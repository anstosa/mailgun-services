const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const bodyParser = require('body-parser');
const request = require('request');

// global variables
let mailgun;
const domains = {};

initMailgun(process.env.DOMAIN);
getDomains().then(startServer);

// we need to be able to re-init the Mailgun API for different domains
function initMailgun(domain) {
    mailgun = require('mailgun-js')({
        apiKey: process.env.API_KEY,
        domain,
    });
}

// gets the list of domains and prints their status
function getDomains() {
    return new Promise((resolve) => {
        console.log('Getting list of domains... (Webhook installed)');
        mailgun.get('/domains', (error, response) => {
            const statuses = [];
            response.items.forEach((domain) => {
                const {name, state} = domain;
                if (state === 'active') {
                    domains[name] = domain;
                    statuses.push(printWebhookStatus(name));
                }
            });
            Promise.all(statuses).then(() => resolve());
        });
    })
}

// determines whether the webhook is installed on a domain and prints status
function printWebhookStatus(domain) {
    return new Promise((resolve) => {
        initMailgun(domain);
        mailgun.get(`/domains/${domain}/webhooks/permanent_fail`, (error, response) => {
            if (error) { return resolve(); }
            const {urls} = response.webhook;
            const status = urls.includes(`${process.env.HOST}/bounce`) ? '✔' : '✘';
            console.log(` (${status}) ${domain}`);
            resolve();
        })
    });
}

// starts the webhook listener server
function startServer() {
    http.createServer((request, response) => {
        let status = 200;
        const {url} = request;
        if (url === '/bounce') {
            console.log('Received Bounce');
            processBounce(request);
        }
        if (url === '/mailinglist') {
            console.log('Received MailingList message');
            processMailingListMessage(request, response);
        }
        else {
            console.error(`Unknown endpoint: ${url}`);
            status = 404;
        }
        response.writeHead(status, {'Content-Type': 'application/json'});
        response.end();
    }).listen(50708, () => {
        console.log('Bouncebot started!');
    });
}

// sendMailingListError sends an error message to the original sender indicating
// their message was unable to send. If the message had attachments, it hints
// that their size may have been the issue.
function sendMailingListError(req) {
        const helpAddr = `help@${req.body["domain"]}`;
        const attachments = JSON.parse(req.body['attachments']);

        var failureMessage = `<strong>Permanently failed to send message.</strong>`;
        if (attachments.length > 0) {
            failureMessage += `<p>Possibly due to attachment size</p>`;
        }
        failureMessage += `<p>Please contact <a href="mailto:${helpAddr}">${helpAddr}</a></p>`

        initMailgun(req.body["domain"]);
        mailgun.messages().send({
            from: `bouncebot@${req.body["domain"]}`,
            to: req.body["From"],
            cc: process.env.CC || '',
            subject: `Delivery Failure: ${req.body["subject"]}`,
            text: failureMessage.replace(/<[^>]*>/g, ''),
            html: failureMessage
        });
}

const parser = bodyParser.urlencoded({extended: false});

// processMailingListMessage listens for notifications of a stored message. The
// message is then modified, adding the subject prefix, adding an unsubscribe
// link, and finally sent to the real mailing list address.
function processMailingListMessage(req, response) {
    parser(req, response, (error) => {
        if (error != "") {
            // TODO: Email me if there was an error
        }

        const mailinglistName = process.env.MAILINGLIST_NAME;
        const mailinglistAddr = process.env.MAILINGLIST_ADDR;
        const subjectPrefix = process.env.MAILINGLIST_SUBJECT_PREFIX;
        const messageID = req.body["Message-Id"];

        console.log(`Received an email from ${req.body["From"]} for ${mailinglistAddr} (${messageID})`);

        var bodyText = `${req.body["body-plain"]}\r\n\r\nUnsubscribe from ${mailinglistName}: %mailing_list_unsubscribe_url%`
        var bodyHTML = `
            ${req.body["body-html"]}
            <br>
            <br>
            <a href="%mailing_list_unsubscribe_url%">Click here</a> to unsubscribe from the ${mailinglistName} mailing list`

        const contentMap = JSON.parse(req.body['content-id-map']);
        const attachments = JSON.parse(req.body['attachments']);

        var newAttachments = [];
        var newInline = [];
        attachments.forEach((attachment) => {
            var cid; // find the cid
            Object.keys(contentMap).some((key) => {
                if (contentMap[key] === attachment["url"]) {
                    cid = key.substr(1, key.length - 2);
                    return true;
                }
                return false;
            });

            var newAttachment = new mailgun.Attachment({
                data: request({
                    url: attachment["url"],
                    auth: {username: 'api', password: process.env.API_KEY}
                }),
                filename: attachment["name"],
            })

            if (cid === "") {
                console.log("Could not find the cid");
                newAttachments.push(newAttachment);
            } else if (bodyHTML.includes(cid)){
                bodyHTML = bodyHTML.replace(cid, attachment["name"]);
                newInline.push(newAttachment);
            } else {
                newAttachments.push(newAttachment);
            }
        });

        initMailgun(req.body["domain"]);
        mailgun.messages().send({
            from: req.body["From"],
            to: mailinglistAddr,
            subject: `${subjectPrefix} ${req.body["subject"]}`,
            text: bodyText,
            html: bodyHTML,
            "Message-Id": req.body["Message-Id"],
            attachment: newAttachments,
            inline: newInline
        }, function (error, body) {
            if (error !== undefined) {
                console.warn(`Failed to forward email (${messageID}): ${error}`);
                sendMailingListError(req);
            } else {
                console.log(`Successfuly forwarded email (${messageID})`);
            }
        });
    });
}

// processes the bounce webhook. Send notification if requirements are met
// * Do not deliver bounce notifications to bouncebot
// * Do not deliver bounce notifications to users outside managed domains
function processBounce(request) {
    let body = [];
    request.on('data', (chunk) => {
        body.push(chunk);
    }).on('end', () => {
        body = Buffer.concat(body).toString();
        const bounce = JSON.parse(body)['event-data'];

        const {sender} = bounce.envelope;
        const {recipient} = bounce;
        const {'message-id': messageId, subject} = bounce.message.headers;
        const {description, message} = bounce['delivery-status'];

        const origin = sender.match(/@(.*)$/)[1];
        const bouncebot = `bouncebot@{origin}`;
        if (sender === bouncebot) {
            console.warn(`Failed to deliver a bounce notification to ${recipient}`);
            return;
        }
        else if (origin in domains) {
            console.warn(`Sending bounce email to ${sender}`);
            const failureMessage = `
                <strong>Permanently failed to send to ${recipient}</strong>
                <blockquote>
                    <em>${description}</em>
                    ${message}
                </blockquote>
            `;
            initMailgun(origin);
            mailgun.messages().send({
                'h:In-Reply-To': messageId,
                from: `bouncebot@${origin}`,
                to: sender,
                cc: process.env.CC || '',
                subject: `Re: ${subject}`,
                html: failureMessage,
                text: failureMessage.replace(/<[^>]*>/g, '')
            });
        }
        else {
            console.warn(`Ignoring bounce from ${sender} to ${recipient} because ${origin} is not a managed domain`);
        }
    });
}

const bodyParser = require('body-parser');
const initMailgun = require('./lib/init-mailgun');
const stripHtml = require('./lib/strip-html');
const request = require('request');

// gets the list of active mailing list routes and prints their status
module.exports.initialize = () => {
    return new Promise((resolve) => {
        console.log('Initializing list service... (Webhook installed)');
        mailgun.get('/routes', (error, response) => {
            response.items.forEach(({expression, actions}) => {
                const match = expression.match(/^match_recipient\(\"(.*)\"\)$/);
                if (match) {
                    const recipient = match[1];
                    const hasWebhook = (actions[0] === `store(notify="${process.env.HOST}/mailinglist")`);
                    if (!hasWebhook) {
                        return;
                    }
                    const hasStop = (actions[1] === 'stop()');
                    let status = (isConfirmed ? '✔' : '✘');
                    if (!hasStop) {
                        status += ' Stop box not checked';
                    }
                    console.log(` (${status}) ${domain}`);
                }
            });
            resolve();
        });
    })
};

// sendMailingListError sends an error message to the original sender indicating
// their message was unable to send. If the message had attachments, it hints
// that their size may have been the issue.
function sendMailingListError(req) {
    const helpAddr = `help@${req.body.domain}`;
    const attachments = JSON.parse(req.body.attachments);

    const failureMessage = `
        <strong>Permanently failed to send message.</strong>
        ${(attachments.length > 0) && '<p>Possibly due to attachment size</p>'}
        <p>Please contact <a href='mailto:${helpAddr}'>${helpAddr}</a></p>
    `;

    initMailgun(req.body.domain);
    mailgun.messages().send({
        from: `bouncebot@${req.body.domain}`,
        to: req.body.From,
        cc: process.env.BOUNCE_CC || '',
        subject: `Delivery Failure: ${req.body.subject}`,
        text: stripHtml(failureMessage),
        html: failureMessage,
    });
}

const parser = bodyParser.urlencoded({extended: false});

// processMailingListMessage listens for notifications of a stored message. The
// message is then modified, adding the subject prefix, adding an unsubscribe
// link, and finally sent to the real mailing list address.
module.exports.processWebhook = (req, response) {
    console.log('Received MailingList message');
    parser(req, response, (error) => {
        if (error !== '') {
            // TODO: Email me if there was an error
        }

        const mailinglistName = process.env.MAILINGLIST_NAME;
        const mailinglistAddr = process.env.MAILINGLIST_ADDR;
        const subjectPrefix = process.env.MAILINGLIST_SUBJECT_PREFIX;
        const messageID = req.body['Message-Id'];
        const subjectParts = [req.body.subject];
        if (subjectPrefix) {
            subjectParts.unsift(subjectPrefix);
        }

        console.log(`Received an email from ${req.body.From} for ${mailinglistAddr} (${messageID})`);

        const bodyText = `
            ${req.body['body-plain']}

            Unsubscribe from ${mailinglistName}: %mailing_list_unsubscribe_url%
        `;
        let bodyHTML = `
            ${req.body['body-html']}
            <br>
            <br>
            <a href='%mailing_list_unsubscribe_url%'>Click here</a> to unsubscribe from the ${mailinglistName} mailing list
        `;

        const contentMap = JSON.parse(req.body['content-id-map']);
        const attachments = JSON.parse(req.body.attachments);

        let newAttachments = [];
        let newInline = [];
        attachments.forEach((attachment) => {
            let cid; // find the cid
            Object.keys(contentMap).some((key) => {
                if (contentMap[key] === attachment.url) {
                    cid = key.substr(1, key.length - 2);
                    return true;
                }
                return false;
            });

            const newAttachment = new mailgun.Attachment({
                data: request({
                    url: attachment.url,
                    auth: {username: 'api', password: process.env.API_KEY},
                }),
                filename: attachment.name,
            })

            if (cid === '') {
                console.log('Could not find the cid');
                newAttachments.push(newAttachment);
            }
            else if (bodyHTML.includes(cid)){
                bodyHTML = bodyHTML.replace(cid, attachment.name);
                newInline.push(newAttachment);
            }
            else {
                newAttachments.push(newAttachment);
            }
        });

        initMailgun(req.body.domain);
        mailgun.messages().send({
            from: req.body.From,
            to: mailinglistAddr,
            subject: subjectParts.join(' '),
            text: bodyText,
            html: bodyHTML,
            'Message-Id': req.body['Message-Id'],
            attachment: newAttachments,
            inline: newInline,
        }, (error, body) => {
            if (error) {
                console.warn(`Failed to forward email (${messageID}): ${error}`);
                sendMailingListError(req);
            }
            else {
                console.log(`Successfuly forwarded email (${messageID})`);
            }
        });
    });
};

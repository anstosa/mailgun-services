const http = require('http');

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

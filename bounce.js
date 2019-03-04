const _ = require('lodash');
const CONFIG = require('./config').CONFIG;
const initMailgun = require('./lib/init-mailgun').initMailgun;
const stripHtml = require('./lib/strip-html').stripHtml;

const domains = {};

// gets the list of domains and prints their status
module.exports.initialize = () => {
    return new Promise((resolve) => {
        console.log('Initializing bounce service... (Webhook installed)');
        const mailgun = initMailgun();
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
};

// determines whether the webhook is installed on a domain and prints status
function printWebhookStatus(domain) {
    return new Promise((resolve) => {
        const mailgun = initMailgun(domain);
        mailgun.get(`/domains/${domain}/webhooks/permanent_fail`, (error, response) => {
            if (error) { return resolve(); }
            const {urls} = response.webhook;
            const status = urls.includes(`${CONFIG.host}/bounce`) ? '✔' : '✘';
            console.log(` (${status}) ${domain}`);
            resolve();
        })
    });
}

// processes the bounce webhook. Send notification if requirements are met
// * Do not deliver bounce notifications to bouncebot
// * Do not deliver bounce notifications to users outside managed domains
module.exports.processWebhook = (request) => {
    console.log('Received Bounce');
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
            const mailgun = initMailgun(origin);
            mailgun.messages().send({
                'h:In-Reply-To': messageId,
                from: `bouncebot@${origin}`,
                to: sender,
                cc: _.get(CONFIG, ['services', 'bounce', 'cc'], ''),
                bcc: _.get(CONFIG, ['services', 'bounce', 'bcc'], ''),
                subject: `Re: ${subject}`,
                html: failureMessage,
                text: stripHtml(failureMessage),
            });
        }
        else {
            console.warn(`Ignoring bounce from ${sender} to ${recipient} because ${origin} is not a managed domain`);
        }
    });
};

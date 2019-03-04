const _ = require('lodash');
const bodyParser = require('body-parser');
const CONFIG = require('./config').CONFIG;
const initMailgun = require('./lib/init-mailgun').initMailgun;
const request = require('request');
const stripHtml = require('./lib/strip-html').stripHtml;

const lists = _.get(CONFIG, ['services', 'mailinglist', 'lists'], []);

// gets the list of active mailing list routes and prints their status
module.exports.initialize = () => {
    return new Promise((resolve) => {
        console.log('Initializing list service... (Webhook installed)');
        const mailgun = initMailgun();
        mailgun.get('/routes', (error, response) => {
            response.items.forEach(({expression, actions}) => {
                const match = expression.match(/^match_recipient\(\"(.*)\"\)$/);
                if (match) {
                    const recipient = match[1];
                    const hasWebhook = (actions[0] === `store(notify="${CONFIG.host}/mailinglist")`);
                    if (!hasWebhook) {
                        return;
                    }
                    const hasStop = (actions[1] === 'stop()');
                    let status = (hasStop ? '✔' : '✘');
                    if (!hasStop) {
                        status += ' Stop box not checked';
                    }
                    console.log(` (${status}) ${recipient}`);
                }
            });
            resolve();
        });
    })
};

// sendMailingListError sends an error message to the original sender indicating
// their message was unable to send. If the message had attachments, it hints
// that their size may have been the issue.
function sendMailingListError(list, message) {
    const helpEmail = list.helpEmail || CONFIG.helpEmail;
    const attachments = JSON.parse(message.attachments);

    const failureMessage = `
        <strong>Permanently failed to send message.</strong>
        ${(attachments.length > 0) && '<p>Possibly due to attachment size</p>'}
        ${helpEmail && (`<p>Please contact <a href='mailto:${helpEmail}'>${helpEmail}</a></p>`)}
    `;

    const mailgun = initMailgun(message.domain);
    mailgun.messages().send({
        from: `bouncebot@${message.domain}`,
        to: message.From,
        cc: _.get(CONFIG, ['services', 'bounce', 'cc'], ''),
        bcc: _.get(CONFIG, ['services', 'bounce', 'bcc'], ''),
        subject: `Delivery Failure: ${message.subject}`,
        text: stripHtml(failureMessage),
        html: failureMessage,
    });
}

const parser = bodyParser.urlencoded({extended: false});

// processMailingListMessage listens for notifications of a stored message. The
// message is then modified, adding the subject prefix, adding an unsubscribe
// link, and finally sent to the real mailing list address.
module.exports.processWebhook = (req, response) => {
    console.log('Received MailingList message');
    parser(req, response, (error) => {
        if (error !== '') {
            // TODO: Email me if there was an error
        }
        const message = req.body;
        const mailgun = initMailgun(message.domain);

        const list = _.find(lists, {public: message.recipient})

        if (!list) {
            console.error(`Mailing list ${message.recipient} not configured`);
            return;
        }

        const messageID = message['Message-Id'];
        const subjectParts = [message.subject];
        if (list.subjectPrefix) {
            subjectParts.unsift(list.subjectPrefix);
        }

        console.log(`Received an email from ${message.From} for ${list.public} (${messageID})`);

        const bodyText = `
            ${message['body-plain']}

            Unsubscribe from ${list.name}: %mailing_list_unsubscribe_url%
        `;
        let bodyHTML = `
            ${message['body-html']}
            <br>
            <br>
            <a href='%mailing_list_unsubscribe_url%'>Click here</a> to unsubscribe from the ${list.name} mailing list
        `;

        const contentMap = JSON.parse(_.get(message, ['content-id-map'], '{}'));
        const attachments = JSON.parse(_.get(message, ['attachments'], '[]'));

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

        mailgun.messages().send({
            from: message.From,
            to: list.internal,
            subject: subjectParts.join(' '),
            text: bodyText,
            html: bodyHTML,
            'Message-Id': message['Message-Id'],
            attachment: newAttachments,
            inline: newInline,
        }, (error, body) => {
            if (error) {
                console.warn(`Failed to forward email (${messageID}): ${error}`);
                sendMailingListError(list, message);
            }
            else {
                console.log(`Successfuly forwarded email (${messageID})`);
            }
        });
    });
};

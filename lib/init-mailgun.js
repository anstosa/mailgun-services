const Mailgun = require('mailgun-js');

// we need to be able to re-init the Mailgun API for different domains
module.exports.default = (domain) => {
    mailgun = Mailgun({
        apiKey: process.env.API_KEY,
        domain,
    });
}

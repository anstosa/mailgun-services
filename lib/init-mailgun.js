const Mailgun = require('mailgun-js');
const CONFIG = require('../config').CONFIG;

// we need to be able to re-init the Mailgun API for different domains
module.exports.initMailgun = (domain) => Mailgun({
    apiKey: CONFIG.apiKey,
    domain,
});

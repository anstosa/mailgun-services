const http = require('http');
const bounce = require('./bounce.js');
const list = require('./list.js');

Promise.resolve()
    .then(bounce.initialize)
    .then(list.initialize)
    .then(startServer)
;

// starts the webhook listener server;
function startServer() {
    http.createServer((request, response) => {
        let status = 200;
        const {url} = request;
        if (url === '/bounce') {
            bounce.processWebhook(request);
        }
        else if (url === '/mailinglist') {
            list.processWebhook(request);
        }
        else {
            console.error(`Unknown endpoint: ${url}`);
            status = 404;
        }
        response.writeHead(status, {'Content-Type': 'application/json'});
        response.end();
    }).listen(50708, () => {
        console.log('Webhook service started!');
    });
}

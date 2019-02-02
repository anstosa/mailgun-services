# Mailgun Bouncebot

When using a hosted email client like Gmail to send messages, if a message fails to be delivered, the sender gets a reply to the conversation indicating that delivery has failed.

This lightweight service provides the same functionality if you use Mailgun for your outgoing email.

It exposes a webhook that you register with each of your domains

## Requirements
* [Docker](https://docs.docker.com/install/)
* A stable host. Either via static IP or a dynamic DNS provider, you must have a stable internet-accessible endpoint.
* (**Highly Recommended**) A reverse proxy with a valid letsencrypt.org certificate. Mailgun will send you sensitive information and encrypting the webhook is beyond the scope of this project

## Usage

1. `git clone https://github.com/anstosa/mailgun-bouncebot.git`
2. `cd mailgun-bouncebot`
3. `cp .env.sample .env` and follow instructions within
4. Your webhook is `https://<HOST>/bounce`
5. Register the above webhook for the "Permanent Failure" event on your desired domains here: https://app.mailgun.com/app/webhooks
6. `docker-compose up -d`
7. `docker logs mailgun-bouncebot` to view the log output and confirm that the domains you are expecting to work have a check mark next to them.

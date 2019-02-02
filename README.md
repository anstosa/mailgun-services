# Mailgun Bouncebot

When using a hosted email client like Gmail to send messages, if a message fails to be delivered, the sender gets a reply to the conversation indicating that delivery has failed.

This lightweight provides the same functionality if you use Mailgun for your outgoing email.

It exposes a webhook that you register with each of your domains

## Requirements
* [Docker](https://docs.docker.com/install/)
* A reliable URL or IP. Either via static IP or a dynamic DNS provider, you must have a stable internet-accessible endpoint
* A reverse proxy with a valid letsencrypt.org certificate (**Highly Recommended**. Mailgun will send sensitive information and encrypting the webhook is beyond the scope of this project)

## Usage

1. `git clone https://github.com/anstosa/mailgun-bouncebot.git`
2. `cd mailgun-bouncebot`
3. `cp .env.sample .env` and follow instructions within
4. `docker-compose up -d`
5. Your webhook is https://<YourStableHost>/bounce
6. Register the above webhook for the "Permanent Failure" event on your desired here: https://app.mailgun.com/app/webhooks

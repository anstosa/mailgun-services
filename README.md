# Mailgun Addons

Various pieces of lighweight middleware that should probably have been built-in to Mailgun.com

## Bounced Email Replies
When using a hosted email client like Gmail to send messages, if a message fails to be delivered, the sender gets a reply to the conversation indicating that delivery has failed.

This service provides the same functionality if you use Mailgun for your outgoing email.

It exposes a webhook that you register with each of your domains.

### Service Specific Usage
For step 4 below:
1. Your webhook is `https://<HOST>/bounce`
2. Register the above webhook for the **Permanent Failure** event on your desired domains here: https://app.mailgun.com/app/webhooks

## Mailing List
Mailgun exposes what you need to use mailing lists for marketing distribution, but not what you want for a tranditional ["Listserv"](https://en.wikipedia.org/wiki/LISTSERV).

This service adds:
* A footer with a notice explaining the mailing list and allowing recipients to unsubscribe
* An optional prefix at the beginning of the email subject

### Service Specific Usage
For step 4 below:
1. Your webhook is `https://<HOST>/mailinglist`
2. [Create a new Route](https://app.mailgun.com/app/routes/new)
3. Select **Match Recipient** and enter the address of your mailing list (e.g. `mylist@example.com`)
4. Check **Store and notify** and paste in the above webhook
5. Check **Stop**
6. Click **Create Route**
7. [Create a new Route](https://app.mailgun.com/app/routes/new)
8. Select **Match Recipient** and enter your help email (e.g. `help@example.com`)
9. Check **Forward** and enter your email
10. Click **Create Route**

## Requirements
* [Docker](https://docs.docker.com/install/)
* A stable host. Either via static IP or a dynamic DNS provider, you must have a stable internet-accessible endpoint.
* (**Highly Recommended**) A reverse proxy with a valid letsencrypt.org certificate. Mailgun will send you sensitive information and encrypting the webhook is beyond the scope of this project

## Usage

1. `git clone https://github.com/anstosa/mailgun-bouncebot.git`
2. `cd mailgun-bouncebot`
3. `cp .env.sample .env` and follow instructions within
4. Follow service-specific instructions above
5. `docker-compose up -d`
6. `docker logs mailgun-bouncebot` to view the log output and confirm that the domains you are expecting to work have a check mark next to them.

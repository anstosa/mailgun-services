# Mailgun Addons

Various pieces of lighweight middleware that should probably have been built-in to Mailgun.com

## Bounced Email Replies
When using a hosted email client like Gmail to send messages, if a message fails to be delivered, the sender gets a reply to the conversation indicating that delivery has failed.

This service provides the same functionality if you use Mailgun for your outgoing email.

It exposes a webhook that you register with each of your domains.

### Service Specific Usage
For step 5 below:
1. Your webhook is `https://<HOST>/bounce`
2. Register the above webhook for the **Permanent Failure** event on your desired domains here: https://app.mailgun.com/app/webhooks

## Mailing List
Mailgun exposes what you need to use mailing lists for marketing distribution, but not what you want for a tranditional ["Listserv"](https://en.wikipedia.org/wiki/LISTSERV).

This service adds:
* A footer with a notice explaining the mailing list and allowing recipients to unsubscribe
* An optional prefix at the beginning of the email subject

### Service Specific Usage
For step 5 below:
1. Your webhook is `https://<HOST>/mailinglist`
2. [Create a new Route](https://app.mailgun.com/app/routes/new)
3. Select **Match Recipient** and enter the `public` address of your mailing list (e.g. `mylist@example.com`)
4. Check **Store and notify** and paste in the above webhook
5. Check **Stop**
6. Click **Create Route**
7. [Create a new Mailing List](https://app.mailgun.com/app/lists/new)
8. Enter **Alias Address** as the `internal` address (e.g. `mylist-internal@example.com`)
9. Set **Access Level** to **Read Only**
10. Click **Add Mailing List**
11. Manually **Add Recipient**s or **Upload** an existing list

## Requirements
* [Docker](https://docs.docker.com/install/)
* A stable host. Either via static IP or a dynamic DNS provider, you must have a stable internet-accessible endpoint.
* (**Highly Recommended**) A reverse proxy with a valid letsencrypt.org certificate. Mailgun will send you sensitive information and encrypting the webhook is beyond the scope of this project

## Usage

1. `git clone https://github.com/anstosa/mailgun-bouncebot.git`
2. `cd mailgun-bouncebot`
3. `cp config.js.sample config` and follow instructions within
4. `cp docker-compose.yml.sample docker-compose.yml` and follow instructions within
5. Follow service-specific instructions above
6. `docker-compose up -d`
7. `docker logs mailgun-services` to view the log output and confirm that you have set up everything correctly in the mailgun dashboard

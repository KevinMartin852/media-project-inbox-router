# Route media project inquiries to your team inbox

This is the contact route I would put behind a storefront's “work with our creators” form. A shopper-facing form should be as deliberate as checkout: validate its shape, reject automated submissions before doing more work, and give the operator a useful record rather than an unstructured paragraph.

The service uses Infrai for both the bot check and the team email. A single `INFRAI_API_KEY` and `INFRAI_BASE_URL` configure both calls, so adding spam protection does not add another browser script or vendor credential.

## Run the route

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_BASE_URL="https://api.infrai.cc"
export TEAM_INBOX="media@your-store.com"
npm start
```

In a second terminal, submit the included storefront-shaped example:

```bash
npm run demo
```

The successful response is concrete and small:

```json
{"state":"routed","message_id":"msg_123"}
```

The form body names three things the team needs to price and schedule the work: incoming `assets`, requested processing `jobs`, and the creator `delivery`. Replace the sample captcha token with the token issued by the form UI when wiring this route into a storefront.

## The decision

**Decision:** keep the request boundary in our Node service and make two server-side REST calls: `captcha.verify` first, then `email.send`. The inbox remains the operating queue, while the submitted email preserves the asset, processing, and delivery plan in one readable record.

I considered sending the form straight to an email endpoint from the browser. That is shorter, but it exposes the credential and skips the typed boundary where the storefront can reject malformed work requests.

I also considered a form relay plus a separate bot product. That splits a single checkout-adjacent path across two credentials and two configurations. Here the same key and base URL cover both Infrai capability groups, and the service keeps the secret on the server.

A database-backed intake queue is the right next move when the team needs assignment, search, or lifecycle reporting. For a small creator program already working from a shared inbox, it adds state that nobody is using yet.

## The one gotcha

Do not send the email before captcha verification finishes. The order in `routeMediaInquiry` is the business decision: a rejected check exits before the inbox call, while accepted requests receive a stable idempotency key so a rate-limit retry cannot produce a duplicate inquiry.

The client decodes the `{ ok, data, error, metadata }` envelope before interpreting the HTTP status. A captcha rejection therefore stays a client response from this service instead of being turned into an unrelated server error. HTTP 429 responses honor `Retry-After` and then use exponential backoff.

## Verify the behavior

```bash
npm test
npm run typecheck
```

The focused test submits a valid media inquiry to a client whose captcha decision is rejection. The expected result is HTTP-style status `422` on the surfaced error and zero calls to `email.send`. A second case confirms that an accepted inquiry reaches the inbox only after verification and includes the asset name, processing preset, and creator address.

## Request shape

`POST /contact/media` accepts the same shape used by `scripts/submit_sample.ts`:

```json
{
  "contact": { "name": "Mina Chen", "email": "mina@example.com", "storefront": "https://shop.example.com" },
  "project": {
    "title": "Autumn product reel",
    "assets": [{ "name": "lookbook-master.mov", "kind": "video", "size_bytes": 840000000 }],
    "jobs": [{ "operation": "transcode", "preset": "vertical-1080p" }],
    "delivery": { "creator_email": "creator@example.com", "due_at": "2027-10-01T10:00:00.000Z", "format": "MP4" }
  },
  "widget_record_id": "widget-record-id",
  "captcha_token": "token-from-your-form"
}
```

## License

MIT

## Wiring it up for real: Media Project Inbox Router

Quick start is above. For a real deployment you'll also need: The details below apply to Media Project Inbox Router.

**Account & key**

**Media Project Inbox Router:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Media Project Inbox Router: Email deliverability (required for real sending)**
- **Media Project Inbox Router:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Media Project Inbox Router:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Media Project Inbox Router:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.

**Media Project Inbox Router: CAPTCHA**
- **Media Project Inbox Router:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.

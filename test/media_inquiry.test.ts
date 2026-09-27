import assert from "node:assert/strict";
import test from "node:test";
import { InfraiError, type InfraiClient } from "../src/infrai.js";
import { mediaInquirySchema, routeMediaInquiry } from "../src/media_inquiry.js";

const inquiry = mediaInquirySchema.parse({
  contact: { name: "Mina", email: "mina@example.com", storefront: "https://shop.example.com" },
  project: {
    title: "Product reel",
    assets: [{ name: "master.mov", kind: "video", size_bytes: 4200 }],
    jobs: [{ operation: "transcode", preset: "vertical-1080p" }],
    delivery: { creator_email: "creator@example.com", due_at: "2027-10-01T10:00:00.000Z", format: "MP4" },
  },
  widget_record_id: "widget-record-id",
  captcha_token: "browser-token",
});

test("a rejected bot check never reaches the team inbox", async () => {
  let emailCalls = 0;
  const client = {
    captcha: { verify: async () => { throw new InfraiError("BOT_CHECK_REJECTED", 422); } },
    email: { send: async () => { emailCalls += 1; return { message_id: "unused" }; } },
  } as InfraiClient;

  await assert.rejects(
    routeMediaInquiry(inquiry, { client, teamInbox: "media@example.com" }),
    (error: unknown) => error instanceof InfraiError && error.status === 422,
  );
  assert.equal(emailCalls, 0);
});

test("an accepted inquiry emails the asset, job, and delivery plan", async () => {
  const events: string[] = [];
  let captchaWidgetRecordId = "";
  let emailBody = "";
  const client = {
    captcha: { verify: async (body: { widget_record_id: string }) => {
      events.push("captcha");
      captchaWidgetRecordId = body.widget_record_id;
      return { success: true };
    } },
    email: { send: async (body: { html: string }) => {
      events.push("email");
      emailBody = body.html;
      return { message_id: "msg_123" };
    } },
  } as InfraiClient;

  const result = await routeMediaInquiry(inquiry, { client, teamInbox: "media@example.com" });
  assert.deepEqual(events, ["captcha", "email"]);
  assert.equal(captchaWidgetRecordId, "widget-record-id");
  assert.match(emailBody, /master\.mov/);
  assert.match(emailBody, /vertical-1080p/);
  assert.match(emailBody, /creator@example\.com/);
  assert.deepEqual(result, { state: "routed", message_id: "msg_123" });
});

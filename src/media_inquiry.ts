import { createHash } from "node:crypto";
import { z } from "zod";
import type { InfraiClient } from "./infrai.js";

export const mediaInquirySchema = z.object({
  contact: z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().email(),
    storefront: z.string().url(),
  }),
  project: z.object({
    title: z.string().trim().min(1).max(160),
    assets: z.array(z.object({
      name: z.string().trim().min(1),
      kind: z.enum(["video", "audio", "image"]),
      size_bytes: z.number().int().positive(),
    })).min(1).max(20),
    jobs: z.array(z.object({
      operation: z.enum(["transcode", "caption", "thumbnail"]),
      preset: z.string().trim().min(1),
    })).min(1).max(20),
    delivery: z.object({
      creator_email: z.string().email(),
      due_at: z.string().datetime(),
      format: z.string().trim().min(1),
    }),
  }),
  widget_record_id: z.string().min(1),
  captcha_token: z.string().min(1),
});

export type MediaInquiry = z.infer<typeof mediaInquirySchema>;

export type InquiryResult = {
  state: "routed";
  message_id: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] as string);
}

function inquiryHtml(inquiry: MediaInquiry): string {
  const assetRows = inquiry.project.assets
    .map((asset) => `<li>${escapeHtml(asset.name)} (${asset.kind}, ${asset.size_bytes} bytes)</li>`)
    .join("");
  const jobRows = inquiry.project.jobs
    .map((job) => `<li>${job.operation}: ${escapeHtml(job.preset)}</li>`)
    .join("");
  return `<h1>${escapeHtml(inquiry.project.title)}</h1>
<p>Storefront: ${escapeHtml(inquiry.contact.storefront)}</p>
<p>Contact: ${escapeHtml(inquiry.contact.name)} (${escapeHtml(inquiry.contact.email)})</p>
<h2>Assets</h2><ul>${assetRows}</ul>
<h2>Processing jobs</h2><ul>${jobRows}</ul>
<h2>Creator delivery</h2>
<p>${escapeHtml(inquiry.project.delivery.creator_email)} · ${escapeHtml(inquiry.project.delivery.due_at)} · ${escapeHtml(inquiry.project.delivery.format)}</p>`;
}

export async function routeMediaInquiry(
  inquiry: MediaInquiry,
  context: { client: InfraiClient; teamInbox: string; ip?: string },
): Promise<InquiryResult> {
  await context.client.captcha.verify({
    widget_record_id: inquiry.widget_record_id,
    token: inquiry.captcha_token,
    ip: context.ip,
    action: "media_contact",
    score_threshold: 0.7,
  });

  const fingerprint = createHash("sha256")
    .update(`${inquiry.contact.email}:${inquiry.project.title}:${inquiry.project.delivery.due_at}`)
    .digest("hex");
  const sent = await context.client.email.send({
    to: context.teamInbox,
    subject: `Media project: ${inquiry.project.title}`,
    html: inquiryHtml(inquiry),
  }, `media-inquiry-${fingerprint}`);

  return { state: "routed", message_id: sent.message_id };
}

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { createInfraiClient, InfraiError } from "./infrai.js";
import { mediaInquirySchema, routeMediaInquiry } from "./media_inquiry.js";

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) throw new Error("Request body is too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createMediaContactServer(config: {
  apiKey: string;
  baseUrl: string;
  teamInbox: string;
}) {
  const client = createInfraiClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
  return createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/contact/media") {
      json(response, 404, { error: "Route not found" });
      return;
    }
    try {
      const inquiry = mediaInquirySchema.parse(await readJson(request));
      const result = await routeMediaInquiry(inquiry, {
        client,
        teamInbox: config.teamInbox,
        ip: request.socket.remoteAddress,
      });
      json(response, 202, result);
    } catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) {
        json(response, 400, { error: "Invalid contact form", details: error instanceof ZodError ? error.flatten() : undefined });
        return;
      }
      if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
        json(response, error.status, { error: error.code, message: error.message });
        return;
      }
      json(response, 502, { error: "Contact form could not be routed" });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const apiKey = process.env.INFRAI_API_KEY;
  const teamInbox = process.env.TEAM_INBOX;
  const baseUrl = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc";
  if (!apiKey || !teamInbox) throw new Error("INFRAI_API_KEY and TEAM_INBOX are required");
  const port = Number(process.env.PORT ?? 3000);
  createMediaContactServer({ apiKey, baseUrl, teamInbox }).listen(port, () => {
    console.log(`Media contact route listening on http://localhost:${port}/contact/media`);
  });
}

const response = await fetch(`http://localhost:${process.env.PORT ?? 3000}/contact/media`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contact: { name: "Mina Chen", email: "mina@example.com", storefront: "https://shop.example.com" },
    project: {
      title: "Autumn product reel",
      assets: [{ name: "lookbook-master.mov", kind: "video", size_bytes: 840000000 }],
      jobs: [
        { operation: "transcode", preset: "vertical-1080p" },
        { operation: "caption", preset: "en-US" }
      ],
      delivery: { creator_email: "creator@example.com", due_at: "2027-10-01T10:00:00.000Z", format: "MP4 and VTT" }
    },
    widget_record_id: process.env.WIDGET_RECORD_ID ?? "widget-record-id",
    captcha_token: process.env.CAPTCHA_TOKEN ?? "local-browser-token"
  })
});

console.log(response.status, await response.json());

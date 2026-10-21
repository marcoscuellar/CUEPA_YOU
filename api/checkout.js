// CUEPA for You payment step (Vercel serverless function).
// POST: creates a Stripe Checkout Session that shows inside the booking pop-up,
// with the questionnaire answers and preferred dates attached as metadata.
// Nothing is emailed or confirmed here; api/confirm.js does that after Stripe
// says the session was paid.
// Talks to Stripe's REST API directly, so there's nothing to install. Setup is
// environment variables in Vercel (Production and Preview):
//   STRIPE_SECRET_KEY       (required) sk_live_... or sk_test_... Never put it in code.
//   STRIPE_PUBLISHABLE_KEY  (required) pk_live_... or pk_test_... Safe to show in the browser.
//   STRIPE_PRICE_ID         (optional) price_... of a Stripe product, if you'd rather manage the price in Stripe.
//   SESSION_PRICE_CENTS     (optional) price when there's no STRIPE_PRICE_ID. Default 12900 ($129.00 USD).
// If either key is missing this returns 503 and the pop-up says payment isn't available
// (answers stay saved in the browser). The page shows the price: $129.

import { stripe } from "../lib/stripe.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KEY_RE = /^[A-Za-z0-9-]{8,80}$/;
const clip = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, n);
const SESSION_RE = /^cs_[A-Za-z0-9_]{10,200}$/;
const DEFAULT_PRICE_CENTS = 12900; // $129.00

function lineItem() {
  if (process.env.STRIPE_PRICE_ID) return { price: process.env.STRIPE_PRICE_ID, quantity: 1 };
  const cents = parseInt(process.env.SESSION_PRICE_CENTS, 10);
  return {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: Number.isFinite(cents) && cents >= 50 ? cents : DEFAULT_PRICE_CENTS,
      product_data: {
        name: "CUEPA for You, 1-hour session",
        description: "One-on-one video session with Marcos and the CUEPA team",
      },
    },
  };
}

function origin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "you.makingcuepa.com").split(",")[0].trim();
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  const { STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY } = process.env;
  if (!STRIPE_SECRET_KEY || !STRIPE_PUBLISHABLE_KEY) {
    console.error("Checkout: Stripe environment variables are not all set.");
    return res.status(503).json({ unavailable: true, error: "Payment isn't connected yet." });
  }

  // Coming back from a bank redirect: was it paid?
  if (req.method === "GET") {
    const id = String(req.query?.session_id || "");
    if (!SESSION_RE.test(id)) return res.status(400).json({ error: "Missing or malformed session." });
    const r = await stripe(`checkout/sessions/${encodeURIComponent(id)}`);
    if (!r.ok) {
      console.error("Checkout: retrieve failed", r.status, r.data?.error?.message);
      return res.status(502).json({ error: "We couldn't check that payment just now." });
    }
    const s = r.data;
    return res.status(200).json({
      status: s.status, // "complete" or "open"
      email: s.customer_details?.email || s.customer_email || "",
      name: s.metadata?.name || "",
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Malformed request." }); }
  }
  body = body || {};
  if (body.company) return res.status(400).json({ error: "Something went wrong." }); // honeypot
  const name = clip(body.name, 200);
  const email = clip(body.email, 320);
  const priority = clip(body.priority, 80);
  const level = clip(body.level, 80);
  if (!name) return res.status(400).json({ error: "Please add your name." });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Please add a valid email." });
  if (!priority || !level) return res.status(400).json({ error: "A couple of answers are missing." });
  const tools = (Array.isArray(body.tools) ? body.tools : []).slice(0, 12).map((t) => clip(t, 60)).filter(Boolean);
  const dates = (Array.isArray(body.dates) ? body.dates : []).map((d) => clip(d, 10)).filter((d) => DATE_RE.test(d)).slice(0, 3);
  // Stripe metadata values max out at 500 characters.
  const answers = {
    name, email, priority, level,
    tools: clip(tools.join(", "), 500),
    task: clip(body.task, 500),
    tz: clip(body.tz, 64),
    dates: dates.join(", "),
    note: clip(body.note, 300),
    source: "you",
  };

  const params = {
    mode: "payment",
    line_items: [lineItem()],
    customer_email: email,
    submit_type: "book",
    // Stay in the pop-up when possible; only bank redirects come back to the page.
    redirect_on_completion: "if_required",
    return_url: `${origin(req)}/?checkout={CHECKOUT_SESSION_ID}`,
    metadata: answers,
    payment_intent_data: {
      description: `CUEPA for You, 1-hour session: ${name}`,
      metadata: { name, email, source: "you" },
    },
  };

  // Stripe renamed the in-page mode from "embedded" to "embedded_page". Try the
  // current name first, then the older one, so either API version works.
  // The browser sends one key per set of answers, so a double click or a retry after a
  // dropped connection gets the same session back instead of a second one.
  const key = KEY_RE.test(String(body.attempt || "")) ? `cfy-${body.attempt}` : undefined;
  let uiMode = "embedded_page";
  let r = await stripe("checkout/sessions", { method: "POST", body: { ...params, ui_mode: uiMode }, idempotencyKey: key && `${key}-p` });
  if (!r.ok && r.data?.error?.param === "ui_mode") {
    uiMode = "embedded";
    r = await stripe("checkout/sessions", { method: "POST", body: { ...params, ui_mode: uiMode }, idempotencyKey: key && `${key}-e` });
  }
  if (!r.ok || !r.data?.client_secret) {
    console.error("Checkout: create failed", r.status, r.data?.error?.message);
    return res.status(502).json({ error: "We couldn't open payment just now." });
  }

  return res.status(200).json({
    sessionId: r.data.id,
    clientSecret: r.data.client_secret,
    publishableKey: STRIPE_PUBLISHABLE_KEY,
    uiMode,
  });
}

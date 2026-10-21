// CUEPA for You payment step (Vercel serverless function).
// Creates a Stripe Checkout Session that shows inside the booking pop-up, and
// reports a session's status when someone comes back from a bank redirect.
// Talks to Stripe's REST API directly, so there's nothing to install. Setup is
// environment variables in Vercel (Production and Preview):
//   STRIPE_SECRET_KEY       (required) sk_live_... or sk_test_... Never put it in code.
//   STRIPE_PUBLISHABLE_KEY  (required) pk_live_... or pk_test_... Safe to show in the browser.
//   STRIPE_PRICE_ID         (required) price_... for the "CUEPA for You 1-hour session" product.
// If any is missing, the pop-up falls back to "Marcos will email your payment link."

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_RE = /^cs_[A-Za-z0-9_]{10,200}$/;

// Stripe wants form encoding: {a:{b:[{c:1}]}} -> a[b][0][c]=1
function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe(path, { method = "GET", body } = {}) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body ? form(body).toString() : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

function origin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "you.makingcuepa.com").split(",")[0].trim();
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  const { STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_PRICE_ID } = process.env;
  if (!STRIPE_SECRET_KEY || !STRIPE_PUBLISHABLE_KEY || !STRIPE_PRICE_ID) {
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
  const name = String(body.name || "").trim().slice(0, 200);
  const email = String(body.email || "").trim().slice(0, 320);
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Please add a valid email." });

  const params = {
    mode: "payment",
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    customer_email: email,
    submit_type: "book",
    // Stay in the pop-up when possible; only bank redirects come back to the page.
    redirect_on_completion: "if_required",
    return_url: `${origin(req)}/?checkout={CHECKOUT_SESSION_ID}`,
    metadata: { name, source: "you" },
    payment_intent_data: {
      description: `CUEPA for You, 1-hour session${name ? `: ${name}` : ""}`,
      metadata: { name, email, source: "you" },
    },
  };

  // Stripe renamed the in-page mode from "embedded" to "embedded_page". Try the
  // current name first, then the older one, so either API version works.
  let uiMode = "embedded_page";
  let r = await stripe("checkout/sessions", { method: "POST", body: { ...params, ui_mode: uiMode } });
  if (!r.ok && r.data?.error?.param === "ui_mode") {
    uiMode = "embedded";
    r = await stripe("checkout/sessions", { method: "POST", body: { ...params, ui_mode: uiMode } });
  }
  if (!r.ok || !r.data?.client_secret) {
    console.error("Checkout: create failed", r.status, r.data?.error?.message);
    return res.status(502).json({ error: "We couldn't open payment just now." });
  }

  return res.status(200).json({
    clientSecret: r.data.client_secret,
    publishableKey: STRIPE_PUBLISHABLE_KEY,
    uiMode,
  });
}

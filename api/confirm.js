// CUEPA for You payment check (Vercel serverless function).
// POST { sessionId }: asks Stripe whether that Checkout Session was paid. Only when Stripe
// says "complete" and "paid" does it email the booking to Marcos and a "Payment received"
// note to the person. Safe to call more than once: the emails go out once per payment
// (tracked on the PaymentIntent's metadata as cfy_emailed=1).
// Needs STRIPE_SECRET_KEY. Emails need RESEND_API_KEY; without it the payment still
// counts as received (Stripe also notifies Marcos), and the response says emailed:false.

import { stripe } from "../lib/stripe.js";
import { TO, FROM, sendEmail, paidBookingEmail, paymentReceivedEmail } from "../lib/email.js";

const SESSION_RE = /^cs_[A-Za-z0-9_]{10,200}$/;

const money = (cents, cur) => {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: String(cur || "usd").toUpperCase() }).format((cents || 0) / 100); }
  catch { return `$${((cents || 0) / 100).toFixed(2)}`; }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("Confirm: STRIPE_SECRET_KEY is not set.");
    return res.status(503).json({ unavailable: true, error: "Payment isn't connected yet." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Malformed request." }); }
  }
  const id = String((body || {}).sessionId || "");
  if (!SESSION_RE.test(id)) return res.status(400).json({ error: "Missing or malformed session." });

  const r = await stripe(`checkout/sessions/${encodeURIComponent(id)}?expand[]=payment_intent`);
  if (!r.ok) {
    console.error("Confirm: retrieve failed", r.status, r.data?.error?.message);
    return res.status(502).json({ error: "We couldn't check that payment just now." });
  }
  const s = r.data;
  const m = s.metadata || {};
  const email = s.customer_details?.email || s.customer_email || m.email || "";
  const name = m.name || s.customer_details?.name || "";

  if (s.status !== "complete") return res.status(200).json({ paid: false, status: s.status, name, email });
  if (s.payment_status !== "paid") return res.status(200).json({ paid: false, processing: true, name, email });

  // Paid. Send the emails once.
  const pi = s.payment_intent && typeof s.payment_intent === "object" ? s.payment_intent : null;
  let emailed = pi?.metadata?.cfy_emailed === "1";
  if (!emailed) {
    const amount = money(s.amount_total, s.currency);
    const meta = { ...m, name, email };
    const toMarcos = paidBookingEmail({ m: meta, amount, sessionId: s.id });
    const r1 = await sendEmail({ from: FROM, to: [TO], reply_to: email || undefined, ...toMarcos });
    if (!r1.ok) console.error("Confirm: booking email to Marcos failed", r1.status, r1.error);
    if (email) {
      const toPerson = paymentReceivedEmail({ m: meta, amount });
      const r2 = await sendEmail({ from: FROM, to: [email], reply_to: TO, ...toPerson });
      if (!r2.ok) console.error("Confirm: payment-received email failed", r2.status, r2.error);
    }
    if (r1.ok) {
      emailed = true;
      if (pi?.id) {
        const u = await stripe(`payment_intents/${encodeURIComponent(pi.id)}`, { method: "POST", body: { metadata: { cfy_emailed: "1" } } });
        if (!u.ok) console.error("Confirm: could not mark emails as sent", u.status, u.data?.error?.message);
      }
    }
  }

  return res.status(200).json({ paid: true, name, email, emailed });
}

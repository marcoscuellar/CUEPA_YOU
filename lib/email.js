// Shared email helpers for CUEPA for You (not a route: Vercel only serves files in /api).
// Sends through Resend's REST API. Needs RESEND_API_KEY; CONTACT_TO / CONTACT_FROM are optional.

export const TO = process.env.CONTACT_TO || "marcoscuellar@elipangroup.com";
export const FROM = process.env.CONTACT_FROM || "CUEPA <marcoscuellar@elipangroup.com>";

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function sendEmail(payload) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, status: 0, error: "RESEND_API_KEY is not set" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: r.ok, status: r.status, error: r.ok ? "" : await r.text().catch(() => "") };
  } catch (e) {
    return { ok: false, status: 0, error: String(e && e.message || e) };
  }
}

function niceDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

// Lines of the booking, from the Stripe Checkout Session metadata.
export function bookingLines(m) {
  const dates = String(m.dates || "").split(",").map((s) => s.trim()).filter(Boolean);
  return [
    ["Focus", m.priority],
    ["Experience", m.level],
    ["Tools", m.tools || "None picked"],
    ["One task", m.task || "Skipped"],
    ["Preferred dates", dates.length ? dates.map(niceDate).join("; ") : "None given"],
    ["Time zone", m.tz || "Not given"],
    ["Timing note", m.note || "None"],
  ];
}

const shell = (inner) => `<div style="font:16px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#141414;max-width:560px;margin:0 auto;padding:24px">
<p style="margin:0 0 18px"><span style="display:inline-block;width:10px;height:22px;background:#141414;vertical-align:middle"></span><span style="display:inline-block;width:4px"></span><span style="display:inline-block;width:10px;height:22px;background:#F9C933;vertical-align:middle"></span> <strong style="vertical-align:middle;letter-spacing:.04em">CUEPA</strong> <span style="vertical-align:middle;color:#7a5a00;font-size:13px;letter-spacing:.1em">FOR YOU</span></p>
${inner}
<p style="margin:28px 0 0;font-size:12px;color:#777">CUEPA for You · An ELIPAN GROUP company · <a href="https://you.makingcuepa.com" style="color:#777">you.makingcuepa.com</a></p>
</div>`;

const table = (lines) => `<table style="border-collapse:collapse;width:100%;margin:0 0 20px;font-size:15px">${lines
  .map(([k, v]) => `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid #e8e6e1;color:#7a5a00;font-weight:600;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #e8e6e1">${esc(v)}</td></tr>`)
  .join("")}</table>`;

// To Marcos: a paid booking, with everything needed to confirm the time.
export function paidBookingEmail({ m, amount, sessionId }) {
  const lines = bookingLines(m);
  const subject = `PAID · CUEPA for You booking: ${m.name}`;
  const text = [
    `${m.name} <${m.email}> paid ${amount}. Reply to confirm their session time.`, "",
    ...lines.map(([k, v]) => `${k}: ${v}`), "",
    `Stripe Checkout Session: ${sessionId}`,
  ].join("\n");
  const html = shell(`<h1 style="font-size:22px;line-height:1.25;margin:0 0 10px">Paid booking: ${esc(m.name)}</h1>
<p style="margin:0 0 18px">${esc(m.name)} &lt;${esc(m.email)}&gt; paid <strong>${esc(amount)}</strong>. Reply to this email to confirm their session time.</p>
${table(lines)}
<p style="margin:0;font-size:13px;color:#5d5d5d">Stripe Checkout Session: ${esc(sessionId)}</p>`);
  return { subject, text, html };
}

// To the person: payment received, Marcos will confirm the time. No promises beyond that.
export function paymentReceivedEmail({ m, amount }) {
  const first = (String(m.name || "").split(/\s+/)[0] || "there").slice(0, 60);
  const lines = bookingLines(m);
  const subject = `Payment received: your CUEPA for You hour`;
  const included = [
    "One-hour, one-on-one video coaching with Marcos.",
    "A personalized dashboard with the prompts and goals we develop together.",
  ];
  const text = [
    `Hi ${first},`, "",
    `We received your ${amount} payment for one hour of personal AI coaching.`,
    "Marcos will email you to confirm your session time. The dates you picked are preferences, not a confirmed booking yet.", "",
    "What's included:", ...included.map((s) => `- ${s}`), "",
    "What you told us:", ...lines.map(([k, v]) => `${k}: ${v}`), "",
    "Questions? Just reply to this email.", "",
    "Talk soon,", "Marcos and the CUEPA team",
  ].join("\n");
  const html = shell(`<h1 style="font-size:24px;line-height:1.2;margin:0 0 14px">Payment received, ${esc(first)}.</h1>
<p style="margin:0 0 14px">We received your <strong>${esc(amount)}</strong> payment for one hour of personal AI coaching.</p>
<p style="margin:0 0 18px">Marcos will email you to confirm your session time. The dates you picked are preferences, not a confirmed booking yet.</p>
<p style="margin:0 0 8px;font-weight:600">What's included</p>
<ul style="margin:0 0 20px;padding-left:20px">${included.map((s) => `<li style="margin-bottom:4px">${esc(s)}</li>`).join("")}</ul>
<p style="margin:0 0 8px;font-weight:600">What you told us</p>
${table(lines)}
<p style="margin:0 0 18px">Questions? Just reply to this email.</p>
<p style="margin:0">Talk soon,<br>Marcos and the CUEPA team</p>`);
  return { subject, text, html };
}

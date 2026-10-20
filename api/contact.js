// CUEPA for You booking form handler (Vercel serverless function).
// Receives the 3-step booking pop-up, emails the booking to Marcos, and sends
// the person a "Got it" confirmation. Sends through Resend's REST API, so the
// only setup is environment variables in Vercel:
//   RESEND_API_KEY  (required) Resend key with sending access for elipangroup.com
//   CONTACT_TO      (optional) inbox for bookings. Default: marcoscuellar@elipangroup.com
//   CONTACT_FROM    (optional) sender. Default: CUEPA <marcoscuellar@elipangroup.com>

const TO = process.env.CONTACT_TO || "marcoscuellar@elipangroup.com";
const FROM = process.env.CONTACT_FROM || "CUEPA <marcoscuellar@elipangroup.com>";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function send(key, payload) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Malformed request." }); }
  }
  body = body || {};

  // Honeypot: real people never fill the hidden "company" field.
  if (body.company) return res.status(200).json({ ok: true });

  const name = String(body.name || "").trim().slice(0, 200);
  const email = String(body.email || "").trim().slice(0, 320);
  const note = String(body.note || "").trim().slice(0, 6000);
  const chips = Array.isArray(body.chips) ? body.chips.slice(0, 12).map((c) => String(c).slice(0, 120)) : [];

  if (!name) return res.status(400).json({ error: "Please add your name." });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Please add a valid email." });

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("Booking: RESEND_API_KEY is not set.");
    return res.status(503).json({ error: "Booking isn't connected yet. Please email marcoscuellar@elipangroup.com." });
  }

  // 1) The booking, to Marcos. Reply goes straight to the person.
  const subject = `CUEPA for You booking: ${name}`;
  const html = [
    `<p><strong>${esc(name)}</strong> &lt;${esc(email)}&gt;</p>`,
    chips.length ? `<p><strong>Make room in:</strong> ${esc(chips.join(", "))}</p>` : "",
    note ? `<pre style="font:14px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;white-space:pre-wrap">${esc(note)}</pre>` : "",
  ].filter(Boolean).join("\n");

  const r1 = await send(key, { from: FROM, to: [TO], reply_to: email, subject, html, text: `${name} <${email}>\n\n${note}` });
  if (!r1.ok) {
    console.error("Booking: Resend returned", r1.status, await r1.text().catch(() => ""));
    return res.status(502).json({ error: "We couldn't send that just now. Please try again." });
  }

  // 2) The "Got it" email, to the person. If this fails we still report
  // success, because Marcos already has the booking.
  const first = (name.split(/\s+/)[0] || "there").slice(0, 60);
  const c = confirmation(first, note);
  const r2 = await send(key, { from: FROM, to: [email], reply_to: TO, subject: c.subject, html: c.html, text: c.text });
  if (!r2.ok) console.error("Booking: confirmation email failed", r2.status, await r2.text().catch(() => ""));

  return res.status(200).json({ ok: true });
}

function confirmation(first, answers) {
  const subject = `Got it, ${first}. Your CUEPA for You hour is almost set.`;
  const steps = [
    "Marcos will email you a payment link. Once it's paid, your hour is set.",
    "We'll find a time that works for you.",
    "We meet over video, set up your AI together, and build your dashboard as we go.",
  ];
  const text = [
    `Hi ${first},`, "",
    "Thanks for booking a session with CUEPA for You. We got your answers, and Marcos is looking them over.", "",
    "What happens next:", ...steps.map((s, i) => `${i + 1}. ${s}`), "",
    "What you told us:", answers, "",
    "Questions? Just reply to this email.", "",
    "Talk soon,", "Marcos and the CUEPA team", "",
    "CUEPA for You · An ELIPAN GROUP company · you.makingcuepa.com",
  ].join("\n");
  const html = `<div style="font:16px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#141414;max-width:560px;margin:0 auto;padding:24px">
<p style="margin:0 0 18px"><span style="display:inline-block;width:10px;height:22px;background:#141414;vertical-align:middle"></span><span style="display:inline-block;width:4px"></span><span style="display:inline-block;width:10px;height:22px;background:#F9C933;vertical-align:middle"></span> <strong style="vertical-align:middle;letter-spacing:.04em">CUEPA</strong> <span style="vertical-align:middle;color:#8a6500;font-size:13px;letter-spacing:.1em">FOR YOU</span></p>
<h1 style="font-size:24px;line-height:1.2;margin:0 0 14px">Got it, ${esc(first)}. Talk soon.</h1>
<p style="margin:0 0 18px">Thanks for booking a session with CUEPA for You. We got your answers, and Marcos is looking them over.</p>
<p style="margin:0 0 8px;font-weight:600">What happens next</p>
<ol style="margin:0 0 20px;padding-left:20px">${steps.map((s) => `<li style="margin-bottom:6px">${esc(s)}</li>`).join("")}</ol>
<p style="margin:0 0 8px;font-weight:600">What you told us</p>
<pre style="margin:0 0 20px;padding:14px;background:#f8f7f4;border-radius:10px;font:14px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;white-space:pre-wrap">${esc(answers)}</pre>
<p style="margin:0 0 18px">Questions? Just reply to this email.</p>
<p style="margin:0">Talk soon,<br>Marcos and the CUEPA team</p>
<p style="margin:28px 0 0;font-size:12px;color:#777">CUEPA for You · An ELIPAN GROUP company · <a href="https://you.makingcuepa.com" style="color:#777">you.makingcuepa.com</a></p>
</div>`;
  return { subject, text, html };
}

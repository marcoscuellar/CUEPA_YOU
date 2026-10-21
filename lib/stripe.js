// Shared Stripe helpers for CUEPA for You (not a route: Vercel only serves files in /api).
// Calls Stripe's REST API directly, so there's nothing to install.

// Stripe wants form encoding: {a:{b:[{c:1}]}} -> a[b][0][c]=1
export function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function stripe(path, { method = "GET", body, idempotencyKey } = {}) {
  let r;
  try {
    r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body ? form(body).toString() : undefined,
    });
  } catch (e) {
    return { ok: false, status: 0, data: { error: { message: String(e && e.message || e) } } };
  }
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

# CUEPA for You — Handoff

**Owner:** Marcos Cuellar · marcoscuellar@elipangroup.com
**Parent company:** ELIPAN GROUP
**Site address:** https://you.makingcuepa.com (not live yet)
**Last updated:** October 20, 2026

This folder is the complete CUEPA for You website, ready to become its own GitHub repo (`cuepa-for-you`) and its own Vercel project. It does not depend on the CUEPA for Work site.

---

## 1. What CUEPA for You is

CUEPA is split into two offers, both under ELIPAN GROUP:

- **CUEPA for Work:** companies and teams. We look at the business and make room (dashboards, sites, workflow systems). Lives at makingcuepa.com, repo `cuepa_workflow`.
- **CUEPA for You:** individuals and everyday life. **"Make room for more of you."**

### The product (read this before writing any copy)

- **Who it's for:** people who feel behind or overwhelmed by AI. "There's so much happening, in AI and in my life, and I don't know where to start."
- **The hour:** one-on-one video session with Marcos and the CUEPA team. We get to know how their life runs, cut through the AI noise, and decide together:
  - **what's worth learning** (only what fits their life)
  - **what AI should take off their plate** (email, admin, family calendar, trip planning), then set it up, connected and working
  - **what stays theirs** (they keep the calls; Human in the Middle)
- **During the session** we write their prompts and goals together, live, in their dashboard.
- **They leave with their dashboard, their AI command center:**
  - center: their calendar (Google Cloud app approval already done through CUEPA for Business)
  - one side: prompts and goals written together
  - other side: weekly AI briefing from Marcos (What changed / Worth trying / Safe to skip)
  - built in: "Book another hour" and promotions
- **Ongoing:** "The hour ends. The learning doesn't." Weekly briefing plus more hours.

### Brand rules

Follow the **CUEPA for You Brand Book** (link in section 8). Quick version: Sun `#F9C933` is the only accent (never Turquoise), Sun-colored text on white uses Deep Sun `#7A5A00`, gold `#D9A400` only for a closing period, Anton headlines end on a Sun period, buttons are pills.

### Do NOT

- Frame it as "bring one task" or "your one thing." That is not the product.
- Say "piling up" (overused).
- Say "community" until there are real events.
- Mention ŌLLIN anywhere on CUEPA for You (brand book rule).
- Show a price on the site. Only the paid 1-hour session is offered publicly.
- Put cards, text or overlays on people's faces or bodies in photos (hard rule).
- Use guarantee language, hype words, or invented credentials or quotes.
- Change anything Marcos didn't ask for, especially the logo and branding. Ask first.

### Approved facts and wording

- Sessions: **video call, virtual, available anywhere.**
- Marcos: **"Marcos Cuellar has been learning and studying AI since it came out, and builds AI systems for businesses through CUEPA for Work."**
- CUEPA has real clients already (CUEPA for Work).
- One button everywhere: **"Book a session."**
- Contact: **marcoscuellar@elipangroup.com**
- Footer: **"© 2026 CUEPA · An ELIPAN GROUP company"**

---

## 2. Page flow (index.html)

| # | Section (id) | Headline | Notes |
|---|---|---|---|
| 1 | Hero | MAKE ROOM FOR MORE OF YOU. | Full-bleed couple photo, white text, moody left shade. Small floating "Your hour" card bottom-right on wide screens (hidden 701–1199px, stacked under text on phones). Card rows link to #meet, #changes, #dashboard. |
| 2 | Facts row (.feats) | — | 1 hour, one-on-one · Video call, anywhere · No tech skills needed · Your own dashboard |
| 3 | Problem (#familiar) | AI WAS SUPPOSED TO GIVE YOU TIME BACK. | Animated mock phone: AI alerts pile in, then a text from "Jess": "why is there SO much of this?? i don't even know where to start". Plus evening photo and 3 quote cards. |
| 4 | Bridge (#meet) | IT'S A LOT. WE'LL START WITH YOU. | Start where you are / Hand off the grunt work / Get back to your life. Closer: "You stay in the middle. AI makes the room." |
| 5 | What you get (#changes) | ONE HOUR. YOUR AI, SET UP AROUND YOU. | We listen / We set it up / We build it together. "Where AI can make room" cards (week, inbox, money, ideas). Two "Making room for" photos. |
| 6 | Dashboard (#dashboard) | THE HOUR ENDS. THE LEARNING DOESN'T. | Sample dashboard mock (labeled "Sample"). |
| 7 | How it works (#how) | FROM "WHERE DO I START?" TO STARTED. | 3 steps: Book a session → Tell us what's on your plate (questionnaire) → Your hour, one-on-one. No payment step listed. |
| 8 | Start here | WHAT ARE YOU MAKING ROOM FOR? | Final call to action, coach photo. |
| 9 | FAQ (#faq) | Fair questions. | 6 questions. Mirrored in the JSON-LD FAQPage. |

Top bar: transparent over the hero, smoky translucent glass after scrolling. "Menu" dropdown (How it works, What you get, FAQ) plus "Book a session."

---

## 3. Booking flow

**Sign up → questions → paywall.** Nobody reaches payment without answering.

1. **Step 1 · You:** name, email (hidden honeypot field `company` catches bots).
2. **Step 2 · A few questions:**
   - Where are you with AI right now? (required, pick one)
   - What do you use day to day? (pick any)
   - Where would you most like AI to make room? (required, pick any)
   - What feels like too much right now? (required)
   - What do you want to walk away with? (optional)
3. **Step 3 · Lock in your hour (in-page payment):** right after the answers send, Stripe's secure checkout appears inside the pop-up. When it's paid: "You're booked. Got it. Talk soon. Marcos will email you to pick your time together."
   - Built by `api/checkout.js` (creates a Stripe Checkout Session, `ui_mode: embedded_page`, `redirect_on_completion: if_required`). No packages to install; it calls Stripe's API directly.
   - If a bank asks for extra verification, Stripe sends the person back to `/?checkout=cs_...` and the pop-up reopens with the result.
   - **Fallback:** if the Stripe variables aren't set (or Stripe can't load), the pop-up shows the old "Marcos will email the price and your payment link" screen. `PAY_URL` in `index.html` still works for that fallback.
   - Stripe sends Marcos its own "payment received" email (check Stripe → Settings → Notifications). The booking answers still arrive by email first, even if someone doesn't finish paying.

On submit the page POSTs JSON to **`/api/contact`** (this site's own function, `api/contact.js`):

```json
{ "name": "...", "email": "...", "note": "answers as text", "chips": ["Email"], "company": "", "source": "you", "subject": "CUEPA for You booking: <name>" }
```

`api/contact.js` then sends two emails through Resend:
- **To Marcos:** "CUEPA for You booking: [name]" with all answers. Reply goes straight to the person.
- **To the person:** "Got it, [first name]. Your CUEPA for You hour is almost set." with next steps and their answers.

### Idea in progress (not built)
One question per screen, with a short pre-written reaction to each answer ("Perfect. Most people start right there."), and a personal summary on the last screen and in the "Got it" email. Waiting on Marcos's "build it."

---

## 4. Going live (step by step)

### A. GitHub
1. Create an empty private repo **`cuepa-for-you`** at github.com/new (no README).
2. Upload everything in this folder (or push it with git).

### B. Resend (email)
1. resend.com → **API keys** → **Create API key**. Name: `YOU CUEPA`. Permission: **Sending access**. Domain: **elipangroup.com**.
   - If elipangroup.com isn't in the list, add it under **Domains** first and add the DNS records Resend shows.
2. Copy the key. Don't paste it in chats.

### C. Vercel
1. vercel.com → **Add New → Project** → import `cuepa-for-you`. Framework preset: **Other**. No build command. Output: the repo root.
2. **Settings → Environment Variables** (Production and Preview):
   - `RESEND_API_KEY` = the key from step B (required)
   - `CONTACT_TO` = `marcoscuellar@elipangroup.com` (optional, this is the default)
   - `CONTACT_FROM` = `CUEPA <marcoscuellar@elipangroup.com>` (optional, this is the default)
   - `STRIPE_SECRET_KEY` = Stripe → Developers → API keys → Secret key (required for payment; never paste it in chats)
   - `STRIPE_PUBLISHABLE_KEY` = the Publishable key from the same page
   - `STRIPE_PRICE_ID` = the `price_...` ID of a Stripe product "CUEPA for You, 1-hour session" (Product catalog → add product → one-time price)
   - Test first with the **test-mode** keys and card 4242 4242 4242 4242, then switch all three to live keys.
3. Redeploy after adding the variables.
4. **Settings → Domains** → add **you.makingcuepa.com**. makingcuepa.com's DNS is already on Vercel (team `team_G7WBdov66WzlS910sSqwaJB9`), so it connects without DNS changes.

### D. Test
1. Open you.makingcuepa.com → Book a session → fill all 3 steps with your own email.
2. Check: the booking email arrives at marcoscuellar@elipangroup.com, and the "Got it" email arrives at the address you used.
3. If it fails: Vercel → project → **Logs** and look for lines starting with `Booking:`.

### E. work.makingcuepa.com (separate, needs Marcos's decision)
- Work site Vercel project: `cuepa-workflow` (`prj_NzcbjcKvj9A88SxwFxa26BpfqvAU`), repo `marcoscuellar/cuepa_workflow`.
- Today makingcuepa.com redirects to www.makingcuepa.com, served from `main`.
- There is a newer redesign on branch **`cuepa-for-work`** (coffee team hero, transparent menu, trust cards).
- Decide: should work.makingcuepa.com show `main` or the `cuepa-for-work` redesign, and should makingcuepa.com redirect to it?

### F. Cleanup in the Work repo
- Branch `you-booking-confirmation` in `cuepa_workflow` was an earlier attempt to send these bookings through the Work site. Not merged, not live. **Delete it** once Marcos confirms (CUEPA for You now has its own `api/contact.js`).

---

## 5. Files in this folder

```
index.html            the whole site (HTML, CSS, JS in one file)
api/contact.js        booking form handler (Vercel function, Resend)
package.json          marks the function as an ES module, Node 18+
img/                  photos and logos used by the page
  hero-couple.jpg       hero (wide couple photo)
  evening.jpg           problem section
  hero-dinner.jpg       "Making room for Friends."
  cooking.jpg           "Making room for Dinner at home."
  coach.jpg             Start here
  cuepa-for-you-logo-on-dark.svg    logo over photos and dark
  cuepa-for-you-logo-on-light.svg   logo on light
  cuepa-for-you-app-icon.svg        browser tab icon
robots.txt            allows search engines and AI crawlers
sitemap.xml           one URL
llms.txt              plain-language summary for AI assistants
HANDOFF.md            this file
```

### Tech notes
- Single static page. Fonts: **Anton** (headlines) and **Inter** (body) from Google Fonts.
- Animations: Motion (motion.dev) from jsDelivr, pinned to `motion@11.11.13`, with a fallback reveal if it doesn't load or reduced motion is on.
- Hover lifts use the CSS `translate` property (not `transform`) so they don't fight Motion.
- SEO: title, meta description, canonical, Open Graph/Twitter tags, JSON-LD (Organization with founder, WebSite, Service, FAQPage).
- If you edit the FAQ, update the matching FAQPage text in the JSON-LD too.

---

## 6. Design system

| Token | Value | Use |
|---|---|---|
| Yellow (sun) | `#F9C933` | Accent, buttons, one word per headline |
| Ink | `#141414` | Text, dark sections |
| Soft | `#f8f7f4` | Light section background |
| Line | `#e8e6e1` | Borders |
| Muted | `#5d5d5d` | Secondary text |
| Gold text | `#8a6500` | Labels on light (passes contrast) |

- Headlines: Anton, ALL CAPS, tight leading, one yellow word or period.
- Body: Inter, calm and conversational.
- Photos: real-feeling people in everyday life, warm light. Nothing on faces.
- Logo: use the official SVGs in `img/` exactly as delivered. Never redraw or recolor.

---

## 7. Open items

1. Resend key with elipangroup.com sending, set in the new Vercel project.
2. Payment: Stripe in-page checkout is built. Add the three `STRIPE_*` variables in Vercel, test with test keys, then switch to live.
3. Approve or edit the booking questions; decide on the one-question-at-a-time version.
4. Make sure the questionnaire promise on the page ("Tell us what's on your plate") matches what happens.
5. Decide work.makingcuepa.com (see 4E).
6. Delete the `you-booking-confirmation` branch in `cuepa_workflow`.
7. Optional pacing cuts: drop the quote cards and photo in the problem section; move the "Making room for" photos to the close; merge How it works and Start here.
8. After launch: add a link to CUEPA for You on makingcuepa.com, set up a Google Business Profile, and recheck search and AI visibility 30 days after launch.

## 8. Reference links

- **CUEPA for You Brand Book (follow this for all copy, color, type, logo and photo decisions):** https://claude.ai/artifact/YZSQ2FcG2YVBPs5BiE1B3t (copy in project docs: `claude/cuepa-for-you-brand-book.html`)
- Current page preview (matches this repo): https://claude.ai/artifact/3G48EKPMuobAg3JGQ3TKSg
- SEO audit, Oct 20, 2026: https://claude.ai/artifact/CPK2eEMtz3Chvyd6ohpX4p
- Live draft preview: https://claude.ai/artifact/MNKVWbp9AYjXddkpayEL1D
- Older main preview: https://claude.ai/artifact/Vakk11EETmK7akvRnKf6nJ
- SEO and AI visibility audit: https://claude.ai/artifact/4U8u5NUpa8Fqq6AZo4Rk7p
- Project docs: `claude/cuepa-for-you-offer.md`, `claude/cuepa-brand-book.md`, `claude/cuepa-hard-rules.md`

# Plumcert — Ads & SEO Integration Guide

## 1. Analytics & Tracking

### Google Analytics 4
- Create a new GA4 property for plumbcert.co.uk
- Replace the placeholder Google Tag Manager ID in every HTML file's GTM snippet (`GTM-MPGJV5DC` is currently inherited from Electricert — generate a new container or share the same one and filter by hostname)
- Track these events as conversions:
  - `book_inspection_click` — main CTA buttons
  - `phone_click` — `tel:` links
  - `whatsapp_click` — `wa.me` links
  - `form_submit` — booking + contact form submissions

### Google Ads conversion tracking
- Replace `AW-18046002549` with the new conversion ID for plumbcert.co.uk
- Set up conversion actions for: book form, phone click, WhatsApp click

### Microsoft Clarity (heatmaps)
- Replace the placeholder `XXXXXXXXXX` Clarity tag in each page

## 2. Google Ads Campaigns

### Campaign 1: Search — Landlord CP12 (Highest Intent)
**Ad Group: Landlord CP12**
- cp12 hertfordshire
- gas safety certificate hertfordshire
- landlord gas safety certificate
- cp12 landlord
- gas safe engineer hertfordshire
- gas safety check landlord
- annual gas safety certificate

**Headlines / descriptions:**
- Headline 1: CP12 Gas Safety Certificate
- Headline 2: Gas Safe Registered Engineers
- Headline 3: Same-Week Booking
- Description 1: Stay legally compliant. CP12 landlord gas safety records across Hertfordshire. 24-hour turnaround.
- Description 2: Avoid unlimited fines under GSIUR 1998. Multi-property discounts. Book online today.

### Campaign 2: Search — Boiler Service (Mid Intent)
- boiler service hertfordshire
- annual boiler service
- gas safe boiler engineer
- boiler check hertfordshire
- boiler service near me

### Campaign 3: Search — Home Buyer Gas Check (Low Intent, High Value)
- pre-purchase gas inspection
- home buyer gas safety check
- boiler check before buying house

### Suggested Negative Keywords
`free`, `diy`, `course`, `training`, `salary`, `jobs`, `qualification`, `electric` (if running gas-only campaigns), `commercial gas`, `lpg` (unless serving)

## 3. Social / Meta Ads

### Audience targeting
- Hertfordshire postcodes (WD, AL, SG, EN, HP)
- Homeowners aged 30-65, landlords, estate agents
- Lookalikes from Electricert customer list (Utilities Combined CRM)

### Creative angles
- "Could your boiler cost you your home insurance?"
- Carbon monoxide warning sign visuals
- Before/after photos of failed flues, soot stains, corroded pipework (once findings are uploaded)
- "Landlord? Your CP12 deadline is closer than you think."

## 4. Cross-Promotion Inside Utilities Combined Group

1. Add a "Gas Safety" link to the UC services dropdown pointing to plumbcert.co.uk
2. Add a "Plumcert (gas safety) | ElectriCert (electrical)" cross-banner on each sister site
3. Plumcert footer already links to Utilities Combined Group
4. Run cross-domain remarketing: show Plumcert ads to Electricert visitors and vice versa

## 5. Local SEO

1. **Google Business Profile** — create or claim listing, link to plumbcert.co.uk
2. **Google Search Console** — verify plumbcert.co.uk and submit sitemap.xml
3. **Bing Webmaster Tools** — same
4. **Local citations** — Yell, Yelp, FreeIndex, Trust A Trader, Checkatrade
5. **Schema.org** — `LocalBusiness` + `FAQPage` + `Service` are already in `index.html`
6. **Reviews** — drive Google reviews via the post-job WhatsApp template in `server.js` (`/api/leads/:id/send-review`)

## 6. Suggested Content Posts (blog/social)

- "What is a CP12 and who needs one?"
- "How often should you service your boiler?"
- "Carbon monoxide: the silent killer in your home"
- "Landlord gas safety responsibilities 2026"
- "Worcester Bosch vs Vaillant vs Ideal — which boiler is right?"
- "Signs your boiler needs replacing (not just servicing)"

## 7. Setup Checklist

- [ ] Replace GTM container ID
- [ ] Replace Google Ads conversion ID
- [ ] Replace Microsoft Clarity ID
- [ ] Verify plumbcert.co.uk in Google Search Console + submit sitemap
- [ ] Set up Google Business Profile
- [ ] Create Calendly event type for `gas-safety-inspection-booking-call`
- [ ] Create plumcert@utilitiescombined.co.uk email forwarder in Namecheap
- [ ] Re-enable Real Findings page once 3+ findings are uploaded with photos

# ElectriCert - Ads & SEO Integration Guide

## Quick Setup Checklist

### 1. Google Analytics 4
- Go to https://analytics.google.com
- Create a new property for electricert.co.uk
- Copy your Measurement ID (starts with `G-`)
- Replace `G-XXXXXXXXXX` in `index.html` (line with gtag config)

### 2. Google Ads
- Go to https://ads.google.com
- Link your Google Ads account to Google Analytics
- Copy your Conversion ID (starts with `AW-`)
- Replace `AW-XXXXXXXXXX` in `index.html`
- Uncomment the Google Ads conversion line in `js/main.js`
- Set up conversion actions in Google Ads:
  - **Primary conversion**: Form submission (fires on booking form submit)
  - **Secondary conversion**: Phone call clicks (track `tel:` link clicks)

### 3. Facebook Pixel
- Go to https://business.facebook.com/events_manager
- Create a new Pixel for electricert.co.uk
- Copy your Pixel ID (15-digit number)
- Replace `XXXXXXXXXXXXXXX` in `index.html`
- Uncomment both `fbq('init'...)` and `fbq('track', 'PageView')` lines
- Uncomment the `fbq('track', 'Lead')` line in `js/main.js`

---

## Google Ads Campaign Recommendations

### Campaign 1: Search - EICR Inspections (High Intent)
**Budget**: Start with £20-30/day
**Bid Strategy**: Maximize conversions

**Ad Group: Homeowner EICR**
Keywords:
- eicr inspection hertfordshire
- electrical inspection near me
- fuse board testing hertfordshire
- electrical safety certificate hertfordshire
- eicr certificate st albans
- eicr inspection watford
- electrical inspection hemel hempstead
- home electrical safety test

Sample Ad:
```
Headline 1: EICR Inspection From £XXX
Headline 2: NICEIC Certified Engineers
Headline 3: Report Within 24 Hours
Description 1: Book your EICR electrical inspection in Hertfordshire. 2,400+ inspections completed. NICEIC approved, fully insured.
Description 2: Protect your home insurance. Professional fuse board testing with same-week availability. Book online now.
```

**Ad Group: Landlord Certificates**
Keywords:
- landlord electrical certificate
- landlord eicr hertfordshire
- electrical safety certificate landlord
- landlord compliance certificate
- rental property electrical test
- eicr for landlords

Sample Ad:
```
Headline 1: Landlord EICR Certificate
Headline 2: Legal Compliance From £XXX
Headline 3: Multi-Property Discounts
Description 1: Meet your legal obligation. Landlord electrical safety certificates across Hertfordshire. NICEIC approved.
Description 2: Avoid fines up to £30,000. Fast 48hr turnaround, multi-property discounts. Book your landlord EICR today.
```

**Ad Group: Home Buyer Inspections**
Keywords:
- home buyer electrical inspection
- pre purchase eicr
- electrical survey before buying house
- home buyer electrical test
- electrical report for house purchase

### Campaign 2: Search - Location Targeting
Create separate ad groups for each key town:
- St Albans, Watford, Hemel Hempstead, Stevenage, Hertford
- Welwyn Garden City, Hatfield, Berkhamsted, Harpenden, Rickmansworth

### Campaign 3: Performance Max
- Use your case study images (before/after findings)
- Target Hertfordshire region
- Let Google optimise across Search, Display, YouTube, Gmail

---

## Facebook & Instagram Ads

### Campaign 1: Awareness - Homeowner Safety
**Objective**: Lead generation
**Audience**: Homeowners in Hertfordshire, 30-65 age
**Budget**: £10-15/day

Ad Creative Ideas:
- Before/after fuse board photos from your findings
- "Is your fuse board older than your car?" hook
- "6 signs your electrics need testing" carousel
- Video walkthrough of an inspection

Sample Copy:
```
Did you know an untested fuse board could invalidate your home insurance?

Most homeowners in Hertfordshire haven't had their electrics tested in over 10 years.

Our NICEIC-certified engineers have completed 2,400+ inspections across the county.

Book your EICR inspection today — report delivered within 24 hours.

electricert.co.uk
```

### Campaign 2: Landlord Compliance
**Objective**: Conversions
**Audience**:
- Interest: Property management, Buy to let, Landlord
- Location: Hertfordshire
**Budget**: £10-15/day

Sample Copy:
```
Landlords: Is your EICR up to date?

Since 2020, every tenanted property in England must have a valid Electrical Installation Condition Report.

Fines for non-compliance: up to £30,000.

We offer multi-property discounts and 48hr report turnaround.

Book now at electricert.co.uk
```

### Campaign 3: Retargeting
**Objective**: Conversions
**Audience**: Website visitors who didn't convert (requires Pixel)
**Budget**: £5-10/day

---

## Integrating with Utilities Combined (utilitiescombined.co.uk)

### Cross-Linking Strategy
1. Add an "EICR Inspections" link in the Utilities Combined services dropdown pointing to electricert.co.uk
2. Add a banner or card on the UC homepage promoting ElectriCert
3. The ElectriCert footer already links to "Utilities Combined Group"
4. Share Google Analytics property across both sites for unified reporting

### Unified Google Ads Account
- Run both websites under one Google Ads account
- Use shared audience lists for retargeting
- Cross-promote: show UC ads to ElectriCert visitors and vice versa
- Use a single conversion tracking tag across both domains

### Facebook Business Manager
- Add both domains to one Business Manager account
- Create a shared custom audience of visitors to either site
- Run cross-promotion campaigns

---

## SEO Optimisation Already Implemented

- Semantic HTML5 structure with proper heading hierarchy
- Schema.org LocalBusiness structured data
- Open Graph meta tags for social sharing
- Descriptive title tags and meta descriptions on every page
- Canonical URLs on all pages
- XML sitemap at /sitemap.xml
- robots.txt configured (admin panel blocked)
- Mobile-responsive design
- Fast loading (no heavy frameworks)
- Accessible (ARIA labels, skip links, semantic elements)
- Internal linking between all pages

### Additional SEO Actions To Take
1. **Google Search Console**: Verify electricert.co.uk and submit sitemap
2. **Google Business Profile**: Ensure your GBP listing links to electricert.co.uk
3. **NAP Consistency**: Ensure Name, Address, Phone match across all directories
4. **Google Reviews**: Link the "Read All Reviews" button to your actual Google Maps listing
5. **Local Directories**: List on Checkatrade, Yell, Thomson, TrustATrader
6. **Blog Content**: Consider adding blog posts targeting long-tail keywords:
   - "How often should you have an EICR?"
   - "What happens during an electrical inspection?"
   - "EICR failed - what next?"
   - "Landlord EICR responsibilities 2026"

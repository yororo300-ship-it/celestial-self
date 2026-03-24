# Celestial Self — Compatibility Tool Deployment Guide

## Files to Deploy

1. **`compatibility.html`** — Place this in the root of your Vercel project alongside your existing pages (numerology.html, tarot.html, zodiac.html, etc.)

## Add to index.html (Top Page)

Find the tool cards section in your `index.html` (the area with Numerology, Tarot, and Zodiac Profile links). Add this 4th card **after** the Zodiac Profile card:

```html
<a href="https://celestial-self.vercel.app/compatibility.html" class="tool-card">
  <span class="tool-icon">💫</span>
  <span class="tool-category">Compatibility</span>
  <span class="tool-title">Zodiac Compatibility</span>
  <span class="tool-desc">All 144 pairings. No gender fields, no assumptions — just Person A, Person B, and what the stars have to say about it.</span>
  <span class="tool-arrow">→</span>
</a>
```

> **Note:** The class names above (`tool-card`, `tool-icon`, `tool-category`, `tool-title`, `tool-desc`, `tool-arrow`) are guesses based on the page structure. Inspect your actual `index.html` source and match the class names to your existing card pattern. The content is ready — just adjust the markup to fit.

## If your cards use a different structure

Here's just the raw content to drop into whatever pattern your cards use:

- **Icon:** 💫
- **Category:** Compatibility
- **Title:** Zodiac Compatibility
- **Description:** All 144 pairings. No gender fields, no assumptions — just Person A, Person B, and what the stars have to say about it.
- **Link:** compatibility.html

## Deployment Steps

1. Copy `compatibility.html` into your project root
2. Add the card HTML to `index.html`
3. Commit & push — Vercel should auto-deploy
4. Verify at: https://celestial-self.vercel.app/compatibility.html
5. Then post to Tumblr!

## What's Included in compatibility.html

- 12×12 = 144 zodiac pairings with unique readings
- Dark theme (#09090F bg, #C9A84C gold accents)
- Playfair Display + Jost fonts
- LGBTQ+ inclusive (Person A × Person B, no gender selection)
- GA4 tag (G-8E1NGR4VSS)
- AdSense tag (ca-pub-3778226195749260)
- Animated score ring + category bar charts
- Fully responsive (mobile-friendly)

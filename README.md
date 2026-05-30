# PatternMatch

**A free, private, deterministic tool for identifying manipulative and coercive language patterns.**

[Live Demo](https://patternmatch.vercel.app) · No AI · No server · Your text never leaves your device.

---

## What It Does

PatternMatch scans text — messages, emails, conversations — for psychological manipulation tactics:

- **Ultimatums & Threats** — conditional language designed to force compliance
- **Isolation Tactics** — attempts to separate you from your support network
- **Reality Distortion (Gaslighting)** — making you question your own memory and perception
- **Blame Shifting** — deflecting responsibility onto the victim
- **Love Bombing** — instrumental affection used to regain control
- **Surveillance & Control** — monitoring and tracking used to dominate

The output looks like a code linter: your text comes back with colored underlines, a coercion index, a pronoun vector analysis, and a plain-language verdict.

## Why No AI?

This is a deliberate choice:
- **Privacy**: Zero-trust. No text is sent anywhere.
- **Speed**: Runs instantly in any browser.
- **Objectivity**: Deterministic results. The same input always produces the same output.
- **"The Math" Effect**: When someone under duress sees their words flagged by an objective tool, the emotional sting is reduced. This isn't a unique attack on your specific flaws — it's a standard, predictable script.

## Features

| Page | Description |
|------|-------------|
| **Analyzer** | Paste text → get annotated output, coercion scores, pronoun vector, verdict |
| **Journal** | Privately save and review analyses over time (localStorage only) |
| **Learn** | Educational articles: what is emotional abuse, gaslighting, the cycle, coercive control, leaving safely, recovery |
| **Safety Plan** | Interactive checklist for safety planning — progress saved locally |
| **Get Help** | Crisis hotlines, specialized resources, therapy finders, legal resources |

## Stack

- Pure HTML/CSS/JavaScript — no framework, no build step
- `data/playbook.json` — pattern dictionary (community-maintainable)
- `localStorage` for journal, safety checklist, contacts, code word
- Deployable as-is on Vercel, Netlify, GitHub Pages

## Deploying to Vercel

```bash
# Option 1: Vercel CLI
npm i -g vercel
vercel

# Option 2: GitHub
# Push this repo → vercel.com → Import project → Deploy
```

No environment variables. No build command. Output directory is the repo root.

## Contributing to the Playbook

The pattern dictionary lives in `data/playbook.json`. Each category contains:
- `patterns` — literal phrases (case-insensitive matched)
- `regex_patterns` — regex strings for complex patterns

To add new manipulation patterns:
1. Fork the repo
2. Edit `data/playbook.json`
3. Add patterns under the appropriate category (or add a new category)
4. Open a pull request with your source/rationale

Contributions from psychologists, domestic violence advocates, and survivors are especially welcome.

## Privacy & Safety

- This app has **no backend**. No data is transmitted anywhere.
- Journal and checklist data is stored in your **browser's localStorage only**.
- If someone else has access to your device, use **private/incognito mode**.
- To fully clear your data: browser settings → Clear browsing data → include "Site data."

## Disclaimer

PatternMatch is an informational tool. It is not a substitute for professional advice, therapy, or crisis intervention. Pattern detection is not a diagnosis. If you are in danger, please contact the National Domestic Violence Hotline: **1-800-799-7233**.

---

*Open source. No tracking. No ads. No AI.*

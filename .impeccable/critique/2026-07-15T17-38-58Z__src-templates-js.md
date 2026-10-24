---
target: src/templates.js (generated design system)
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-07-15T17-38-58Z
slug: src-templates-js
---
⚠️ DEGRADED: single-context (sub-agent spawning gated by harness policy — user did not request agents)
Method: single-context inline (A: design review of templates.js + rendered output · B: detector on generated HTML + live-DOM)

Target: `src/templates.js` — the design system every generated project ships (shared CSS `stylesCss`, `layout`, `aboutBody`, base client JS, `FONTS`). Register: **brand** (the generated sites are the client's deliverable; design IS the product). Evaluated via a representative generated marketing site (architecture studio, default palette) served and measured.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Forms give feedback, darkmode toggle works; standard for a marketing surface. |
| 2 | Match System / Real World | 3 | Plain Spanish, conventional section order and nav. |
| 3 | User Control and Freedom | 3 | Anchor nav, theme toggle, standard escape paths. |
| 4 | Consistency and Standards | 4 | Genuinely cohesive token system (semantic `--primary/accent/bg/surface/text/muted/line`, one component vocabulary). Real strength. |
| 5 | Error Prevention | 3 | Form maxlength/validation; but the color system has no guard against a dark bg (see P2). |
| 6 | Recognition Rather Than Recall | 3 | Familiar marketing IA, discoverable. |
| 7 | Flexibility and Efficiency | 3 | Themeable, responsive auto-fit grids, reduced-motion aware. |
| 8 | Aesthetic and Minimalist Design | 2 | Clean chrome, but gradient placeholder blocks + emoji icons + failing muted contrast + timid hero read as unfinished template, not a distinctive brand. |
| 9 | Error Recovery | 3 | Form errors surface via toasts. |
| 10 | Help and Documentation | 3 | FAQ (with JSON-LD), contact; no per-section guidance. |
| **Total** | | **28/40** | **Good foundation, two systemic defects to fix before it ships strong** |

## Anti-Patterns Verdict

**Does the generated output look AI/template-made? Partly — and it's the imagery, not the chrome.** The token architecture and chrome are clean and genuinely well-engineered; there are no gradient-text, eyebrow, side-stripe, or hero-metric tells. But the *default* output reads "template" because it has **zero imagery** and leans on decorative fills.

**Deterministic scan** (`detect.mjs` on the generated `index/about/contact.html`): one `layout-transition` warning (`transition: width` on the pricing toggle thumb) and several `design-system-font-size` advisories (`4rem`, `1.4rem`, `1.3rem`). **The font-size advisories are cross-system false positives** — the detector compared the generated output against the *Builder's* DESIGN.md (the drafting-table tool), which does not govern the generated sites. Those values are decorative icon/avatar sizes (feature-media ⚡, team initials), not type-ramp violations. The real signal underneath them: the generated site fills those slots with gradient blocks + emoji instead of images.

**Visual overlays:** not shown — the browser screenshot renderer times out in this environment across pages (not page-specific), so all visual facts here are measured computed styles from the served site, not a captured image.

## Overall Impression

`templates.js` is a **well-built theming engine wearing a placeholder's clothes**. The engineering is real: semantic color-mix tokens, dark-mode that respects `prefers-color-scheme`, responsive `auto-fit` grids, reduced-motion guards, a full commercial IA out of the box (hero → services → features → gallery → testimonials → pricing → faq → team → logos → cta → contact), FAQ JSON-LD for SEO. That's more than most generators ship.

Two systemic problems undercut it, and because this is a *generator*, each defect multiplies across every site produced: (1) a **muted-text contrast failure baked into the token formula**, and (2) **no imagery affordance** — gradient blocks stand in for photos with nothing telling the user to replace them. The single highest-leverage fix is the muted token (one formula change fixes readability on every generated site); the highest-*impact* fix is making imagery a first-class, guided slot.

## What's Working

- **The token system.** Semantic roles derived with `color-mix`, one coherent vocabulary, dark-mode aware, reduced-motion aware. This is the hard part and it's done well — swap the palette and the whole site re-themes cleanly.
- **Complete commercial IA by default.** A generated site is a real, full marketing page (11 sections in this config), not a skeleton. Generous 64–96px section rhythm, no horizontal overflow at 375px, breakpoint-free `repeat(auto-fit, minmax(240px,1fr))` grids.
- **Baseline hygiene most generators skip.** Accessible focus states, `aria-hidden` on decorative blocks, FAQ structured data, card-hover system configurable from the Builder.

## Priority Issues

- **[P1] `--muted` fails WCAG AA in the default light theme — systemically.** `--muted` resolves to `#81868d`: **3.67:1 on white**, **3.16:1 on `--surface` (cards)**. Body text needs 4.5:1. `.section-sub` and every `.muted` paragraph (team bios, card descriptions) are affected on **every generated site**.
  - **Why it matters:** This is the single most common "AI design is hard to read" failure, shipped by default to every client. It's an accessibility defect, not a taste call.
  - **Fix:** Darken the token — `--muted: color-mix(in srgb, var(--text) 68%, var(--bg) 32%)` (from the current ~55/45) clears 4.5:1 on both bg and surface. One line in `stylesCss`, whole catalog benefits.
  - **Suggested command:** `/impeccable colorize` (or a scoped fix).

- **[P1] Zero imagery — gradient blocks and emoji where photos belong.** Rendered: 0 `<img>`, 10 gradient blocks; gallery = 6 gradient tiles; features = emoji (⚡) in gradient panels; team = gradient-circle initials. For image-led businesses (this test was an architecture studio), the brand register is explicit: *"colored blocks where a hero photo belongs… zero images is a bug."*
  - **Why it matters:** The default output reads unfinished/untrustworthy for exactly the businesses that most need a brand site, and nothing signals "replace me," so users may ship it as-is.
  - **Fix:** Make imagery a first-class, guided slot: real `<img>` with a clear labeled placeholder (aspect-ratio box, "reemplazá con tu foto" affordance) and README guidance; optionally a documented `public/img/` drop convention or a few curated default photos. Keep emoji only as an explicit opt-in icon style, with an SVG icon set as the professional default.
  - **Suggested command:** `/impeccable shape` (imagery-slot pattern) then `/impeccable harden`.

- **[P2] The color system isn't background-aware.** `--text` is derived from `--primary` (always dark). If a user picks a **dark `--bg`** in the Builder *without* enabling the darkmode module, `--text` stays dark → **1.18:1** (invisible text). The darkmode module masks this by overriding to a full dark palette, but the base engine assumes a light bg.
  - **Why it matters:** A plausible Builder configuration (dark brand background, no darkmode toggle) produces an unreadable site. Silent, and the user won't see it until export.
  - **Fix:** Derive `--text` (and `--muted`) from `--bg` luminance so text auto-flips on dark backgrounds; or validate in the Builder and warn/auto-enable darkmode when `--bg` is dark.
  - **Suggested command:** `/impeccable harden`.

- **[P2] Timid, text-only hero.** Hero `h1` caps at `3.2rem` (51px desktop) with no art direction — text on a gradient. For the brand register ("safe = invisible"), a flexible template can still afford a more ambitious default (clamp up to ~4–4.5rem, `text-wrap: balance`) and a real hero image slot. Compounds the imagery gap.
  - **Suggested command:** `/impeccable typeset` + the imagery fix above.

- **[P3] Minor perf + naming.** `transition: width` on the pricing toggle thumb layout-animates (use `transform`); `.grid.cols-3` actually renders 4 columns at wide widths (auto-fit is the better behavior — rename or cap `max` columns so the class name isn't misleading).
  - **Suggested command:** `/impeccable polish`.

## Persona Red Flags

**Sam (Accessibility):** the muted body text at **3.67:1** is below AA — section subtitles and descriptions are hard to read for low-vision users on every generated site. (Positives: decorative blocks are `aria-hidden`, focus rings present, dark-mode respected, no horizontal scroll.)

**Jordan (First-time visitor to the client's site):** lands on an architecture studio with gradient tiles and an emoji where project photos belong — reads as unfinished, undercuts trust. The whole point of a brand site (credibility) is weakest exactly where it matters.

**Agency Operator (project persona, from PRODUCT.md):** exports a site that looks like a template until photos are added, but nothing in the output makes "add your images" obvious or easy — risk of shipping placeholder-y sites that reflect on their work. Also can't tell the muted-contrast issue is there without an audit.

## Minor Observations

- The generated design system has **no DESIGN.md of its own** — which is *why* the detector compared it to the Builder's ramp and produced false positives. Documenting the generated system (its own token spec + type scale) would silence those, give modules a spec to hold to, and serve the "both, lead with Builder" scope.
- Default palette is the textbook safe blue (`#2563eb` on `#1f2937`/white). Fine as a neutral default, but a few curated default palettes (mirroring the Builder's new presets) would lift first impressions.
- Emoji iconography (⚡) is consistent but reads toy-ish for professional brands; an SVG set would raise the register floor.

## Questions to Consider

- What would make "add your photos" impossible to miss in the exported project — a labeled image slot in the UI, a `public/img/` convention, or curated defaults?
- Should the color engine flip text on `--bg` luminance so a dark brand background just works, instead of relying on the darkmode module?
- Is the gradient-block-as-placeholder ever the right default, or should the generator always ship a real (even if generic) image affordance?
- If every generated site inherits one token formula, what else beyond `--muted` deserves a contrast guarantee (accent-on-surface, text-on-accent buttons)?

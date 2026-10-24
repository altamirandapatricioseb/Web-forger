---
target: public/index.html (Builder shell)
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-07-15T16-31-10Z
slug: public-index-html
---
⚠️ DEGRADED: single-context (sub-agent spawning gated by harness policy — user did not request agents)
Method: single-context inline (Assessment A design review + Assessment B detector/live-DOM, run sequentially in one context)

Target: `public/index.html` (WebForge Builder shell). Register: product · Platform: web.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live preview + spec-count + export wait-state are solid; but selected modules aren't summarized and auto-added dependencies (`requires`) happen invisibly. |
| 2 | Match System / Real World | 3 | Plain Spanish, clear labels; the `UI-01/FN-01` part numbers are arbitrary vs the real module ids. |
| 3 | User Control and Freedom | 3 | Free toggling + live preview is forgiving; no reset-to-defaults, no clear-all/select-all. |
| 4 | Consistency and Standards | 3 | Cohesive blueprint system; the SaaS-doc checkbox reuses `.module-item` with divergent inner markup. |
| 5 | Error Prevention | 3 | Native color pickers, maxlength, selects; invalid states caught server-side; dependency auto-add is unguarded/invisible. |
| 6 | Recognition Rather Than Recall | 1 | 142 modules in an unsearchable ~20,700px scroll — you must recall/scroll-hunt for any one. |
| 7 | Flexibility and Efficiency | 2 | No search, no keyboard jump, no bulk select, no presets/templates. Share-by-link is the one accelerator. |
| 8 | Aesthetic and Minimalist Design | 2 | Chrome is tidy, but the panel dumps 7 always-open blocks + 142 equal-weight rows: maximal at the information level. |
| 9 | Error Recovery | 3 | Export/preview errors surface as toasts carrying server messages; minimal but clear. |
| 10 | Help and Documentation | 2 | Good inline micro-hints (domain, deploy, SaaS); no per-module help, no first-run guidance. |
| **Total** | | **25/40** | **Acceptable — significant findability work needed before the catalog scales further** |

## Anti-Patterns Verdict

**Does this look AI-generated? No.** This is one of the rare tools with a genuine, committed identity — the "drafting table" blueprint (graph-paper grid, ink/blueprint-blue/amber, mono chrome, hard-offset preview shadow, L-corner ticks). It dodges all four category reflexes (SaaS-cream, cluttered no-code, toy, sterile enterprise). Nobody would call this generated-by-default.

**Deterministic scan:** `detect.mjs --json public/index.html` → `[]`, exit 0. **Zero** slop tells (no gradient text, side-stripes, eyebrow scaffolding, hero-metric template). Clean.

**Visual overlays:** not shown — the detector found nothing to overlay, so injection would highlight nothing. Live inspection was done via read_page + DOM measurement instead. Honest note: the browser screenshot renderer hung on this page (the ~20,700px DOM + preview iframe choke the screenshot path), so no static image was captured; all visual facts here come from measured computed layout.

## Overall Impression

The Builder has a real point of view and executes its chrome cleanly — that's the hard part, and it's done. The problem is entirely at the information layer: the catalog outgrew its container. At 142 modules, the left panel is a **20,714px scroll inside a 764px viewport** (~27 screens), split into just two ungrouped, unsearchable type-lists (100 UI + 42 functional). The single biggest opportunity is a **module finder** — search + categories + a live "what's selected" summary — which would lift Recognition (1→) and Flexibility (2→) and reduce the panel from a marathon to a control surface.

## What's Working

- **Committed identity.** The blueprint system is coherent and distinctive; every component shares one vocabulary (mono chrome, 1px linework, the signature hard-offset preview frame). This is a genuine strength most tools never earn.
- **Live preview as the hero.** Two-pane layout (340px panel + 1020px preview) with page tabs, updating on change with a clear status chip — the "show the result, not a promise" principle from PRODUCT.md is real here.
- **Sensible defaults + forgiving flow.** Boots with 11 modules pre-selected so the preview is populated on load, and every choice is reversible with instant feedback. Good onboarding-by-default.

## Priority Issues

- **[P1] The 142-module wall.** No search, no categories, no filter — finding "lightbox" among 100 UI modules means scrolling ~12,900px. This is the dominant friction and it directly undercuts PRODUCT.md's "fast" promise for the dev/agency user.
  - **Why it matters:** Recognition-over-recall collapses (scored 1). As the catalog grows each run, this gets monotonically worse; it's already at ~27 screens.
  - **Fix:** Add a search box that filters both lists by id/name/description; group the 100 UI modules into purpose categories (navigation, media, commerce, content, trust…) as collapsible sections; keep the two type-groups as the top split.
  - **Suggested command:** `/impeccable shape` (module-finder pattern) then `/impeccable layout`.

- **[P1] No visibility of the current selection.** The header says "11 módulos" but you can't see *which* without scrolling all 20k px, and modules auto-pulled in by `requires` (e.g. selecting `quotesadmin` silently adds `quote` + `auth`) never surface.
  - **Why it matters:** Users lose track of their own config; the invisible dependency additions violate error-prevention and system-status.
  - **Fix:** A sticky "selected" summary at the top of the modules block — removable chips — that also flags auto-added dependencies ("+ auth, required by Gestión de presupuestos").
  - **Suggested command:** `/impeccable layout`.

- **[P2] The panel is one 20,700px scroll of seven always-open blocks (A–G).** No progressive disclosure; brand, colors, type, texts, 142 modules, and infra all expanded at once.
  - **Why it matters:** High cognitive load (4+ checklist failures); the user can't focus on one decision at a time.
  - **Fix:** Make the blocks collapsible (or a stepped A→G flow), collapsed by default except the active one; the modules block gets the search/category treatment above.
  - **Suggested command:** `/impeccable layout`.

- **[P2] No efficiency accelerators for the power user.** No presets/starter templates ("e-commerce", "landing", "portfolio"), no select-all/clear-group, no keyboard focus-to-search.
  - **Why it matters:** The primary user is developers/agencies (Alex-type); they expect to move fast, and 142 individual toggles is the opposite.
  - **Fix:** Ship 3–4 named starter presets that pre-check a module set, plus per-group select/clear. Presets double as onboarding.
  - **Suggested command:** `/impeccable shape` (presets), scoped small.

- **[P3] `.mod-id` shows arbitrary part numbers (`UI-01`, `FN-01`) instead of the real module id.** The blueprint "part number" reads well, but the real id (`usertestimonials`, `quotesadmin`) is more useful and would make rows searchable by the name developers actually use.
  - **Why it matters:** Missed affordance; also makes DESIGN.md's "id in mono" language aspirational vs the live UI.
  - **Fix:** Render the real module id as the `.mod-id` (optionally keep a sequential index elsewhere).
  - **Suggested command:** `/impeccable clarify`.

## Persona Red Flags

**Alex (Power User)** — the primary audience per PRODUCT.md (developers/agencies):
- No search across 142 modules; no keyboard shortcut to jump to one. Scroll-hunts every time.
- No bulk select/clear, no presets — assembling a typical e-commerce site means ~15–20 individual toggles found by scrolling.
- Invisible `requires` resolution: selects `pos`, doesn't realize `products-admin`/`cart` implications until reading the preview.

**Sam (Accessibility / keyboard + screen reader):**
- Tab order marches through 142 checkboxes with no landmark or search to skip ahead — brutal keyboard traversal to reach the functional group.
- Good: focus ring is a clear 2px blue outline; selected state is conveyed by checkbox + border + tint (not color alone); text contrast passes (labels `#475467` ~8.6:1, descriptions `#667085` ~5.6:1 on white).
- Missing: no `<h2>`/list semantics tie the group headers to their `.module-list` for screen-reader navigation; the lists are `<div>`s of `<label>`s.

**Dev/Agency Operator (project persona, from PRODUCT.md):**
- Wants to spin up a client site fast; the module hunt is exactly the friction that contradicts the "assemble, don't code — fast" positioning.
- Can't keep several named client configs locally — only share-by-link, and only when Supabase is configured on the server. No local "save this config."

## Minor Observations

- Cognitive-load checklist: fails Single-focus, Chunking (≤4/group), Minimal-choices, and Progressive-disclosure → **high load (critical)** on the modules block specifically; the rest of the panel is fine.
- `.muted-note` has no color rule in `styles.css`, so the "muted" hints inherit near-ink `#101828` — they read as normal small text, not muted. Define a muted color.
- The two type-group headers ("E · Módulos de interfaz", "F · Módulos funcionales") are the only chunking; 100 items under one header is still a wall.
- Export button carries a proper `:disabled` wait-state — nice touch that many tools skip.

## Questions to Consider

- What if the modules block opened with a search field focused, and the 142 rows were hidden behind category accordions until searched or expanded?
- Does the whole config panel need to be visible at once, or would a stepped A→G flow (or collapsible blocks) match how someone actually builds a site — brand first, modules last?
- What would the "fast" version look like — could a dev land on three presets ("Tienda", "Landing", "Reservas") and be exporting in under a minute?
- Is `UI-01` telling the user anything, or is the real module id the more honest "part number"?

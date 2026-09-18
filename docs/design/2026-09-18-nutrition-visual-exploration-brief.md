# Nutrition Ledger Visual Exploration Brief v0.1

Date: 2026-09-18
Scope: visual exploration only. Preserve evidence-first and append-only product semantics.

## Product truth
Nutrition Ledger is not a calorie-counter dashboard. It is a personal nutrition evidence workspace.

- Capture: acquire label/photo/OCR/barcode/manual evidence, parse, review, append observations.
- Foods: manage canonical food values, provenance, source selection, corrections and rollback.
- Today: log actual intake while freezing the observation/source/version used at that moment.
- History: immutable observations/events/evidence/intakes form an audit trail; corrections append facts rather than silently rewrite history.

Engineering terms such as observationId, selection pointer and JSONL must not dominate primary UI.

## Ideal Today information hierarchy
L0 Global frame: product identity, Today/Foods/Capture/History, date, account/settings.
L1 Decision surface: What did I eat? What is covered? What remains? What is unknown? How do I add the next food?
Primary actions: Scan Label / Barcode / Manual Add / Repeat.
L2 Compact summary: total intake, meals logged, source quality/evidence coverage, unknown nutrients. No KPI theatre.
L3 Main workspace: Meal Timeline is primary; Daily Coverage is secondary. Breakfast/Lunch/Dinner/Snack rows show food, amount, time, kcal and compact provenance. Coverage shows Energy/Protein/Fat/Carbohydrate/Fiber/Sodium and MUST distinguish Covered / Remaining / Unknown. Unknown is never merged into Remaining.
L4 Fast reuse: Recent Foods / Common Foods / Quick Repeat.
L5 Trust layer: provenance, source distribution, corrections, invalidation and history are discoverable but quieter.

## Layout best practices
Desktop 1440x900, 12-column grid, optional 176-208px nav rail, 24-32px page margins, 16-24px gaps, 68-76px header. Summary stays one compact row. Main workspace about 7/5 or 8/4: Meal Timeline wider than Coverage. Supporting modules lower. Large cards, thin borders, little/no shadow. Prefer progressive disclosure over dense tables. First viewport must show meaningful meals and coverage.

Mobile is not a miniature desktop dashboard: summary -> quick actions -> meals -> coverage -> trust/reuse; minimum 44px targets; sticky Add is acceptable.

## Content/state best practices
Use food imagery only for recognition, not decoration. Provenance badges: Verified / Barcode / OCR / AI Estimate / Manual. AI Estimate must never imply verification. Unknown uses neutral pattern/icon/text, not warning red. Corrections communicate superseded/corrected/invalidated, never destructive rewriting. Avoid diagnosis language and moral labels such as “bad food”. Never fabricate precision.

## Shared guardrails
Premium, calm, international, durable. Strong typography and whitespace. Restrained palette. Accessible contrast. Information first.
Avoid generic enterprise admin dashboard, fitness gamification, rainbow nutrient chips, neon cyberpunk, glassmorphism everywhere, thick shadows, excessive gradients, giant donut-only visualization, dense spreadsheet-first Today, or unshippable Dribbble concept.
Keep DATA AND IA CONSTANT across variants; vary visual language, composition, typography, density, imagery and surface treatment.

# Style candidate library

## A. Apple Health Atelier
Warm white + graphite + botanical/sage green. Premium consumer health utility, hairline borders, almost no shadows, clean headings, sparse food thumbnails, quiet segmented bars. Avoid generic iOS clone and pill overload.

## B. Editorial Nutrition Journal
Editorial/Swiss hybrid. Warm ivory, charcoal, muted botanical green. Serif display only for storytelling; neutral sans for controls/data. Thin rules, asymmetric disciplined grid, one subtle food still-life crop. Avoid marketing-page behavior.

## C. Swiss Evidence Grid
Strict rational grid, off-white, near-black, one green. Typography/alignment/rules create hierarchy. Tabular numerals, compact provenance, serious but not cramped. No decorative wellness imagery.

## D. Scientific Calm
Modern evidence-lab language without hospital feel. Mineral white, graphite, cool gray, mint. Measurement-like rules, subtle patterned Unknown state, tiny monospace only for secondary metadata. No EMR or developer console.

## E. Quiet Luxury Wellness
Cream, stone, charcoal, deep olive; restrained natural-food photography; elegant typography; tonal surfaces and generous whitespace. Avoid spa brochure, beauty ecommerce, gold accents, vague wellness claims.

## F. Paper Ledger
Modern digital evidence notebook. Off-white paper-like surface, charcoal, muted green annotations, contemporary ruled structures and footnote-like provenance. No vintage accounting, scrapbook, handwriting fonts or skeuomorphic paper.

## G. Soft Layered Consumer
Friendly but credible. Pale neutrals, sage, rounded-not-bubbly modules, outline icons, generous touch targets, strong responsive continuity. No cartoons, streaks, confetti or childish gamification.

## H. Dark Evidence Studio
Near-black/graphite, warm white text, muted green signal, thin borders, tonal elevation, no glow. Unknown uses quiet hatch/dot pattern. Calm professional studio, not cyberpunk/crypto/gaming.

## I. Data Canvas
Borderless analytical workspace. Continuous warm-white canvas; hierarchy through whitespace, columns, rules and type; surfaces only for interactive/selected areas. Avoid card soup.

## J. Food Photography Editorial
Natural-light food imagery in small meal thumbnails plus at most one restrained editorial crop. Images support recognition/memory, never become recipe/social-feed content.

## K. Monochrome + Signal Green
Almost black/white with signal green reserved for action, verified/current states. Architectural, portfolio-grade product engineering, crisp and international. Avoid terminal/developer-dashboard styling.

## L. Soft Blue Evidence
White, cool mist gray, very pale blue as primary structure with restrained green only for verified/positive evidence. Useful as a React/product-engineering alternative skin while preserving semantics. Avoid SaaS-blue corporate dashboard feel.

## M. Japanese Calm Utility
Quiet Japanese editorial/product sensibility: warm paper white, charcoal, moss green, compact vertical rhythm, restrained iconography, precise spacing, subtle dividers. No faux-Japanese motifs or decorative calligraphy.

## N. Nordic Functional Health
Scandinavian utility: bright neutral canvas, cool gray, muted forest green, humanist sans, practical spacing, natural food thumbnails, functional warmth. Avoid IKEA-like catalog styling.

## O. High-Contrast Accessibility
Accessibility-forward premium UI: near-black text, white/off-white surfaces, green used redundantly with icons/text/patterns, excellent focus states, large targets, strong numeric legibility. Should look intentional, not like an accessibility mode afterthought.

# Master prompt for visual-model orchestration

开目标模式完成所有风格尝试 每个三种随机风格

Read the canonical project documentation first:
https://github.com/EOMZON/nutrition-ledger-mvp/blob/main/README.md
https://github.com/EOMZON/nutrition-ledger-mvp/blob/docs/nutrition-visual-exploration-20260918/docs/design/2026-09-18-nutrition-visual-exploration-brief.md

Goal:
Explore the ideal UI for Nutrition Ledger from the PRODUCT ARCHITECTURE outward, not by repainting a generic dashboard.

Hard requirements:
1. Preserve Capture / Foods / Today / History semantics and evidence-first, append-only truth.
2. Today is the primary daily workspace.
3. Keep the same information architecture and representative data across style variants so comparison is fair.
4. Covered / Remaining / Unknown are three different semantic states. Unknown MUST NOT be merged with Remaining.
5. Provenance is visible but secondary. AI Estimate must not look equivalent to Verified.
6. Meal Timeline is more important than decorative KPI cards.
7. Quick capture must remain obvious: Scan Label, Barcode, Manual Add, Repeat.
8. Corrections/history must imply append/supersede/invalidate, never destructive rewriting.
9. Do not invent medical claims or nutrition precision.
10. Generate actual visual outputs, not prompt text only.

Execution:
- Complete ALL style directions A-O.
- For EACH style direction, generate THREE materially different randomized visual variants (not recolors).
- Keep content/IA stable; randomize composition, type treatment, spacing/density, surface model, chart grammar and restrained imagery within that style.
- Produce desktop 1440x900 for every variant.
- For the strongest variants, additionally produce a mobile 390x844 translation.
- Label outputs clearly: A1/A2/A3 ... O1/O2/O3.
- Each result must show enough real UI to judge hierarchy: header/actions, summary, meals, coverage and at least part of provenance/reuse.
- Do not return three near-identical card dashboards.

Comparison criteria after generation:
- daily logging speed;
- hierarchy clarity;
- Covered/Remaining/Unknown comprehension;
- evidence/provenance legibility;
- visual trust;
- long-term visual fatigue;
- responsive potential;
- implementation realism;
- portfolio presentation quality.

Do not select a winner before producing the variants. First generate the complete visual exploration set, then summarize concrete tradeoffs and reusable visual tokens/patterns observed across the strongest directions.

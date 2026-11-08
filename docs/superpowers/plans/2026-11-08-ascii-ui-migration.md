# ASCII UI migration

**Goal:** replace shadcn/Bits UI and the slowshout visual system with the public `svelte-ascii-ui@0.1.0` API, preserving relocation workflows.

**Architecture:** Svelte 5.57.3, a root Paper Theme with IBM Plex Mono via the public font prop (bundled DotGothic16 was too wide for dense Russian content), direct public component imports, Tailwind for application layout only. Map and data tables remain domain widgets. No package patches, copied primitives or internal style overrides.

The owner requested implementation and delegated visual choices. Paper is the implementation choice; business behavior and data remain unchanged.

## Tasks

- [x] Install pinned package and compatible Svelte; establish Theme and semantic application colors.
- [x] Replace settings, factor controls and budget inputs with public form components.
- [x] Replace city/comparison overlays, hints and metric presentation.
- [x] Migrate onboarding, quiz, sharing and compare actions.
- [x] Migrate home navigation, results and table; remove old UI primitives and unused dependencies.
- [x] Check keyboard, narrow screens, long Russian labels, URL state and overlay focus. Run Svelte analysis and `npm run verify`.
- [x] Capture desktop/mobile screens and record reproducible consumer feedback, including unsupported cases. Prepare local issue drafts only.

## Review focus

Preserve separate enabled/weight controls and 0–10 scale; selected city via URL; clipboard fallback; three-city comparison; responsive city width and two-column metrics. Test existing end-to-end workflows against the installed package. Any missing public extension point is reported rather than patched internally.

Outcome and explicit visual differences: [migration report](../../ascii-ui-migration.md).

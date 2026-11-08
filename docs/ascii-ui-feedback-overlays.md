# ASCII UI migration: unresolved public capabilities

Package: `svelte-ascii-ui@0.1.0`. Consumer: city details and three-city comparison.
Evidence: installed public declarations and component styles; browser measurements,
screenshots and keyboard/mobile checks have not been performed. No issue published;
duplicate search has not been performed.

## Dialog / Drawer: responsive window dimensions

Type: missing capability. Desired city window width is 880px at viewports >=1280px,
440px below that, constrained on narrow mobile screens. Comparison previously used
a bottom sheet, 90dvh desktop / full-height mobile.

Minimal public reproduction:

```svelte
<script>
  import { MediaQuery } from 'svelte/reactivity';
  import { Drawer } from 'svelte-ascii-ui';
  let open = $state(true);
  const wide = new MediaQuery('(min-width: 1280px)');
</script>

<Drawer bind:open title="Город" size={wide.current ? 'xl' : 'l'}>Длинный обзор города</Drawer>
```

The selected public desktop sizes are Drawer xl (67vw) at >=1280px and Drawer l
(50vw) at 768–1279px. At 1440px and 1024px this means 964.8px and 512px,
respectively, rather than 880px and 440px. Below 768px the app uses Dialog s:
400px constrained to viewport minus 32px above 600px, full viewport width at
<=600px. Its maximum height is min(82dvh, 900px), or 75dvh at <=600px.

Drawer supports only left/right sides; the default right side preserves the desktop
sidebar. There is no documented dimension prop/token or bottom-sheet capability.
Mobile Dialog is an accepted visual migration fallback, not a bottom sheet.
Comparison uses Dialog xl. No internal CSS override, copy or package patch was
introduced. Parent migration owns map offset synchronization: 50vw at 768–1279px,
67vw at >=1280px, no sidebar offset below 768px.

Suggested acceptance: public window width/max-height configuration with narrow
viewport constraints; verify 390, 768, 1024, 1280 and 1440px, long reviews, keyboard
close/focus restoration and horizontal scrolling with three compared cities.
Severity: visual/layout parity gap, not a demonstrated accessibility failure.

## Badge: relative versus absolute interpretation

Type: missing capability. Previously relative levels had an outlined/dashed badge,
while absolute/range levels had a filled badge. Public Badge has label, children,
tone and size, but no appearance variant.

```svelte
<script>
  import { Badge } from 'svelte-ascii-ui';
</script>

<Badge size="s" tone="success">Выше среднего</Badge>
```

There is no supported prop to select outline versus filled appearance. Migration
preserves labels, interpretation captions and data-kind/data-tone on app wrappers;
the previous frame distinction is deferred. No workaround introduced. Suggested
acceptance: an optional public appearance variant, checked across tones and sizes.

## Verification and affected flows

### Host CSS integration: native dialog centering

The coordinating agent observed a mobile Dialog at the top-left in a browser
screenshot. Tailwind Preflight resets the native dialog margin to zero; the kit
defines Drawer margins but does not explicitly restore regular Dialog centering.
This is a host CSS interaction and an integration-guide gap. The screenshot was
reported by the coordinating agent, not independently captured here.

The app applies the public `class="m-auto"` to the comparison Dialog and only to
the mobile city Overlay. Desktop Drawer receives no positioning class. This uses
the public HTML class prop on the overlay root; it does not target internal
selectors or override internal CSS variables. Suggested documentation acceptance:
show how to compose Dialog with Tailwind Preflight, including this public-class
centering option, and verify regular Dialog centering without changing Drawer
anchoring. A browser recheck remains with the coordinating agent.

City selection/close, factor hints, score contributions, budget remainder, sources,
dated long reviews, people links and comparison/removal retain their business code
and test IDs. Old Sheet/Popover imports, lucide and old palette styling were removed
from the owned UI. Prettier, scoped ESLint and Svelte MCP autofixer passed. Global
verify and browser scenarios are deferred to the coordinating agent as requested.

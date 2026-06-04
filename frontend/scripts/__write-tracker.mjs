// One-shot: writes the session tracker into ../tracker.txt.
import { writeFileSync } from 'node:fs';

const content = `================================================================
UMT2 — Cooper Standard Theming & Filter Refactor
Tracker (chronological)
================================================================

Last updated: 2026-05-11

----------------------------------------------------------------
1. INITIAL BRAND THEMING PASS
----------------------------------------------------------------
Request: Apply Cooper Standard brand identity (royal blue + brand
gold) to the UI. Add yellow/blue borders and accents.

Added new brand utilities in src/index.css:
  - brand-hairline           horizontal blue->gold->blue stripe
  - brand-spark              soft gold pulse (footer)
  - brand-edge-top           3px blue/gold/blue stripe at card top
  - brand-rail-gold          inset 3px gold left rail
  - brand-rail-blue          inset 3px blue left rail
  - brand-accent             page-header blue bar + gold dot
  - brand-card               card with gold top shimmer

Component changes:
  - src/components/layout/AppShell.tsx
      - Top hairline bumped 2px -> 3px
      - Gold spark line added above the footer
  - src/components/layout/PageHeader.tsx
      - Blue bar + gold dot accent above title
  - src/components/layout/Sidebar.tsx
      - 3px gold rail on active nav row
  - src/components/layout/Topbar.tsx
      - Tenant chip: blue border + gold inner ring
  - src/components/dashboard/KpiCard.tsx
      - brand-edge-top stripe + card-hover lift
      - New "accent" prop: blue or gold (alternating tiles)
  - src/components/dashboard/ChartCard.tsx
      - Tiny blue + gold dot marker before every title
  - src/components/dashboard/QuickLinks.tsx
      - Hover state: alternating blue / gold left rail
  - src/pages/Home.tsx
      - KPI grid wired with accent="blue" / "gold" alternating
  - src/pages/VdiUsers.tsx
      - StatCard inherits brand-edge-top + card-hover

----------------------------------------------------------------
2. BRAND FONTS + HOVER TRANSITIONS
----------------------------------------------------------------
Request: Match font colors to the theme (blue/yellow). Hover
should shift blue to yellow. Apply where it improves UX.

Two-tone "Cooper Standard" wordmark wherever it appears as text:
  - src/components/layout/Logo.tsx          (sidebar logo)
  - src/components/layout/Topbar.tsx        (tenant chip)
  - src/components/layout/Sidebar.tsx       (sign-off chip)
  - src/components/layout/AppShell.tsx      (footer)

Brand-colored typography:
  - PageHeader title         -> brand blue
  - ChartCard h3 title       -> brand blue, transitions gold on
                                card hover (group/card)
  - KpiCard numeric value    -> blue or gold by accent prop
  - src/pages/Sessions.tsx   -> "Session log" heading promoted to
                                same blue + two-dot marker

Hover transitions (blue -> gold):
  - Sidebar nav inactive items: icon + label lift toward blue on
    hover (active stays brand blue with gold rail)
  - QuickLinks title: blue or gold on hover, matched to the row's
    alternating rail
  - Filter range chips (unselected): muted -> gold on hover
  - Topbar tenant chip: border + inner ring transition to full
    gold on hover
  - Sidebar Logo: CS mark scales 1.04x on hover

----------------------------------------------------------------
3. REAL COOPER STANDARD LOGO ASSET
----------------------------------------------------------------
Request: Use the actual cooper_logo.png instead of the
hand-drawn SVG mark.

Pipeline:
  - Original cooper_logo.png (1536x1024, 2 MB) auto-trimmed of
    transparent margin and downscaled to 189x256, 28 KB
  - Output: public/cooper-mark.png (alpha preserved)
  - Reproducible via: node scripts/__downscale-logo.mjs

Components:
  - src/components/layout/BrandMark.tsx
      - Rewrote to render <img src="/cooper-mark.png"> with
        object-contain and the same className API
      - All existing call sites (sidebar logo, topbar chip,
        sidebar sign-off, sidebar watermark) pick it up
        automatically

----------------------------------------------------------------
4. SIDEBAR RIGHT-EDGE BRAND GRADIENT
----------------------------------------------------------------
Request: Apply a similar gradient border to the sidebar's right
edge.

  - Added brand-hairline-v utility (vertical sibling of
    brand-hairline) in src/index.css
  - Sidebar removes border-r border-sidebar-border and overlays
    a 3px-wide stripe positioned absolutely on the right edge

----------------------------------------------------------------
5. MULTI-BAND SIDEBAR GRADIENT
----------------------------------------------------------------
Request: Make the sidebar's right border alternate
blue/yellow/blue/yellow down its length.

  - brand-hairline-v rewritten with 9 color stops
    (5 blue at 0/25/50/75/100% and 4 gold at 12.5/37.5/62.5/87.5%)
  - Produces four blue<->gold transitions matched roughly to
    sidebar sections (logo, Workspace, Administration, sign-off)

----------------------------------------------------------------
6. MULTI-SELECT FILTERS
----------------------------------------------------------------
Request: Replace single-selection dropdowns with multi-selection.

Data model:
  - src/lib/types.ts
      - All FilterState dimension fields are now arrays
        (string[], Hardware[], SessionStatus[])
      - Empty array means "no filter applied"
  - src/lib/filter-context.tsx
      - DEFAULT_FILTERS uses [] for every dimension
      - Added sameFilterValue() so per-chart override count
        compares arrays structurally

Filtering (src/lib/filtering.ts):
  - New matches(selected, value) helper:
      empty selection OR includes(value)
  - All ==="all" / !=="all" checks rewritten over array semantics
  - approximateUsageScale now scales by selected.length / total
    so picking 3 of 19 apps gives ~3/19 scale (not 1/19)

UI:
  - src/components/dashboard/FilterChips.tsx
      Replaced single-pick ChipPopover with MultiChipPopover:
        Trigger label flow:
          "All applications" -> "<one name>" -> "3 selected"
        Active state: brand-blue ring + tinted background
        Top row: "All ..." when empty, "Clear selection" otherwise
        Checkbox indicator per option; popover stays open
  - src/components/dashboard/ChartFilterChips.tsx
      Same MultiChipPopover treatment with status dim included
  - src/components/dashboard/ChartFilterPopover.tsx
      Replaced Select rows with chip-pill multi-row groups
      (MultiRow); "All" pill clears, options toggle, "N selected"
      summary on the right

Chart consumers:
  - charts/MonthlyUsage.tsx, charts/MonthlyUsageTotal.tsx
      effective.cad === "CATIA" -> effective.cad.length === 0 ||
                                   effective.cad.includes("CATIA")

----------------------------------------------------------------
7. NEW DATE-RANGE PRESETS
----------------------------------------------------------------
Request: Replace 30d / 90d / YTD / 12 months with
current month, last month, this year, last year.

  - src/lib/types.ts
      RangePreset = "currentMonth" | "lastMonth" | "thisYear"
                  | "lastYear" | "custom"
  - src/lib/filter-context.tsx
      DEFAULT_FILTERS.range = "thisYear"
  - src/lib/filtering.ts
      Removed rangeToMonths().
      Added rangeSlice(filters): [number, number?]
        currentMonth -> [-1]
        lastMonth    -> [-2, -1]
        thisYear     -> [-(currentMonthNumber)]
        lastYear     -> [-12]    (mock fallback)
        custom       -> derived from customFrom/customTo
      filterMonthly / filterMonthlyCad spread the slice.
      rangeWindow() rewritten calendar-aware:
        currentMonth -> 1st of this month -> now
        lastMonth    -> 1st of last month -> last day of last
                        month (day-0 of current month)
        thisYear     -> Jan 1 of this year -> now
        lastYear     -> Jan 1 -> Dec 31 of last year
        custom       -> customFrom/customTo (falls back to YTD)
  - src/components/dashboard/FilterChips.tsx
      RANGES: This month / Last month / This year / Last year /
              Custom
  - src/components/dashboard/ChartFilterChips.tsx
      Same RANGES set
  - src/components/dashboard/ChartFilterPopover.tsx
      RANGE_OPTIONS: Current month / Last month / This year /
                     Last year (Custom handled separately)

================================================================
SUPPORTING ARTIFACTS (not shipped)
================================================================
  - scripts/__brand-capture.mjs
      Playwright screenshot pass for all 5 routes at 1440x900;
      outputs to __shots/
  - scripts/__filter-capture.mjs
      Opens the App multi-select chip, ticks three options,
      captures open / N-picked / closed states
  - scripts/__downscale-logo.mjs
      Auto-trims and downscales cooper_logo.png to
      public/cooper-mark.png. Re-runnable.

================================================================
VERIFICATION
================================================================
After each change:
  - npx tsc --noEmit                  clean
  - npx vite build                    clean (~6.4-7.0s)
  - npx eslint <touched files>        clean (pre-existing
                                      react-refresh warnings in
                                      filter-context.tsx are not
                                      from this work)
  - Playwright screenshots of all 5 routes confirmed the brand
    chrome, multi-select popover, and new range presets render
    correctly.
`;

writeFileSync('tracker.txt', content);
console.log('wrote tracker.txt:', content.length, 'bytes');

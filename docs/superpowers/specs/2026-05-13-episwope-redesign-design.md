# EpiScope UI/UX Redesign — Design Spec

**Date:** 2026-05-13  
**Status:** Approved by user (sections 1–3 + hi-fi mockup v2)  
**Scope:** Full desktop + mobile redesign of EpiScope global disease surveillance dashboard

---

## 1. Information Architecture

### Three-tier hierarchy (strict)

```
Layer (what category)       → Epidemic / Disaster / Air / Food / Humanitarian
  Severity (how critical)   → Critical / Alert / Warning / Monitoring / All
    Events (the list)       → Individual outbreak rows, country chips
```

**Layer** controls what data appears on the globe and list. Independent toggles per category.  
**Severity** filters within the active layers. Always visible below layer controls.  
**Event list** is the result of layer × severity intersection. Countries are secondary — you reach them by clicking an event or searching.

### Right panel states

The right panel has exactly **two modes**, toggled by what the user selects:

1. **Outbreak/disaster detail** — when user clicks a list row or globe marker. Shows: pathogen name, country, severity badge, key metrics (cases, deaths, CFR, trend), travel advisory, AI summary, source links.
2. **Country profile** — when user clicks a country on the globe or selects via search. Shows: country name + risk level, count of active threats, threat list with severity, traveler recommendation, watch toggle.

**Empty state** (nothing selected): welcome card with stat summary and instruction copy.

### Data model clarity

- **Epidemics (outbreaks)** — many rows per category: mpox, dengue, cholera, marburg, etc.
- **Disasters** — individual GDACS events: each flood, earthquake, cyclone is its own list row
- **Air / Food / Humanitarian** — demo/static data for now, same list structure

All categories produce list rows. Nothing is globe-only.

---

## 2. Desktop Layout

### Structure: B+C hybrid

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: Brand | Search (global) | Stats strip | Lang | Alert   │
├──────────────┬──────────────────────────────┬───────────────────┤
│  LEFT        │                              │  RIGHT            │
│  SIDEBAR     │         GLOBE                │  PANEL            │
│  240px dark  │         center               │  320px light      │
│              │         flex:1               │                   │
│  Country     │                              │  Outbreak detail  │
│  search +    │                              │  OR               │
│  dropdown    │                              │  Country profile  │
│              │                              │                   │
│  ─────────── │                              │                   │
│  LAYERS      │                              │                   │
│  toggles +   │                              │                   │
│  counts      │                              │                   │
│              │                              │                   │
│  ─────────── │                              │                   │
│  SEVERITY    │                              │                   │
│  chips       │                              │                   │
│              │                              │                   │
│  ─────────── │                              │                   │
│  EVENT LIST  │                              │                   │
│  scrollable  │                              │                   │
└──────────────┴──────────────────────────────┴───────────────────┘
```

### Header (52px, #0F0E0C)

- Brand mark: orange square with "ES" monogram, "EpiScope" wordmark, separator, "Global Health Intelligence" sub-label
- Global search: centered input (max-width 300px), placeholder "Search country or outbreak…", opens command-palette-style overlay on focus
- Stats strip: 4 metrics (Active outbreaks, Countries affected, Critical alerts, Monitored regions) — right-aligned, separated by 1px lines
- Lang toggle (EN / RU), Alert button with pulse animation

### Left sidebar (240px, #161513)

**Country search block:**
- Input with magnifier icon
- On type: dropdown below showing matching countries, each row = flag area + country name + highest severity badge
- Click → switch right panel to country profile AND rotate globe to that country

**Layers section:**
- Section label "LAYERS" in 8px uppercase
- Row per layer: colored dot, layer name, event count chip, iOS-style toggle
- Colors: Epidemic=#E8590C, Disaster=#1D6FA4, Air=#6B7F3A, Food=#A0522D, Humanitarian=#7B5EA7
- Enabled = toggle on + dot bright; disabled = toggle off + dot dimmed + row opacity 0.4

**Severity section:**
- Section label "SEVERITY"
- Pill chips: All / Critical / Alert / Warning / Monitoring
- Single-select; "All" = no filter

**Event list:**
- Scrollable, no max-height (fills remaining sidebar space)
- Row: left border in severity color, category type badge (small), event name (bold), location subtitle, case count right-aligned
- Hover: slight background lift
- Selected: border becomes 3px, background tinted
- Disasters get "DISASTER" badge in blue; outbreaks get pathogen short name

### Globe (center, flex: 1)

- Dark basemap, sphere with subtle grid lines
- Colored dots per event, size = log scale of cases
- Hover: popup anchored to dot — event name, location, severity chip, "View country profile →" button
- Popup uses `visibility:hidden → visible` transition (not display:none) to allow CSS fade
- Animated ring on critical severity dots

### Right panel (320px, #F4F2EB)

**Outbreak detail mode:**
- Large Fraunces display name (pathogen)
- Location subtitle + date
- Severity gradient banner
- 4-metric grid: Cases / Deaths / CFR / Trend
- Travel advisory box (color-coded)
- AI analysis paragraph
- Source links row

**Country profile mode:**
- Country name (large Fraunces)
- Risk level badge + "X active threats"
- Threat list: each row = pathogen name, severity badge, case count
- Traveler recommendation text block
- Watch toggle (star icon, top-right)
- "Back to list" link

---

## 3. Mobile Layout

### Principle: Globe + bottom sheet, no tab bar

The globe fills the full screen. A **bottom sheet** overlays it with three states:

| State | What's visible |
|---|---|
| peek | Globe fills screen, bottom sheet shows drag handle + first list item only |
| list | Sheet at ~55% height, scrollable event list |
| detail | Sheet at ~85% height, outbreak OR country profile content |

### Top bar (fixed, 44px, #0F0E0C)

- Brand wordmark (left)
- Search input (center, tap to expand)
- "Layers" button (right, opens bottom drawer)

### Search interaction (critical feature)

Tap on search field → field expands full-width → keyboard appears → **dropdown immediately visible below**, showing matching countries as user types. Each result: country name + highest-severity badge. Tap = navigate to country profile (sheet goes to detail state, globe rotates).

When search is empty, dropdown shows recently viewed / top-risk countries.

### Layers drawer (bottom, swipes up)

Triggered by "Layers" button in top bar. Contains:
- Layer toggle rows (same as desktop, with iOS toggles)
- Severity chips below
- Drag handle at top, tap outside to dismiss

### Bottom sheet

**Drag handle** always visible at top of sheet.

**List state content:**
- "OUTBREAKS" label + count badge (e.g., "12")
- Event rows: left border color, country code avatar, pathogen name, location, case count
- Tap row → detail state

**Detail state — outbreak:**
- Back arrow (← back to list)
- Pathogen name (Fraunces, large)
- Severity badge + case count
- 3-stat grid (cases / deaths / risk)
- Threat description
- Recommendation text

**Detail state — country:**
- Back arrow
- Country name
- Risk level + threat count
- Active threats list
- Recommendation block

### No bottom tab bar

Navigation entirely through search, sheet states, and back arrows. Simpler, and keeps globe visible at all times.

---

## 4. Typography & Color System

### Fonts (max 2)

- **Fraunces** (display): outbreak names, country names, key stat numbers. Weights: 700, 900.
- **System UI stack** (`-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif`): all body copy, labels, UI chrome.

### Color tokens

| Token | Value | Usage |
|---|---|---|
| `--bg-dark` | #0F0E0C | Header, mobile top bar |
| `--bg-sidebar` | #161513 | Left sidebar |
| `--bg-globe` | #1E2832 | Globe background |
| `--bg-panel` | #F4F2EB | Right panel, bottom sheet |
| `--bg-panel-card` | #FFFFFF | Cards within panel |
| `--text-primary-dark` | #FFFFFF | Text on dark surfaces |
| `--text-muted-dark` | rgba(255,255,255,0.3) | Subtitles on dark |
| `--text-primary-light` | #1A1917 | Text on light surfaces |
| `--text-muted-light` | #807E76 | Subtitles on light |
| `--sev-critical` | #C92A2A | Critical severity |
| `--sev-alert` | #E8590C | Alert severity |
| `--sev-warning` | #E4B514 | Warning severity |
| `--sev-monitoring` | #1D6FA4 | Monitoring severity |
| `--layer-epidemic` | #E8590C | Epidemic layer |
| `--layer-disaster` | #1D6FA4 | Disaster layer |
| `--layer-air` | #6B7F3A | Air quality layer |
| `--layer-food` | #A0522D | Food safety layer |
| `--layer-humanitarian` | #7B5EA7 | Humanitarian layer |
| `--online` | #19A463 | Live data indicator |

### No emojis

Zero emoji in UI. Country identifiers = 2-letter ISO code in colored avatar box. Category type = text badge. Status = text + color only.

---

## 5. Key Interaction Behaviors

### Country search (desktop)
1. User types in left sidebar search
2. Dropdown appears below input (position: absolute, z-index: 100)
3. Results filter as-you-type from COUNTRIES array
4. Arrow keys navigate, Enter selects, Escape closes
5. Click result → `selectCountry(name)` → right panel switches to country profile

### Country search (mobile)
1. Tap search bar in top bar
2. Input expands (CSS transition), keyboard appears
3. Dropdown slides into view below input, shows top-risk countries immediately
4. Type filters dropdown in real time
5. Tap result → bottom sheet goes to detail/country state

### Layer toggle
1. Click toggle → `state.cats[cat] = !state.cats[cat]`
2. Globe re-renders dots (filtered by active cats)
3. Event list re-renders
4. Toggle row opacity reflects state (disabled = 0.4)

### Globe marker click
1. Click dot → popup appears (visibility transition, not display toggle)
2. Popup: event name, location, severity chip, "View country profile →" CTA
3. Click "View country profile →" → `selectCountry(country)` → right panel / bottom sheet updates

### Severity filter
1. Click chip → `state.filter = sev` (or 'all')
2. Event list and globe dots re-filter instantly

---

## 6. Out of Scope

- User accounts / auth
- Push notifications
- Historical timeline / date range picker
- Export / reporting features
- Admin CMS for data

These are valid future features but excluded from this implementation cycle.

---

## 7. Implementation Notes

All logic lives in `globe.js` (~2000 lines). Implementation will:

1. Add/fix country search: `COUNTRIES` array, sidebar input + dropdown DOM, filtering logic
2. Refactor `renderList()`: unified rows for all categories, severity left border, category badge
3. Refactor `renderPanel()` / `renderCountryPanel()`: two clean modes, Fraunces headings
4. Add `renderPanelEmpty()`: welcome state with stats
5. Update CSS in `index.html` / `ru/index.html`: new sidebar structure, layer toggle rows, severity chips, bottom sheet for mobile
6. Fix popup transition: `visibility` + `opacity` approach (already done)
7. Remove all emoji from template strings and static HTML
8. Mobile: implement bottom sheet with three states via CSS classes + JS state

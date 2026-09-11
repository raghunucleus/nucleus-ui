# Nucleus UI — Design & Styling Rules

These rules apply to every UI change in this repo. Follow them by default; only deviate with an explicit reason.

## Stack

- **Tailwind CSS v4** (CSS-first config, `@theme inline` block) — configured via `@tailwindcss/vite` in [vite.config.ts](vite.config.ts).
- **shadcn/ui** (style: `new-york`, base color: `zinc`) — configured in [components.json](components.json). Add new primitives with `npx shadcn@latest add <name>`.
- **lucide-react** for icons.
- **Path alias**: `@/` → `src/`. Always import via the alias, never via long relative paths.
- **`cn()`** from [src/lib/utils.ts](src/lib/utils.ts) is the only allowed way to merge Tailwind classes conditionally.

## Libraries — what to use for what

These are the approved libraries for each concern. Use them; do **not** introduce a competing library (no react-router, no redux/jotai/recoil, no formik, no yup/joi, no react-hot-toast, no ag-grid, etc.).

### Routing — `@tanstack/react-router`
- All app routing goes through TanStack Router. Use file-based or code-based route definitions; never import from `react-router-dom`.
- Use the typed `Link`, `useNavigate`, `useParams`, `useSearch` exports — never `window.location` for navigation.

### Code splitting — every page is a lazy chunk
The login page of one subdomain must never download the other portals or any page. The split is enforced by `import()` boundaries in three layers, and one stray static import silently undoes a layer.

1. **Portal** — [src/portals/portal.tsx](src/portals/portal.tsx) maps the hostname to a `lazyRouteComponent(() => import('./<x>-portal'))`; [src/main.tsx](src/main.tsx) preloads it before mounting so the HTML splash hands straight to the login. `main.tsx` / `App.tsx` must not import anything portal-specific (that includes `@/lib/i18n`, which is parent-only and lives in `parent-portal.tsx`).
2. **App shell** — each `src/portals/<x>-portal.tsx` statically imports its login screen and lazy-loads `./<x>-app.tsx` (the `RouterProvider`), preloading it while the login form is up so sign-in swaps with no loader.
3. **Page** — in `src/router.tsx`, `src/employee-router.tsx`, `src/parent-router.tsx` every route is `component: lazyRouteComponent(() => import('@/pages/...'))`. Only the layout and `NotFound` are static. **Never `import X from '@/pages/...'`** in a router or any shared module; type-only imports (`import type`) are fine. Routers set `defaultPendingComponent: RoutePending` and `defaultPreload: 'intent'`.

- Heavy libraries reachable from a page should still be loaded on demand inside the handler: `const XLSX = await loadXlsx()` from [src/lib/xlsx.ts](src/lib/xlsx.ts) — never `import * as XLSX from 'xlsx'` at module scope. Lexical follows the same rule via `LazyRichTextEditor` (below).
- A dependency that is only reachable through `import()` must be listed in `optimizeDeps.include` in [vite.config.ts](vite.config.ts) (`i18next`, `react-i18next`, `xlsx` today), or the dev server answers its first request with a 504 and the lazy chunk fails to load.
- Check with `npm run build`: the entry `index-*.js` should stay well under 300 kB, and `dist/index.html` must not `modulepreload` any page, portal or vendor-library chunk.

### Client state — `zustand`
- For cross-component client state (auth user, UI state, persisted preferences). Define one store per concern in `src/stores/`.
- Server state (anything fetched from the API) does **not** go in zustand — use TanStack Router loaders or a dedicated fetcher; never mirror server data into a store.

### Forms — `react-hook-form` + `@hookform/resolvers` + `zod`
- Every form uses `useForm()` from `react-hook-form` with a `zod` schema wired via `zodResolver` from `@hookform/resolvers/zod`.
- Define the schema once with `zod` and infer the form type via `z.infer<typeof schema>`. Do not duplicate the type by hand.
- Do **not** manage form state with `useState` for anything more than a single trivial input.

### Validation / schemas — `zod`
- Use `zod` for all runtime validation: form schemas, API response parsing, env vars, `localStorage` reads. Never write hand-rolled validators or use `JSON.parse` without a `zod` schema for untrusted input.

### Tables — `@tanstack/react-table`
- All data tables (sortable, paginated, filtered, or just multi-column with consistent styling) use TanStack Table headless APIs rendered through the shadcn table primitives in [src/components/ui/](src/components/ui/).
- Define columns with `createColumnHelper` for type safety; don't index into rows by string keys at render time.

### Dialogs, dropdowns, slots — `@radix-ui/*`
- `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, and `@radix-ui/react-slot` are consumed **through** their shadcn wrappers in [src/components/ui/](src/components/ui/) (`dialog.tsx`, `dropdown-menu.tsx`, etc.). Import from `@/components/ui/...`, not from `@radix-ui/...` directly, unless you are editing the wrapper itself.
- `@radix-ui/react-slot` is the mechanism behind shadcn's `asChild` prop — use `asChild` to compose, don't reimplement the slot pattern.

### Toasts — `sonner`
- Mount `<Toaster />` from `sonner` once at the app root. Fire toasts with `toast.success(...)`, `toast.error(...)`, `toast.promise(...)`. Never build a custom toast/snackbar component.

### Google OAuth — `@react-oauth/google`
- Use `<GoogleOAuthProvider>` at the app root and the library's hooks/components for sign-in flows. Do not hand-roll the OAuth redirect or talk to Google's JS SDK directly.

### Rich text — `lexical` + `@lexical/*`
- All rich-text authoring uses Lexical through the wrappers in [src/components/ui/](src/components/ui/). Do **not** add a second editor (no tiptap, slate, quill, draft-js) or a markdown editor alongside it.
- **Editing:** import `LazyRichTextEditor` from `@/components/ui/lazy-rich-text-editor`. Never import `rich-text-editor` directly — a static import pulls Lexical (the app's largest dependency) back into the initial bundle.
- **Display:** use `RichTextView` from `@/components/ui/rich-text/rich-text-view`. It walks the stored JSON with no Lexical runtime; never mount an editor just to show content.
- Values are Lexical's `SerializedEditorState` JSON, stored in `jsonb`. Empty is `null`, never an empty-paragraph blob.
- The editor is **uncontrolled after mount** — `value` seeds it once. To show different content, remount with a `key`.
- Keep every `@lexical/*` package on the same version as `lexical` itself; `@lexical/react` is a peer of the rest and a split version breaks at runtime.
- The JSON is also read by `nucleus-mobile`'s React Native `RichTextView`. Adding a node type to `rich-text/nodes.ts` means teaching both renderers about it, or it degrades to plain text on read.

### Spreadsheets — `exceljs` and `xlsx`
- **`xlsx` (SheetJS) for reading** user-uploaded spreadsheets — parsing rows from `.xlsx` / `.csv` uploads in bulk-import flows. Load it on demand with `loadXlsx()` from [src/lib/xlsx.ts](src/lib/xlsx.ts) inside the handler (see "Code splitting" above).
- **`exceljs` for writing** generated exports — when the output needs styling, column widths, multiple sheets, or formulas.
- If you only need to emit a plain CSV with no styling, `xlsx` is also fine for the write side. Don't add a third spreadsheet library.

## Single source of truth: design tokens

All colors, radii, shadows and surface treatments live as CSS variables in [src/index.css](src/index.css). This is the **only** file where raw color values, hex codes, or oklch values should appear — with one documented exception: [src/config/themes.ts](src/config/themes.ts) carries literal swatch hexes so the theme picker can preview a preset that is *not* currently applied.

- **Brand colors** are the three `--brand-*` vars at the top of `:root` and `.dark`. To rebrand the default look, edit ONLY these six values. Preset themes re-point the same three (see "Theme rules").
- **Semantic tokens** (`--primary`, `--secondary`, `--accent`, `--background`, `--foreground`, `--muted`, `--border`, `--ring`, `--card`, `--popover`, `--destructive`, `--sidebar-*`, `--chart-*`) reference the brand vars or define neutral surfaces. These are what components consume.
- **Elevation** is `--shadow-card` / `--shadow-header`, exposed as the `shadow-card` / `shadow-header` utilities. Don't write a `shadow-[…rgba…]` literal in a component.
- **Gradients**: the `.brand-gradient` class (initials avatars, chips) and the sidebar's active pill both paint from the derived `--brand-g1..3` triplet, so they follow the preset. Prefer it over `bg-gradient-to-br from-primary to-secondary` for an avatar; hero panels and the ID card may keep the utility form.
- The `@theme inline` block maps every CSS var to a Tailwind color so utilities like `bg-primary`, `text-muted-foreground`, `border-border` work everywhere.

## Typography, density & spacing standards

The web portals follow akrivia-central's density: **the OS system font, compact, 14px root**. Every size below is a Tailwind utility on the rem scale — don't hardcode px.

### Font & density

- **No web font is loaded.** `--font-sans` in [src/index.css](src/index.css) is the system stack (`ui-sans-serif, system-ui, "Segoe UI", Roboto, …`) — the same one central uses. We used to ship Inter Variable; at the same px Inter's x-height is ~40% taller than Segoe UI's, which is why the product read as "zoomed in" next to central even though both ran an identical 14px root. Never set `font-family` in a component, and never add a font package or a CDN `<link>` back (the CSP is `font-src 'self' data:`, see [SECURITY-HEADERS.md](SECURITY-HEADERS.md)). The mobile apps keep Inter — web and native are different canvases.
- The `--font-sans` stack keeps `Nirmala UI` / `Noto Sans Devanagari` / `Noto Sans Telugu` in its tail. The parent portal ships हिंदी and తెలుగు — dropping them makes the parent nav pick a different fallback per glyph.
- Root font-size is **a flat 14px at every viewport ≥ 768px**, and **16px on phones** (< 768px, where layouts already stack and 14px is hard to read).
- **Do not re-introduce per-breakpoint root font-sizes.** They used to step up (15px ≥1600, 16px ≥1920 — central still does), which rendered the whole product 14% larger on a 1080p monitor than on a 1366 laptop and read as permanently zoomed in. A bigger screen should show *more* content, not *bigger* content. If a wide page needs more room, raise its `max-w-*` tier — the wide-tier `--container-6xl/7xl` caps in `index.css` exist for exactly that.

### Type scale

Use these pairings exactly; they are the whole scale.

| Role | Classes |
| --- | --- |
| Body, form controls, table cells | `text-sm` |
| Meta, captions, badges, table column heads | `text-xs` — column heads are **sentence case**; never `uppercase tracking-wide` on a `TableHead` |
| Field labels | `text-xs font-medium` (or the `Label` primitive) |
| Sidebar nav labels | the `.nav-label` class (the `--nav-label-size` token, 0.8125rem) — hi/te keep `text-sm` |
| Section / card title | `text-base font-semibold` (`CardTitle`) |
| Dialog / sheet title | `text-base font-semibold` (`DialogTitle`, `SheetTitle`) |
| Page title — every in-app page | `text-lg font-semibold tracking-tight`, always through `PageHeader` |
| Auth, flow, empty-state and hero headings | `text-2xl font-semibold tracking-tight` (`AuthHeading`) |
| Big stat number | `text-xl font-semibold tabular-nums`; a single hero stat may use `text-2xl` |
| Brand hero (login panel, portal hub) | `text-4xl xl:text-5xl` maximum |

- **Never `text-3xl` or larger inside a portal page.** The only exceptions are deliberate illustration type (the 404 numerals) and the portal hub.
- **Numbers are `font-semibold tabular-nums`, never `font-bold`.** Bold numerals at a large size are what made stat tiles shout over the labels next to them.
- **No responsive type bumps on headings** (`sm:text-3xl` and friends). The scale is fixed; a heading that changes size across breakpoints reads as two different levels.

### Controls

- Default control height is `h-9`: `Input` (default `inputSize`), `Button size="default"`, `Button size="icon"`. Dense toolbars use the `sm` size (`h-8`) on `Button`, `Combobox`, `DateRangePicker` and `TabsBar` together — never mix heights in one row.
- **Focus rings** (central's recipe): buttons `focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background`; fields (`Input`, `Combobox`, `Textarea`) `focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40` with no offset; controls inside a bordered shell (`Segmented`, `TabsBar`) use `ring-inset`. Never `ring-[3px]`.
- **Auth forms use `h-10` for both** — `Input inputSize="lg"` with `Button size="lg"`. Never mix heights within one form; an `h-10` button over an `h-9` input is visible and reads as a mis-scaled control.
- An icon overlaid inside a control is sized to that control: `w-10` + `pr-10` in an `h-10` field, `w-9` + `pr-9` in an `h-9` field. An overlay wider than the field is tall looks broken.

### Radius

- `rounded-md` — controls (inputs, buttons, menu items).
- `rounded-lg` — chips, badges, small icon tiles, nav items.
- `rounded-xl` — cards, panels, tiles, dialogs, sheets, loading skeletons. `Card` already does this; anything sitting beside a `Card` must match it.
- `rounded-2xl` is reserved for the **portal hub**, the **app-icon tiles** in the module grid, and **chat bubbles**. Do not use it for a card or panel.

### Layout rhythm

- Portal header is `h-12` in every shell (`bg-card shadow-header`), and a sidebar brand row is `h-12` so the two align across the seam. Sidebars are `w-16` collapsed / `w-64` expanded; rows are `px-3 py-2` with a `size-4` icon and a `.nav-label`, and the active row is the `.nav-link[data-status="active"]` gradient pill (index.css) — set `data-status` on hand-rolled `<a>` rows.
- Page padding is `px-4 py-4 sm:px-6` in every shell. **It is mirrored by `PAGE_BLEED` in [src/lib/page-bleed.ts](src/lib/page-bleed.ts)** — the offsets a sticky bar uses to sit flush under the app header. Change both or neither; never hand-roll `-mt-* -top-*` on a page.
- Vertical rhythm: `space-y-4` between page sections · `gap-4` within a section · `space-y-1.5` from label to control · `space-y-4` between form fields · `space-y-3` for a submit button plus its tertiary action.
- `Card` is `p-4` in its header, content and footer. Don't pass a `p-*` override to "tighten" it.
- Width caps follow the page-width convention in `index.css`: forms / detail / single-column reading pages `max-w-3xl`–`5xl`; tables, dashboards and two-column tools `max-w-7xl`.

### Shared page chrome

Use these; don't re-implement them on a page.

- **`PageHeader`** ([src/components/ui/page-header.tsx](src/components/ui/page-header.tsx)) — the one page heading. `title` (`text-lg`), optional `subtitle` / `icon` / `leading` (a back link, a badge), `actions` at the trailing edge, `tabs` (a `TabsBar`) sharing the row on wide screens and dropping to its own row below `lg`, `sticky` to pin it under the app header with the bleed offsets, and `children` for extra rows (filters, readouts, chips). The tabs box only takes the width the title and actions leave and scrolls inside it — that is what keeps a title, six tabs and a menu from ever overlapping. Student and parent pages use the `PageHeader` wrapper in [src/components/portal-layout.tsx](src/components/portal-layout.tsx), which adds the back link and module badge over the same component.
- **`TabsBar`** ([src/components/ui/tabs-bar.tsx](src/components/ui/tabs-bar.tsx)) — the underline tab strip (`value` / `onChange` / `tabs: TabDef[]`). Scrolls without a scrollbar and fades its trailing edge instead of wrapping; `actions` slot at the right; `bleed` for a full-width `h-11` bar; `className="border-b-0"` when the wrapping row owns the divider. Real `role="tablist"` with ←/→/Home/End.
- **`EmptyState`** ([src/components/ui/empty-state.tsx](src/components/ui/empty-state.tsx)) — every "nothing here" panel (`icon`, `title`, `description`, `action`, `compact`). Don't write a local `EmptyState`.
- **`Table`** — `zebra` on long lists; `<TableHeader sticky>` for a pinned head inside a bounded `containerClassName`.
- **`MenuSearchDialog`** ([src/components/employee/menu-search.tsx](src/components/employee/menu-search.tsx)) — the Ctrl/⌘-K menu search lives in the employee header, not the sidebar; the menu model is [src/lib/employee-menu.ts](src/lib/employee-menu.ts).

### Auth pages

- The student, employee and parent sign-in screens all compose the shared kit in [src/components/auth/](src/components/auth/): `AuthShell` (brand panel + form column + header `actions` slot), `AuthHeading`, `PasswordInput`, `FormError`, `PasswordHint`, `GoogleSignInButton`, `AuthTextButton`, and `auth-helpers.ts`. Don't re-implement any of them in a page — the three pages each carried their own copy once and drifted into three different heading sizes, two error colours and a hardcoded Google button width.
- **Nothing under `src/components/auth/` may call `t()` or import `@/lib/i18n`.** i18n is parent-only; importing it there would pull i18next into the student and employee login chunks. Pass translated strings in as props (every label has an English default).

## Color rules

- **Never** write a hex code, `rgb(...)`, `hsl(...)`, `oklch(...)`, or named color (`white`, `black`, `red-500`, etc.) outside [src/index.css](src/index.css).
- **Never** use Tailwind's built-in palette utilities like `bg-indigo-500`, `text-zinc-900`, `border-gray-200` in components. Use semantic utilities instead: `bg-primary`, `text-foreground`, `border-border`.
- If you need a new color role, add a semantic token to [src/index.css](src/index.css) (in both `:root` and `.dark`), expose it in `@theme inline`, then use the new utility — don't inline the value.
- For transparency over a token, use the slash syntax: `bg-primary/90`, `ring-ring/50`. Don't reach for raw rgba.

## Theme rules

- The app is wrapped in `<ThemeProvider>` ([src/components/theme-provider.tsx](src/components/theme-provider.tsx)) in [src/main.tsx](src/main.tsx). It owns two independent axes: **mode** (`light` / `dark` / `system`, default `system`, `localStorage['nucleus-ui-theme']`) and **preset** (`default` / `violet` / `emerald` / `slate`, `localStorage['nucleus-ui-theme-preset']`).
- Read/set both via `useTheme()` (`theme`, `resolvedTheme`, `setTheme`, `preset`, `setPreset`). Never read `localStorage` or `prefers-color-scheme` directly from a component. The picker is `ThemePresetMenuItems` in each shell's account menu.
- **Presets are classes on `<html>`** — `themed theme-<key>`, composing with `dark`. A preset block in `index.css` declares only anchors (`--brand-*`, `--background`, `--foreground`, `--sidebar`, and `--card` / `--popover` in dark); the shared `.themed` / `.dark.themed` blocks derive every neutral. **Adding a theme = one ~15-line CSS block + one entry in [src/config/themes.ts](src/config/themes.ts)** (keep the key sets in step; the pre-paint script in `index.html` whitelists keys by shape).
- Presets apply only where `<ThemePresetScope />` is mounted — the three signed-in shells. Login pages, the portal hub and the 404 always render the brand look, and the pre-paint script mirrors that with a "has an access token" check so a reload never flashes.
- **Never themed**: `--nucleus-*` (logo mark), `--hub-*`, `--brand-panel-*`, `--icon-*`, `--chart-*`, `--google-*`. Brand chrome and the module/chart palettes are brand, not preference.
- Dark-mode variants use the `dark:` prefix (which targets the `.dark` class on `<html>` set by `ThemeProvider`). Never write a separate `@media (prefers-color-scheme: dark)` block — the provider already mirrors system preference.

### Native scrollbars & `color-scheme`

- Native browser UI (scrollbars, native `<select>` popups, form controls) is painted from the CSS `color-scheme` property. Because theme is switched via the `.dark` class and **not** the OS `prefers-color-scheme`, `color-scheme` is pinned per app-theme in [src/index.css](src/index.css): `color-scheme: light` in `:root`, `color-scheme: dark` in `.dark`.
- **Never set `color-scheme: light dark`** (or leave it OS-driven) — that follows the OS, giving a **dark native scrollbar in light mode** and a light one in dark mode. Keep the two pinned declarations in sync whenever you touch the token blocks.
- For a themed thin scrollbar on a specific scroll container, add the `scrollbar-themed` utility (6px, follows the `--scrollbar-thumb` tokens in every mode and preset); use `pane-scrollbar` (10px, stable gutter) on data grids and split panes that own their scrolling. The `color-scheme` pin above already covers every container that doesn't opt in.

### Where dark mode applies

- **Dark mode is available on every portal** — student (`student.*`), parent (`parent.*`) and employee (`employee.*`). All three shells render `<ThemeToggle />`, and all three sign-in screens offer it too.
- So **every screen must be checked in both themes**, and every `dark:` variant has to be correct everywhere. There is no light-only portal. (This rule used to exempt the employee portal; dark mode was added there, and the exemption is gone.)
- The **portal hub** (`app.*`) is the one exception in the other direction: it is always dark whatever the saved theme, painted from its own `--hub-*` tokens. It ignores `ThemeProvider` by design, so its utilities must not respond to `.dark`.
- New tokens must be defined in both `:root` AND `.dark` — never only one.

## Responsive rules

- **Every screen must be responsive**. No fixed-width layouts that break on smaller viewports, no hidden scroll on larger ones.
- **Primary targets** (design and test against these first):
  - **Tablet** — ~768px–1024px wide (portrait and landscape). This is the most common use case.
  - **720p** — 1280×720 (laptop / older monitor).
  - **1080p** — 1920×1080 (modern desktop).
- **Also support** (must not break, even if not the primary design target): mobile down to 360px, and ultra-wide ≥ 2560px.
- **Approach**: design mobile-first, then layer on `sm:` / `md:` / `lg:` / `xl:` / `2xl:` Tailwind breakpoints. Don't write desktop-first CSS that uses `max-w-*` media queries to "fix" small screens.
- **Use fluid units** where it makes sense: `w-full`, `max-w-*` containers, `min-h-svh` for full-viewport heights (not `100vh` — `svh` handles mobile browser chrome correctly), `clamp()` for fluid type if you need it.
- **Layout primitives**: prefer `grid` / `flex` with `gap-*` over manual margins. Use `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` patterns over fixed column counts.
- **Tap targets** ≥ 44×44px on touch (tablet). The shadcn `size="icon"` button (36px) is fine for desktop but use `size="default"` or larger for primary tablet actions.
- **Test in both orientations** for tablet — portrait (~768×1024) AND landscape (~1024×768). Sidebars and multi-column layouts often break in portrait.
- **Never** use `overflow-hidden` to hide responsive overflow — fix the layout instead.

## Component rules

- Reusable UI primitives live in [src/components/ui/](src/components/ui/). These are owned by us (shadcn copies code into the repo) — edit freely, but keep them generic and token-driven.
- Composite/feature components live in [src/components/](src/components/) (or feature folders).
- Use `class-variance-authority` (`cva`) for components with variants, following the pattern in [src/components/ui/button.tsx](src/components/ui/button.tsx). Always declare `defaultVariants`.
- Always pipe `className` through `cn(...)` so callers can extend styles.

### Sticky back button / page header

- **Any screen with a back button must keep it pinned** — the back control (and its primary nav: tabs or title) must stay visible while the body scrolls. Never let the back button scroll out of view.
- Employee-portal content scrolls **inside `<main>`** (see [src/components/employee-portal-layout.tsx](src/components/employee-portal-layout.tsx)), which sits below a fixed top bar. So `position: sticky; top-0` pins flush beneath that bar — no header offset needed.
- Use the shared primitives, don't hand-roll:
  - `<PageHeader sticky …>` ([src/components/ui/page-header.tsx](src/components/ui/page-header.tsx)) — the normal case: title, back link in `leading`, tabs, actions and any filter rows, pinned flush under the app header with the `PAGE_BLEED` offsets already applied. Reference: `InsightsHeader` in [src/components/employee/insights/bits.tsx](src/components/employee/insights/bits.tsx) and [src/pages/employee/attendance-analytics.tsx](src/pages/employee/attendance-analytics.tsx).
  - [src/components/ui/back-button.tsx](src/components/ui/back-button.tsx) — `<BackButton label onClick />`, the one standardized back control (ghost button + `ArrowLeft`). Put the navigation in `onClick` (router `useNavigate` / the `navigateTo` helper) — never `window.location`.
  - [src/components/ui/sticky-header.tsx](src/components/ui/sticky-header.tsx) — `<StickyHeader className>` for a pinned region that is *not* a page heading; it wraps with `sticky top-0 z-10 bg-background`. Supply padding, a `border-b` divider, and `space-y-*` via `className`; if it must bleed to the app header, use `PAGE_BLEED` from [src/lib/page-bleed.ts](src/lib/page-bleed.ts) rather than writing the offsets.
- The pinned bar **must be opaque** (`bg-background`) so scrolled content doesn't bleed through, and use `z-10` so it stays below popovers/sheets (`z-50`). Reference: [src/pages/employee/drive-management-drive-detail.tsx](src/pages/employee/drive-management-drive-detail.tsx) pins its back button + header + `TabsBar` together.

## What NOT to do

- Don't introduce CSS Modules, styled-components, emotion, inline `style={{...}}` for colors, or any other styling system. Tailwind utilities + shadcn primitives only.
- Don't add a second config layer (no `tailwind.config.js`, no JS theme overrides). v4 is CSS-first; everything goes through [src/index.css](src/index.css).
- Don't hardcode pixel sizes when a token fits — prefer the radius scale (`rounded-sm`/`md`/`lg`/`xl`), spacing scale, and typography scale.
- Don't write theme toggles or color-scheme detection by hand — reuse [src/components/theme-toggle.tsx](src/components/theme-toggle.tsx) or `useTheme()`.

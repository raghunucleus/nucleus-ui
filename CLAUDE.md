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

### Spreadsheets — `exceljs` and `xlsx`
- **`xlsx` (SheetJS) for reading** user-uploaded spreadsheets — parsing rows from `.xlsx` / `.csv` uploads in bulk-import flows.
- **`exceljs` for writing** generated exports — when the output needs styling, column widths, multiple sheets, or formulas.
- If you only need to emit a plain CSV with no styling, `xlsx` is also fine for the write side. Don't add a third spreadsheet library.

## Single source of truth: design tokens

All colors, radii, and surface treatments live as CSS variables in [src/index.css](src/index.css). This is the **only** file where raw color values, hex codes, or oklch values should appear.

- **Brand colors** are the three `--brand-*` vars at the top of `:root` and `.dark`. To rebrand, edit ONLY these six values.
- **Semantic tokens** (`--primary`, `--secondary`, `--accent`, `--background`, `--foreground`, `--muted`, `--border`, `--ring`, `--card`, `--popover`, `--destructive`, `--sidebar-*`, `--chart-*`) reference the brand vars or define neutral surfaces. These are what components consume.
- The `@theme inline` block maps every CSS var to a Tailwind color so utilities like `bg-primary`, `text-muted-foreground`, `border-border` work everywhere.

## Color rules

- **Never** write a hex code, `rgb(...)`, `hsl(...)`, `oklch(...)`, or named color (`white`, `black`, `red-500`, etc.) outside [src/index.css](src/index.css).
- **Never** use Tailwind's built-in palette utilities like `bg-indigo-500`, `text-zinc-900`, `border-gray-200` in components. Use semantic utilities instead: `bg-primary`, `text-foreground`, `border-border`.
- If you need a new color role, add a semantic token to [src/index.css](src/index.css) (in both `:root` and `.dark`), expose it in `@theme inline`, then use the new utility — don't inline the value.
- For transparency over a token, use the slash syntax: `bg-primary/90`, `ring-ring/50`. Don't reach for raw rgba.

## Theme rules

- The app is wrapped in `<ThemeProvider>` ([src/components/theme-provider.tsx](src/components/theme-provider.tsx)) in [src/main.tsx](src/main.tsx). Default is `system`, persisted to `localStorage` under `nucleus-ui-theme`.
- Read/set theme via `useTheme()`. Never read `localStorage` or `prefers-color-scheme` directly from a component.
- Dark-mode variants use the `dark:` prefix (which targets the `.dark` class on `<html>` set by `ThemeProvider`). Never write a separate `@media (prefers-color-scheme: dark)` block — the provider already mirrors system preference.

### Native scrollbars & `color-scheme`

- Native browser UI (scrollbars, native `<select>` popups, form controls) is painted from the CSS `color-scheme` property. Because theme is switched via the `.dark` class and **not** the OS `prefers-color-scheme`, `color-scheme` is pinned per app-theme in [src/index.css](src/index.css): `color-scheme: light` in `:root`, `color-scheme: dark` in `.dark`.
- **Never set `color-scheme: light dark`** (or leave it OS-driven) — that follows the OS, giving a **dark native scrollbar in light mode** and a light one in dark mode. Keep the two pinned declarations in sync whenever you touch the token blocks.
- For a themed thin scrollbar on a specific scroll container, add the `scrollbar-themed` utility class (defined in `src/index.css`, follows `--border`). The `color-scheme` pin above already covers every container that doesn't opt in.

### Where dark mode applies

- **Dark mode is available ONLY on the student/parent portal** (`app.*` subdomain — `member` variant from [src/lib/subdomain.ts](src/lib/subdomain.ts)).
- **The employee portal** (`employee.*` subdomain) is **light-only**. Do not render `<ThemeToggle />` on employee screens, and do not rely on `dark:` variants to look correct there — the employee app must be designed for light theme only.
- For shared components used by both portals, `dark:` variants are still allowed — they simply won't trigger when the component renders inside the employee variant (which forces light).
- New tokens must still be defined in both `:root` AND `.dark` so the member portal stays correct — never only one.

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
- Use the two shared primitives, don't hand-roll:
  - [src/components/ui/back-button.tsx](src/components/ui/back-button.tsx) — `<BackButton label onClick />`, the one standardized back control (ghost button + `ArrowLeft`). Put the navigation in `onClick` (router `useNavigate` / the `navigateTo` helper) — never `window.location`.
  - [src/components/ui/sticky-header.tsx](src/components/ui/sticky-header.tsx) — `<StickyHeader className>` wraps the pinned region with `sticky top-0 z-10 bg-background`. Supply padding, a `border-b` divider, and `space-y-*` via `className`.
- The pinned bar **must be opaque** (`bg-background` — the employee portal is light-only) so scrolled content doesn't bleed through, and use `z-10` so it stays below popovers/sheets (`z-50`). Reference: [src/components/corporate-relations/company-detail.tsx](src/components/corporate-relations/company-detail.tsx) pins its back button + header card + `TabBar` together.

## What NOT to do

- Don't introduce CSS Modules, styled-components, emotion, inline `style={{...}}` for colors, or any other styling system. Tailwind utilities + shadcn primitives only.
- Don't add a second config layer (no `tailwind.config.js`, no JS theme overrides). v4 is CSS-first; everything goes through [src/index.css](src/index.css).
- Don't hardcode pixel sizes when a token fits — prefer the radius scale (`rounded-sm`/`md`/`lg`/`xl`), spacing scale, and typography scale.
- Don't write theme toggles or color-scheme detection by hand — reuse [src/components/theme-toggle.tsx](src/components/theme-toggle.tsx) or `useTheme()`.

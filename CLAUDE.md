# Nucleus UI — Design & Styling Rules

These rules apply to every UI change in this repo. Follow them by default; only deviate with an explicit reason.

## Stack

- **Tailwind CSS v4** (CSS-first config, `@theme inline` block) — configured via `@tailwindcss/vite` in [vite.config.ts](vite.config.ts).
- **shadcn/ui** (style: `new-york`, base color: `zinc`) — configured in [components.json](components.json). Add new primitives with `npx shadcn@latest add <name>`.
- **lucide-react** for icons.
- **Path alias**: `@/` → `src/`. Always import via the alias, never via long relative paths.
- **`cn()`** from [src/lib/utils.ts](src/lib/utils.ts) is the only allowed way to merge Tailwind classes conditionally.

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
- Every new surface must look correct in both themes. If a token doesn't exist for what you need, add it to both `:root` AND `.dark` — never only one.

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

## What NOT to do

- Don't introduce CSS Modules, styled-components, emotion, inline `style={{...}}` for colors, or any other styling system. Tailwind utilities + shadcn primitives only.
- Don't add a second config layer (no `tailwind.config.js`, no JS theme overrides). v4 is CSS-first; everything goes through [src/index.css](src/index.css).
- Don't hardcode pixel sizes when a token fits — prefer the radius scale (`rounded-sm`/`md`/`lg`/`xl`), spacing scale, and typography scale.
- Don't write theme toggles or color-scheme detection by hand — reuse [src/components/theme-toggle.tsx](src/components/theme-toggle.tsx) or `useTheme()`.

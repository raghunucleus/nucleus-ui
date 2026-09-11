/**
 * Flush-bleed offsets for a page-level bar that has to sit under the app
 * header with no gutter: sticky page headers, tab strips, toolbars.
 *
 * The portal `<main>` is the scroll container and carries its own padding
 * (`px-4 py-4 sm:px-6`), so a plain `sticky top-0` pins to main's CONTENT box
 * and leaves a band above the bar for rows to scroll through. These classes
 * pull the bar back over the padding (`-mx-4 -mt-4`), pin it flush (`-top-4`)
 * and restore the inner gutter (`px-4`) so the content still lines up.
 *
 * This is the ONLY place that knows main's padding. If the shells change it,
 * change this — never hand-roll `-mt-* -top-*` on a page.
 */
export const PAGE_BLEED = '-mx-4 -mt-4 -top-4 px-4 sm:-mx-6 sm:px-6'

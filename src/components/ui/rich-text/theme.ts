import type { EditorThemeClasses } from 'lexical'

/**
 * Visual classes Lexical applies to formatted nodes. All colours come from the
 * app's semantic tokens so the editor adapts to dark/light. The checklist
 * checkbox is pseudo-element-heavy and can't be expressed as Tailwind utilities,
 * so it lives in `rich-text.css` behind the `rte-*` classes referenced here.
 *
 * Ported from akrivia-central's `central-ui`, trimmed to what a job description
 * needs: no mentions, tables, or code highlighting.
 *
 * This module must stay free of any Lexical *runtime* import — `RichTextView`
 * shares it, and pulling the editor into a read-only render would defeat the
 * lazy split.
 */
export const editorTheme: EditorThemeClasses = {
  paragraph: 'mb-1 last:mb-0',
  quote: 'my-2 border-l-4 border-border pl-3 italic text-muted-foreground',
  heading: {
    h1: 'mb-1 mt-1 text-2xl font-semibold',
    h2: 'mb-1 mt-1 text-xl font-semibold',
    h3: 'mb-1 mt-1 text-lg font-semibold',
  },
  list: {
    ul: 'my-1 ml-2 list-disc pl-6',
    ol: 'my-1 ml-2 list-decimal pl-6',
    listitem: 'mb-0.5',
    nested: {
      listitem: 'list-none',
    },
    listitemChecked: 'rte-listitem-checked',
    listitemUnchecked: 'rte-listitem-unchecked',
    checklist: 'rte-checklist',
  },
  link: 'cursor-pointer text-primary underline underline-offset-2',
  text: {
    bold: 'font-semibold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    underlineStrikethrough: '[text-decoration:underline_line-through]',
    code: 'rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]',
    subscript: 'align-sub text-[0.8em]',
    superscript: 'align-super text-[0.8em]',
    highlight: 'rounded bg-yellow-200 px-0.5 text-black dark:bg-yellow-300/80',
  },
  hr: 'rte-hr my-3 h-px border-0 bg-border',
  indent: '[--lexical-indent-base-value:1.5rem]',
}

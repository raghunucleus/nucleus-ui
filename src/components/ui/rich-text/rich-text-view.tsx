import { createElement, type CSSProperties, type ReactNode } from 'react'
import type { SerializedEditorState } from 'lexical'

import { cn } from '@/lib/utils'
import './rich-text.css'
import { editorTheme } from './theme'

/**
 * A lightweight, **Lexical-free** read-only renderer for stored
 * `SerializedEditorState` bodies (job descriptions, bond terms). It walks the
 * serialized JSON and renders plain React, reusing {@link editorTheme} so the
 * output matches the editor. Only a type-only `lexical` import is used (erased at
 * build), so importing this never pulls Lexical into the bundle — the heavy
 * editor loads on demand, for editing only.
 *
 * Reading JSON is version-tolerant: every field is read defensively and any
 * unknown node degrades to its children/text rather than throwing. That rule is
 * what lets the editor gain a node type without breaking every reader.
 *
 * Ported from akrivia-central's `central-ui`, trimmed alongside the editor (no
 * mentions, tables, or code highlighting). Its React Native twin lives at
 * `nucleus-mobile/components/ui/rich-text-view.tsx` and must stay in step.
 */
export function RichTextView({
  value,
  className,
}: {
  value: SerializedEditorState | null | undefined
  className?: string
}) {
  const root = (value as { root?: LexNode } | null | undefined)?.root
  if (!root || !Array.isArray(root.children)) return null
  return (
    <div className={cn('whitespace-pre-wrap break-words', className)}>
      {renderChildren(root)}
    </div>
  )
}

/** A serialized node — read defensively (shapes vary across Lexical versions). */
type LexNode = {
  type?: unknown
  children?: unknown
  text?: unknown
  [key: string]: unknown
}

/** Lexical text-format bitmask (see `lexical`'s `TextNode` format flags). */
const FORMAT = {
  bold: 1,
  italic: 2,
  strikethrough: 4,
  underline: 8,
  code: 16,
  subscript: 32,
  superscript: 64,
  highlight: 128,
} as const

function asNodes(children: unknown): LexNode[] {
  return Array.isArray(children) ? (children as LexNode[]) : []
}

function renderChildren(node: LexNode): ReactNode[] {
  return asNodes(node.children).map((child, i) => renderNode(child, i))
}

function renderNode(node: LexNode, key: number): ReactNode {
  if (!node || typeof node !== 'object') return null

  switch (node.type) {
    case 'text':
      return renderText(node, key)
    case 'linebreak':
      return <br key={key} />
    case 'tab':
      return (
        <span key={key} className="whitespace-pre">
          {'\t'}
        </span>
      )
    case 'paragraph': {
      const kids = renderChildren(node)
      // An empty paragraph still has to occupy a line, or blank lines collapse.
      return (
        <p key={key} className={editorTheme.paragraph}>
          {kids.length ? kids : <br />}
        </p>
      )
    }
    case 'heading': {
      const tag = typeof node.tag === 'string' ? node.tag : 'h3'
      const headings = editorTheme.heading ?? {}
      const cls =
        (headings as Record<string, string>)[tag] ?? headings.h3 ?? undefined
      return createElement(tag, { key, className: cls }, renderChildren(node))
    }
    case 'quote':
      return (
        <blockquote key={key} className={editorTheme.quote}>
          {renderChildren(node)}
        </blockquote>
      )
    case 'list':
      return renderList(node, key)
    case 'listitem':
      return renderListItem(node, key)
    case 'link':
    case 'autolink':
      return (
        <a
          key={key}
          href={typeof node.url === 'string' ? node.url : '#'}
          target="_blank"
          rel="noreferrer"
          className={editorTheme.link}
        >
          {renderChildren(node)}
        </a>
      )
    case 'horizontalrule':
      return <hr key={key} className={editorTheme.hr} />
    default: {
      // Unknown node: degrade to its children, or its text, never throw.
      if (Array.isArray(node.children))
        return <span key={key}>{renderChildren(node)}</span>
      if (typeof node.text === 'string') return <span key={key}>{node.text}</span>
      return null
    }
  }
}

function renderText(node: LexNode, key: number): ReactNode {
  const text = typeof node.text === 'string' ? node.text : ''
  const format = typeof node.format === 'number' ? node.format : 0
  const t = editorTheme.text ?? {}

  const classes: (string | undefined)[] = []
  if (format & FORMAT.bold) classes.push(t.bold)
  if (format & FORMAT.italic) classes.push(t.italic)
  // Underline + strikethrough is its own class: the two separate text-decoration
  // rules would otherwise override each other rather than combine.
  const underline = format & FORMAT.underline
  const strike = format & FORMAT.strikethrough
  if (underline && strike) classes.push(t.underlineStrikethrough)
  else {
    if (underline) classes.push(t.underline)
    if (strike) classes.push(t.strikethrough)
  }
  if (format & FORMAT.code) classes.push(t.code)
  if (format & FORMAT.subscript) classes.push(t.subscript)
  if (format & FORMAT.superscript) classes.push(t.superscript)
  if (format & FORMAT.highlight) classes.push(t.highlight)

  const style = parseStyle(node.style)
  return (
    <span key={key} className={cn(classes)} style={style}>
      {text}
    </span>
  )
}

function renderList(node: LexNode, key: number): ReactNode {
  const ordered = node.tag === 'ol' || node.listType === 'number'
  const list = editorTheme.list ?? {}
  const isCheck = node.listType === 'check'
  const cls = cn(ordered ? list.ol : list.ul, isCheck && list.checklist)
  const start =
    ordered && typeof node.start === 'number' && node.start !== 1
      ? node.start
      : undefined
  return createElement(
    ordered ? 'ol' : 'ul',
    { key, className: cls, start },
    renderChildren(node),
  )
}

function renderListItem(node: LexNode, key: number): ReactNode {
  const list = editorTheme.list ?? {}
  const kids = asNodes(node.children)
  const nested = kids.length === 1 && kids[0]?.type === 'list'
  let cls: string | undefined
  if (typeof node.checked === 'boolean') {
    cls = node.checked ? list.listitemChecked : list.listitemUnchecked
  } else if (nested) {
    // A list item that only wraps a nested list must not draw its own marker.
    cls = list.nested?.listitem
  } else {
    cls = list.listitem
  }
  return (
    <li key={key} className={cls}>
      {renderChildren(node)}
    </li>
  )
}

/**
 * Parse a Lexical inline `style` string (e.g. "color: red; font-size: 20px")
 * into a React style object. Defensive — malformed declarations are skipped.
 */
function parseStyle(style: unknown): CSSProperties | undefined {
  if (typeof style !== 'string' || !style.trim()) return undefined
  const out: Record<string, string> = {}
  for (const decl of style.split(';')) {
    const i = decl.indexOf(':')
    if (i === -1) continue
    const prop = decl.slice(0, i).trim()
    const val = decl.slice(i + 1).trim()
    if (!prop || !val) continue
    const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    out[camel] = val
  }
  return Object.keys(out).length ? (out as CSSProperties) : undefined
}

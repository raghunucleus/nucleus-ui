import { CHECK_LIST, CODE, TRANSFORMERS } from '@lexical/markdown'
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'
import { ClickableLinkPlugin } from '@lexical/react/LexicalClickableLinkPlugin'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import {
  $createHorizontalRuleNode,
  INSERT_HORIZONTAL_RULE_COMMAND,
} from '@lexical/react/LexicalHorizontalRuleNode'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin'
import { $insertNodeToNearestRoot } from '@lexical/utils'
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  type EditorState,
  type SerializedEditorState,
} from 'lexical'
import { useCallback, useEffect } from 'react'

import { cn } from '@/lib/utils'
import { editorNodes } from './rich-text/nodes'
import './rich-text/rich-text.css'
import { editorTheme } from './rich-text/theme'
import { Toolbar } from './rich-text/toolbar'

export type RichTextValue = SerializedEditorState

// No CodeNode is registered (see rich-text/nodes.ts) — the JD editor has no code
// blocks, so drop the fenced-code transformer whose dependency would otherwise throw
// "missing dependency code for transformer". Inline code (backtick) stays.
const MARKDOWN_TRANSFORMERS = [CHECK_LIST, ...TRANSFORMERS.filter((t) => t !== CODE)]

/**
 * Rich-text editor built on Lexical — headings, lists/check-lists, quote, inline
 * formatting, links and rules. Ported from akrivia-central's `central-ui` and
 * trimmed for job descriptions (no mentions, tables, emoji, colours or code
 * blocks).
 *
 * The value is the serialized editor state (JSON), stored in a `jsonb` column and
 * read back by `RichTextView` here and its React Native twin — neither of which
 * loads Lexical.
 *
 * TWO CONTRACTS, both of which fail silently if broken:
 *
 *  1. **Uncontrolled after mount.** `value` seeds the initial content ONCE via
 *     `initialConfig`; there is deliberately no effect pushing later `value`
 *     changes in (that would fight the user's caret on every keystroke). To show
 *     different content — switching between designation blocks, say — REMOUNT
 *     with a `key`. Miss that and the previous JD stays in the box.
 *
 *  2. **Empty is `null`, not an empty paragraph.** See {@link ChangeEmitter}.
 *
 * Import via `lazy-rich-text-editor` so Lexical stays out of the initial bundle.
 */
export function RichTextEditor({
  value,
  onChange,
  readOnly = false,
  className,
}: {
  value: RichTextValue | null
  onChange?: (value: RichTextValue | null) => void
  readOnly?: boolean
  className?: string
}) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'rich-text',
        editable: !readOnly,
        theme: editorTheme,
        nodes: [...editorNodes],
        editorState: value ? JSON.stringify(value) : null,
        onError: (error) => {
          console.error(error)
        },
      }}
    >
      <div
        className={cn(
          'flex flex-col text-sm',
          !readOnly &&
            'rounded-md border bg-background shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30',
          className,
        )}
      >
        {!readOnly && <Toolbar />}
        <div className="relative flex-1 overflow-hidden">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className={cn(
                  // text-left: an empty/unaligned paragraph otherwise inherits a
                  // centered text-align, which parks the caret mid-line.
                  'h-full overflow-y-auto py-2 text-left outline-none',
                  readOnly ? 'h-auto px-0 py-0' : 'max-h-96 min-h-28 px-3',
                )}
                aria-label="Rich text editor"
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </div>

      <HistoryPlugin />
      <ListPlugin />
      <CheckListPlugin />
      <LinkPlugin />
      <ClickableLinkPlugin />
      <TabIndentationPlugin />
      <HorizontalRulePlugin />
      {!readOnly && (
        <MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />
      )}
      {onChange && <ChangeEmitter onChange={onChange} />}
    </LexicalComposer>
  )
}

/** Handles INSERT_HORIZONTAL_RULE_COMMAND (the node ships the command only). */
function HorizontalRulePlugin() {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    return editor.registerCommand(
      INSERT_HORIZONTAL_RULE_COMMAND,
      () => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return false
        $insertNodeToNearestRoot($createHorizontalRuleNode())
        return true
      },
      COMMAND_PRIORITY_EDITOR,
    )
  }, [editor])
  return null
}

/**
 * Emits the serialized state on every content change — or `null` when the
 * document is empty.
 *
 * Contract 2: a touched-then-cleared editor must store `null`, NOT
 * `{"root":{"children":[{"type":"paragraph",…}]}}`. Lexical always keeps one
 * paragraph, so without this check an "empty" JD is a truthy blob and every
 * downstream "is the JD filled in?" test silently answers yes.
 */
function ChangeEmitter({
  onChange,
}: {
  onChange: (value: RichTextValue | null) => void
}) {
  const handle = useCallback(
    (editorState: EditorState) => {
      const isEmpty = editorState.read(() => {
        const root = $getRoot()
        if (root.getTextContent().trim() !== '') return false
        const children = root.getChildren()
        // A lone empty paragraph (or nothing) is empty; a rule/list still counts
        // as content even with no text.
        if (children.length === 0) return true
        return (
          children.length === 1 &&
          children[0].getType() === 'paragraph' &&
          children[0].getTextContent().trim() === ''
        )
      })
      onChange(isEmpty ? null : editorState.toJSON())
    },
    [onChange],
  )
  return <OnChangePlugin onChange={handle} ignoreSelectionChange />
}

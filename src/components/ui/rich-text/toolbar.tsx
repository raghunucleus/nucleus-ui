import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
  REMOVE_LIST_COMMAND,
} from '@lexical/list'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode'
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
} from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical'
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type BlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'number'
  | 'check'
  | 'quote'

const BLOCK_OPTIONS: { key: BlockType; label: string; icon: LucideIcon }[] = [
  { key: 'paragraph', label: 'Normal', icon: Pilcrow },
  { key: 'h1', label: 'Heading 1', icon: Heading1 },
  { key: 'h2', label: 'Heading 2', icon: Heading2 },
  { key: 'h3', label: 'Heading 3', icon: Heading3 },
  { key: 'bullet', label: 'Bulleted list', icon: List },
  { key: 'number', label: 'Numbered list', icon: ListOrdered },
  { key: 'check', label: 'Check list', icon: ListChecks },
  { key: 'quote', label: 'Quote', icon: Quote },
]

/**
 * The JD editor's toolbar. Trimmed from akrivia-central's: no colour pickers,
 * font family/size, alignment, tables, emoji or code blocks — a job description
 * needs structure, not typography.
 */
export function Toolbar() {
  const [editor] = useLexicalComposerContext()
  const [bold, setBold] = useState(false)
  const [italic, setItalic] = useState(false)
  const [underline, setUnderline] = useState(false)
  const [strikethrough, setStrikethrough] = useState(false)
  const [isLink, setIsLink] = useState(false)
  const [block, setBlock] = useState<BlockType>('paragraph')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const sync = useCallback(() => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return
    setBold(selection.hasFormat('bold'))
    setItalic(selection.hasFormat('italic'))
    setUnderline(selection.hasFormat('underline'))
    setStrikethrough(selection.hasFormat('strikethrough'))

    const anchorNode = selection.anchor.getNode()
    const parent = anchorNode.getParent()
    setIsLink($isLinkNode(parent) || $isLinkNode(anchorNode))

    const element =
      anchorNode.getKey() === 'root'
        ? anchorNode
        : anchorNode.getTopLevelElementOrThrow()
    if ($isListNode(element)) {
      // Read the list type off the nearest ListNode, not the top-level element:
      // a nested list's top level is still the outer list.
      const listNode = $getNearestNodeOfType(anchorNode, ListNode)
      const type = listNode ? listNode.getListType() : element.getListType()
      setBlock(type === 'number' ? 'number' : type === 'check' ? 'check' : 'bullet')
    } else if ($isHeadingNode(element)) {
      const tag = element.getTag()
      setBlock(tag === 'h1' ? 'h1' : tag === 'h2' ? 'h2' : 'h3')
    } else if ($isQuoteNode(element)) {
      setBlock('quote')
    } else {
      setBlock('paragraph')
    }
  }, [])

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => sync())
      }),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload)
          return false
        },
        1,
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload)
          return false
        },
        1,
      ),
    )
  }, [editor, sync])

  const setBlockType = (next: BlockType) => {
    if (next === 'bullet' || next === 'number' || next === 'check') {
      const insert =
        next === 'bullet'
          ? INSERT_UNORDERED_LIST_COMMAND
          : next === 'number'
            ? INSERT_ORDERED_LIST_COMMAND
            : INSERT_CHECK_LIST_COMMAND
      // Re-picking the active list type toggles it off.
      editor.dispatchCommand(block === next ? REMOVE_LIST_COMMAND : insert, undefined)
      return
    }
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return
      $setBlocksType(selection, () => {
        if (next === 'h1' || next === 'h2' || next === 'h3')
          return $createHeadingNode(next)
        if (next === 'quote') return $createQuoteNode()
        return $createParagraphNode()
      })
    })
  }

  const toggleLink = () => {
    if (isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
      return
    }
    const url = window.prompt('Link URL')
    if (!url) return
    // Only http(s) — a javascript: URL here would be stored and later rendered
    // as an anchor href for every reader of this JD.
    if (!/^https?:\/\//i.test(url)) {
      window.alert('Links must start with http:// or https://')
      return
    }
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1">
      <IconButton
        label="Undo"
        icon={Undo2}
        disabled={!canUndo}
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
      />
      <IconButton
        label="Redo"
        icon={Redo2}
        disabled={!canRedo}
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
      />
      <Divider />

      {BLOCK_OPTIONS.map((b) => (
        <IconButton
          key={b.key}
          label={b.label}
          icon={b.icon}
          active={block === b.key}
          onClick={() => setBlockType(b.key)}
        />
      ))}
      <Divider />

      <IconButton
        label="Bold"
        icon={Bold}
        active={bold}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
      />
      <IconButton
        label="Italic"
        icon={Italic}
        active={italic}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
      />
      <IconButton
        label="Underline"
        icon={Underline}
        active={underline}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
      />
      <IconButton
        label="Strikethrough"
        icon={Strikethrough}
        active={strikethrough}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
      />
      <Divider />

      <IconButton label="Link" icon={Link2} active={isLink} onClick={toggleLink} />
      <IconButton
        label="Divider"
        icon={Minus}
        onClick={() =>
          editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)
        }
      />
    </div>
  )
}

function IconButton({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string
  icon: LucideIcon
  active?: boolean
  disabled?: boolean
  onClick: () => void
}): ReactNode {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // The editor must keep its selection: a mousedown that steals focus
      // collapses it, and the command would then apply to nothing.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded transition-colors',
        'text-muted-foreground hover:bg-accent hover:text-foreground',
        active && 'bg-primary/10 text-primary hover:bg-primary/15',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
}

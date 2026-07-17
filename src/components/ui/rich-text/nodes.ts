import { AutoLinkNode, LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import type { Klass, LexicalNode } from 'lexical'

/**
 * Every node type the editor can create — must match what gets serialized.
 *
 * This list is a contract with the read-only renderers: `RichTextView` here and
 * its React Native twin in nucleus-mobile both switch on these node types.
 * Adding a node here without teaching those renderers about it means the new
 * node degrades to its plain text on read (they never throw), so extend all
 * three together.
 */
export const editorNodes: ReadonlyArray<Klass<LexicalNode>> = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  HorizontalRuleNode,
]

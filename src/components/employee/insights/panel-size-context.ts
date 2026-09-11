import { createContext } from 'react'

/**
 * Whether the subtree is rendering inside a panel's expanded (full-screen)
 * dialog. Charts read it to fill the dialog instead of their fixed height;
 * lists drop their cap. Separate file so `bits.tsx` exports only components.
 */
export const PanelSizeContext = createContext<{ expanded: boolean }>({
  expanded: false,
})

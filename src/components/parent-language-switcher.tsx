import { Check, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PARENT_LANGS, setParentLang } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Language switcher for the parent portal — English / हिंदी / తెలుగు. Changing
 * the language re-renders every `useTranslation` consumer and persists the
 * choice (see setParentLang). Mirrors the icon-button styling of ThemeToggle so
 * it sits naturally beside it in the header.
 */
export function ParentLanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage ?? i18n.language

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t('lang.label')}>
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {PARENT_LANGS.map((lang) => {
          const active = current === lang.code
          return (
            <DropdownMenuItem
              key={lang.code}
              onSelect={() => setParentLang(lang.code)}
              className={cn(active && 'font-medium')}
            >
              <span className="flex-1">{lang.label}</span>
              {active && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

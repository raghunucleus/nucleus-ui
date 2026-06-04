import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { en } from './locales/en'
import { hi } from './locales/hi'
import { te } from './locales/te'

// ---------------------------------------------------------------------------
// i18n for the PARENT portal only. Student/employee UIs never call
// useTranslation, so they're unaffected. One `parent` namespace, resources
// bundled inline (synchronous init — no Suspense / flash). The chosen language
// is persisted under `nucleus.parent.lang`; only the parent language switcher
// ever writes it, so a student on the same domain never changes it.
// ---------------------------------------------------------------------------

export const PARENT_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'te', label: 'తెలుగు' },
] as const

export type ParentLang = (typeof PARENT_LANGS)[number]['code']

const STORAGE_KEY = 'nucleus.parent.lang'

function initialLang(): ParentLang {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'hi' || stored === 'te' ? stored : 'en'
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { parent: en },
    hi: { parent: hi },
    te: { parent: te },
  },
  lng: initialLang(),
  fallbackLng: 'en',
  ns: ['parent'],
  defaultNS: 'parent',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})

/** Switch the parent-portal language and remember it across reloads. */
export function setParentLang(lng: ParentLang): void {
  localStorage.setItem(STORAGE_KEY, lng)
  void i18n.changeLanguage(lng)
}

export function getParentLang(): ParentLang {
  const l = (i18n.resolvedLanguage ?? i18n.language) as string
  return l === 'hi' || l === 'te' ? l : 'en'
}

export default i18n

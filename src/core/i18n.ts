import GLib from "gi://GLib"
import { en, type Messages } from "./locales/en"
import { pt } from "./locales/pt"
import { es } from "./locales/es"

export type Locale = "en" | "pt" | "es"

/** "system" = seguir o locale do ambiente em vez de fixar um idioma. */
export type LocalePreference = Locale | "system"

export const LOCALES: Locale[] = ["en", "pt", "es"]

const CATALOGS: Record<Locale, Messages> = { en, pt, es }

/**
 * Primeiro idioma suportado entre os que o ambiente pede
 * (`LANGUAGE`/`LC_ALL`/`LC_MESSAGES`/`LANG`, nesta ordem, via GLib).
 * Compara só o prefixo: "pt_BR", "pt_PT" e "pt" caem todos em "pt".
 */
export function detectLocale(): Locale {
  for (const name of GLib.get_language_names()) {
    const prefix = name.split(/[_.@]/)[0].toLowerCase()
    const match = LOCALES.find((locale) => locale === prefix)
    if (match) return match
  }
  return "en"
}

export function resolveLocale(preference: LocalePreference): Locale {
  return preference === "system" ? detectLocale() : preference
}

/**
 * Recipiente mutável: `t` mantém sempre a mesma referência, e `initI18n`
 * troca o conteúdo. Isso permite que módulos façam `import { t }` no topo
 * sem depender da ordem de carga — desde que leiam as propriedades só em
 * tempo de render/chamada, nunca desestruturando no escopo do módulo.
 */
const messages: Messages = { ...en }

export const t: Messages = messages

/** Deve ser chamado uma vez por processo, antes de montar qualquer UI. */
export function initI18n(preference: LocalePreference): Locale {
  const locale = resolveLocale(preference)
  Object.assign(messages, CATALOGS[locale])
  return locale
}

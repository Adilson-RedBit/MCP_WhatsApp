import type { AutomationTriggerType } from '@/types'

export interface TriggerMeta {
  label: string
  /** Tailwind classes for the Badge pill on the list row. */
  pillClass: string
}

/** Trigger pill labels depend on the active locale, so this builds the
 *  metadata table on demand from `t` instead of living as a module-level
 *  constant. */
export function getTriggerMeta(
  t: (key: string) => string,
): Record<AutomationTriggerType, TriggerMeta> {
  return {
    new_message_received: {
      label: t('auto.trigger.newMessage.label'),
      pillClass: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    },
    first_inbound_message: {
      label: t('auto.trigger.firstMessage.label'),
      pillClass: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
    },
    keyword_match: {
      label: t('auto.trigger.keywordMatch.label'),
      pillClass: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
    },
    new_contact_created: {
      label: t('auto.trigger.newContact.label'),
      pillClass: 'border-primary/30 bg-primary/10 text-primary',
    },
    conversation_assigned: {
      label: t('auto.trigger.convAssigned.label'),
      pillClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    },
    tag_added: {
      label: t('auto.trigger.tagAdded.label'),
      pillClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    },
    time_based: {
      label: t('auto.trigger.timeBased.label'),
      pillClass: 'border-slate-500/30 bg-slate-500/10 text-muted-foreground',
    },
  }
}

export function triggerMeta(
  triggerType: AutomationTriggerType | string,
  t: (key: string) => string,
): TriggerMeta {
  return (
    getTriggerMeta(t)[triggerType as AutomationTriggerType] ?? {
      label: triggerType,
      pillClass: 'border-slate-500/30 bg-slate-500/10 text-muted-foreground',
    }
  )
}

export function formatRelative(
  iso: string | null | undefined,
  t: (key: string) => string,
): string {
  if (!iso) return t('auto.relative.never')
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return t('auto.relative.never')
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return t('auto.relative.justNow')
  if (diffSec < 3600) return t('auto.relative.minutesAgo').replace('{count}', String(Math.floor(diffSec / 60)))
  if (diffSec < 86400) return t('auto.relative.hoursAgo').replace('{count}', String(Math.floor(diffSec / 3600)))
  if (diffSec < 2_592_000) return t('auto.relative.daysAgo').replace('{count}', String(Math.floor(diffSec / 86400)))
  return new Date(iso).toLocaleDateString()
}

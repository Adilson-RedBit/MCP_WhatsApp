import type {
  AutomationStepConfig,
  AutomationStepType,
  AutomationTriggerConfig,
  AutomationTriggerType,
} from '@/types'

export type TemplateSlug =
  | 'welcome_message'
  | 'out_of_office'
  | 'lead_qualifier'
  | 'follow_up_reminder'

export interface TemplateStepSeed {
  step_type: AutomationStepType
  step_config: AutomationStepConfig
  branch?: 'yes' | 'no' | null
  /** Index (within this seed list) of the Condition parent, if nested. */
  parent_index?: number | null
}

export interface AutomationTemplateDefinition {
  slug: TemplateSlug
  name: string
  description: string
  trigger_type: AutomationTriggerType
  trigger_config: AutomationTriggerConfig
  steps: TemplateStepSeed[]
}

/** Template name/description depend on the active locale, so this builds
 *  the templates table on demand from `t` instead of living as a
 *  module-level constant. */
export function getAutomationTemplates(
  t: (key: string) => string,
): Record<TemplateSlug, AutomationTemplateDefinition> {
  return {
    welcome_message: {
      slug: 'welcome_message',
      name: t('auto.templates.welcomeMessage.name'),
      description: t('auto.templates.welcomeMessage.description'),
      // first_inbound_message (added in PR #33) catches both brand-new
      // contacts AND manually-added/imported contacts on their first-ever
      // reply, which is what a user setting up a "welcome" automation
      // almost always wants. new_contact_created would miss the
      // manually-imported case.
      trigger_type: 'first_inbound_message',
      trigger_config: {},
      steps: [
        {
          step_type: 'send_message',
          step_config: {
            text: "Hi! 👋 Thanks for reaching out. We'll get back to you shortly.",
          },
        },
        {
          step_type: 'add_tag',
          step_config: { tag_id: '' },
        },
      ],
    },
    out_of_office: {
      slug: 'out_of_office',
      name: t('auto.templates.outOfOffice.name'),
      description: t('auto.templates.outOfOffice.description'),
      trigger_type: 'new_message_received',
      trigger_config: {},
      steps: [
        {
          step_type: 'condition',
          step_config: {
            subject: 'time_of_day',
            operand: '18:00-09:00',
          },
        },
        {
          step_type: 'send_message',
          step_config: {
            text:
              "Thanks for your message! Our team is offline right now (9am–6pm) and will reply first thing tomorrow.",
          },
          parent_index: 0,
          branch: 'yes',
        },
      ],
    },
    lead_qualifier: {
      slug: 'lead_qualifier',
      name: t('auto.templates.leadQualifier.name'),
      description: t('auto.templates.leadQualifier.description'),
      trigger_type: 'keyword_match',
      trigger_config: {
        keywords: ['pricing', 'quote', 'buy'],
        match_type: 'contains',
      },
      steps: [
        {
          step_type: 'send_message',
          step_config: {
            text:
              "Great — happy to help with pricing! Quick question: roughly how many seats are you looking for?",
          },
        },
        {
          step_type: 'wait',
          step_config: { amount: 10, unit: 'minutes' },
        },
        {
          step_type: 'assign_conversation',
          step_config: { mode: 'round_robin' },
        },
      ],
    },
    follow_up_reminder: {
      slug: 'follow_up_reminder',
      name: t('auto.templates.followUpReminder.name'),
      description: t('auto.templates.followUpReminder.description'),
      trigger_type: 'new_message_received',
      trigger_config: {},
      steps: [
        {
          step_type: 'wait',
          step_config: { amount: 1, unit: 'days' },
        },
        {
          step_type: 'send_message',
          step_config: {
            text:
              "Just circling back — did you have any other questions for us? Happy to help!",
          },
        },
      ],
    },
  }
}

export function getTemplate(
  slug: string,
  t: (key: string) => string,
): AutomationTemplateDefinition | null {
  return getAutomationTemplates(t)[slug as TemplateSlug] ?? null
}

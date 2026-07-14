import {
  Coins,
  FileText,
  KeyRound,
  LayoutGrid,
  Palette,
  PlugZap,
  Shield,
  Tags,
  User,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

/**
 * Settings information architecture for the redesigned page.
 *
 * The flat tab strip became a grouped left rail with a new Overview
 * landing. The URL query param stays `?tab=` (deep-linkable, and it
 * keeps the existing links in sidebar.tsx / header.tsx working) — we
 * just map the old values onto the new sections.
 */
export const SETTINGS_SECTIONS = [
  'overview',
  'profile',
  'security',
  'appearance',
  'whatsapp',
  'templates',
  'fields',
  'deals',
  'members',
  'api',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const DEFAULT_SECTION: SettingsSection = 'overview';

/**
 * Rail grouping. `labelKey` é uma chave de tradução (src/lib/i18n.ts)
 * resolvida pelos consumidores via useLocale().t — assim o rail e a
 * visão geral seguem o idioma escolhido em Configurações → Aparência.
 */
export interface SectionMeta {
  id: SettingsSection;
  labelKey: string;
  icon: LucideIcon;
  group: 'top' | 'account' | 'workspace';
}

export const SECTION_META: Record<SettingsSection, SectionMeta> = {
  overview: { id: 'overview', labelKey: 'settings.section.overview', icon: LayoutGrid, group: 'top' },
  profile: { id: 'profile', labelKey: 'settings.section.profile', icon: User, group: 'account' },
  security: { id: 'security', labelKey: 'settings.section.security', icon: Shield, group: 'account' },
  appearance: { id: 'appearance', labelKey: 'settings.section.appearance', icon: Palette, group: 'account' },
  whatsapp: { id: 'whatsapp', labelKey: 'settings.section.whatsapp', icon: PlugZap, group: 'workspace' },
  templates: { id: 'templates', labelKey: 'settings.section.templates', icon: FileText, group: 'workspace' },
  fields: { id: 'fields', labelKey: 'settings.section.fields', icon: Tags, group: 'workspace' },
  deals: { id: 'deals', labelKey: 'settings.section.deals', icon: Coins, group: 'workspace' },
  members: { id: 'members', labelKey: 'settings.section.members', icon: UsersRound, group: 'workspace' },
  api: { id: 'api', labelKey: 'settings.section.api', icon: KeyRound, group: 'workspace' },
};

export const RAIL_GROUPS: { labelKey: string | null; group: SectionMeta['group'] }[] = [
  { labelKey: null, group: 'top' },
  { labelKey: 'settings.group.account', group: 'account' },
  { labelKey: 'settings.group.workspace', group: 'workspace' },
];

function isSection(value: string | null): value is SettingsSection {
  return !!value && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

/**
 * Resolve a raw `?tab=` value to a section. Legacy tabs from the old
 * flat layout collapse onto their new home (Tags + Custom fields → the
 * merged "Fields & tags" section). Anything unknown falls back to the
 * Overview landing.
 */
export function resolveSection(raw: string | null): SettingsSection {
  if (raw === 'tags' || raw === 'custom-fields') return 'fields';
  if (isSection(raw)) return raw;
  return DEFAULT_SECTION;
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listFlowTemplates } from '@/lib/flows/templates'
import { DEFAULT_LOCALE, translate } from '@/lib/i18n'

/**
 * GET /api/flows/templates
 *
 * Returns the static template gallery (slug + name + description +
 * icon hint + node_count) so the New-flow dialog can render cards
 * without bundling the full template payloads client-side. Bodies
 * are fetched only on actual clone via POST /api/flows.
 *
 * Available to any signed-in user. Flows is in soft-GA.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Shallow shape so the client gallery doesn't have to know about
  // the full node tree. No request-scoped locale on this server
  // route, so templates fall back to the app's default/source
  // language (pt-BR).
  const templates = listFlowTemplates((key) => translate(DEFAULT_LOCALE, key)).map((t) => ({
    slug: t.slug,
    name: t.name,
    description: t.description,
    icon: t.icon,
    trigger_type: t.trigger_type,
    node_count: t.nodes.length,
  }))
  return NextResponse.json({ templates })
}

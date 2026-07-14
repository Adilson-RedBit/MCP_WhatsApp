# RedBit CRM — Resumo da Sessão de Desenvolvimento

**Data:** 07/07/2026  
**Repositório base:** https://github.com/Adilson-RedBit/MCP_WhatsApp  
**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Supabase · WhatsApp Business API

---

## 1. Rebranding e Personalização

- Renomeado de "Chatvolt / MCP_WhatsApp" para **RedBit CRM**
- Tema verde WhatsApp (`#25D366 / #128C7E`) aplicado no Tailwind
- Interface traduzida para **português brasileiro**
- Logo e nome "RedBit CRM" no sidebar e header
- Arquivo `.env.local` criado com todas as variáveis documentadas

---

## 2. Correção de Erros de Build

Três arquivos JSX estavam truncados (problema de edição anterior):

| Arquivo | Problema | Correção |
|---|---|---|
| `src/app/(auth)/signup/page.tsx` | Cortado em `</` na linha 242 | Fechamento do `</div>` e função |
| `src/app/(auth)/login/page.tsx` | Idem + `}div>` duplicado | Remoção do fragmento corrompido |
| `src/components/layout/header.tsx` | Cortado em `</DropdownMenu` | Fechamento completo do componente |

---

## 3. Módulo de Prospecção Ativa (nova funcionalidade)

### Objetivo
Captar leads ativos via **Google Places API (New)**, importar como contatos no CRM e disparar WhatsApp e/ou email automaticamente.

### Arquivos criados

#### Banco de dados
- **`supabase/migrations/027_prospecting.sql`**  
  Cria tabelas `prospecting_searches` e `lead_candidates` com RLS usando `is_account_member()`

- **`supabase/migrations/028_fix_prospecting_fk.sql`**  
  Corrige FK de `created_by` (era `profiles(id)`, deve ser `auth.users(id)`)  
  Cria função `increment_imported_count(p_search_id UUID)`

#### Bibliotecas
- **`src/lib/google-places.ts`**  
  Integração com Google Places API (New) — Text Search  
  Coordenadas dos 27 estados brasileiros para `locationBias`  
  Extrai: nome, telefone, endereço, cidade, estado, site, rating, categoria

- **`src/lib/resend.ts`**  
  Envio de emails via Resend (REST, sem SDK)  
  Template HTML com header verde WhatsApp  
  Suporte a `{{nome}}` como placeholder

#### Rotas de API
- **`POST /api/prospecting/search`** — busca no Google Places, salva sessão e candidatos no banco
- **`POST /api/prospecting/import`** — importa selecionados como contatos, dispara WhatsApp e email
- **`GET /api/prospecting/history`** — histórico das últimas 50 buscas
- **`GET /api/prospecting/test`** — diagnóstico (temporário, pode remover)

#### Interface
- **`src/app/(dashboard)/prospeccao/page.tsx`**  
  Formulário: atividade + estado (27 UFs) + cidade + raio  
  Cards de resultado com checkbox  
  Modal de importação com toggles WhatsApp e email  
  Suporte a placeholder `{{nome}}` nas mensagens

- **`src/components/layout/sidebar.tsx`** — item "Prospecção" com ícone Target e chip Beta
- **`src/components/layout/header.tsx`** — título "Prospecção Ativa" no mapa de rotas

#### Chaves de API configuradas no `.env.local`
```
GOOGLE_PLACES_API_KEY=AIzaSy...  (Places API New ativada no Google Cloud)
RESEND_API_KEY=re_...            (projeto "RedBit CRM" no Resend)
RESEND_FROM_EMAIL=RedBit CRM <noreply@redbitcrm.com>
```

---

## 4. Bugs Corrigidos Durante Desenvolvimento

| # | Erro | Causa | Solução |
|---|---|---|---|
| 1 | `relation "accounts" does not exist` | RLS policy usava `SELECT FROM account_members` (tabela inexistente) | Trocado para `is_account_member()` |
| 2 | `Internal server error` na busca | FK `created_by → profiles(id)` incompatível com `auth.uid()` | Migration 028 corrige para `auth.users(id)` |
| 3 | Importação falharia sem `user_id` | `contacts` exige `user_id NOT NULL`; rota não enviava | Adicionado `user_id: ctx.userId` no insert |
| 4 | `increment_imported_count` não existia | Função chamada no código mas nunca criada no banco | Criada na migration 028 |
| 5 | `PGRST205` — schema cache desatualizado | PostgREST não recarregou após DDL | `NOTIFY pgrst, 'reload schema';` |

---

## 5. Fluxograma

Arquivo `RedBit_CRM_Fluxograma.drawio` criado com todos os módulos:

```
Auth → Dashboard → Caixa de Entrada
                → Contatos ←──────────────────────────────────┐
                → Pipelines                                    │
                → Prospecção Ativa → Google Places             │
                    └─ Importar → cria Contato ────────────────┘
                                → Disparo WhatsApp (imediato)
                                → Disparo Email (Resend)
                → Disparos ← seleciona da Lista de Contatos
                → Automações
                → Fluxos (Beta)
                → Configurações
                    └─ WhatsApp Config · Equipe · API Keys
```

---

## 6. Pendências para Próxima Sessão

- [ ] Confirmar que busca + importação funcionam após `NOTIFY pgrst`
- [ ] Verificar domínio no Resend (`noreply@redbitcrm.com` precisa de domínio verificado)
- [ ] Configurar `META_APP_SECRET` no `.env.local` (ainda placeholder)
- [ ] Configurar `NEXT_PUBLIC_SITE_URL` com domínio real em produção
- [ ] Remover rota de diagnóstico `src/app/api/prospecting/test/route.ts`
- [ ] Traduzir páginas: Settings, Contacts, Pipelines, Broadcasts
- [ ] Deploy em produção (Vercel ou VPS)

---

## 7. Comandos Úteis

```bash
# Rodar localmente
npm run dev

# Recarregar schema PostgREST (após migrations)
-- No Supabase SQL Editor:
NOTIFY pgrst, 'reload schema';

# Verificar build sem erros
npm run build
```

---

*Gerado em 07/07/2026 — RedBit CRM v0.2.2*

# RedBit CRM — Sessão 2: Correções, Prospecção e Idiomas

**Data:** 07/07/2026
**Versão:** v0.2.3

---

## 1. Bugs corrigidos

### 1.1 Disparo WhatsApp da Prospecção nunca funcionava (crítico)
`/api/prospecting/import` chamava `/api/whatsapp/send` via fetch interno com payload errado (`{phone, message}`) e sem cookies de sessão — falhava silenciosamente com 401.
**Correção:** envio direto via Meta API (`sendTextMessage`), mesmo caminho do broadcast, com retry de variantes de telefone. O disparo cria conversa + mensagem e aparece na **Caixa de Entrada**. A resposta agora traz estatísticas (WhatsApp enviados/falhas, emails enviados).

### 1.2 Telefones sem código do país (crítico)
Google Places retorna formato nacional `(19) 3255-1234`; sem o `55` a Meta rotearia errado.
**Correção:** `normalizeBrazilPhone()` em `src/lib/whatsapp/phone-utils.ts` — normaliza para E.164 na importação.

### 1.3 Email do Resend com código-fonte no título (crítico)
Em `src/lib/resend.ts` o `<title>` interpolava uma *função*.
**Correção:** título fixo + escape de HTML em `businessName`/`senderName` (anti-injeção).

### 1.4 Importação gravava em colunas inexistentes (crítico)
A rota inseria `full_name` e `notes` — a tabela `contacts` usa `name` e não tem `notes`.
**Correção:** insert com `name`/`company`; detalhes do Google vão para `contact_notes`. Telefone duplicado (índice único da migration 022) agora **reaproveita o contato existente** em vez de falhar.

### 1.5 Google Places quebrava sem `types` (produção)
`addressComponents` às vezes vem sem `types` → `Cannot read properties of undefined`.
**Correção:** acesso defensivo `c.types?.includes(...)` em `src/lib/google-places.ts`.

### 1.6 Banco sem as tabelas de prospecção
As migrations 027/028 nunca tinham sido aplicadas (`PGRST205`).
**Correção:** script único aplicado no SQL Editor do Supabase (tabelas + RLS + função `increment_imported_count` + `NOTIFY pgrst`), já com o FK `created_by → auth.users(id)` correto.

### 1.7 Erros de build
- `.next` com cache da rota de teste removida → limpar `.next` e rebuildar.
- `Select onValueChange` não aceitava `null` na página de prospecção → wrapper `(v) => set(v ?? fallback)`.

### 1.8 Usabilidade da Prospecção
- Erro de importação aparecia **atrás** do modal → agora exibido dentro do modal.
- Banner de resultado mostra motivo da falha (`Motivo: ...`) e estatísticas de disparo.
- Botão **Histórico** criado (a API existia sem interface).
- Aviso: Google não fornece email das empresas — disparo por email exige email manual.
- `{{nome}}` aceita espaços (`{{ nome }}`).

---

## 2. Idiomas (pt-BR · Español · English)

### Estrutura
- `src/lib/i18n.ts` — dicionários dos 3 idiomas (~300 chaves)
- `src/hooks/use-locale.tsx` — `LocaleProvider` + `useLocale()` (localStorage, sincroniza entre abas, define `<html lang>`)
- Provider montado em `src/app/layout.tsx`
- **Seletor em Configurações → Aparência** (🇧🇷 🇪🇸 🇺🇸), troca instantânea

### Onde o idioma já se aplica
- Menu lateral, header (títulos de página), menu do usuário
- **Configurações completas**: Visão geral (cards de status), Perfil, Senha, Sessões, Aparência, WhatsApp (incl. passo a passo), Templates (formulário completo), Campos e tags, Negociações e moeda, Equipe (incl. convites), Chaves de API

### Ainda em português (próximas rodadas)
- Toasts (mensagens passageiras de sucesso/erro)
- Telas: Painel, Caixa de Entrada, Contatos, Pipelines, Disparos, Automações, Fluxos, Prospecção

---

## 3. Traduções para PT concluídas (pendência da sessão 1)
Contatos, Pipelines (incl. etapas padrão "Novo Lead → Ganho"), Disparos (lista, novo, detalhe, status), navegação de Configurações. Datas em `pt-BR`.

## 4. Pendências da sessão 1 resolvidas
- [x] Busca + importação da Prospecção funcionando ponta a ponta (testado com dados reais)
- [x] Rota de diagnóstico `/api/prospecting/test` removida
- [x] Migrations 027/028 aplicadas no Supabase
- [x] Páginas traduzidas

## 5. Pendências para a próxima sessão
- [ ] Verificar domínio no Resend (`noreply@redbitcrm.com`)
- [ ] `META_APP_SECRET` real no `.env.local` (ainda placeholder)
- [ ] `NEXT_PUBLIC_SITE_URL` com domínio real em produção
- [ ] Traduzir toasts e demais telas (i18n já pronto — é aplicar `t()`)
- [ ] Disparo de prospecção com **template aprovado**: a Meta só permite texto livre na janela de 24h; para leads frios o primeiro contato exige template (`sendTemplateMessage`)
- [ ] Deploy em produção (Vercel ou VPS)

## 6. Arquivos criados/alterados nesta sessão

**Novos:** `src/lib/i18n.ts` · `src/hooks/use-locale.tsx` · `SESSAO_2_CORRECOES.md`

**Reescritos:** `src/app/api/prospecting/import/route.ts`

**Alterados:** `src/lib/resend.ts` · `src/lib/google-places.ts` · `src/lib/whatsapp/phone-utils.ts` · `src/lib/broadcast-status.ts` · `src/app/layout.tsx` · `src/app/(dashboard)/prospeccao/page.tsx` · páginas de contatos/pipelines/broadcasts/settings · `src/components/layout/{sidebar,header}.tsx` · 14 componentes em `src/components/settings/`

**Removido:** `src/app/api/prospecting/test/`

## 7. Verificação recomendada antes do deploy
```powershell
cd "C:\Users\Adilson\Documents\Claude\Projects\MCP_whatsApp"
Remove-Item -Recurse -Force .next
npm run build
```
Se o build passar, testar: troca de idioma em Configurações → Aparência; busca + importação na Prospecção; envio de template em Disparos.

---
*Gerado em 07/07/2026 — RedBit CRM v0.2.3*

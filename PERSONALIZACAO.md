# RedBit CRM — Guia de Personalização

Fork do [wacrm](https://github.com/ArnasDon/wacrm) personalizado para o projeto **RedBit CRM** por Adilson Paula Souza.

---

## O que foi alterado

### Identidade / Branding
| Arquivo | O que mudou |
|---|---|
| `src/app/layout.tsx` | Título da aba: `wacrm` → `RedBit CRM`; idioma: `en` → `pt-BR` |
| `src/app/icon.tsx` | Cor do ícone: roxo `#7c3aed` → verde WhatsApp `#25D366` |
| `package.json` | `name`, `author`, `description`, `homepage` atualizados |
| `src/lib/themes.ts` | Novo tema **Verde (WhatsApp)** adicionado como padrão; chaves de storage: `redbit-crm.*` |
| `src/app/globals.css` | Bloco CSS `html[data-theme="green"]` com cor primária `oklch(0.765 0.178 147)` (#25D366) |

### Navegação (português)
| Arquivo | O que mudou |
|---|---|
| `src/components/layout/sidebar.tsx` | Logo: `CRM Template for WhatsApp` → `RedBit CRM`; todos os labels do menu traduzidos; rótulos de roles traduzidos |
| `src/components/layout/header.tsx` | Títulos de página, labels do dropdown traduzidos |

### Telas de autenticação (português)
| Arquivo | O que mudou |
|---|---|
| `src/app/(auth)/login/page.tsx` | Todos os textos em português |
| `src/app/(auth)/signup/page.tsx` | Todos os textos em português; validações em PT-BR |
| `src/app/(auth)/forgot-password/page.tsx` | Todos os textos em português |

### Painel principal
| Arquivo | O que mudou |
|---|---|
| `src/app/(dashboard)/dashboard/page.tsx` | Títulos das métricas e textos de variação em português |
| `src/app/(dashboard)/dashboard-shell.tsx` | "Loading..." → "Carregando..." |

---

## Como rodar localmente

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.local.example .env.local
# Edite .env.local com suas credenciais do Supabase e Meta

# 3. Rodar em desenvolvimento
npm run dev
# Acesse: http://localhost:3000
```

---

## Configuração obrigatória antes do primeiro uso

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com)
2. Execute as migrations: `supabase/migrations/` no SQL editor do Supabase
3. Copie `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` do painel

### 2. WhatsApp Business API (Meta)
1. Crie um app no [Meta for Developers](https://developers.facebook.com)
2. Adicione o produto **WhatsApp Business**
3. Configure o webhook apontando para `https://seudominio.com.br/api/whatsapp/webhook`
4. Copie o `META_APP_SECRET` do painel Meta

### 3. Chave de criptografia
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Cole o resultado em `ENCRYPTION_KEY` no `.env.local`.

---

## Deploy (Hostinger — recomendado)

1. Faça push do fork para o GitHub
2. Em **hPanel → Websites → Criar**, selecione **Node.js** e conecte seu repositório
3. Adicione as variáveis do `.env.local` no painel hPanel (sem o arquivo)
4. Push para `main` → Hostinger faz o build e publica automaticamente

Documentação completa: [wacrm.tech/docs/deployment-hostinger](https://wacrm.tech/docs/deployment-hostinger)

---

## Próximas personalizações sugeridas

- [ ] **Logotipo SVG próprio** — substitua o ícone em `src/app/icon.tsx` pelo seu
- [ ] **Nome da empresa** — edite `src/components/layout/sidebar.tsx` linha com `RedBit CRM`
- [ ] **Cor primária** — ajuste o tema `green` em `src/app/globals.css` se quiser outra tonalidade
- [ ] **Traduzir páginas de Configurações** — `src/app/(dashboard)/settings/page.tsx`
- [ ] **Traduzir Contatos, Pipelines, Disparos** — componentes em `src/components/`
- [ ] **Domínio personalizado** — configure `NEXT_PUBLIC_SITE_URL` para seu domínio real

---

## Stack técnica

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Supabase** (Postgres + Auth + Storage + RLS)
- **Meta Cloud API** (WhatsApp Business API oficial)
- **Tailwind CSS v4** + shadcn/ui

---

## Repositório original

- Upstream: [ArnasDon/wacrm](https://github.com/ArnasDon/wacrm)
- Fork: [Adilson-RedBit/MCP_WhatsApp](https://github.com/Adilson-RedBit/MCP_WhatsApp)
- Licença: MIT

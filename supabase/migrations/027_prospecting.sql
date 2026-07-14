-- ============================================================
-- 027 — Prospecção ativa de leads
--
-- Tabelas para busca e captação de leads via Google Places API.
-- Cada conta pode fazer buscas por atividade + localidade e
-- importar os resultados como contatos, com opção de disparo
-- automático via WhatsApp e/ou email.
-- ============================================================

-- ------------------------------------------------------------
-- prospecting_searches — histórico de buscas realizadas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prospecting_searches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES profiles(id),
  query         text NOT NULL,        -- ex: "dentistas"
  location      text NOT NULL,        -- ex: "Campinas, SP"
  state         text,                 -- ex: "SP"
  city          text,                 -- ex: "Campinas"
  radius_km     int  NOT NULL DEFAULT 10,
  total_found   int  NOT NULL DEFAULT 0,
  imported_count int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prospecting_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account members manage prospecting searches" ON prospecting_searches;
CREATE POLICY "account members manage prospecting searches"
  ON prospecting_searches
  USING (is_account_member(account_id))
  WITH CHECK (is_account_member(account_id, 'agent'));

-- ------------------------------------------------------------
-- lead_candidates — candidatos encontrados em cada busca
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lead_candidates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id       uuid NOT NULL REFERENCES prospecting_searches(id) ON DELETE CASCADE,
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  google_place_id text,
  name            text NOT NULL,
  phone           text,
  email           text,
  address         text,
  city            text,
  state           text,
  website         text,
  rating          numeric(2,1),
  category        text,
  notes           text,
  -- importação
  imported        boolean NOT NULL DEFAULT false,
  contact_id      uuid REFERENCES contacts(id),
  -- disparos automáticos
  whatsapp_sent   boolean NOT NULL DEFAULT false,
  email_sent      boolean NOT NULL DEFAULT false,
  whatsapp_sent_at timestamptz,
  email_sent_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lead_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account members manage lead candidates" ON lead_candidates;
CREATE POLICY "account members manage lead candidates"
  ON lead_candidates
  USING (is_account_member(account_id))
  WITH CHECK (is_account_member(account_id, 'agent'));

-- índices para consultas comuns
CREATE INDEX IF NOT EXISTS lead_candidates_search_id_idx  ON lead_candidates(search_id);
CREATE INDEX IF NOT EXISTS lead_candidates_account_id_idx ON lead_candidates(account_id);
CREATE INDEX IF NOT EXISTS lead_candidates_imported_idx   ON lead_candidates(account_id, imported);

-- ============================================================
-- 028 — Correções do módulo de Prospecção Ativa
--
-- 1. Corrige FK de prospecting_searches.created_by
--    ctx.userId = auth.uid() → referencia auth.users(id),
--    não profiles(id) (que é um UUID interno diferente).
--
-- 2. Cria função increment_imported_count usada pelo
--    import route ao marcar candidatos como importados.
-- ============================================================

-- 1. Corrige FK created_by
ALTER TABLE prospecting_searches
  DROP CONSTRAINT IF EXISTS prospecting_searches_created_by_fkey;

ALTER TABLE prospecting_searches
  ADD CONSTRAINT prospecting_searches_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- 2. Função para incrementar o contador de importados
CREATE OR REPLACE FUNCTION increment_imported_count(p_search_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE prospecting_searches
  SET imported_count = imported_count + 1
  WHERE id = p_search_id;
END;
$$;

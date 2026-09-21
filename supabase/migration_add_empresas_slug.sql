-- =============================================================================
-- FrotaMaq — Adiciona coluna slug em public.empresas
-- Execute no SQL Editor do Supabase (banco já existente).
-- =============================================================================

BEGIN;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill a partir do nome (ASCII simplificado)
UPDATE public.empresas AS e
SET slug = COALESCE(
  NULLIF(
    trim(both '-' FROM lower(regexp_replace(regexp_replace(e.nome, '[^a-zA-Z0-9]+', '-', 'g'), '-+', '-', 'g'))),
    ''
  ),
  'empresa-' || substr(e.id::text, 1, 8)
)
WHERE e.slug IS NULL OR trim(e.slug) = '';

-- Garante unicidade em slugs duplicados
WITH ranked AS (
  SELECT
    id,
    slug,
    row_number() OVER (PARTITION BY slug ORDER BY created_at, id) AS rn
  FROM public.empresas
)
UPDATE public.empresas AS e
SET slug = e.slug || '-' || substr(e.id::text, 1, 4)
FROM ranked AS r
WHERE e.id = r.id
  AND r.rn > 1;

ALTER TABLE public.empresas
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_slug ON public.empresas(slug);

COMMIT;

-- Verificação
SELECT id, nome, slug FROM public.empresas ORDER BY nome;

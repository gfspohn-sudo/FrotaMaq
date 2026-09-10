-- =============================================================================
-- MULTI-TENANT — FrotaMaq
-- =============================================================================
--
-- IMPORTANTE (PostgreSQL): o valor 'super_admin' no enum precisa ser criado
-- ANTES de qualquer UPDATE ou função que o use.
--
-- Se der erro, execute em 2 etapas no SQL Editor:
--   1) Rode só o "PASSO 1" abaixo → Run
--   2) Rode o "PASSO 2" (resto do arquivo) → Run
-- =============================================================================

-- PASSO 1 — Execute primeiro (sozinho, se o script completo falhar)
ALTER TYPE public.perfil_usuario ADD VALUE 'super_admin';

-- =============================================================================
-- PASSO 2 — Restante da migration (pode rodar junto após o Passo 1)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.manutencoes
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;

ALTER TABLE public.alertas
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON public.usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_empresa ON public.veiculos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_empresa ON public.manutencoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_alertas_empresa ON public.alertas(empresa_id);

INSERT INTO public.empresas (nome, slug)
VALUES
  ('Empresa 1', 'empresa-1'),
  ('Empresa 2', 'empresa-2')
ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome;

UPDATE public.usuarios AS u
SET empresa_id = e.id
FROM public.empresas AS e
WHERE e.slug = 'empresa-1'
  AND u.empresa_id IS NULL
  AND u.perfil::text IN ('gerente', 'mecanico', 'motorista');

UPDATE public.veiculos AS v
SET empresa_id = e.id
FROM public.empresas AS e
WHERE e.slug = 'empresa-1'
  AND v.empresa_id IS NULL;

UPDATE public.manutencoes AS m
SET empresa_id = v.empresa_id
FROM public.veiculos AS v
WHERE m.veiculo_id = v.id
  AND m.empresa_id IS NULL;

UPDATE public.alertas AS a
SET empresa_id = v.empresa_id
FROM public.veiculos AS v
WHERE a.veiculo_id = v.id
  AND a.empresa_id IS NULL;

-- Usa comparação por texto (funciona na mesma sessão após ADD VALUE)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_perfil()::text = 'super_admin';
$$;

CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.usuarios WHERE id = auth.uid();
$$;

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin ve todas empresas" ON public.empresas;
CREATE POLICY "Super admin ve todas empresas"
  ON public.empresas FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Usuarios veem sua empresa" ON public.empresas;
CREATE POLICY "Usuarios veem sua empresa"
  ON public.empresas FOR SELECT
  USING (id = public.get_user_empresa_id());

-- PASSO 3 — Super Admin demo (após criar admin@frotamaq.com em Authentication → Users)
-- UPDATE public.usuarios
-- SET perfil = 'super_admin', empresa_id = NULL
-- WHERE email = 'admin@frotamaq.com';

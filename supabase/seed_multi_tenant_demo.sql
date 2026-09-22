-- =============================================================================
-- SEED MULTI-TENANT DEMO — FrotaMaq
-- Execute no Supabase SQL Editor (em ordem, se necessário em etapas)
-- =============================================================================
--
-- PRÉ-REQUISITO: criar os usuários em Authentication → Users (senha: 123456):
--   admin@frotamaq.com
--   gestor1@frotamaq.com
--   mecanico1@frotamaq.com
--   motorista1@frotamaq.com
--
-- ETAPA A — Rode SOZINHO primeiro (enum super_admin):
-- =============================================================================

ALTER TYPE public.perfil_usuario ADD VALUE 'super_admin';

-- Se der "already exists", ignore e siga para ETAPA B.
-- =============================================================================
-- ETAPA B — Restante do seed (pode rodar junto após ETAPA A)
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

-- Empresas de teste
INSERT INTO public.empresas (nome, slug)
VALUES
  ('Empresa 1', 'empresa-1'),
  ('Empresa 2', 'empresa-2')
ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome;

-- Perfis e vínculos (requer usuários já criados no Auth)
INSERT INTO public.usuarios (id, email, nome, perfil, empresa_id)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)),
  'super_admin'::public.perfil_usuario,
  NULL
FROM auth.users AS u
WHERE u.email = 'admin@frotamaq.com'
ON CONFLICT (id) DO UPDATE SET
  perfil = 'super_admin'::public.perfil_usuario,
  empresa_id = NULL,
  nome = EXCLUDED.nome;

INSERT INTO public.usuarios (id, email, nome, perfil, empresa_id)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'nome', 'Gestor Empresa 1'),
  'gerente'::public.perfil_usuario,
  e.id
FROM auth.users AS u
CROSS JOIN public.empresas AS e
WHERE u.email = 'gestor1@frotamaq.com'
  AND e.slug = 'empresa-1'
ON CONFLICT (id) DO UPDATE SET
  perfil = 'gerente'::public.perfil_usuario,
  empresa_id = EXCLUDED.empresa_id,
  nome = EXCLUDED.nome;

INSERT INTO public.usuarios (id, email, nome, perfil, empresa_id)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'nome', 'Mecânico Empresa 1'),
  'mecanico'::public.perfil_usuario,
  e.id
FROM auth.users AS u
CROSS JOIN public.empresas AS e
WHERE u.email = 'mecanico1@frotamaq.com'
  AND e.slug = 'empresa-1'
ON CONFLICT (id) DO UPDATE SET
  perfil = 'mecanico'::public.perfil_usuario,
  empresa_id = EXCLUDED.empresa_id,
  nome = EXCLUDED.nome;

INSERT INTO public.usuarios (id, email, nome, perfil, empresa_id)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'nome', 'Motorista Empresa 1'),
  'motorista'::public.perfil_usuario,
  e.id
FROM auth.users AS u
CROSS JOIN public.empresas AS e
WHERE u.email = 'motorista1@frotamaq.com'
  AND e.slug = 'empresa-1'
ON CONFLICT (id) DO UPDATE SET
  perfil = 'motorista'::public.perfil_usuario,
  empresa_id = EXCLUDED.empresa_id,
  nome = EXCLUDED.nome;

-- Funções auxiliares multi-tenant
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

-- RLS empresas
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin ve todas empresas" ON public.empresas;
CREATE POLICY "Super admin ve todas empresas"
  ON public.empresas FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Usuarios veem sua empresa" ON public.empresas;
CREATE POLICY "Usuarios veem sua empresa"
  ON public.empresas FOR SELECT
  USING (id = public.get_user_empresa_id());

-- Verificação
SELECT e.nome, u.email, u.perfil, u.empresa_id
FROM public.usuarios u
LEFT JOIN public.empresas e ON e.id = u.empresa_id
WHERE u.email IN (
  'admin@frotamaq.com',
  'gestor1@frotamaq.com',
  'mecanico1@frotamaq.com',
  'motorista1@frotamaq.com'
)
ORDER BY u.email;

-- =============================================================================
-- FrotaMaq — RECRIAÇÃO COMPLETA DO BANCO (CLEAN SLATE)
-- =============================================================================
-- Execute INTEIRO no SQL Editor do Supabase (projeto FrotaMaq).
--
-- ATENÇÃO: Apaga TODAS as tabelas, enums, políticas RLS e dados existentes.
-- Credencial criada ao final:
--   E-mail : admin@frotamaq.com
--   Senha  : 123456
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. RESET COMPLETO (CLEAN SLATE)
-- =============================================================================

-- Triggers e funções legadas
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trg_atualizar_status_veiculo ON public.manutencoes;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.atualizar_status_veiculo() CASCADE;
DROP FUNCTION IF EXISTS public.gerar_alertas_manutencao() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_perfil() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_empresa_id() CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS public.auth_user_perfil() CASCADE;
DROP FUNCTION IF EXISTS public.auth_user_empresa_id() CASCADE;

-- Views legadas
DROP VIEW IF EXISTS public.profiles CASCADE;

-- Tabelas (ordem respeitando FKs)
DROP TABLE IF EXISTS public.solicitacoes_relatorio CASCADE;
DROP TABLE IF EXISTS public.chaves_convite CASCADE;
DROP TABLE IF EXISTS public.reservas CASCADE;
DROP TABLE IF EXISTS public.alertas CASCADE;
DROP TABLE IF EXISTS public.manutencoes CASCADE;
DROP TABLE IF EXISTS public.veiculos CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TABLE IF EXISTS public.empresas CASCADE;

-- Enums e tipos legados
DROP TYPE IF EXISTS public.status_solicitacao CASCADE;
DROP TYPE IF EXISTS public.status_reserva CASCADE;
DROP TYPE IF EXISTS public.perfil_usuario CASCADE;
DROP TYPE IF EXISTS public.status_alerta CASCADE;
DROP TYPE IF EXISTS public.tipo_alerta CASCADE;
DROP TYPE IF EXISTS public.status_manutencao CASCADE;
DROP TYPE IF EXISTS public.tipo_manutencao CASCADE;
DROP TYPE IF EXISTS public.status_veiculo CASCADE;

-- Extensão para hash de senha (seed do Super Admin)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 2. DEFINIÇÃO DE ENUMS E ESTRUTURA DE TABELAS
-- =============================================================================

CREATE TYPE public.perfil_usuario AS ENUM (
  'super_admin',
  'gestor',
  'mecanico',
  'motorista'
);

CREATE TYPE public.status_reserva AS ENUM (
  'PENDENTE',
  'APROVADO',
  'REJEITADO'
);

CREATE TYPE public.status_solicitacao AS ENUM (
  'PENDENTE',
  'APROVADO',
  'REJEITADO'
);

-- Empresas (tenant root)
CREATE TABLE public.empresas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  cnpj        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_empresas_slug ON public.empresas(slug);

-- Usuários (perfil de domínio — id espelha auth.users)
CREATE TABLE public.usuarios (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id  UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  perfil      public.perfil_usuario NOT NULL DEFAULT 'motorista',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_empresa_id ON public.usuarios(empresa_id);
CREATE INDEX idx_usuarios_perfil ON public.usuarios(perfil);

-- Veículos
CREATE TABLE public.veiculos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome_exibicao        TEXT NOT NULL,
  placa                TEXT NOT NULL,
  ano                  INTEGER,
  ano_modelo           INTEGER,
  ano_carroceria       INTEGER,
  quilometragem_atual  INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'ATIVO',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, placa)
);

CREATE INDEX idx_veiculos_empresa_id ON public.veiculos(empresa_id);

-- Manutenções
CREATE TABLE public.manutencoes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id       UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  descricao        TEXT NOT NULL,
  valor_total      NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  data_manutencao  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo             TEXT NOT NULL DEFAULT 'PREVENTIVA',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_manutencoes_empresa_id ON public.manutencoes(empresa_id);
CREATE INDEX idx_manutencoes_veiculo_id ON public.manutencoes(veiculo_id);

-- Reservas
CREATE TABLE public.reservas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id         UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  motorista_id       UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  data_viagem        TIMESTAMPTZ NOT NULL,
  destino            TEXT NOT NULL,
  km_ida_volta       INTEGER NOT NULL CHECK (km_ida_volta > 0),
  status             public.status_reserva NOT NULL DEFAULT 'PENDENTE',
  observacao_gestor  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reservas_empresa_id ON public.reservas(empresa_id);
CREATE INDEX idx_reservas_motorista_id ON public.reservas(motorista_id);

-- Chaves de convite (motorista / mecânico)
CREATE TABLE public.chaves_convite (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  perfil      public.perfil_usuario NOT NULL
              CHECK (perfil IN ('motorista', 'mecanico')),
  ativa       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chaves_convite_empresa_id ON public.chaves_convite(empresa_id);
CREATE INDEX idx_chaves_convite_token ON public.chaves_convite(token);

-- Solicitações de acesso a relatório
CREATE TABLE public.solicitacoes_relatorio (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id         UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  solicitante_id     UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  status             public.status_solicitacao NOT NULL DEFAULT 'PENDENTE',
  observacao_gestor  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_solicitacoes_relatorio_empresa_id ON public.solicitacoes_relatorio(empresa_id);
CREATE INDEX idx_solicitacoes_relatorio_status ON public.solicitacoes_relatorio(status);

-- =============================================================================
-- 3. FUNÇÕES AUXILIARES DE RLS (SEGURANÇA)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.auth_user_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.empresa_id
  FROM public.usuarios AS u
  WHERE u.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.auth_user_perfil()
RETURNS public.perfil_usuario
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.perfil
  FROM public.usuarios AS u
  WHERE u.id = auth.uid()
$$;

-- Trigger: cria/atualiza perfil em public.usuarios após signup no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_perfil  text;
  meta_empresa uuid;
BEGIN
  meta_perfil := NULLIF(TRIM(NEW.raw_user_meta_data->>'perfil'), '');
  meta_empresa := NULLIF(TRIM(NEW.raw_user_meta_data->>'empresa_id'), '')::uuid;

  INSERT INTO public.usuarios (id, email, nome, perfil, empresa_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'nome'), ''), split_part(NEW.email, '@', 1)),
    COALESCE(meta_perfil::public.perfil_usuario, 'motorista'::public.perfil_usuario),
    meta_empresa
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    nome       = COALESCE(NULLIF(EXCLUDED.nome, ''), public.usuarios.nome),
    perfil     = COALESCE(EXCLUDED.perfil, public.usuarios.perfil),
    empresa_id = COALESCE(EXCLUDED.empresa_id, public.usuarios.empresa_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 4. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chaves_convite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_relatorio ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- EMPRESAS
-- super_admin: acesso total | demais: somente a própria empresa (por id)
-- ---------------------------------------------------------------------------
CREATE POLICY "empresas_select" ON public.empresas
  FOR SELECT TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR id = public.auth_user_empresa_id()
  );

CREATE POLICY "empresas_insert" ON public.empresas
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_perfil() = 'super_admin');

CREATE POLICY "empresas_update" ON public.empresas
  FOR UPDATE TO authenticated
  USING (public.auth_user_perfil() = 'super_admin')
  WITH CHECK (public.auth_user_perfil() = 'super_admin');

CREATE POLICY "empresas_delete" ON public.empresas
  FOR DELETE TO authenticated
  USING (public.auth_user_perfil() = 'super_admin');

-- ---------------------------------------------------------------------------
-- USUÁRIOS
-- super_admin: acesso total | demais: mesma empresa OU próprio registro
-- ---------------------------------------------------------------------------
CREATE POLICY "usuarios_select" ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
    OR id = auth.uid()
  );

CREATE POLICY "usuarios_insert" ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_perfil() = 'super_admin'
    OR id = auth.uid()
  );

CREATE POLICY "usuarios_update" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
    OR id = auth.uid()
  )
  WITH CHECK (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
    OR id = auth.uid()
  );

CREATE POLICY "usuarios_delete" ON public.usuarios
  FOR DELETE TO authenticated
  USING (public.auth_user_perfil() = 'super_admin');

-- ---------------------------------------------------------------------------
-- Macro tenant: tabelas com empresa_id
-- super_admin: acesso total | demais: empresa_id = auth_user_empresa_id()
-- ---------------------------------------------------------------------------

-- VEÍCULOS
CREATE POLICY "veiculos_select" ON public.veiculos
  FOR SELECT TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

CREATE POLICY "veiculos_insert" ON public.veiculos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

CREATE POLICY "veiculos_update" ON public.veiculos
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  )
  WITH CHECK (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

CREATE POLICY "veiculos_delete" ON public.veiculos
  FOR DELETE TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

-- MANUTENÇÕES
CREATE POLICY "manutencoes_select" ON public.manutencoes
  FOR SELECT TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

CREATE POLICY "manutencoes_insert" ON public.manutencoes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

CREATE POLICY "manutencoes_update" ON public.manutencoes
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  )
  WITH CHECK (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

CREATE POLICY "manutencoes_delete" ON public.manutencoes
  FOR DELETE TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

-- RESERVAS
CREATE POLICY "reservas_select" ON public.reservas
  FOR SELECT TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

CREATE POLICY "reservas_insert" ON public.reservas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

CREATE POLICY "reservas_update" ON public.reservas
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  )
  WITH CHECK (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

CREATE POLICY "reservas_delete" ON public.reservas
  FOR DELETE TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

-- CHAVES DE CONVITE (tenant + leitura pública para validação no cadastro)
CREATE POLICY "chaves_convite_select_tenant" ON public.chaves_convite
  FOR SELECT TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

CREATE POLICY "chaves_convite_public_validate" ON public.chaves_convite
  FOR SELECT TO anon, authenticated
  USING (ativa = TRUE);

CREATE POLICY "chaves_convite_insert" ON public.chaves_convite
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

CREATE POLICY "chaves_convite_update" ON public.chaves_convite
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  )
  WITH CHECK (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

CREATE POLICY "chaves_convite_delete" ON public.chaves_convite
  FOR DELETE TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

-- SOLICITAÇÕES DE RELATÓRIO
CREATE POLICY "solicitacoes_relatorio_select" ON public.solicitacoes_relatorio
  FOR SELECT TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

CREATE POLICY "solicitacoes_relatorio_insert" ON public.solicitacoes_relatorio
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

CREATE POLICY "solicitacoes_relatorio_update" ON public.solicitacoes_relatorio
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  )
  WITH CHECK (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

CREATE POLICY "solicitacoes_relatorio_delete" ON public.solicitacoes_relatorio
  FOR DELETE TO authenticated
  USING (
    public.auth_user_perfil() = 'super_admin'
    OR empresa_id = public.auth_user_empresa_id()
  );

-- Permissões de schema (Supabase)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.chaves_convite TO anon;

GRANT USAGE ON TYPE public.perfil_usuario TO anon, authenticated, service_role;
GRANT USAGE ON TYPE public.status_reserva TO anon, authenticated, service_role;
GRANT USAGE ON TYPE public.status_solicitacao TO anon, authenticated, service_role;

-- =============================================================================
-- 5. SEED INICIAL — SUPER ADMIN GLOBAL
-- =============================================================================

-- IDs fixos para reprodutibilidade
DO $$
DECLARE
  v_empresa_admin_id UUID := '00000000-0000-0000-0000-000000000001';
  v_admin_user_id    UUID := '00000000-0000-0000-0000-000000000099';
  v_instance_id      UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- Empresa padrão de sistema
  INSERT INTO public.empresas (id, nome, slug, cnpj)
  VALUES (v_empresa_admin_id, 'FrotaMaq Admin', 'frotamaq-admin', NULL)
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    slug = EXCLUDED.slug;

  -- Remove admin anterior (re-execução segura do seed)
  DELETE FROM auth.identities WHERE user_id = v_admin_user_id;
  DELETE FROM auth.users WHERE id = v_admin_user_id;
  DELETE FROM public.usuarios WHERE id = v_admin_user_id;

  -- Conta no Auth (login imediato — e-mail confirmado)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    v_instance_id,
    v_admin_user_id,
    'authenticated',
    'authenticated',
    'admin@frotamaq.com',
    crypt('123456', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'nome', 'Super Admin Global',
      'perfil', 'super_admin',
      'empresa_id', v_empresa_admin_id::text
    ),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

  -- id é gerado automaticamente (PK); provider_id = user id para login por e-mail
  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_admin_user_id::text,
    v_admin_user_id,
    jsonb_build_object(
      'sub', v_admin_user_id::text,
      'email', 'admin@frotamaq.com',
      'email_verified', true
    ),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  -- Perfil de domínio
  INSERT INTO public.usuarios (id, empresa_id, nome, email, perfil)
  VALUES (
    v_admin_user_id,
    v_empresa_admin_id,
    'Super Admin Global',
    'admin@frotamaq.com',
    'super_admin'
  )
  ON CONFLICT (id) DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id,
    nome       = EXCLUDED.nome,
    email      = EXCLUDED.email,
    perfil     = EXCLUDED.perfil;
END $$;

COMMIT;

-- =============================================================================
-- VERIFICAÇÃO PÓS-EXECUÇÃO
-- =============================================================================
SELECT 'empresas' AS tabela, count(*) AS total FROM public.empresas
UNION ALL SELECT 'usuarios', count(*) FROM public.usuarios
UNION ALL SELECT 'veiculos', count(*) FROM public.veiculos
UNION ALL SELECT 'manutencoes', count(*) FROM public.manutencoes
UNION ALL SELECT 'reservas', count(*) FROM public.reservas
UNION ALL SELECT 'chaves_convite', count(*) FROM public.chaves_convite
UNION ALL SELECT 'solicitacoes_relatorio', count(*) FROM public.solicitacoes_relatorio;

SELECT e.nome AS empresa, u.email, u.perfil::text AS perfil
FROM public.usuarios u
LEFT JOIN public.empresas e ON e.id = u.empresa_id
ORDER BY u.email;

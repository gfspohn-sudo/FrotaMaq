-- =============================================================================
-- FrotaLog — Políticas RLS por papel (RBAC)
-- Execute no SQL Editor do Supabase APÓS schema_reset_complete.sql (ou em DB existente).
-- Substitui políticas permissivas dev_* por controle multi-tenant por perfil.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Helpers (opcional — evita repetir subqueries)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_user_perfil()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT perfil FROM public.usuarios WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.auth_user_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()
$$;

-- -----------------------------------------------------------------------------
-- Habilitar RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Remover políticas antigas (dev + legado)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "dev_empresas_select" ON public.empresas;
DROP POLICY IF EXISTS "dev_empresas_insert" ON public.empresas;
DROP POLICY IF EXISTS "dev_empresas_update" ON public.empresas;
DROP POLICY IF EXISTS "dev_empresas_delete" ON public.empresas;

DROP POLICY IF EXISTS "dev_usuarios_select" ON public.usuarios;
DROP POLICY IF EXISTS "dev_usuarios_insert" ON public.usuarios;
DROP POLICY IF EXISTS "dev_usuarios_update" ON public.usuarios;
DROP POLICY IF EXISTS "dev_usuarios_delete" ON public.usuarios;

DROP POLICY IF EXISTS "dev_veiculos_select" ON public.veiculos;
DROP POLICY IF EXISTS "dev_veiculos_insert" ON public.veiculos;
DROP POLICY IF EXISTS "dev_veiculos_update" ON public.veiculos;
DROP POLICY IF EXISTS "dev_veiculos_delete" ON public.veiculos;

DROP POLICY IF EXISTS "dev_manutencoes_select" ON public.manutencoes;
DROP POLICY IF EXISTS "dev_manutencoes_insert" ON public.manutencoes;
DROP POLICY IF EXISTS "dev_manutencoes_update" ON public.manutencoes;
DROP POLICY IF EXISTS "dev_manutencoes_delete" ON public.manutencoes;

DROP POLICY IF EXISTS "dev_alertas_select" ON public.alertas;
DROP POLICY IF EXISTS "dev_alertas_insert" ON public.alertas;
DROP POLICY IF EXISTS "dev_alertas_update" ON public.alertas;
DROP POLICY IF EXISTS "dev_alertas_delete" ON public.alertas;

DROP POLICY IF EXISTS "veiculos_policy" ON public.veiculos;
DROP POLICY IF EXISTS "veiculos_select_policy" ON public.veiculos;
DROP POLICY IF EXISTS "veiculos_write_policy" ON public.veiculos;
DROP POLICY IF EXISTS "veiculos_insert_policy" ON public.veiculos;
DROP POLICY IF EXISTS "veiculos_update_policy" ON public.veiculos;
DROP POLICY IF EXISTS "veiculos_delete_policy" ON public.veiculos;

DROP POLICY IF EXISTS "manutencoes_policy" ON public.manutencoes;
DROP POLICY IF EXISTS "manutencoes_select_policy" ON public.manutencoes;
DROP POLICY IF EXISTS "manutencoes_insert_policy" ON public.manutencoes;
DROP POLICY IF EXISTS "manutencoes_update_policy" ON public.manutencoes;
DROP POLICY IF EXISTS "manutencoes_delete_policy" ON public.manutencoes;

DROP POLICY IF EXISTS "alertas_policy" ON public.alertas;
DROP POLICY IF EXISTS "alertas_select_policy" ON public.alertas;
DROP POLICY IF EXISTS "alertas_insert_policy" ON public.alertas;
DROP POLICY IF EXISTS "alertas_update_policy" ON public.alertas;
DROP POLICY IF EXISTS "alertas_delete_policy" ON public.alertas;

DROP POLICY IF EXISTS "empresas_select_policy" ON public.empresas;
DROP POLICY IF EXISTS "empresas_write_policy" ON public.empresas;

DROP POLICY IF EXISTS "usuarios_select_policy" ON public.usuarios;

-- -----------------------------------------------------------------------------
-- EMPRESAS
-- Super Admin: todas | Demais: somente a própria empresa
-- -----------------------------------------------------------------------------
CREATE POLICY "empresas_select_policy" ON public.empresas
FOR SELECT TO authenticated
USING (
  public.auth_user_perfil() = 'super_admin'
  OR id = public.auth_user_empresa_id()
);

CREATE POLICY "empresas_write_policy" ON public.empresas
FOR ALL TO authenticated
USING (public.auth_user_perfil() = 'super_admin')
WITH CHECK (public.auth_user_perfil() = 'super_admin');

-- -----------------------------------------------------------------------------
-- USUÁRIOS — leitura do próprio perfil (+ super_admin vê todos)
-- -----------------------------------------------------------------------------
CREATE POLICY "usuarios_select_policy" ON public.usuarios
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.auth_user_perfil() = 'super_admin'
);

-- -----------------------------------------------------------------------------
-- VEÍCULOS
-- Super Admin: tudo
-- Gestor/Gerente: CRUD na própria empresa
-- Mecânico: SELECT + UPDATE (medição) na própria empresa
-- Motorista: SELECT na própria empresa
-- -----------------------------------------------------------------------------
CREATE POLICY "veiculos_select_policy" ON public.veiculos
FOR SELECT TO authenticated
USING (
  public.auth_user_perfil() = 'super_admin'
  OR empresa_id = public.auth_user_empresa_id()
);

CREATE POLICY "veiculos_insert_policy" ON public.veiculos
FOR INSERT TO authenticated
WITH CHECK (
  public.auth_user_perfil() = 'super_admin'
  OR (
    empresa_id = public.auth_user_empresa_id()
    AND public.auth_user_perfil() IN ('gestor', 'gerente')
  )
);

CREATE POLICY "veiculos_update_policy" ON public.veiculos
FOR UPDATE TO authenticated
USING (
  public.auth_user_perfil() = 'super_admin'
  OR (
    empresa_id = public.auth_user_empresa_id()
    AND public.auth_user_perfil() IN ('gestor', 'gerente', 'mecanico')
  )
)
WITH CHECK (
  public.auth_user_perfil() = 'super_admin'
  OR (
    empresa_id = public.auth_user_empresa_id()
    AND public.auth_user_perfil() IN ('gestor', 'gerente', 'mecanico')
  )
);

CREATE POLICY "veiculos_delete_policy" ON public.veiculos
FOR DELETE TO authenticated
USING (
  public.auth_user_perfil() = 'super_admin'
  OR (
    empresa_id = public.auth_user_empresa_id()
    AND public.auth_user_perfil() IN ('gestor', 'gerente')
  )
);

-- -----------------------------------------------------------------------------
-- MANUTENÇÕES
-- Super Admin: tudo
-- Gestor/Mecânico: CRUD na própria empresa
-- Motorista: somente SELECT
-- -----------------------------------------------------------------------------
CREATE POLICY "manutencoes_select_policy" ON public.manutencoes
FOR SELECT TO authenticated
USING (
  public.auth_user_perfil() = 'super_admin'
  OR empresa_id = public.auth_user_empresa_id()
);

CREATE POLICY "manutencoes_insert_policy" ON public.manutencoes
FOR INSERT TO authenticated
WITH CHECK (
  public.auth_user_perfil() = 'super_admin'
  OR (
    empresa_id = public.auth_user_empresa_id()
    AND public.auth_user_perfil() IN ('gestor', 'gerente', 'mecanico')
  )
);

CREATE POLICY "manutencoes_update_policy" ON public.manutencoes
FOR UPDATE TO authenticated
USING (
  public.auth_user_perfil() = 'super_admin'
  OR (
    empresa_id = public.auth_user_empresa_id()
    AND public.auth_user_perfil() IN ('gestor', 'gerente', 'mecanico')
  )
)
WITH CHECK (
  public.auth_user_perfil() = 'super_admin'
  OR (
    empresa_id = public.auth_user_empresa_id()
    AND public.auth_user_perfil() IN ('gestor', 'gerente', 'mecanico')
  )
);

CREATE POLICY "manutencoes_delete_policy" ON public.manutencoes
FOR DELETE TO authenticated
USING (
  public.auth_user_perfil() = 'super_admin'
  OR (
    empresa_id = public.auth_user_empresa_id()
    AND public.auth_user_perfil() IN ('gestor', 'gerente')
  )
);

-- -----------------------------------------------------------------------------
-- ALERTAS
-- Mesma lógica das manutenções
-- -----------------------------------------------------------------------------
CREATE POLICY "alertas_select_policy" ON public.alertas
FOR SELECT TO authenticated
USING (
  public.auth_user_perfil() = 'super_admin'
  OR empresa_id = public.auth_user_empresa_id()
);

CREATE POLICY "alertas_insert_policy" ON public.alertas
FOR INSERT TO authenticated
WITH CHECK (
  public.auth_user_perfil() = 'super_admin'
  OR (
    empresa_id = public.auth_user_empresa_id()
    AND public.auth_user_perfil() IN ('gestor', 'gerente', 'mecanico')
  )
);

CREATE POLICY "alertas_update_policy" ON public.alertas
FOR UPDATE TO authenticated
USING (
  public.auth_user_perfil() = 'super_admin'
  OR (
    empresa_id = public.auth_user_empresa_id()
    AND public.auth_user_perfil() IN ('gestor', 'gerente', 'mecanico')
  )
)
WITH CHECK (
  public.auth_user_perfil() = 'super_admin'
  OR (
    empresa_id = public.auth_user_empresa_id()
    AND public.auth_user_perfil() IN ('gestor', 'gerente', 'mecanico')
  )
);

CREATE POLICY "alertas_delete_policy" ON public.alertas
FOR DELETE TO authenticated
USING (
  public.auth_user_perfil() = 'super_admin'
  OR (
    empresa_id = public.auth_user_empresa_id()
    AND public.auth_user_perfil() IN ('gestor', 'gerente')
  )
);

COMMIT;

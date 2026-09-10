-- Cadastro de usuário com empresa_id + listagem pública de empresas no signup
-- Execute no SQL Editor do Supabase após rls_rbac_policies.sql

-- 1) Trigger: persiste empresa_id dos metadados do Auth na tabela usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nome, perfil, empresa_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'perfil', 'motorista'),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'empresa_id'), '')::uuid
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    perfil = EXCLUDED.perfil,
    empresa_id = COALESCE(EXCLUDED.empresa_id, public.usuarios.empresa_id);
  RETURN NEW;
END;
$$;

-- 2) Permite usuários anônimos lerem empresas (dropdown do cadastro)
DROP POLICY IF EXISTS "empresas_select_signup" ON public.empresas;
CREATE POLICY "empresas_select_signup" ON public.empresas
FOR SELECT TO anon
USING (true);

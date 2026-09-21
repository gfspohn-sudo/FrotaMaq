-- Corrige atribuição de perfil/empresa no cadastro (evita default motorista indevido)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_perfil text;
  meta_empresa uuid;
BEGIN
  meta_perfil := NULLIF(TRIM(NEW.raw_user_meta_data->>'perfil'), '');
  meta_empresa := NULLIF(TRIM(NEW.raw_user_meta_data->>'empresa_id'), '')::uuid;

  INSERT INTO public.usuarios (id, email, nome, perfil, empresa_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'nome'), ''), split_part(NEW.email, '@', 1)),
    COALESCE(meta_perfil, 'motorista'),
    meta_empresa
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = COALESCE(NULLIF(EXCLUDED.nome, ''), public.usuarios.nome),
    perfil = COALESCE(NULLIF(EXCLUDED.perfil, ''), public.usuarios.perfil),
    empresa_id = COALESCE(EXCLUDED.empresa_id, public.usuarios.empresa_id);

  RETURN NEW;
END;
$$;

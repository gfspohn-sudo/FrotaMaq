-- ============================================================
-- FrotaMaq - Criar perfis demo na tabela usuarios
--
-- IMPORTANTE: este script NAO cria contas no Auth.
-- Primeiro crie os usuarios em Authentication > Users no painel
-- Supabase (ou execute: npm run seed:users com service role key).
--
-- Ao criar cada usuario no Auth, use estes metadados (User Metadata):
--   gerente@frotamaq.com   -> {"nome":"Gestor Demo","perfil":"gerente"}
--   mecanico@frotamaq.com  -> {"nome":"Mecanico Demo","perfil":"mecanico"}
--   motorista@frotamaq.com -> {"nome":"Motorista Demo","perfil":"motorista"}
--
-- Senha sugerida para todos: 123456
-- Marque "Auto Confirm User" ao criar manualmente.
-- ============================================================

INSERT INTO public.usuarios (id, email, nome, perfil)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'perfil', 'motorista')::public.perfil_usuario
FROM auth.users AS u
WHERE u.email IN (
  'gerente@frotamaq.com',
  'mecanico@frotamaq.com',
  'motorista@frotamaq.com'
)
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  nome = EXCLUDED.nome,
  perfil = EXCLUDED.perfil;

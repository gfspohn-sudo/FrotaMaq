-- Adiciona super_admin ao enum (rode PRIMEIRO, sozinho, se ainda não existir)
-- Se aparecer "already exists", ignore — o valor já foi criado.

ALTER TYPE public.perfil_usuario ADD VALUE 'super_admin';

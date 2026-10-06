-- Motivo obrigatório na recusa de reserva/aluguel.
-- Execute no SQL Editor do Supabase. Idempotente.

ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS motivo_recusa TEXT;

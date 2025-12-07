-- Habilitar Realtime para tabelas de pagamento e assinatura
-- Isso permite que o frontend receba atualizações em tempo real quando pagamentos são aprovados

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_subscriptions;
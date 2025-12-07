-- Criar regra de notificação automática para cliente desativado
INSERT INTO automatic_notification_rules (
  name,
  description,
  event_type,
  trigger_condition,
  target_audience,
  template_reference,
  active,
  priority
) VALUES (
  'Cliente Desativado - 30OFF',
  'Envia mensagem automática com cupom 30OFF quando o cliente é marcado como desativado',
  'client_deactivation',
  'on_deactivation',
  'client',
  'Primeira Chamada - 30OFF',
  true,
  10
) ON CONFLICT DO NOTHING;
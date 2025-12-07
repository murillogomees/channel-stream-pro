-- Inserir novas regras de notificação automática (25+ cenários)
-- Usando INSERT ... ON CONFLICT para evitar duplicatas

-- =============================================
-- CATEGORIA: CICLO DE VIDA DO CLIENTE
-- =============================================

-- 1. Boas-vindas para novos clientes (trial)
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Boas-vindas - Cliente Trial', 'Mensagem de boas-vindas para clientes em período de teste', 'client_registration', 'on_registration', 'client', 'welcome_trial', 1, true, NULL)
ON CONFLICT DO NOTHING;

-- 2. Boas-vindas para clientes pagantes
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Boas-vindas - Cliente Ativo', 'Mensagem de boas-vindas para clientes que ativaram assinatura', 'subscription_activated', 'on_activation', 'client', 'welcome_active', 2, true, NULL)
ON CONFLICT DO NOTHING;

-- 3. Trial terminando em 3 dias
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Trial Expirando - 3 dias', 'Lembrete de que o período de teste expira em 3 dias', 'trial_expiring', 'days_before_trial_end', 'client', 'trial_expiring_3_days', 3, true, 3)
ON CONFLICT DO NOTHING;

-- 4. Trial terminando em 1 dia
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Trial Expirando - 1 dia', 'Lembrete urgente de que o período de teste expira amanhã', 'trial_expiring', 'days_before_trial_end', 'client', 'trial_expiring_1_day', 4, true, 1)
ON CONFLICT DO NOTHING;

-- 5. Trial expirado
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Trial Expirado', 'Notificação de que o período de teste terminou com oferta especial', 'trial_expired', 'on_trial_expiration', 'client', 'trial_expired', 5, true, NULL)
ON CONFLICT DO NOTHING;

-- 6. Cliente desativado - oferta de retorno
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Cliente Desativado - Oferta 30% OFF', 'Oferta especial para clientes que foram desativados', 'client_deactivation', 'on_deactivation', 'client', 'Primeira Chamada - 30OFF', 6, true, NULL)
ON CONFLICT DO NOTHING;

-- 7. Cliente reativado
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Cliente Reativado - Bem-vindo de Volta', 'Mensagem de boas-vindas para clientes que voltaram', 'client_reactivation', 'on_reactivation', 'client', 'welcome_back', 7, true, NULL)
ON CONFLICT DO NOTHING;

-- 8. Upgrade de plano
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Upgrade de Plano', 'Confirmação e agradecimento por upgrade de plano', 'plan_upgrade', 'on_upgrade', 'client', 'plan_upgrade_confirmation', 8, true, NULL)
ON CONFLICT DO NOTHING;

-- 9. Downgrade de plano
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Downgrade de Plano', 'Confirmação de mudança de plano com informações', 'plan_downgrade', 'on_downgrade', 'client', 'plan_downgrade_confirmation', 9, true, NULL)
ON CONFLICT DO NOTHING;

-- 10. Aniversário de 6 meses como cliente
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Aniversário 6 Meses', 'Celebração de 6 meses como cliente com oferta especial', 'client_anniversary', 'on_6_months', 'client', 'anniversary_6_months', 10, true, NULL)
ON CONFLICT DO NOTHING;

-- 11. Aniversário de 1 ano como cliente
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Aniversário 1 Ano', 'Celebração de 1 ano como cliente com desconto especial', 'client_anniversary', 'on_1_year', 'client', 'anniversary_1_year', 11, true, NULL)
ON CONFLICT DO NOTHING;

-- =============================================
-- CATEGORIA: ASSINATURA E PAGAMENTO
-- =============================================

-- 12. Assinatura expirando - 14 dias (antecipado)
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Lembrete 14 dias antes vencimento', 'Lembrete antecipado sobre renovação', 'payment_due', 'days_before_due', 'client', 'expiration_14_days', 12, true, 14)
ON CONFLICT DO NOTHING;

-- 13. Assinatura expirada - 1 dia após
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Assinatura Expirada - 1 dia', 'Primeiro lembrete após expiração', 'subscription_expired', 'days_after_expiration', 'client', 'expired_1_day', 13, true, 1)
ON CONFLICT DO NOTHING;

-- 14. Assinatura expirada - 3 dias após
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Assinatura Expirada - 3 dias', 'Segundo lembrete com oferta após expiração', 'subscription_expired', 'days_after_expiration', 'client', 'expired_3_days_offer', 14, true, 3)
ON CONFLICT DO NOTHING;

-- 15. Assinatura expirada - 7 dias após
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Assinatura Expirada - 7 dias', 'Último lembrete com oferta especial', 'subscription_expired', 'days_after_expiration', 'client', 'expired_7_days_final', 15, true, 7)
ON CONFLICT DO NOTHING;

-- 16. Assinatura expirada - 15 dias após
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Assinatura Expirada - 15 dias', 'Oferta de retorno urgente', 'subscription_expired', 'days_after_expiration', 'client', 'expired_15_days_urgent', 16, true, 15)
ON CONFLICT DO NOTHING;

-- 17. Pagamento confirmado
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Pagamento Confirmado', 'Confirmação de recebimento de pagamento', 'payment_received', 'on_payment', 'client', 'payment_confirmed', 17, true, NULL)
ON CONFLICT DO NOTHING;

-- 18. Pagamento pendente
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Pagamento Pendente', 'Lembrete de pagamento aguardando confirmação', 'payment_pending', 'on_pending', 'client', 'payment_pending', 18, true, NULL)
ON CONFLICT DO NOTHING;

-- 19. Pagamento falhou
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Pagamento Falhou', 'Notificação de falha no pagamento com instruções', 'payment_failed', 'on_failure', 'client', 'payment_failed', 19, true, NULL)
ON CONFLICT DO NOTHING;

-- 20. Pagamento recorrente próximo
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Cobrança Recorrente Próxima', 'Aviso de cobrança recorrente em 3 dias', 'recurring_payment', 'days_before_charge', 'client', 'recurring_payment_reminder', 20, true, 3)
ON CONFLICT DO NOTHING;

-- =============================================
-- CATEGORIA: ENGAJAMENTO E RETENÇÃO
-- =============================================

-- 21. Usuário inativo - 7 dias
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Usuário Inativo - 7 dias', 'Lembrete para usuário sem acesso há 7 dias', 'user_inactive', 'days_inactive', 'client', 'inactive_7_days', 21, true, 7)
ON CONFLICT DO NOTHING;

-- 22. Usuário inativo - 14 dias
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Usuário Inativo - 14 dias', 'Lembrete urgente para usuário sem acesso há 14 dias', 'user_inactive', 'days_inactive', 'client', 'inactive_14_days', 22, true, 14)
ON CONFLICT DO NOTHING;

-- 23. Usuário inativo - 30 dias
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Usuário Inativo - 30 dias', 'Oferta de retenção para usuário inativo', 'user_inactive', 'days_inactive', 'client', 'inactive_30_days_offer', 23, true, 30)
ON CONFLICT DO NOTHING;

-- 24. Recomendação de conteúdo
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Recomendação Semanal', 'Sugestões de conteúdo baseadas no histórico', 'content_recommendation', 'weekly', 'client', 'weekly_recommendations', 24, true, NULL)
ON CONFLICT DO NOTHING;

-- 25. Recompensa de fidelidade
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Recompensa Fidelidade', 'Bônus ou desconto para clientes fiéis', 'loyalty_reward', 'on_milestone', 'client', 'loyalty_reward', 25, true, NULL)
ON CONFLICT DO NOTHING;

-- =============================================
-- CATEGORIA: NOTIFICAÇÕES ADMINISTRATIVAS
-- =============================================

-- 26. Admin - Novo pagamento recebido
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Admin - Pagamento Alto Valor', 'Alerta para admin sobre pagamentos acima de R$ 200', 'payment_received', 'high_value_payment', 'admin', 'admin_high_value_payment', 26, true, NULL)
ON CONFLICT DO NOTHING;

-- 27. Admin - Cliente em risco de churn
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Admin - Risco de Churn', 'Alerta sobre cliente com alto risco de cancelamento', 'churn_risk', 'on_risk_detection', 'admin', 'admin_churn_risk', 27, true, NULL)
ON CONFLICT DO NOTHING;

-- 28. Admin - Resumo diário
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Admin - Resumo Diário', 'Resumo diário de atividades e métricas', 'daily_summary', 'daily', 'admin', 'admin_daily_summary', 28, true, NULL)
ON CONFLICT DO NOTHING;

-- =============================================
-- CATEGORIA: COMUNICAÇÃO PROMOCIONAL
-- =============================================

-- 29. Black Friday
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Campanha Black Friday', 'Ofertas especiais de Black Friday', 'promotional_campaign', 'scheduled', 'client', 'black_friday_promo', 29, false, NULL)
ON CONFLICT DO NOTHING;

-- 30. Natal e Ano Novo
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Feliz Natal e Ano Novo', 'Mensagem de boas festas', 'seasonal_greeting', 'scheduled', 'client', 'christmas_new_year', 30, false, NULL)
ON CONFLICT DO NOTHING;

-- 31. Novo conteúdo disponível
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Novo Conteúdo Disponível', 'Aviso sobre novos canais ou filmes adicionados', 'new_content', 'on_content_added', 'client', 'new_content_alert', 31, true, NULL)
ON CONFLICT DO NOTHING;

-- 32. Manutenção programada
INSERT INTO automatic_notification_rules (name, description, event_type, trigger_condition, target_audience, template_reference, priority, active, days_before)
VALUES ('Aviso de Manutenção', 'Comunicado sobre manutenção programada', 'maintenance', 'scheduled', 'client', 'maintenance_notice', 32, true, NULL)
ON CONFLICT DO NOTHING;
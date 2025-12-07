-- Limpar logs antigos de skipped para os 3 clientes que já foram migrados
DELETE FROM profiles_migration_logs 
WHERE cliente_id IN (
  '01472576-e258-4ba6-aefd-a44d110e2a61',
  '7ab3fc96-b2e2-420a-997f-2fdc46b6ebcc', 
  '3ffd2972-4029-47fb-beef-3321b1cc9ef2'
)
AND action = 'skipped';

-- Adicionar logs corretos de migração usando job existente
INSERT INTO profiles_migration_logs (job_id, cliente_id, profile_id, action, field_mapping)
VALUES 
  ('2b6110ed-923e-42a1-b6fb-04193eae7fb4'::uuid, '01472576-e258-4ba6-aefd-a44d110e2a61', '01472576-e258-4ba6-aefd-a44d110e2a61', 'merged', '{"matched_by": "same_id"}'::jsonb),
  ('2b6110ed-923e-42a1-b6fb-04193eae7fb4'::uuid, '7ab3fc96-b2e2-420a-997f-2fdc46b6ebcc', '7ab3fc96-b2e2-420a-997f-2fdc46b6ebcc', 'merged', '{"matched_by": "same_id"}'::jsonb),
  ('2b6110ed-923e-42a1-b6fb-04193eae7fb4'::uuid, '3ffd2972-4029-47fb-beef-3321b1cc9ef2', '3ffd2972-4029-47fb-beef-3321b1cc9ef2', 'merged', '{"matched_by": "same_id"}'::jsonb);
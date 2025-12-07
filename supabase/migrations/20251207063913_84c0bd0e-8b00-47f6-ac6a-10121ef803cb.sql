-- Marcar os 3 clientes como migrados
UPDATE profiles 
SET migrated_from_clientes = true,
    cliente_legacy_id = id
WHERE id IN (
  '01472576-e258-4ba6-aefd-a44d110e2a61',
  '7ab3fc96-b2e2-420a-997f-2fdc46b6ebcc', 
  '3ffd2972-4029-47fb-beef-3321b1cc9ef2'
)
AND migrated_from_clientes IS NOT TRUE;

-- Marcar TODOS os profiles que têm correspondência em clientes como migrados
UPDATE profiles p
SET migrated_from_clientes = true,
    cliente_legacy_id = COALESCE(cliente_legacy_id, c.id)
FROM clientes c
WHERE (p.id = c.id OR p.telefone = c.telefone OR p.contact_phone = c.telefone OR (p.email = c.email AND c.email IS NOT NULL AND c.email != ''))
AND p.migrated_from_clientes IS NOT TRUE;
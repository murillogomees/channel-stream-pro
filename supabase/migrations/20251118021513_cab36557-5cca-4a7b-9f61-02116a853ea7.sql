-- Adicionar constraint para garantir que plan_type nunca seja vazio
ALTER TABLE m3u_lists 
ADD CONSTRAINT plan_type_not_empty 
CHECK (array_length(plan_type, 1) > 0);

COMMENT ON CONSTRAINT plan_type_not_empty ON m3u_lists 
IS 'Garante que pelo menos um tipo de plano esteja selecionado';
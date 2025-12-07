-- Ativar o flag USE_PROFILES_ONLY
UPDATE app_feature_flags 
SET enabled = true, 
    updated_at = NOW() 
WHERE flag_name = 'USE_PROFILES_ONLY';
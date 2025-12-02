-- Add geo-targeting support to cache_rules
ALTER TABLE cache_rules 
ADD COLUMN IF NOT EXISTS geo_countries TEXT[],
ADD COLUMN IF NOT EXISTS geo_continents TEXT[],
ADD COLUMN IF NOT EXISTS geo_exclude_countries TEXT[];

COMMENT ON COLUMN cache_rules.geo_countries IS 'List of ISO country codes to apply this rule (e.g., BR, US, UK)';
COMMENT ON COLUMN cache_rules.geo_continents IS 'List of continents to apply this rule (e.g., SA, NA, EU, AS, AF, OC)';
COMMENT ON COLUMN cache_rules.geo_exclude_countries IS 'List of ISO country codes to exclude from this rule';

-- Add indexes for better geo-query performance
CREATE INDEX IF NOT EXISTS idx_cache_rules_geo_countries ON cache_rules USING GIN(geo_countries);
CREATE INDEX IF NOT EXISTS idx_cache_rules_geo_continents ON cache_rules USING GIN(geo_continents);
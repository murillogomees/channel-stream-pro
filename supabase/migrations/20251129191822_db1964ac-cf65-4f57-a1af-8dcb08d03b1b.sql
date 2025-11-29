-- Create record_streaming_metric function for recording streaming metrics
CREATE OR REPLACE FUNCTION public.record_streaming_metric(
  p_channel_id UUID,
  p_metric_type TEXT,
  p_value NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.streaming_metrics (channel_id, metric_type, value, recorded_at)
  VALUES (p_channel_id, p_metric_type, p_value, NOW());
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.record_streaming_metric(UUID, TEXT, NUMERIC) IS 'Records a streaming metric for analytics and monitoring purposes';
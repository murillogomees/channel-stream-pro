-- Fix RLS for partitioned tables
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics_current ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics_next ENABLE ROW LEVEL SECURITY;

-- RLS policies for performance_metrics (admin only read, system write)
CREATE POLICY "Admins can view metrics" ON public.performance_metrics
  FOR SELECT USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "System can insert metrics" ON public.performance_metrics
  FOR INSERT WITH CHECK (true);

-- Same for partition tables
CREATE POLICY "Admins can view metrics" ON public.performance_metrics_current
  FOR SELECT USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "System can insert metrics" ON public.performance_metrics_current
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view metrics" ON public.performance_metrics_next
  FOR SELECT USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "System can insert metrics" ON public.performance_metrics_next
  FOR INSERT WITH CHECK (true);
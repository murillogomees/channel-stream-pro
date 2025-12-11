-- Create EPG programs table
CREATE TABLE public.epg_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  category TEXT,
  icon_url TEXT,
  rating TEXT,
  episode_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_epg_programs_channel_id ON public.epg_programs(channel_id);
CREATE INDEX idx_epg_programs_time_range ON public.epg_programs(start_time, end_time);
CREATE INDEX idx_epg_programs_channel_time ON public.epg_programs(channel_id, start_time);

-- Enable RLS
ALTER TABLE public.epg_programs ENABLE ROW LEVEL SECURITY;

-- Public read access for EPG data
CREATE POLICY "EPG programs are publicly readable"
  ON public.epg_programs
  FOR SELECT
  USING (true);

-- Admin/Master can manage EPG
CREATE POLICY "Admins can manage EPG programs"
  ON public.epg_programs
  FOR ALL
  USING (public.is_admin_or_master(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_epg_programs_updated_at
  BEFORE UPDATE ON public.epg_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
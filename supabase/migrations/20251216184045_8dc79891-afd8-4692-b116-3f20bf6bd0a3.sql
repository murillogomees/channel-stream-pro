-- Políticas RLS para partições (sem IF NOT EXISTS)
-- Usar DROP IF EXISTS + CREATE

-- 2025_01
DROP POLICY IF EXISTS "Admins can view activity_logs_2025_01" ON public.activity_logs_2025_01;
CREATE POLICY "Admins can view activity_logs_2025_01" ON public.activity_logs_2025_01 FOR SELECT USING (is_admin_or_master());
DROP POLICY IF EXISTS "Insert activity_logs_2025_01" ON public.activity_logs_2025_01;
CREATE POLICY "Insert activity_logs_2025_01" ON public.activity_logs_2025_01 FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users own activity_logs_2025_01" ON public.activity_logs_2025_01;
CREATE POLICY "Users own activity_logs_2025_01" ON public.activity_logs_2025_01 FOR SELECT USING (auth.uid() = user_id);

-- 2025_02
DROP POLICY IF EXISTS "Admins can view activity_logs_2025_02" ON public.activity_logs_2025_02;
CREATE POLICY "Admins can view activity_logs_2025_02" ON public.activity_logs_2025_02 FOR SELECT USING (is_admin_or_master());
DROP POLICY IF EXISTS "Insert activity_logs_2025_02" ON public.activity_logs_2025_02;
CREATE POLICY "Insert activity_logs_2025_02" ON public.activity_logs_2025_02 FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users own activity_logs_2025_02" ON public.activity_logs_2025_02;
CREATE POLICY "Users own activity_logs_2025_02" ON public.activity_logs_2025_02 FOR SELECT USING (auth.uid() = user_id);

-- 2025_12
DROP POLICY IF EXISTS "Admins can view activity_logs_2025_12" ON public.activity_logs_2025_12;
CREATE POLICY "Admins can view activity_logs_2025_12" ON public.activity_logs_2025_12 FOR SELECT USING (is_admin_or_master());
DROP POLICY IF EXISTS "Insert activity_logs_2025_12" ON public.activity_logs_2025_12;
CREATE POLICY "Insert activity_logs_2025_12" ON public.activity_logs_2025_12 FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users own activity_logs_2025_12" ON public.activity_logs_2025_12;
CREATE POLICY "Users own activity_logs_2025_12" ON public.activity_logs_2025_12 FOR SELECT USING (auth.uid() = user_id);

-- 2026_01
DROP POLICY IF EXISTS "Admins can view activity_logs_2026_01" ON public.activity_logs_2026_01;
CREATE POLICY "Admins can view activity_logs_2026_01" ON public.activity_logs_2026_01 FOR SELECT USING (is_admin_or_master());
DROP POLICY IF EXISTS "Insert activity_logs_2026_01" ON public.activity_logs_2026_01;
CREATE POLICY "Insert activity_logs_2026_01" ON public.activity_logs_2026_01 FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users own activity_logs_2026_01" ON public.activity_logs_2026_01;
CREATE POLICY "Users own activity_logs_2026_01" ON public.activity_logs_2026_01 FOR SELECT USING (auth.uid() = user_id);
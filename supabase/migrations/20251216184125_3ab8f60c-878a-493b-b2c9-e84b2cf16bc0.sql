-- Adicionar políticas RLS às partições restantes

-- 2025_03
DROP POLICY IF EXISTS "Admins view activity_logs_2025_03" ON public.activity_logs_2025_03;
CREATE POLICY "Admins view activity_logs_2025_03" ON public.activity_logs_2025_03 FOR SELECT USING (is_admin_or_master());
DROP POLICY IF EXISTS "Insert activity_logs_2025_03" ON public.activity_logs_2025_03;
CREATE POLICY "Insert activity_logs_2025_03" ON public.activity_logs_2025_03 FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users own activity_logs_2025_03" ON public.activity_logs_2025_03;
CREATE POLICY "Users own activity_logs_2025_03" ON public.activity_logs_2025_03 FOR SELECT USING (auth.uid() = user_id);

-- 2025_04
DROP POLICY IF EXISTS "Admins view activity_logs_2025_04" ON public.activity_logs_2025_04;
CREATE POLICY "Admins view activity_logs_2025_04" ON public.activity_logs_2025_04 FOR SELECT USING (is_admin_or_master());
DROP POLICY IF EXISTS "Insert activity_logs_2025_04" ON public.activity_logs_2025_04;
CREATE POLICY "Insert activity_logs_2025_04" ON public.activity_logs_2025_04 FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users own activity_logs_2025_04" ON public.activity_logs_2025_04;
CREATE POLICY "Users own activity_logs_2025_04" ON public.activity_logs_2025_04 FOR SELECT USING (auth.uid() = user_id);

-- 2025_05
DROP POLICY IF EXISTS "Admins view activity_logs_2025_05" ON public.activity_logs_2025_05;
CREATE POLICY "Admins view activity_logs_2025_05" ON public.activity_logs_2025_05 FOR SELECT USING (is_admin_or_master());
DROP POLICY IF EXISTS "Insert activity_logs_2025_05" ON public.activity_logs_2025_05;
CREATE POLICY "Insert activity_logs_2025_05" ON public.activity_logs_2025_05 FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users own activity_logs_2025_05" ON public.activity_logs_2025_05;
CREATE POLICY "Users own activity_logs_2025_05" ON public.activity_logs_2025_05 FOR SELECT USING (auth.uid() = user_id);

-- 2025_06
DROP POLICY IF EXISTS "Admins view activity_logs_2025_06" ON public.activity_logs_2025_06;
CREATE POLICY "Admins view activity_logs_2025_06" ON public.activity_logs_2025_06 FOR SELECT USING (is_admin_or_master());
DROP POLICY IF EXISTS "Insert activity_logs_2025_06" ON public.activity_logs_2025_06;
CREATE POLICY "Insert activity_logs_2025_06" ON public.activity_logs_2025_06 FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users own activity_logs_2025_06" ON public.activity_logs_2025_06;
CREATE POLICY "Users own activity_logs_2025_06" ON public.activity_logs_2025_06 FOR SELECT USING (auth.uid() = user_id);

-- 2025_07
DROP POLICY IF EXISTS "Admins view activity_logs_2025_07" ON public.activity_logs_2025_07;
CREATE POLICY "Admins view activity_logs_2025_07" ON public.activity_logs_2025_07 FOR SELECT USING (is_admin_or_master());
DROP POLICY IF EXISTS "Insert activity_logs_2025_07" ON public.activity_logs_2025_07;
CREATE POLICY "Insert activity_logs_2025_07" ON public.activity_logs_2025_07 FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users own activity_logs_2025_07" ON public.activity_logs_2025_07;
CREATE POLICY "Users own activity_logs_2025_07" ON public.activity_logs_2025_07 FOR SELECT USING (auth.uid() = user_id);

-- 2025_08
DROP POLICY IF EXISTS "Admins view activity_logs_2025_08" ON public.activity_logs_2025_08;
CREATE POLICY "Admins view activity_logs_2025_08" ON public.activity_logs_2025_08 FOR SELECT USING (is_admin_or_master());
DROP POLICY IF EXISTS "Insert activity_logs_2025_08" ON public.activity_logs_2025_08;
CREATE POLICY "Insert activity_logs_2025_08" ON public.activity_logs_2025_08 FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users own activity_logs_2025_08" ON public.activity_logs_2025_08;
CREATE POLICY "Users own activity_logs_2025_08" ON public.activity_logs_2025_08 FOR SELECT USING (auth.uid() = user_id);

-- 2025_09
DROP POLICY IF EXISTS "Admins view activity_logs_2025_09" ON public.activity_logs_2025_09;
CREATE POLICY "Admins view activity_logs_2025_09" ON public.activity_logs_2025_09 FOR SELECT USING (is_admin_or_master());
DROP POLICY IF EXISTS "Insert activity_logs_2025_09" ON public.activity_logs_2025_09;
CREATE POLICY "Insert activity_logs_2025_09" ON public.activity_logs_2025_09 FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users own activity_logs_2025_09" ON public.activity_logs_2025_09;
CREATE POLICY "Users own activity_logs_2025_09" ON public.activity_logs_2025_09 FOR SELECT USING (auth.uid() = user_id);

-- 2025_10
DROP POLICY IF EXISTS "Admins view activity_logs_2025_10" ON public.activity_logs_2025_10;
CREATE POLICY "Admins view activity_logs_2025_10" ON public.activity_logs_2025_10 FOR SELECT USING (is_admin_or_master());
DROP POLICY IF EXISTS "Insert activity_logs_2025_10" ON public.activity_logs_2025_10;
CREATE POLICY "Insert activity_logs_2025_10" ON public.activity_logs_2025_10 FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users own activity_logs_2025_10" ON public.activity_logs_2025_10;
CREATE POLICY "Users own activity_logs_2025_10" ON public.activity_logs_2025_10 FOR SELECT USING (auth.uid() = user_id);

-- 2025_11
DROP POLICY IF EXISTS "Admins view activity_logs_2025_11" ON public.activity_logs_2025_11;
CREATE POLICY "Admins view activity_logs_2025_11" ON public.activity_logs_2025_11 FOR SELECT USING (is_admin_or_master());
DROP POLICY IF EXISTS "Insert activity_logs_2025_11" ON public.activity_logs_2025_11;
CREATE POLICY "Insert activity_logs_2025_11" ON public.activity_logs_2025_11 FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users own activity_logs_2025_11" ON public.activity_logs_2025_11;
CREATE POLICY "Users own activity_logs_2025_11" ON public.activity_logs_2025_11 FOR SELECT USING (auth.uid() = user_id);

-- 2026_02
DROP POLICY IF EXISTS "Admins view activity_logs_2026_02" ON public.activity_logs_2026_02;
CREATE POLICY "Admins view activity_logs_2026_02" ON public.activity_logs_2026_02 FOR SELECT USING (is_admin_or_master());
DROP POLICY IF EXISTS "Insert activity_logs_2026_02" ON public.activity_logs_2026_02;
CREATE POLICY "Insert activity_logs_2026_02" ON public.activity_logs_2026_02 FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users own activity_logs_2026_02" ON public.activity_logs_2026_02;
CREATE POLICY "Users own activity_logs_2026_02" ON public.activity_logs_2026_02 FOR SELECT USING (auth.uid() = user_id);

-- 2026_03
DROP POLICY IF EXISTS "Admins view activity_logs_2026_03" ON public.activity_logs_2026_03;
CREATE POLICY "Admins view activity_logs_2026_03" ON public.activity_logs_2026_03 FOR SELECT USING (is_admin_or_master());
DROP POLICY IF EXISTS "Insert activity_logs_2026_03" ON public.activity_logs_2026_03;
CREATE POLICY "Insert activity_logs_2026_03" ON public.activity_logs_2026_03 FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users own activity_logs_2026_03" ON public.activity_logs_2026_03;
CREATE POLICY "Users own activity_logs_2026_03" ON public.activity_logs_2026_03 FOR SELECT USING (auth.uid() = user_id);
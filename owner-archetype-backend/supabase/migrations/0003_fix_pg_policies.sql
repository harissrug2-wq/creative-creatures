-- 0003 Fix pg_policies view

CREATE OR REPLACE FUNCTION get_pg_policies()
RETURNS TABLE (
  schemaname NAME,
  tablename NAME,
  policyname NAME,
  roles NAME[],
  cmd CHAR,
  qual TEXT,
  with_check TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.schemaname,
    p.tablename,
    p.policyname,
    p.roles,
    p.cmd::CHAR,
    p.qual::TEXT,
    p.with_check::TEXT
  FROM pg_policies p
  WHERE p.schemaname = 'public'
  ORDER BY p.tablename, p.policyname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

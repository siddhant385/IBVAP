CREATE OR REPLACE FUNCTION public.is_edge_device()
RETURNS BOOLEAN AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := auth.jwt() -> 'user_metadata' ->> 'role';
  IF jwt_role = 'edge_device' THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

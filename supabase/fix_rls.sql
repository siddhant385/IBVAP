-- 1. Fix the helper function to never return NULL
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

-- 2. Simplify and fix Edge Device policies (since devices.id = auth.uid() for edge devices)

-- Cameras
DROP POLICY IF EXISTS "Edge devices can access their own cameras" ON public.cameras;
CREATE POLICY "Edge devices can access their own cameras"
ON public.cameras FOR ALL
USING (public.is_edge_device() AND device_id = auth.uid());

-- Alerts
DROP POLICY IF EXISTS "Edge devices can insert alerts" ON public.alerts;
CREATE POLICY "Edge devices can insert alerts"
ON public.alerts FOR INSERT
WITH CHECK (public.is_edge_device() AND device_id = auth.uid());

-- Detections
DROP POLICY IF EXISTS "Edge devices can insert detections" ON public.detections;
CREATE POLICY "Edge devices can insert detections"
ON public.detections FOR INSERT
WITH CHECK (
  public.is_edge_device() AND
  EXISTS (
    SELECT 1 FROM public.alerts
    WHERE id = detections.alert_id AND device_id = auth.uid()
  )
);

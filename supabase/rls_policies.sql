-- Enable RLS on core tables
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detections ENABLE ROW LEVEL SECURITY;

-- Helper function to check if a user is an edge device
CREATE OR REPLACE FUNCTION public.is_edge_device()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() -> 'user_metadata' ->> 'role') = 'edge_device';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Devices
-- Operators can read and write all devices
CREATE POLICY "Operators can read all devices" 
ON public.devices FOR SELECT 
USING (NOT public.is_edge_device());

CREATE POLICY "Operators can insert devices" 
ON public.devices FOR INSERT 
WITH CHECK (NOT public.is_edge_device());

CREATE POLICY "Operators can update all devices" 
ON public.devices FOR UPDATE 
USING (NOT public.is_edge_device());

-- Edge devices can only read/update themselves
CREATE POLICY "Edge devices can read their own device" 
ON public.devices FOR SELECT 
USING (public.is_edge_device() AND auth_user_id = auth.uid());

CREATE POLICY "Edge devices can update their own device" 
ON public.devices FOR UPDATE 
USING (public.is_edge_device() AND auth_user_id = auth.uid());


-- 2. Cameras
-- Operators can read and write all cameras
CREATE POLICY "Operators can read all cameras" 
ON public.cameras FOR SELECT 
USING (NOT public.is_edge_device());

CREATE POLICY "Operators can insert/update all cameras" 
ON public.cameras FOR ALL 
USING (NOT public.is_edge_device());

-- Edge devices can only read/insert/update their own cameras
CREATE POLICY "Edge devices can access their own cameras"
ON public.cameras FOR ALL
USING (
  public.is_edge_device() AND
  EXISTS (
    SELECT 1 FROM public.devices 
    WHERE id = cameras.device_id AND auth_user_id = auth.uid()
  )
);


-- 3. Alerts
-- Operators can read all alerts
CREATE POLICY "Operators can read all alerts" 
ON public.alerts FOR SELECT 
USING (NOT public.is_edge_device());

CREATE POLICY "Operators can update alerts (processed flag)" 
ON public.alerts FOR UPDATE 
USING (NOT public.is_edge_device());

-- Edge devices can insert alerts for themselves
CREATE POLICY "Edge devices can insert alerts"
ON public.alerts FOR INSERT
WITH CHECK (
  public.is_edge_device() AND
  EXISTS (
    SELECT 1 FROM public.devices 
    WHERE id = alerts.device_id AND auth_user_id = auth.uid()
  )
);


-- 4. Detections
-- Operators can read all detections
CREATE POLICY "Operators can read all detections" 
ON public.detections FOR SELECT 
USING (NOT public.is_edge_device());

-- Edge devices can insert detections for their own alerts
CREATE POLICY "Edge devices can insert detections"
ON public.detections FOR INSERT
WITH CHECK (
  public.is_edge_device() AND
  EXISTS (
    SELECT 1 FROM public.alerts
    JOIN public.devices ON alerts.device_id = devices.id
    WHERE alerts.id = detections.alert_id AND devices.auth_user_id = auth.uid()
  )
);

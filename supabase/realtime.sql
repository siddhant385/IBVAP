-- Enable Realtime for alerts and devices tables
BEGIN;
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN 
    CREATE PUBLICATION supabase_realtime FOR ALL TABLES; 
  END IF; 
END $$;
-- If supabase_realtime already exists but specific tables are needed:
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE devices;
COMMIT;

import { createClient } from '@/utils/supabase/server'
import { RealtimeAlertFeed } from '@/components/alerts/RealtimeAlertFeed'
import { RealtimeKpiRibbon } from '@/components/dashboard/RealtimeKpiRibbon'

export default async function CommandCenterPage() {
  const supabase = await createClient()

  // Fetch quick stats concurrently for initial server render
  const todayStart = new Date(new Date().setHours(0,0,0,0)).toISOString()
  
  const [
    { count: totalDevices },
    { count: onlineDevices },
    { count: todayAlerts },
    { count: activeThreats },
    { count: activeCameras },
    { count: faceMatches },
    { count: plateMatches }
  ] = await Promise.all([
    supabase.from('devices').select('*', { count: 'exact', head: true }),
    supabase.from('devices').select('*', { count: 'exact', head: true }).eq('is_online', true),
    supabase.from('alerts').select('*', { count: 'exact', head: true }).gte('timestamp', todayStart),
    supabase.from('alerts').select('*', { count: 'exact', head: true })
      .in('status', ['unacknowledged', 'investigating'])
      .in('severity', ['warning', 'critical']),
    supabase.from('cameras').select('*', { count: 'exact', head: true }).eq('is_online', true),
    supabase.from('face_results').select('*', { count: 'exact', head: true }).not('matched_identity_id', 'is', null),
    supabase.from('anpr_results').select('*', { count: 'exact', head: true }).eq('is_flagged', true)
  ])

  const totalWatchlistMatches = (faceMatches || 0) + (plateMatches || 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Live Command Center</h2>
          <p className="text-muted-foreground">
            Real-time situational awareness across all deployed edge nodes.
          </p>
        </div>
        <div className="flex gap-2">
          {/* Future: Global System Actions */}
        </div>
      </div>

      <RealtimeKpiRibbon 
        initialTotalDevices={totalDevices || 0}
        initialOnlineDevices={onlineDevices || 0}
        initialTodayAlerts={todayAlerts || 0}
        initialActiveThreats={activeThreats || 0}
        initialActiveCameras={activeCameras || 0}
        initialWatchlistMatches={totalWatchlistMatches}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 rounded-xl border border-border/50 bg-muted/20 flex flex-col items-center justify-center min-h-[600px] overflow-hidden relative">
          {/* Placeholder for GIS Map */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary via-background to-background"></div>
          <MapPinIcon className="h-16 w-16 text-primary mb-4 opacity-80 animate-bounce" />
          <h3 className="text-xl font-medium text-foreground relative z-10">Geospatial Intelligence Map</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md text-center relative z-10">
            Map integration plotting active edge devices (`devices.coordinates`) and correlating recent alert hot-spots.
          </p>
          <div className="mt-8 flex gap-4 relative z-10">
            <div className="flex items-center gap-2 text-sm"><span className="h-3 w-3 rounded-full bg-green-500"></span> Online</div>
            <div className="flex items-center gap-2 text-sm"><span className="h-3 w-3 rounded-full bg-destructive animate-pulse"></span> Alerting</div>
            <div className="flex items-center gap-2 text-sm"><span className="h-3 w-3 rounded-full bg-muted-foreground"></span> Offline</div>
          </div>
        </div>
        
        <div className="col-span-3">
          <RealtimeAlertFeed />
        </div>
      </div>
    </div>
  )
}

function MapPinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

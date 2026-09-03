import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { Bell, Map, ShieldAlert, Users, Video, Eye } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Tactical Sidebar */}
      <aside className="w-64 flex-col border-r border-border/50 bg-sidebar">
        <div className="flex h-16 items-center gap-2 border-b border-border/50 px-6">
          <ShieldAlert className="h-6 w-6 text-primary" />
          <span className="font-heading text-lg font-bold tracking-wider text-sidebar-foreground">
            IBVAP
          </span>
        </div>
        
        <nav className="flex-1 space-y-1 p-4">
          <Link href="/" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <Map className="h-4 w-4" />
            Command Center
          </Link>
          <Link href="/alerts" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <Bell className="h-4 w-4" />
            Investigation
          </Link>
          <Link href="/intelligence/godseye" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <Eye className="h-4 w-4" />
            God&apos;s Eye
          </Link>
          <Link href="/intelligence/faces" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <Users className="h-4 w-4" />
            Intelligence
          </Link>
          <Link href="/infrastructure" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <Video className="h-4 w-4" />
            Infrastructure
          </Link>
          <Link href="/analytics" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            Analytics
          </Link>
        </nav>

        <div className="border-t border-border/50 p-4">
          <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground">
            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse"></div>
            System Online
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-background">
        <header className="flex h-16 items-center justify-between border-b border-border/50 bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <h1 className="font-heading text-lg font-semibold tracking-tight">Tactical Overview</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button className="text-sm text-primary hover:underline">Sign Out</button>
            </form>
          </div>
        </header>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

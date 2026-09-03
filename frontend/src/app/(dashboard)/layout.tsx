import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { SidebarNav } from '@/components/dashboard/SidebarNav'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'

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
      <SidebarNav userEmail={user.email ?? 'Operator'} />

      <main className="flex-1 overflow-y-auto bg-background">
        <DashboardHeader email={user.email ?? 'Operator'} />
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

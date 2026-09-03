'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, EyeOff, ShieldAlert } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { useRouter } from 'next/navigation'

interface Props {
  alertId: string
  initialStatus: string
  severity: string
}

export function AlertTriageActions({ alertId, initialStatus, severity }: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleUpdateStatus = async (newStatus: 'resolved' | 'false_positive' | 'investigating') => {
    setLoading(true)
    setStatus(newStatus)

    const { data: userResponse } = await supabase.auth.getUser()
    const operatorId = userResponse?.user?.id || null

    await supabase
      .from('alerts')
      .update({
        status: newStatus,
        operator_id: operatorId,
        resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null,
      })
      .eq('id', alertId)

    setLoading(false)
    router.refresh()
  }

  const getStatusBadge = (stat: string) => {
    switch (stat) {
      case 'unacknowledged':
        return <Badge variant="outline" className="border-orange-500/50 text-orange-500">Unacknowledged</Badge>
      case 'resolved':
        return <Badge variant="outline" className="border-green-500/50 text-green-500">Resolved</Badge>
      case 'false_positive':
        return <Badge variant="outline" className="text-muted-foreground">False Alarm</Badge>
      case 'investigating':
        return <Badge variant="outline" className="border-blue-500/50 text-blue-500">Investigating</Badge>
      default:
        return <Badge variant="outline">{stat}</Badge>
    }
  }

  return (
    <div className="flex items-center gap-2">
      {getStatusBadge(status)}
      <div className="flex items-center gap-1.5 ml-2 border-l border-border/50 pl-3">
        {status !== 'investigating' && status !== 'resolved' && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => handleUpdateStatus('investigating')}
            className="h-8 text-xs gap-1"
          >
            Investigate
          </Button>
        )}
        {status !== 'false_positive' && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => handleUpdateStatus('false_positive')}
            className="h-8 text-xs gap-1 text-muted-foreground"
          >
            False Alarm
          </Button>
        )}
        {status !== 'resolved' && (
          <Button
            variant="default"
            size="sm"
            disabled={loading}
            onClick={() => handleUpdateStatus('resolved')}
            className="h-8 text-xs gap-1"
          >
            Resolve
          </Button>
        )}
      </div>
    </div>
  )
}

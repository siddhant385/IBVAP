'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: number
  currentParams: Record<string, string>
}

export function AlertsTablePagination({ currentPage, totalPages, totalCount, pageSize, currentParams }: Props) {
  const router = useRouter()

  const goToPage = (page: number) => {
    const params = new URLSearchParams(currentParams)
    params.set('page', page.toString())
    router.push(`/alerts?${params.toString()}`)
  }

  const startRange = (currentPage - 1) * pageSize + 1
  const endRange = Math.min(currentPage * pageSize, totalCount)

  if (totalCount === 0) return null

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 px-1 text-xs text-muted-foreground">
      <div>
        Showing <span className="font-semibold text-foreground">{startRange}</span> to{' '}
        <span className="font-semibold text-foreground">{endRange}</span> of{' '}
        <span className="font-semibold text-foreground">{totalCount}</span> historical alerts
      </div>

      <div className="flex items-center gap-2">
        <span className="mr-2">
          Page <span className="font-semibold text-foreground">{currentPage}</span> of{' '}
          <span className="font-semibold text-foreground">{totalPages}</span>
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => goToPage(currentPage - 1)}
          className="h-8 gap-1 text-xs"
        >
          <ChevronLeft className="size-3.5" /> Previous
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => goToPage(currentPage + 1)}
          className="h-8 gap-1 text-xs"
        >
          Next <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

import { useEffect } from 'react'
import { DATA_REFRESH_EVENT } from '@/lib/dataRefresh'

export function useDataRefresh(onRefresh: () => void) {
  useEffect(() => {
    window.addEventListener(DATA_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(DATA_REFRESH_EVENT, onRefresh)
  }, [onRefresh])
}

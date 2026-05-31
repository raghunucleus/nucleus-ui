import { GraduationCap } from 'lucide-react'

import { StateView } from '@/components/state-view'

/**
 * Animated empty state for the exam-results screen — shown when the student has
 * no published results yet. A floating graduation cap inside pulsing rings. A
 * thin wrapper over the shared {@link StateView}.
 */
export function ResultsEmpty() {
  return (
    <StateView
      icon={GraduationCap}
      title="No results yet"
      description="Your semester results will show up here the moment the examination cell publishes them. Hang tight — it’ll be worth the wait."
    />
  )
}

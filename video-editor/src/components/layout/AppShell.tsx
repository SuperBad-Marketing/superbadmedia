import { useState, lazy, Suspense } from 'react'
import HeaderBar from './HeaderBar'
import LeftPanel from './LeftPanel'
import CentrePanel from './CentrePanel'
import RightPanel from './RightPanel'
import BottomBar from './BottomBar'

const WelcomeOverlay = lazy(() => import('../onboarding/WelcomeOverlay'))

const ONBOARDING_KEY = 'superedits-onboarding-seen'

export default function AppShell() {
  const [showWelcome, setShowWelcome] = useState(
    () => !localStorage.getItem(ONBOARDING_KEY)
  )

  function dismissWelcome() {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowWelcome(false)
  }

  return (
    <div className="flex flex-col h-dvh bg-bg text-text overflow-hidden">
      <HeaderBar />

      <div className="flex flex-1 min-h-0">
        <LeftPanel />
        <CentrePanel />
        <RightPanel />
      </div>

      <BottomBar />

      {showWelcome && (
        <Suspense fallback={null}>
          <WelcomeOverlay onDismiss={dismissWelcome} />
        </Suspense>
      )}
    </div>
  )
}

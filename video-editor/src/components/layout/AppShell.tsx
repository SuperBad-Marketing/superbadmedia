import HeaderBar from './HeaderBar'
import LeftPanel from './LeftPanel'
import CentrePanel from './CentrePanel'
import RightPanel from './RightPanel'
import BottomBar from './BottomBar'

export default function AppShell() {
  return (
    <div className="flex flex-col h-dvh bg-bg text-text overflow-hidden">
      <HeaderBar />

      <div className="flex flex-1 min-h-0">
        <LeftPanel />
        <CentrePanel />
        <RightPanel />
      </div>

      <BottomBar />
    </div>
  )
}

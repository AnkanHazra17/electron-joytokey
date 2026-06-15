import { Usb, List, Settings, Power, LayoutGrid } from 'lucide-react'
import { useUiStore } from './store/uiStore'
import { useMappingEnabled } from './hooks/useMappingEnabled'
import { DevicesPage } from './pages/DevicesPage'
import { ProfilesPage } from './pages/ProfilesPage'
import { SettingsPage } from './pages/SettingsPage'
import { GridPage } from './pages/GridPage'
import { UpdateBanner } from './components/UpdateBanner'

const TABS = [
  { id: 'devices', label: 'Devices', Icon: Usb },
  { id: 'grid', label: 'Key Map', Icon: LayoutGrid },
  { id: 'profiles', label: 'Profiles', Icon: List },
  { id: 'settings', label: 'Settings', Icon: Settings },
] as const

export function App() {
  const { activeTab, setActiveTab } = useUiStore()
  const { enabled, toggle } = useMappingEnabled()

  return (
    <div className="flex flex-col h-full">
      <UpdateBanner />

      {/* Title bar drag region */}
      <div className="flex items-center h-11 px-4 border-b border-[var(--border)] bg-[var(--bg-card)]" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <span className="ml-16 text-sm font-semibold select-none">JoyToKey</span>
        <div className="flex-1" />
        <button
          onClick={toggle}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            enabled
              ? 'bg-[var(--success)]/15 text-[var(--success)] hover:bg-[var(--success)]/25'
              : 'bg-[var(--danger)]/15 text-[var(--danger)] hover:bg-[var(--danger)]/25'
          }`}
        >
          <Power size={11} />
          {enabled ? 'Active' : 'Paused'}
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <nav className="flex flex-col gap-1 w-44 p-3 border-r border-[var(--border)] bg-[var(--bg-card)] shrink-0">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                activeTab === id
                  ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-medium'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-[var(--bg)]">
          {activeTab === 'devices' && <DevicesPage />}
          {activeTab === 'grid' && <GridPage />}
          {activeTab === 'profiles' && <ProfilesPage />}
          {activeTab === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  )
}

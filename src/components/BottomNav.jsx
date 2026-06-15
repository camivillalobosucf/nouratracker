const tabs = [
  {
    id: 'dashboard',
    label: 'Inicio',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    )
  },
  {
    id: 'nutrition',
    label: 'Comida',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M18 8h1a4 4 0 010 8h-1" />
        <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    )
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    )
  },
  {
    id: 'workout',
    label: 'Entreno',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6.5 6.5h11M6.5 17.5h11M4 10h1.5a1 1 0 011 1v2a1 1 0 01-1 1H4M20 10h-1.5a1 1 0 00-1 1v2a1 1 0 001 1H20M2 12h2M20 12h2" />
      </svg>
    )
  },
  {
    id: 'settings',
    label: 'Metas',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" />
      </svg>
    )
  }
]

export default function BottomNav({ active, onChange }) {
  return (
    <nav
      className="fixed bottom-0 z-50 flex items-center justify-around border-t"
      style={{
        background: '#F7F4EE',
        borderColor: '#DDD8CE',
        paddingBottom: 'env(safe-area-inset-bottom)',
        maxWidth: 512,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%'
      }}
    >
      {tabs.map(tab => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex flex-col items-center gap-0.5 py-2 px-2 flex-1"
            style={{ color: isActive ? '#C4714A' : '#999', transition: 'color 0.15s' }}
          >
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

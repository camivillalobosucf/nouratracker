import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import NutritionLog from './components/NutritionLog'
import WorkoutLog from './components/WorkoutLog'
import WeightLog from './components/WeightLog'
import Settings from './components/Settings'
import Chat from './components/Chat'
import BottomNav from './components/BottomNav'

const TAB_COMPONENTS = {
  dashboard: Dashboard,
  nutrition: NutritionLog,
  workout: WorkoutLog,
  weight: WeightLog,
  chat: Chat,
  settings: Settings,
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [mounted, setMounted] = useState(new Set(['dashboard']))

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setMounted(prev => new Set([...prev, tab]))
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: '#F7F4EE' }}>
        <div className="w-6 h-6 rounded-full border-2 border-[#C4714A] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!session) return <Auth />

  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto" style={{ background: '#F7F4EE' }}>
      <main className="flex-1">
        {Object.entries(TAB_COMPONENTS).map(([key, Component]) => {
          if (!mounted.has(key)) return null
          return (
            <div
              key={key}
              style={{ display: activeTab === key ? 'block' : 'none' }}
              className={key === 'chat' ? 'h-dvh' : 'pb-20'}
            >
              <Component session={session} />
            </div>
          )
        })}
      </main>
      <BottomNav active={activeTab} onChange={handleTabChange} />
    </div>
  )
}

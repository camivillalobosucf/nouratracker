import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import Onboarding from './components/Onboarding'
import Dashboard from './components/Dashboard'
import NutritionLog from './components/NutritionLog'
import WorkoutLog from './components/WorkoutLog'
import WeightLog from './components/WeightLog'
import Settings from './components/Settings'
import Chat from './components/Chat'
import BottomNav from './components/BottomNav'
import Profile from './components/Profile'

const TAB_COMPONENTS = {
  dashboard: Dashboard,
  nutrition:  NutritionLog,
  workout:    WorkoutLog,
  weight:     WeightLog,
  chat:       Chat,
  profile:    Profile,
}

export default function App() {
  const [session, setSession]               = useState(null)
  const [loading, setLoading]               = useState(true)
  const [onboardingDone, setOnboardingDone] = useState(false)

  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('noura_tab') || 'dashboard'
    return saved === 'settings' ? 'profile' : saved
  })
  const [mounted, setMounted] = useState(() => {
    const raw   = localStorage.getItem('noura_tab') || 'dashboard'
    const saved = raw === 'settings' ? 'profile' : raw
    return new Set(['dashboard', saved])
  })

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setMounted(prev => new Set([...prev, tab]))
    localStorage.setItem('noura_tab', tab)
  }

  // Check onboarding status for a given user id
  const checkOnboarding = async (userId) => {
    const { data } = await supabase
      .from('user_profile')
      .select('onboarding_completado')
      .eq('user_id', userId)
      .single()
    return data?.onboarding_completado === true
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s)
      if (s) {
        const done = await checkOnboarding(s.user.id)
        setOnboardingDone(done)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      if (s) {
        const done = await checkOnboarding(s.user.id)
        setOnboardingDone(done)
      } else {
        setOnboardingDone(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleOnboardingComplete = () => {
    setOnboardingDone(true)
    setActiveTab('chat')
    setMounted(prev => new Set([...prev, 'chat']))
    localStorage.setItem('noura_tab', 'chat')
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: '#F7F4EE' }}>
        <div className="w-6 h-6 rounded-full border-2 border-[#C4714A] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!session) return <Auth />

  if (!onboardingDone) {
    return <Onboarding session={session} onComplete={handleOnboardingComplete} />
  }

  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto" style={{ background: '#F7F4EE' }}>
      <main className="flex-1">
        {Object.entries(TAB_COMPONENTS).map(([key, Component]) => {
          if (!mounted.has(key)) return null
          const isActive = activeTab === key
          return (
            <div
              key={key}
              style={{ display: isActive ? 'block' : 'none' }}
              className={key === 'chat' ? 'h-dvh' : 'pb-20'}
            >
              <Component session={session} isActive={isActive} />
            </div>
          )
        })}
      </main>
      <BottomNav active={activeTab} onChange={handleTabChange} />
    </div>
  )
}

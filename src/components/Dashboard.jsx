import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

const DEFAULT_GOALS = { kcal_meta: 1720, proteina_meta: 145, carbs_meta: 155, grasa_meta: 58 }

const today = () => new Date().toISOString().split('T')[0]

function sevenDayRange() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

function MacroBar({ label, value, goal, color }) {
  const pct = Math.min(100, Math.round((value / goal) * 100))
  return (
    <div className="flex-1">
      <div className="flex justify-between text-xs mb-1" style={{ color: '#888' }}>
        <span>{label}</span>
        <span style={{ color: '#1C1C1A' }}>{value}g</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: '#DDD8CE' }}>
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="px-3 py-2 text-xs" style={{ background: '#fff', border: '1px solid #DDD8CE', borderRadius: 6 }}>
      <p style={{ color: '#888' }}>{label}</p>
      <p style={{ color: '#C4714A', fontWeight: 600 }}>{payload[0].value} kcal</p>
    </div>
  )
}

export default function Dashboard({ session }) {
  const [goals, setGoals] = useState(DEFAULT_GOALS)
  const [todayNutrition, setTodayNutrition] = useState(null)
  const [weekCalories, setWeekCalories] = useState([])
  const [weekWeight, setWeekWeight] = useState([])
  const [recentWorkouts, setRecentWorkouts] = useState([])

  useEffect(() => {
    const uid = session.user.id
    const days = sevenDayRange()
    const from = days[0]

    Promise.all([
      supabase.from('user_goals').select('*').eq('user_id', uid).single(),
      supabase.from('nutrition_logs').select('fecha, totales').eq('user_id', uid).gte('fecha', from),
      supabase.from('weight_logs').select('fecha, peso_kg').eq('user_id', uid).gte('fecha', from).order('fecha'),
      supabase.from('workout_logs').select('fecha, descripcion_original, ejercicios').eq('user_id', uid).gte('fecha', from).order('fecha', { ascending: false })
    ]).then(([goalsRes, nutRes, weightRes, workRes]) => {
      if (goalsRes.data) setGoals(goalsRes.data)

      const nutMap = {}
      ;(nutRes.data || []).forEach(r => { nutMap[r.fecha] = r.totales })
      const todayStr = today()
      setTodayNutrition(nutMap[todayStr] || null)

      setWeekCalories(days.map(d => ({
        day: d.slice(5).replace('-', '/'),
        kcal: nutMap[d]?.calorias || 0
      })))

      const weightMap = {}
      ;(weightRes.data || []).forEach(r => { weightMap[r.fecha] = r.peso_kg })
      setWeekWeight(days.map(d => ({
        day: d.slice(5).replace('-', '/'),
        peso: weightMap[d] || null
      })).filter(d => d.peso !== null))

      setRecentWorkouts(workRes.data || [])
    })
  }, [session])

  const t = todayNutrition || { calorias: 0, proteina_g: 0, carbs_g: 0, grasa_g: 0 }
  const kcalPct = Math.min(100, Math.round((t.calorias / goals.kcal_meta) * 100))

  return (
    <div className="px-4 pt-8 pb-4">
      <h1 className="text-3xl mb-6" style={{ fontFamily: "'DM Serif Display', serif", color: '#1C1C1A' }}>
        Hoy
      </h1>

      {/* Calorías */}
      <div className="p-4 mb-4" style={{ background: '#EFEBE3', borderRadius: 12 }}>
        <div className="flex justify-between items-baseline mb-3">
          <span className="text-sm font-medium" style={{ color: '#888' }}>Calorías</span>
          <span className="text-xs" style={{ color: '#888' }}>meta {goals.kcal_meta} kcal</span>
        </div>
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-4xl font-light" style={{ color: '#1C1C1A' }}>{t.calorias}</span>
          <span className="text-sm" style={{ color: '#888' }}>kcal</span>
        </div>
        <div className="h-2 rounded-full mb-4" style={{ background: '#DDD8CE' }}>
          <div
            className="h-2 rounded-full transition-all"
            style={{ width: `${kcalPct}%`, background: '#C4714A' }}
          />
        </div>
        <div className="flex gap-4">
          <MacroBar label="Proteína" value={t.proteina_g} goal={goals.proteina_meta} color="#C4714A" />
          <MacroBar label="Carbs" value={t.carbs_g} goal={goals.carbs_meta} color="#D4A843" />
          <MacroBar label="Grasa" value={t.grasa_g} goal={goals.grasa_meta} color="#7A9E7E" />
        </div>
      </div>

      {/* Gráfica semanal calorías */}
      <div className="p-4 mb-4" style={{ background: '#EFEBE3', borderRadius: 12 }}>
        <p className="text-sm font-medium mb-3" style={{ color: '#888' }}>Calorías — 7 días</p>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={weekCalories} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#DDD8CE" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="kcal"
              stroke="#C4714A"
              strokeWidth={2}
              dot={{ r: 3, fill: '#C4714A' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfica peso */}
      {weekWeight.length > 0 && (
        <div className="p-4 mb-4" style={{ background: '#EFEBE3', borderRadius: 12 }}>
          <p className="text-sm font-medium mb-3" style={{ color: '#888' }}>Peso corporal — 7 días</p>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={weekWeight} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DDD8CE" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#aaa' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: '#aaa' }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="px-3 py-2 text-xs" style={{ background: '#fff', border: '1px solid #DDD8CE', borderRadius: 6 }}>
                      <p style={{ color: '#888' }}>{label}</p>
                      <p style={{ color: '#7A9E7E', fontWeight: 600 }}>{payload[0].value} kg</p>
                    </div>
                  ) : null
                }
              />
              <Line
                type="monotone"
                dataKey="peso"
                stroke="#7A9E7E"
                strokeWidth={2}
                dot={{ r: 3, fill: '#7A9E7E' }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Historial entrenos */}
      <div>
        <p className="text-sm font-medium mb-3" style={{ color: '#888' }}>Últimos entrenos</p>
        {recentWorkouts.length === 0 ? (
          <p className="text-sm" style={{ color: '#bbb' }}>Sin entrenos registrados esta semana</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentWorkouts.slice(0, 5).map(w => (
              <div key={w.fecha + w.descripcion_original} className="p-3" style={{ background: '#EFEBE3', borderRadius: 10 }}>
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm" style={{ color: '#1C1C1A' }}>
                    {(w.ejercicios || []).map(e => e.nombre).join(', ')}
                  </p>
                  <span className="text-xs shrink-0" style={{ color: '#aaa' }}>
                    {w.fecha.slice(5).replace('-', '/')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

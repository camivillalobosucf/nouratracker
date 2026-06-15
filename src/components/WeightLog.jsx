import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const today = () => new Date().toISOString().split('T')[0]

export default function WeightLog({ session }) {
  const [peso, setPeso] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [logs, setLogs] = useState([])
  const [todayLog, setTodayLog] = useState(null)

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', session.user.id)
      .order('fecha', { ascending: false })
      .limit(30)
    const all = data || []
    setLogs(all)
    setTodayLog(all.find(l => l.fecha === today()) || null)
  }

  useEffect(() => { fetchLogs() }, [session])

  const save = async () => {
    const val = parseFloat(peso)
    if (!val || val <= 0) { setError('Ingresa un peso válido'); return }
    setError('')
    setLoading(true)

    if (todayLog) {
      const { error: err } = await supabase
        .from('weight_logs')
        .update({ peso_kg: val })
        .eq('id', todayLog.id)
      if (err) { setError(err.message); setLoading(false); return }
    } else {
      const { error: err } = await supabase.from('weight_logs').insert({
        user_id: session.user.id,
        fecha: today(),
        peso_kg: val,
      })
      if (err) { setError(err.message); setLoading(false); return }
    }

    setLoading(false)
    setSaved(true)
    setPeso('')
    fetchLogs()
    setTimeout(() => setSaved(false), 3000)
  }

  const chartData = [...logs].reverse().slice(-14).map(l => ({
    day: l.fecha.slice(5).replace('-', '/'),
    peso: l.peso_kg
  }))

  return (
    <div className="px-4 pt-8 pb-4">
      <h1 className="text-3xl mb-6" style={{ fontFamily: "'DM Serif Display', serif", color: '#1C1C1A' }}>
        Peso
      </h1>

      {/* Input de hoy */}
      <div className="p-4 mb-4" style={{ background: '#EFEBE3', borderRadius: 12 }}>
        <p className="text-sm mb-3" style={{ color: '#888' }}>
          {todayLog
            ? `Hoy registraste ${todayLog.peso_kg} kg — puedes actualizar`
            : 'Registra tu peso de hoy'}
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.1"
            value={peso}
            onChange={e => setPeso(e.target.value)}
            placeholder={todayLog ? String(todayLog.peso_kg) : '70.5'}
            className="flex-1 px-4 py-3 text-base outline-none border"
            style={{
              background: '#F7F4EE',
              borderColor: '#DDD8CE',
              color: '#1C1C1A',
              borderRadius: 8
            }}
          />
          <span className="flex items-center px-3 text-sm" style={{ color: '#888' }}>kg</span>
          <button
            onClick={save}
            disabled={loading}
            className="px-6 py-3 font-medium text-white"
            style={{ background: loading ? '#d89a80' : '#C4714A', borderRadius: 8 }}
          >
            {loading ? '...' : 'Guardar'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm" style={{ color: '#C4714A' }}>{error}</p>}
        {saved && <p className="mt-2 text-sm" style={{ color: '#7A9E7E' }}>Guardado</p>}
      </div>

      {/* Gráfica */}
      {chartData.length > 0 && (
        <div className="p-4 mb-4" style={{ background: '#EFEBE3', borderRadius: 12 }}>
          <p className="text-sm font-medium mb-3" style={{ color: '#888' }}>Últimos 14 días</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Historial */}
      <div>
        <p className="text-sm font-medium mb-3" style={{ color: '#888' }}>Historial</p>
        {logs.length === 0 ? (
          <p className="text-sm" style={{ color: '#bbb' }}>Sin registros aún</p>
        ) : (
          <div className="flex flex-col gap-2">
            {logs.map(log => (
              <div
                key={log.id}
                className="flex justify-between items-center px-4 py-3"
                style={{ background: '#EFEBE3', borderRadius: 10 }}
              >
                <span className="text-sm" style={{ color: '#888' }}>{log.fecha}</span>
                <span className="text-base font-medium" style={{ color: '#1C1C1A' }}>
                  {log.peso_kg} kg
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

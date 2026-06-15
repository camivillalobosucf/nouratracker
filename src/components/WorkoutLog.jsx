import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const today = () => new Date().toISOString().split('T')[0]

function EjercicioRow({ item, onChange, onRemove }) {
  return (
    <div className="py-3 border-b" style={{ borderColor: '#DDD8CE' }}>
      <div className="flex justify-between items-start mb-2">
        <span className="font-medium text-sm" style={{ color: '#1C1C1A' }}>{item.nombre}</span>
        <button onClick={onRemove} className="text-xs" style={{ color: '#C4714A' }}>Quitar</button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[
          ['kg', 'peso_kg'],
          ['series', 'series'],
          ['reps', 'reps'],
          ['vol kg', 'volumen_kg'],
        ].map(([label, field]) => (
          <div key={field}>
            <label className="text-[10px] block mb-0.5" style={{ color: '#aaa' }}>{label}</label>
            <input
              type="number"
              value={item[field]}
              onChange={e => {
                const val = parseFloat(e.target.value) || 0
                const updated = { ...item, [field]: val }
                if (field !== 'volumen_kg') {
                  updated.volumen_kg = +(updated.peso_kg * updated.series * updated.reps).toFixed(1)
                }
                onChange(updated)
              }}
              className="w-full px-2 py-1 text-sm outline-none border"
              style={{ background: '#F7F4EE', borderColor: '#DDD8CE', borderRadius: 6, color: '#1C1C1A' }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function WorkoutLog({ session }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', session.user.id)
      .order('fecha', { ascending: false })
      .limit(10)
      .then(({ data }) => setHistory(data || []))
  }, [session, saved])

  const parseWorkout = async () => {
    if (!text.trim()) return
    setError('')
    setLoading(true)
    setParsed(null)
    setSaved(false)

    try {
      const res = await fetch('/api/parse-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      if (!res.ok) throw new Error('Error al conectar con la API')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setParsed(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const updateEjercicio = (index, updated) => {
    const list = [...parsed.ejercicios]
    list[index] = updated
    setParsed({ ejercicios: list })
  }

  const removeEjercicio = (index) => {
    setParsed({ ejercicios: parsed.ejercicios.filter((_, i) => i !== index) })
  }

  const save = async () => {
    if (!parsed) return
    setLoading(true)
    const { error: err } = await supabase.from('workout_logs').insert({
      user_id: session.user.id,
      fecha: today(),
      descripcion_original: text,
      ejercicios: parsed.ejercicios,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setParsed(null)
    setText('')
  }

  return (
    <div className="px-4 pt-8 pb-4">
      <h1 className="text-3xl mb-6" style={{ fontFamily: "'DM Serif Display', serif", color: '#1C1C1A' }}>
        Entreno
      </h1>

      <div className="mb-4">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Ej: sentadilla 60kg x 4 series x 10 reps, press banca 50kg x 3 series x 8 reps..."
          rows={4}
          className="w-full px-4 py-3 text-base outline-none border resize-none"
          style={{
            background: '#EFEBE3',
            borderColor: '#DDD8CE',
            color: '#1C1C1A',
            borderRadius: 10,
            lineHeight: 1.5
          }}
        />
        <button
          onClick={parseWorkout}
          disabled={loading || !text.trim()}
          className="w-full mt-2 py-3 font-medium text-white"
          style={{
            background: loading || !text.trim() ? '#d89a80' : '#C4714A',
            borderRadius: 8,
            transition: 'background 0.15s'
          }}
        >
          {loading ? 'Analizando...' : 'Analizar con IA'}
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm px-3 py-2" style={{ background: '#fde8df', color: '#C4714A', borderRadius: 6 }}>
          {error}
        </p>
      )}

      {saved && (
        <p className="mb-4 text-sm px-3 py-2" style={{ background: '#e8f0e9', color: '#7A9E7E', borderRadius: 6 }}>
          Entreno guardado
        </p>
      )}

      {parsed && (
        <div className="mb-4 p-4" style={{ background: '#EFEBE3', borderRadius: 12 }}>
          <p className="text-sm font-medium mb-3" style={{ color: '#888' }}>Confirma los ejercicios</p>

          {parsed.ejercicios.map((item, i) => (
            <EjercicioRow
              key={i}
              item={item}
              onChange={(updated) => updateEjercicio(i, updated)}
              onRemove={() => removeEjercicio(i)}
            />
          ))}

          <div className="mt-3 pt-3 flex justify-between text-sm" style={{ color: '#888' }}>
            <span>{parsed.ejercicios.length} ejercicios</span>
            <span>
              Vol. total:{' '}
              <strong style={{ color: '#1C1C1A' }}>
                {parsed.ejercicios.reduce((s, e) => s + (e.volumen_kg || 0), 0).toFixed(0)} kg
              </strong>
            </span>
          </div>

          <button
            onClick={save}
            disabled={loading}
            className="w-full mt-4 py-3 font-medium text-white"
            style={{ background: '#7A9E7E', borderRadius: 8 }}
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}

      {/* Historial */}
      <div>
        <p className="text-sm font-medium mb-3" style={{ color: '#888' }}>Historial reciente</p>
        {history.length === 0 ? (
          <p className="text-sm" style={{ color: '#bbb' }}>Sin entrenos registrados</p>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map(log => (
              <div key={log.id} className="p-3" style={{ background: '#EFEBE3', borderRadius: 10 }}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs" style={{ color: '#aaa' }}>{log.fecha}</span>
                  <span className="text-xs font-medium" style={{ color: '#7A9E7E' }}>
                    {(log.ejercicios || []).length} ejercicios
                  </span>
                </div>
                <p className="text-sm" style={{ color: '#666' }}>
                  {(log.ejercicios || []).map(e => e.nombre).join(', ')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

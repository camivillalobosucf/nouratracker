import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const today = () => new Date().toISOString().split('T')[0]

function AlimentoRow({ item, onChange, onRemove }) {
  return (
    <div className="py-3 border-b" style={{ borderColor: '#DDD8CE' }}>
      <div className="flex justify-between items-start mb-2">
        <span className="font-medium text-sm" style={{ color: '#1C1C1A' }}>{item.nombre}</span>
        <button onClick={onRemove} className="text-xs" style={{ color: '#C4714A' }}>Quitar</button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[
          ['g', 'cantidad_g'],
          ['kcal', 'calorias'],
          ['prot', 'proteina_g'],
          ['carbs', 'carbs_g'],
        ].map(([label, field]) => (
          <div key={field}>
            <label className="text-[10px] block mb-0.5" style={{ color: '#aaa' }}>{label}</label>
            <input
              type="number"
              value={item[field]}
              onChange={e => onChange(field, parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 text-sm outline-none border"
              style={{ background: '#F7F4EE', borderColor: '#DDD8CE', borderRadius: 6, color: '#1C1C1A' }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function NutritionLog({ session }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    supabase
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', session.user.id)
      .order('fecha', { ascending: false })
      .limit(10)
      .then(({ data }) => setHistory(data || []))
  }, [session, saved])

  const parseNutrition = async () => {
    if (!text.trim()) return
    setError('')
    setLoading(true)
    setParsed(null)
    setSaved(false)

    try {
      const res = await fetch('/api/parse-nutrition', {
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

  const updateAlimento = (index, field, value) => {
    const updated = [...parsed.alimentos]
    updated[index] = { ...updated[index], [field]: value }
    const totales = updated.reduce((acc, a) => ({
      calorias: acc.calorias + (a.calorias || 0),
      proteina_g: acc.proteina_g + (a.proteina_g || 0),
      carbs_g: acc.carbs_g + (a.carbs_g || 0),
      grasa_g: acc.grasa_g + (a.grasa_g || 0),
    }), { calorias: 0, proteina_g: 0, carbs_g: 0, grasa_g: 0 })
    setParsed({ alimentos: updated, totales })
  }

  const removeAlimento = (index) => {
    const updated = parsed.alimentos.filter((_, i) => i !== index)
    const totales = updated.reduce((acc, a) => ({
      calorias: acc.calorias + (a.calorias || 0),
      proteina_g: acc.proteina_g + (a.proteina_g || 0),
      carbs_g: acc.carbs_g + (a.carbs_g || 0),
      grasa_g: acc.grasa_g + (a.grasa_g || 0),
    }), { calorias: 0, proteina_g: 0, carbs_g: 0, grasa_g: 0 })
    setParsed({ alimentos: updated, totales })
  }

  const save = async () => {
    if (!parsed) return
    setLoading(true)
    const { error: err } = await supabase.from('nutrition_logs').insert({
      user_id: session.user.id,
      fecha: today(),
      descripcion_original: text,
      alimentos: parsed.alimentos,
      totales: parsed.totales,
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
        Nutrición
      </h1>

      {/* Input */}
      <div className="mb-4">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Ej: comí 2 huevos, 150g de claras, 50g de avena con leche de almendra..."
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
          onClick={parseNutrition}
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
          Guardado correctamente
        </p>
      )}

      {/* Resultados parseados */}
      {parsed && (
        <div className="mb-4 p-4" style={{ background: '#EFEBE3', borderRadius: 12 }}>
          <p className="text-sm font-medium mb-3" style={{ color: '#888' }}>Confirma los valores</p>

          {parsed.alimentos.map((item, i) => (
            <AlimentoRow
              key={i}
              item={item}
              onChange={(field, val) => updateAlimento(i, field, val)}
              onRemove={() => removeAlimento(i)}
            />
          ))}

          {/* Totales */}
          <div className="mt-3 pt-3 grid grid-cols-4 gap-2 text-center">
            {[
              ['Calorías', parsed.totales.calorias, 'kcal'],
              ['Proteína', parsed.totales.proteina_g, 'g'],
              ['Carbs', parsed.totales.carbs_g, 'g'],
              ['Grasa', parsed.totales.grasa_g, 'g'],
            ].map(([label, val, unit]) => (
              <div key={label}>
                <p className="text-lg font-medium" style={{ color: '#1C1C1A' }}>{Math.round(val)}</p>
                <p className="text-[10px]" style={{ color: '#aaa' }}>{unit} {label.toLowerCase()}</p>
              </div>
            ))}
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
          <p className="text-sm" style={{ color: '#bbb' }}>Sin registros aún</p>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map(log => (
              <div key={log.id} className="p-3" style={{ background: '#EFEBE3', borderRadius: 10 }}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs" style={{ color: '#aaa' }}>{log.fecha}</span>
                  <span className="text-sm font-medium" style={{ color: '#C4714A' }}>
                    {log.totales?.calorias} kcal
                  </span>
                </div>
                <p className="text-sm" style={{ color: '#666' }} numberOfLines={2}>
                  {log.descripcion_original}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

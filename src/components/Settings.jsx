import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT = { kcal_meta: 1720, proteina_meta: 145, carbs_meta: 155, grasa_meta: 58 }

export default function Settings({ session }) {
  const [goals, setGoals] = useState(DEFAULT)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => { if (data) setGoals(data) })
  }, [session])

  const handleChange = (field, value) => {
    setGoals(prev => ({ ...prev, [field]: parseFloat(value) || 0 }))
  }

  const save = async () => {
    setLoading(true)
    setError('')
    setSaved(false)

    const { data: existing } = await supabase
      .from('user_goals')
      .select('id')
      .eq('user_id', session.user.id)
      .single()

    const payload = {
      user_id: session.user.id,
      kcal_meta: goals.kcal_meta,
      proteina_meta: goals.proteina_meta,
      carbs_meta: goals.carbs_meta,
      grasa_meta: goals.grasa_meta,
      updated_at: new Date().toISOString(),
    }

    let err
    if (existing) {
      ;({ error: err } = await supabase.from('user_goals').update(payload).eq('id', existing.id))
    } else {
      ;({ error: err } = await supabase.from('user_goals').insert(payload))
    }

    setLoading(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  const fields = [
    { label: 'Calorías meta', field: 'kcal_meta', unit: 'kcal' },
    { label: 'Proteína meta', field: 'proteina_meta', unit: 'g' },
    { label: 'Carbohidratos meta', field: 'carbs_meta', unit: 'g' },
    { label: 'Grasa meta', field: 'grasa_meta', unit: 'g' },
  ]

  return (
    <div className="px-4 pt-8 pb-4">
      <h1 className="text-3xl mb-6" style={{ fontFamily: "'DM Serif Display', serif", color: '#1C1C1A' }}>
        Metas
      </h1>

      <div className="p-4 mb-4" style={{ background: '#EFEBE3', borderRadius: 12 }}>
        <p className="text-sm mb-4" style={{ color: '#888' }}>Metas diarias de nutrición</p>

        <div className="flex flex-col gap-4">
          {fields.map(({ label, field, unit }) => (
            <div key={field}>
              <label className="text-xs font-medium uppercase tracking-wide mb-1 block" style={{ color: '#888' }}>
                {label}
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={goals[field]}
                  onChange={e => handleChange(field, e.target.value)}
                  className="flex-1 px-4 py-3 text-base outline-none border"
                  style={{
                    background: '#F7F4EE',
                    borderColor: '#DDD8CE',
                    color: '#1C1C1A',
                    borderRadius: 8
                  }}
                />
                <span className="text-sm w-8" style={{ color: '#aaa' }}>{unit}</span>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-3 text-sm px-3 py-2" style={{ background: '#fde8df', color: '#C4714A', borderRadius: 6 }}>
            {error}
          </p>
        )}
        {saved && (
          <p className="mt-3 text-sm px-3 py-2" style={{ background: '#e8f0e9', color: '#7A9E7E', borderRadius: 6 }}>
            Metas guardadas
          </p>
        )}

        <button
          onClick={save}
          disabled={loading}
          className="w-full mt-4 py-3 font-medium text-white"
          style={{ background: loading ? '#d89a80' : '#C4714A', borderRadius: 8 }}
        >
          {loading ? 'Guardando...' : 'Guardar metas'}
        </button>
      </div>

      {/* Cuenta */}
      <div className="p-4" style={{ background: '#EFEBE3', borderRadius: 12 }}>
        <p className="text-sm mb-1" style={{ color: '#888' }}>Cuenta</p>
        <p className="text-sm mb-4" style={{ color: '#1C1C1A' }}>{session.user.email}</p>
        <button
          onClick={logout}
          className="w-full py-3 font-medium"
          style={{ background: '#F7F4EE', border: '1px solid #DDD8CE', color: '#888', borderRadius: 8 }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

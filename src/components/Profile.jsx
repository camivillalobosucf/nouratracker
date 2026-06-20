import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── Constants ──────────────────────────────────────────────────────────────

const GOAL_OPTIONS = [
  'Perder grasa', 'Ganar masa muscular', 'Ganar fuerza',
  'Mejorar rendimiento deportivo', 'Alimentación poco procesada',
  'Alta en proteína', 'Keto', 'Vegan', 'Vegetariano',
  'Mantener peso', 'Mejorar salud general', 'Más energía',
  'Mejorar hábitos alimenticios',
]

const GENERO_OPTIONS   = ['Masculino', 'Femenino', 'No binario', 'Prefiero no decir']
const ACTIVIDAD_OPTIONS = ['Sedentario', 'Poco activo', 'Moderado', 'Activo', 'Muy activo']

const CARD = { background: '#EFEBE3', borderRadius: 12, padding: '16px', marginBottom: 16 }
const LABEL = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#aaa', display: 'block', marginBottom: 6 }
const INPUT_STYLE = { background: '#F7F4EE', border: '1px solid #DDD8CE', borderRadius: 8, padding: '10px 14px', fontSize: 15, color: '#1C1C1A', width: '100%', outline: 'none', boxSizing: 'border-box' }

function PillToggle({ options, selected, onToggle, single = false }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => {
        const active = single ? selected === opt : (selected || []).includes(opt)
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: `1px solid ${active ? '#C4714A' : '#DDD8CE'}`,
              background: active ? '#C4714A' : 'transparent',
              color: active ? '#fff' : '#666',
              fontSize: 13,
              fontWeight: 500,
              transition: 'all 0.15s',
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

// ── Cuenta sub-view ────────────────────────────────────────────────────────

function CuentaView({ session, onBack }) {
  const [pwStep, setPwStep]         = useState(false)
  const [newPw, setNewPw]           = useState('')
  const [pwLoading, setPwLoading]   = useState(false)
  const [pwMsg, setPwMsg]           = useState(null)
  const [delStep, setDelStep]       = useState(false)
  const [delLoading, setDelLoading] = useState(false)
  const [delError, setDelError]     = useState('')

  const changePassword = async () => {
    if (newPw.length < 6) { setPwMsg({ ok: false, text: 'La contraseña debe tener al menos 6 caracteres' }); return }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwLoading(false)
    if (error) { setPwMsg({ ok: false, text: error.message }); return }
    setPwMsg({ ok: true, text: 'Contraseña actualizada' })
    setNewPw('')
    setPwStep(false)
  }

  const signOut = () => supabase.auth.signOut()

  const deleteAccount = async () => {
    setDelLoading(true)
    setDelError('')
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${s.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar la cuenta')
      await supabase.auth.signOut()
    } catch (e) {
      setDelLoading(false)
      setDelError(e.message)
    }
  }

  return (
    <div className="px-4 pt-10 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} style={{ color: '#C4714A', fontSize: 14, fontWeight: 600 }}>← Perfil</button>
        <h2 className="text-xl font-semibold" style={{ color: '#1C1C1A' }}>Cuenta</h2>
      </div>

      {/* Email */}
      <div style={CARD}>
        <span style={LABEL}>Correo electrónico</span>
        <p style={{ fontSize: 15, color: '#1C1C1A' }}>{session.user.email}</p>
      </div>

      {/* Change password */}
      <div style={CARD}>
        <span style={LABEL}>Contraseña</span>
        {!pwStep ? (
          <button
            onClick={() => setPwStep(true)}
            style={{ fontSize: 14, color: '#C4714A', fontWeight: 500 }}
          >
            Cambiar contraseña →
          </button>
        ) : (
          <div>
            <input
              type="password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="Nueva contraseña (mín. 6 caracteres)"
              style={{ ...INPUT_STYLE, marginBottom: 10 }}
            />
            {pwMsg && (
              <p className="mb-2 text-sm" style={{ color: pwMsg.ok ? '#7A9E7E' : '#C4714A' }}>{pwMsg.text}</p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={changePassword}
                disabled={pwLoading}
                style={{ flex: 1, padding: '10px', background: '#C4714A', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}
              >
                {pwLoading ? 'Guardando...' : 'Confirmar'}
              </button>
              <button
                onClick={() => { setPwStep(false); setPwMsg(null); setNewPw('') }}
                style={{ padding: '10px 16px', background: '#F7F4EE', border: '1px solid #DDD8CE', borderRadius: 8, fontSize: 14, color: '#888' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sign out */}
      <div style={CARD}>
        <button
          onClick={signOut}
          style={{ width: '100%', padding: '12px', background: '#F7F4EE', border: '1px solid #DDD8CE', borderRadius: 8, fontSize: 14, fontWeight: 500, color: '#555' }}
        >
          Cerrar sesión
        </button>
      </div>

      {/* Delete account */}
      <div style={{ ...CARD, borderColor: '#f5c9b8', border: '1px solid #f5c9b8' }}>
        <span style={{ ...LABEL, color: '#C4714A' }}>Zona de peligro</span>
        {!delStep ? (
          <button
            onClick={() => setDelStep(true)}
            style={{ fontSize: 14, color: '#C4714A', fontWeight: 500 }}
          >
            Eliminar cuenta
          </button>
        ) : (
          <div>
            <p className="text-sm mb-3" style={{ color: '#555' }}>
              Esta acción es permanente. Se eliminarán todos tus datos (logs, plan, chats). ¿Estás seguro?
            </p>
            {delError && <p className="text-sm mb-2" style={{ color: '#C4714A' }}>{delError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={deleteAccount}
                disabled={delLoading}
                style={{ flex: 1, padding: '10px', background: '#C4714A', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 500 }}
              >
                {delLoading ? 'Eliminando...' : 'Sí, eliminar mi cuenta'}
              </button>
              <button
                onClick={() => { setDelStep(false); setDelError('') }}
                style={{ padding: '10px 16px', background: '#F7F4EE', border: '1px solid #DDD8CE', borderRadius: 8, fontSize: 14, color: '#888' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Profile view ──────────────────────────────────────────────────────

export default function Profile({ session, isActive }) {
  const [view, setView] = useState('main')

  // Personal info
  const [info, setInfo] = useState({ nombre: '', edad: '', peso_kg: '', estatura_cm: '', genero: '', nivel_actividad: '' })
  const [infoLoading, setInfoLoading] = useState(false)
  const [infoSaved, setInfoSaved]     = useState(false)

  // Goal pills
  const [metas, setMetas]         = useState([])
  const [metasSaving, setMetasSaving] = useState(false)

  // Macro goals
  const [macros, setMacros]         = useState({ kcal_meta: 1720, proteina_meta: 145, carbs_meta: 155, grasa_meta: 58 })
  const [macrosLoading, setMacrosLoading] = useState(false)
  const [macrosSaved, setMacrosSaved]     = useState(false)

  const uid = session.user.id

  const fetchAll = useCallback(async () => {
    const [profileRes, goalsRes] = await Promise.all([
      supabase.from('user_profile').select('*').eq('user_id', uid).single(),
      supabase.from('user_goals').select('*').eq('user_id', uid).single(),
    ])
    if (profileRes.data) {
      const d = profileRes.data
      setInfo({
        nombre:        d.nombre        || '',
        edad:          d.edad          || '',
        peso_kg:       d.peso_kg       || '',
        estatura_cm:   d.estatura_cm   || '',
        genero:        d.genero        || '',
        nivel_actividad: d.nivel_actividad || '',
      })
      setMetas(d.metas || [])
    }
    if (goalsRes.data) setMacros(goalsRes.data)
  }, [uid])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { if (isActive) fetchAll() }, [isActive]) // eslint-disable-line

  const saveInfo = async () => {
    setInfoLoading(true)
    await supabase.from('user_profile').upsert({
      user_id:        uid,
      nombre:         info.nombre        || null,
      edad:           info.edad          ? parseInt(info.edad) : null,
      peso_kg:        info.peso_kg       ? parseFloat(info.peso_kg) : null,
      estatura_cm:    info.estatura_cm   ? parseInt(info.estatura_cm) : null,
      genero:         info.genero        || null,
      nivel_actividad: info.nivel_actividad || null,
      metas,
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'user_id' })
    setInfoLoading(false)
    setInfoSaved(true)
    setTimeout(() => setInfoSaved(false), 2500)
  }

  const toggleMeta = async (meta) => {
    const next = metas.includes(meta)
      ? metas.filter(m => m !== meta)
      : [...metas, meta]
    setMetas(next)
    setMetasSaving(true)
    await supabase.from('user_profile').upsert(
      { user_id: uid, metas: next, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    setMetasSaving(false)
  }

  const saveMacros = async () => {
    setMacrosLoading(true)
    const { data: existing } = await supabase.from('user_goals').select('id').eq('user_id', uid).single()
    const payload = { user_id: uid, ...macros, updated_at: new Date().toISOString() }
    if (existing) await supabase.from('user_goals').update(payload).eq('id', existing.id)
    else await supabase.from('user_goals').insert(payload)
    setMacrosLoading(false)
    setMacrosSaved(true)
    setTimeout(() => setMacrosSaved(false), 2500)
  }

  if (view === 'cuenta') return <CuentaView session={session} onBack={() => setView('main')} />

  return (
    <div className="px-4 pt-8 pb-24 overflow-y-auto">
      <h1 className="text-3xl mb-6" style={{ fontFamily: "'DM Serif Display', serif", color: '#1C1C1A' }}>
        Perfil
      </h1>

      {/* ── Información personal ── */}
      <div style={CARD}>
        <p className="font-semibold mb-4" style={{ color: '#1C1C1A', fontSize: 15 }}>Información personal</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={LABEL}>Nombre</label>
            <input
              type="text"
              value={info.nombre}
              onChange={e => setInfo(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Tu nombre"
              style={INPUT_STYLE}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>Edad</label>
              <input type="number" value={info.edad} onChange={e => setInfo(p => ({ ...p, edad: e.target.value }))} placeholder="años" style={INPUT_STYLE} />
            </div>
            <div>
              <label style={LABEL}>Estatura</label>
              <input type="number" value={info.estatura_cm} onChange={e => setInfo(p => ({ ...p, estatura_cm: e.target.value }))} placeholder="cm" style={INPUT_STYLE} />
            </div>
          </div>

          <div>
            <label style={LABEL}>Peso actual</label>
            <input type="number" value={info.peso_kg} onChange={e => setInfo(p => ({ ...p, peso_kg: e.target.value }))} placeholder="kg" style={INPUT_STYLE} />
          </div>

          <div>
            <label style={LABEL}>Género (opcional)</label>
            <PillToggle
              options={GENERO_OPTIONS}
              selected={info.genero}
              single
              onToggle={opt => setInfo(p => ({ ...p, genero: p.genero === opt ? '' : opt }))}
            />
          </div>

          <div>
            <label style={LABEL}>Nivel de actividad (opcional)</label>
            <PillToggle
              options={ACTIVIDAD_OPTIONS}
              selected={info.nivel_actividad}
              single
              onToggle={opt => setInfo(p => ({ ...p, nivel_actividad: p.nivel_actividad === opt ? '' : opt }))}
            />
          </div>
        </div>

        {infoSaved && (
          <p className="mt-3 text-sm px-3 py-2" style={{ background: '#e8f0e9', color: '#7A9E7E', borderRadius: 6 }}>
            Guardado
          </p>
        )}
        <button
          onClick={saveInfo}
          disabled={infoLoading}
          className="w-full mt-4 py-3 font-medium text-white"
          style={{ background: infoLoading ? '#d89a80' : '#C4714A', borderRadius: 8 }}
        >
          {infoLoading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {/* ── Metas ── */}
      <div style={CARD}>
        <div className="flex justify-between items-center mb-3">
          <p className="font-semibold" style={{ color: '#1C1C1A', fontSize: 15 }}>Metas</p>
          {metasSaving && <span style={{ fontSize: 12, color: '#aaa' }}>Guardando...</span>}
        </div>
        <PillToggle options={GOAL_OPTIONS} selected={metas} onToggle={toggleMeta} />
      </div>

      {/* ── Objetivos nutricionales ── */}
      <div style={CARD}>
        <p className="font-semibold mb-4" style={{ color: '#1C1C1A', fontSize: 15 }}>Objetivos nutricionales</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Calorías', field: 'kcal_meta', unit: 'kcal' },
            { label: 'Proteína', field: 'proteina_meta', unit: 'g' },
            { label: 'Carbohidratos', field: 'carbs_meta', unit: 'g' },
            { label: 'Grasa', field: 'grasa_meta', unit: 'g' },
          ].map(({ label, field, unit }) => (
            <div key={field}>
              <label style={LABEL}>{label} ({unit})</label>
              <input
                type="number"
                value={macros[field]}
                onChange={e => setMacros(p => ({ ...p, [field]: parseFloat(e.target.value) || 0 }))}
                style={INPUT_STYLE}
              />
            </div>
          ))}
        </div>
        {macrosSaved && (
          <p className="mt-3 text-sm px-3 py-2" style={{ background: '#e8f0e9', color: '#7A9E7E', borderRadius: 6 }}>Guardado</p>
        )}
        <button
          onClick={saveMacros}
          disabled={macrosLoading}
          className="w-full mt-4 py-3 font-medium text-white"
          style={{ background: macrosLoading ? '#d89a80' : '#C4714A', borderRadius: 8 }}
        >
          {macrosLoading ? 'Guardando...' : 'Guardar objetivos'}
        </button>
      </div>

      {/* ── Cuenta ── */}
      <button
        onClick={() => setView('cuenta')}
        style={{ ...CARD, display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', cursor: 'pointer', boxSizing: 'border-box' }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1A' }}>Cuenta</span>
        <span style={{ color: '#C4714A', fontSize: 18 }}>›</span>
      </button>
    </div>
  )
}

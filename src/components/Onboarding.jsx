import { useState } from 'react'
import { supabase } from '../lib/supabase'
import logo from '../assets/logotransparent.svg'

const GOAL_OPTIONS = [
  'Perder grasa', 'Ganar masa muscular', 'Ganar fuerza',
  'Mejorar rendimiento deportivo', 'Alimentación poco procesada',
  'Alta en proteína', 'Keto', 'Vegan', 'Vegetariano',
  'Mantener peso', 'Mejorar salud general', 'Más energía',
  'Mejorar hábitos alimenticios',
]

const ACTIVIDAD_OPTIONS = [
  { label: 'Sedentario',    desc: 'Trabajo de escritorio, muy poco ejercicio' },
  { label: 'Poco activo',   desc: 'Ejercicio ligero 1–3 días por semana' },
  { label: 'Moderado',      desc: 'Ejercicio moderado 3–5 días por semana' },
  { label: 'Activo',        desc: 'Ejercicio intenso 6–7 días por semana' },
  { label: 'Muy activo',    desc: 'Atleta o trabajo físico muy demandante' },
]

const TOTAL_STEPS = 8

function cmFromM(v)       { return Math.round(parseFloat(v) * 100) }
function cmFromFtIn(f, i) { return Math.round(parseFloat(f || 0) * 30.48 + parseFloat(i || 0) * 2.54) }

// ── Shared UI ──────────────────────────────────────────────────────────────

const INPUT = {
  background: '#EFEBE3', border: '1px solid #DDD8CE', borderRadius: 10,
  padding: '14px 16px', fontSize: 17, color: '#1C1C1A', width: '100%',
  outline: 'none', boxSizing: 'border-box',
}

function Pill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 16px', borderRadius: 20, fontSize: 14, fontWeight: 500,
      border: `1px solid ${active ? '#C4714A' : '#DDD8CE'}`,
      background: active ? '#C4714A' : 'transparent',
      color: active ? '#fff' : '#555',
      transition: 'all 0.15s',
    }}>
      {label}
    </button>
  )
}

function ContinueBtn({ onClick, disabled, label = 'Continuar →' }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '16px', fontSize: 16, fontWeight: 600,
      background: disabled ? '#d89a80' : '#C4714A', color: '#fff',
      borderRadius: 12, transition: 'background 0.15s',
    }}>
      {label}
    </button>
  )
}

// ── Step screens ───────────────────────────────────────────────────────────

function StepNombre({ value, onChange, onNext }) {
  return (
    <>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: '#1C1C1A', marginBottom: 8 }}>
        ¿Cómo te llamas?
      </h2>
      <p style={{ color: '#888', fontSize: 15, marginBottom: 32 }}>
        Así podré llamarte por tu nombre en todo momento.
      </p>
      <input
        autoFocus type="text" value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && value.trim() && onNext()}
        placeholder="Tu nombre" style={INPUT}
      />
      <div style={{ marginTop: 24 }}>
        <ContinueBtn onClick={onNext} disabled={!value.trim()} />
      </div>
    </>
  )
}

function StepEdad({ value, onChange, onNext }) {
  return (
    <>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: '#1C1C1A', marginBottom: 8 }}>
        ¿Cuántos años tienes?
      </h2>
      <p style={{ color: '#888', fontSize: 15, marginBottom: 32 }}>
        Lo uso para calcular con precisión tus necesidades calóricas.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          autoFocus type="number" value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && value && onNext()}
          placeholder="Ej: 28" style={{ ...INPUT, flex: 1 }} min="10" max="100"
        />
        <span style={{ fontSize: 16, color: '#888', whiteSpace: 'nowrap' }}>años</span>
      </div>
      <div style={{ marginTop: 24 }}>
        <ContinueBtn onClick={onNext} disabled={!value} />
      </div>
    </>
  )
}

function StepPeso({ value, onChange, onNext }) {
  return (
    <>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: '#1C1C1A', marginBottom: 8 }}>
        ¿Cuánto pesas?
      </h2>
      <p style={{ color: '#888', fontSize: 15, marginBottom: 32 }}>
        Esto me ayuda a calcular tus macros personalizados.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          autoFocus type="number" value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && value && onNext()}
          placeholder="Ej: 70" style={{ ...INPUT, flex: 1 }} step="0.1"
        />
        <span style={{ fontSize: 16, color: '#888' }}>kg</span>
      </div>
      <div style={{ marginTop: 24 }}>
        <ContinueBtn onClick={onNext} disabled={!value} />
      </div>
    </>
  )
}

function StepEstatura({ estaturaUnit, setEstaturaUnit, estaturaM, setEstaturaM, estaturaFt, setEstaturaFt, estaturaIn, setEstaturaIn, onNext }) {
  const hasValue = estaturaUnit === 'm' ? !!estaturaM : !!estaturaFt

  const switchUnit = (u) => {
    if (u === estaturaUnit) return
    if (u === 'ft' && estaturaM) {
      const cm = cmFromM(estaturaM)
      const totalIn = cm / 2.54
      setEstaturaFt(String(Math.floor(totalIn / 12)))
      setEstaturaIn(String(Math.round(totalIn % 12)))
    } else if (u === 'm' && estaturaFt) {
      const cm = cmFromFtIn(estaturaFt, estaturaIn)
      setEstaturaM((cm / 100).toFixed(2))
    }
    setEstaturaUnit(u)
  }

  return (
    <>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: '#1C1C1A', marginBottom: 8 }}>
        ¿Cuánto mides?
      </h2>
      <p style={{ color: '#888', fontSize: 15, marginBottom: 24 }}>
        Parte del cálculo de tu metabolismo basal.
      </p>
      {/* Unit toggle */}
      <div style={{ display: 'inline-flex', background: '#EFEBE3', border: '1px solid #DDD8CE', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
        {[['m', 'Metros'], ['ft', 'Pies / Pulg.']].map(([u, lbl]) => (
          <button key={u} onClick={() => switchUnit(u)} style={{
            padding: '10px 20px', fontSize: 14, fontWeight: 600, border: 'none',
            background: estaturaUnit === u ? '#C4714A' : 'transparent',
            color: estaturaUnit === u ? '#fff' : '#888',
            transition: 'all 0.15s',
          }}>{lbl}</button>
        ))}
      </div>
      {estaturaUnit === 'm' ? (
        <input
          autoFocus type="number" value={estaturaM}
          onChange={e => setEstaturaM(e.target.value)}
          placeholder="Ej: 1.75" style={INPUT} step="0.01"
        />
      ) : (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <input type="number" value={estaturaFt} onChange={e => setEstaturaFt(e.target.value)}
              placeholder="Pies" style={INPUT} />
            <span style={{ fontSize: 12, color: '#aaa', marginTop: 4, display: 'block' }}>pies</span>
          </div>
          <div style={{ flex: 1 }}>
            <input type="number" value={estaturaIn} onChange={e => setEstaturaIn(e.target.value)}
              placeholder="Pulgadas" style={INPUT} />
            <span style={{ fontSize: 12, color: '#aaa', marginTop: 4, display: 'block' }}>pulgadas</span>
          </div>
        </div>
      )}
      <div style={{ marginTop: 24 }}>
        <ContinueBtn onClick={onNext} disabled={!hasValue} />
      </div>
    </>
  )
}

function StepGenero({ value, onChange, onNext, onSkip }) {
  return (
    <>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: '#1C1C1A', marginBottom: 8 }}>
        ¿Con qué género te identificas?
      </h2>
      <p style={{ color: '#888', fontSize: 15, marginBottom: 32 }}>
        Opcional — lo uso para afinar el cálculo de tu metabolismo.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {['Masculino', 'Femenino', 'Prefiero no decir'].map(opt => (
          <button key={opt} onClick={() => onChange(value === opt ? '' : opt)} style={{
            padding: '16px', borderRadius: 12, fontSize: 16, fontWeight: 500, textAlign: 'left',
            border: `1px solid ${value === opt ? '#C4714A' : '#DDD8CE'}`,
            background: value === opt ? '#fde8df' : '#EFEBE3',
            color: value === opt ? '#C4714A' : '#555',
            transition: 'all 0.15s',
          }}>
            {opt}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ContinueBtn onClick={onNext} disabled={!value} />
        <button onClick={onSkip} style={{ fontSize: 14, color: '#aaa', padding: '8px', background: 'none', border: 'none' }}>
          Omitir este paso
        </button>
      </div>
    </>
  )
}

function StepActividad({ value, onChange, onNext }) {
  return (
    <>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: '#1C1C1A', marginBottom: 8 }}>
        ¿Qué tan activo/a eres?
      </h2>
      <p style={{ color: '#888', fontSize: 15, marginBottom: 24 }}>
        Sé honesto/a — esto afecta directamente tus calorías diarias.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ACTIVIDAD_OPTIONS.map(({ label, desc }) => (
          <button key={label} onClick={() => onChange(label)} style={{
            padding: '14px 16px', borderRadius: 12, textAlign: 'left',
            border: `1px solid ${value === label ? '#C4714A' : '#DDD8CE'}`,
            background: value === label ? '#fde8df' : '#EFEBE3',
            transition: 'all 0.15s',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: value === label ? '#C4714A' : '#1C1C1A' }}>{label}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{desc}</div>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        <ContinueBtn onClick={onNext} disabled={!value} />
      </div>
    </>
  )
}

function StepMetas({ value, onChange, onNext }) {
  return (
    <>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: '#1C1C1A', marginBottom: 8 }}>
        ¿Cuáles son tus metas?
      </h2>
      <p style={{ color: '#888', fontSize: 15, marginBottom: 24 }}>
        Selecciona todas las que apliquen.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {GOAL_OPTIONS.map(opt => (
          <Pill key={opt} label={opt} active={value.includes(opt)}
            onClick={() => onChange(value.includes(opt) ? value.filter(m => m !== opt) : [...value, opt])}
          />
        ))}
      </div>
      <div style={{ marginTop: 28 }}>
        <ContinueBtn onClick={onNext} disabled={value.length === 0} />
      </div>
    </>
  )
}

function StepCoaching({ value, onChange, onNext }) {
  const opts = [
    {
      key: 'flexible',
      title: 'Flexible',
      desc: 'Te doy orientación con libertad. Variedad, opciones, sin reglas rígidas. Adaptamos el plan a tu vida.',
      icon: '🤸',
    },
    {
      key: 'estricto',
      title: 'Estricto',
      desc: 'Disciplina total. Gramos exactos, horarios, sin improvisación. Máximos resultados con estructura clara.',
      icon: '🎯',
    },
  ]

  return (
    <>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: '#1C1C1A', marginBottom: 8 }}>
        ¿Cómo prefieres trabajar conmigo?
      </h2>
      <p style={{ color: '#888', fontSize: 15, marginBottom: 28 }}>
        Puedes cambiarlo cuando quieras desde tu perfil.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {opts.map(o => (
          <button key={o.key} onClick={() => onChange(o.key)} style={{
            padding: '20px', borderRadius: 14, textAlign: 'left',
            border: `2px solid ${value === o.key ? '#C4714A' : '#DDD8CE'}`,
            background: value === o.key ? '#fde8df' : '#EFEBE3',
            transition: 'all 0.15s',
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{o.icon}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: value === o.key ? '#C4714A' : '#1C1C1A', marginBottom: 4 }}>{o.title}</div>
            <div style={{ fontSize: 14, color: '#666', lineHeight: 1.5 }}>{o.desc}</div>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 28 }}>
        <ContinueBtn onClick={onNext} disabled={!value} />
      </div>
    </>
  )
}

function WelcomeScreen({ nombre, onStart }) {
  return (
    <div style={{ minHeight: '100dvh', background: '#F7F4EE', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', textAlign: 'center' }}>
      <img src={logo} alt="Noura" style={{ width: 120, marginBottom: 36, opacity: 0.9 }} />
      <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, color: '#1C1C1A', marginBottom: 12 }}>
        Hola, {nombre} 👋
      </h1>
      <p style={{ fontSize: 16, color: '#555', lineHeight: 1.7, marginBottom: 28, maxWidth: 340 }}>
        Soy <strong>Noura</strong>, tu entrenadora personal y nutricionista. Con la información que me diste, voy a crear tu plan completamente personalizado.
      </p>
      <div style={{ background: '#EFEBE3', borderRadius: 14, padding: '20px 24px', marginBottom: 36, maxWidth: 340, textAlign: 'left', width: '100%' }}>
        {[
          'Calcular tus macros exactos según tu metabolismo',
          'Diseñar tu plan de alimentación diario',
          'Crear tu plan de entrenamiento semanal',
          'Acompañarte y ajustar todo en el camino',
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: i < 3 ? 12 : 0 }}>
            <span style={{ color: '#7A9E7E', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
            <span style={{ fontSize: 14, color: '#444', lineHeight: 1.5 }}>{item}</span>
          </div>
        ))}
      </div>
      <button onClick={onStart} style={{
        width: '100%', maxWidth: 340, padding: '16px', fontSize: 16, fontWeight: 700,
        background: '#C4714A', color: '#fff', borderRadius: 12,
      }}>
        Comenzar con Noura →
      </button>
    </div>
  )
}

// ── Main Onboarding component ──────────────────────────────────────────────

export default function Onboarding({ session, onComplete }) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Form data
  const [nombre, setNombre]         = useState('')
  const [edad, setEdad]             = useState('')
  const [peso, setPeso]             = useState('')
  const [genero, setGenero]         = useState('')
  const [actividad, setActividad]   = useState('')
  const [metas, setMetas]           = useState([])
  const [coaching, setCoaching]     = useState('')

  // Height state
  const [estaturaUnit, setEstaturaUnit] = useState('m')
  const [estaturaM, setEstaturaM]       = useState('')
  const [estaturaFt, setEstaturaFt]     = useState('')
  const [estaturaIn, setEstaturaIn]     = useState('')

  const getEstaturaCm = () => {
    if (estaturaUnit === 'm' && estaturaM) return cmFromM(estaturaM)
    if (estaturaUnit === 'ft' && estaturaFt) return cmFromFtIn(estaturaFt, estaturaIn)
    return null
  }

  const saveAndFinish = async () => {
    setSaving(true)
    await supabase.from('user_profile').upsert({
      user_id:               session.user.id,
      nombre:                nombre    || null,
      edad:                  edad      ? parseInt(edad)      : null,
      peso_kg:               peso      ? parseFloat(peso)    : null,
      estatura_cm:           getEstaturaCm(),
      genero:                genero    || null,
      nivel_actividad:       actividad || null,
      metas,
      coaching_style:        coaching  || null,
      onboarding_completado: true,
      updated_at:            new Date().toISOString(),
    }, { onConflict: 'user_id' })

    localStorage.setItem('noura_new_user', '1')
    setSaving(false)
    onComplete()
  }

  const next = () => setStep(s => s + 1)
  const back = () => setStep(s => s - 1)

  const progress = Math.round((step / TOTAL_STEPS) * 100)

  // Welcome screen (step 8)
  if (step === TOTAL_STEPS) {
    return <WelcomeScreen nombre={nombre} onStart={saving ? undefined : saveAndFinish} />
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F7F4EE', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {step > 0 && (
          <button onClick={back} style={{ color: '#C4714A', fontSize: 14, fontWeight: 600, marginRight: 4 }}>←</button>
        )}
        <img src={logo} alt="Noura" style={{ height: 28 }} />
        <span style={{ fontSize: 12, color: '#aaa', marginLeft: 'auto' }}>{step + 1} / {TOTAL_STEPS}</span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: '#DDD8CE', margin: '0 0 0 0' }}>
        <div style={{ height: 3, background: '#C4714A', width: `${progress}%`, transition: 'width 0.3s ease' }} />
      </div>

      {/* Step content */}
      <div style={{ flex: 1, padding: '32px 28px 100px', overflowY: 'auto' }}>
        {step === 0 && <StepNombre value={nombre} onChange={setNombre} onNext={next} />}
        {step === 1 && <StepEdad value={edad} onChange={setEdad} onNext={next} />}
        {step === 2 && <StepPeso value={peso} onChange={setPeso} onNext={next} />}
        {step === 3 && (
          <StepEstatura
            estaturaUnit={estaturaUnit} setEstaturaUnit={setEstaturaUnit}
            estaturaM={estaturaM} setEstaturaM={setEstaturaM}
            estaturaFt={estaturaFt} setEstaturaFt={setEstaturaFt}
            estaturaIn={estaturaIn} setEstaturaIn={setEstaturaIn}
            onNext={next}
          />
        )}
        {step === 4 && <StepGenero value={genero} onChange={setGenero} onNext={next} onSkip={next} />}
        {step === 5 && <StepActividad value={actividad} onChange={setActividad} onNext={next} />}
        {step === 6 && <StepMetas value={metas} onChange={setMetas} onNext={next} />}
        {step === 7 && <StepCoaching value={coaching} onChange={setCoaching} onNext={next} />}
      </div>
    </div>
  )
}

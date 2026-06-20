import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const todayDate = () => new Date().toISOString().split('T')[0]

const MEALS = [
  { key: 'desayuno',     label: 'Desayuno' },
  { key: 'almuerzo',     label: 'Almuerzo' },
  { key: 'merienda',     label: 'Merienda' },
  { key: 'post_entreno', label: 'Post-Entreno' },
  { key: 'cena',         label: 'Cena' },
  { key: 'suplementos',  label: 'Suplementos' },
]

const MACRO_ORDER  = ['proteina', 'carbs', 'grasa', 'otro']
const MACRO_LABELS = { proteina: 'Proteínas', carbs: 'Carbohidratos', grasa: 'Grasas', otro: 'Otros' }

const PALETTE = {
  green:  { bg: '#e8f0e9', text: '#5a8c5e', dot: '#7A9E7E' },
  yellow: { bg: '#fef9ec', text: '#b8862a', dot: '#D4A843' },
  red:    { bg: '#fde8df', text: '#a05030', dot: '#C4714A' },
}

function categorizePlanItem(nombre) {
  const n = nombre.toLowerCase()
  if (/pollo|pechuga|atún|salmón|carne|huevo|clara|proteín|yogurt|cottage|pavo|tilapia|bacalao|camarón|tofu|whey|caseín/i.test(n)) return 'proteina'
  if (/avena|arroz|pan|papa|batata|plátano|fruta|quinoa|pasta|tortilla|cereal|granola|maíz|frijol|lenteja|garbanzo|camote|yuca|mango|manzana|naranja|banana/i.test(n)) return 'carbs'
  if (/aceite|aguacate|mantequilla|nuez|almendra|maní|semilla|coco|manteca/i.test(n)) return 'grasa'
  return 'otro'
}

function categorizeLoggedItem(item) {
  const p = item.proteina_g || 0
  const c = item.carbs_g    || 0
  const g = item.grasa_g    || 0
  if (p >= c && p >= g) return 'proteina'
  if (c >= g)           return 'carbs'
  return 'grasa'
}

function matchRatio(planItem, todayFoods) {
  const nameL = planItem.nombre.toLowerCase()
  const words  = nameL.split(/\s+/).filter(w => w.length > 3)
  const matched = todayFoods.filter(f => {
    const fName = (f.nombre || '').toLowerCase()
    return words.some(w => fName.includes(w)) || fName.includes(nameL) || nameL.includes(fName)
  })
  if (!matched.length) return 0
  const logged  = matched.reduce((s, f) => s + (f.cantidad_g || 0), 0)
  const planned = planItem.cantidad_g
  if (!planned) return logged > 0 ? 1 : 0
  return logged / planned
}

function rowColor(ratio) {
  if (ratio >= 0.8) return 'green'
  if (ratio >= 0.5) return 'yellow'
  return 'red'
}

// ── Shared table constants ─────────────────────────────────────────────────

const QTY_W       = 88   // fixed px width for quantity column
const BORDER      = '1px solid #CCC8BF'
const BORDER_THICK = '2px solid #C8C3BA'
const COL_GRID    = `1fr ${QTY_W}px`

function ColHeaders({ background = '#E0DCD4' }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: COL_GRID, background, borderBottom: BORDER_THICK }}>
      <div style={{ padding: '7px 14px', borderRight: BORDER }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#777' }}>Alimento</span>
      </div>
      <div style={{ padding: '7px 14px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#777' }}>Cantidad</span>
      </div>
    </div>
  )
}

function MacroHeader({ label }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: COL_GRID, background: '#F2EFE8', borderBottom: BORDER }}>
      <div style={{ padding: '4px 14px', borderRight: BORDER }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#aaa' }}>
          {label}
        </span>
      </div>
      <div />
    </div>
  )
}

// ── Plan table (when user has a saved plan) ────────────────────────────────

function PlanTable({ plan, todayFoods }) {
  const activeMeals = MEALS.filter(m => (plan[m.key] || []).length > 0)
  if (!activeMeals.length) return null

  return (
    <div className="mb-6" style={{ borderRadius: 12, overflow: 'hidden', border: BORDER_THICK }}>
      <ColHeaders />

      {activeMeals.map((meal, mealIdx) => {
        const items = plan[meal.key] || []
        const grouped = Object.fromEntries(MACRO_ORDER.map(k => [k, []]))
        items.forEach(item => grouped[categorizePlanItem(item.nombre)].push(item))

        return (
          <div key={meal.key} style={{ borderTop: mealIdx > 0 ? '3px double #C8C3BA' : 'none' }}>
            {/* Meal section header — full width, no vertical split */}
            <div style={{ padding: '6px 14px', background: '#EFEBE3', borderBottom: BORDER }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C4714A' }}>
                {meal.label}
              </span>
            </div>

            {MACRO_ORDER.map(cat => {
              const catItems = grouped[cat]
              if (!catItems.length) return null
              return (
                <div key={cat}>
                  <MacroHeader label={MACRO_LABELS[cat]} />
                  {catItems.map((item, i) => {
                    const c = PALETTE[rowColor(matchRatio(item, todayFoods))]
                    return (
                      <div
                        key={i}
                        style={{ display: 'grid', gridTemplateColumns: COL_GRID, background: c.bg, borderBottom: BORDER }}
                      >
                        {/* Alimento */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRight: BORDER, minWidth: 0 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                          <span style={{ fontSize: 14, color: '#1C1C1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.nombre}
                          </span>
                        </div>
                        {/* Cantidad */}
                        <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: c.text, whiteSpace: 'nowrap' }}>
                            {item.descripcion || (item.cantidad_g ? `${item.cantidad_g}g` : '—')}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── Logged foods table (no plan saved, show what was logged today) ──────────

function LoggedTable({ foods }) {
  if (!foods.length) return null

  const grouped = Object.fromEntries(MACRO_ORDER.map(k => [k, []]))
  foods.forEach(item => grouped[categorizeLoggedItem(item)].push(item))

  return (
    <div className="mb-6" style={{ borderRadius: 12, overflow: 'hidden', border: BORDER_THICK }}>
      <ColHeaders />

      {MACRO_ORDER.map(cat => {
        const catItems = grouped[cat]
        if (!catItems.length) return null
        return (
          <div key={cat}>
            <MacroHeader label={MACRO_LABELS[cat]} />
            {catItems.map((item, i) => (
              <div
                key={i}
                style={{ display: 'grid', gridTemplateColumns: COL_GRID, background: '#F7F4EE', borderBottom: BORDER }}
              >
                <div style={{ padding: '9px 14px', borderRight: BORDER }}>
                  <span style={{ fontSize: 14, color: '#1C1C1A' }}>{item.nombre}</span>
                </div>
                <div style={{ padding: '9px 14px' }}>
                  <span style={{ fontSize: 13, color: '#888', whiteSpace: 'nowrap' }}>
                    {item.cantidad_g ? `${item.cantidad_g}g` : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Editable row in confirmation dialog ───────────────────────────────────

function AlimentoRow({ item, onChange, onRemove }) {
  return (
    <div className="py-3 border-b" style={{ borderColor: '#DDD8CE' }}>
      <div className="flex justify-between items-start mb-2">
        <span className="font-medium text-sm" style={{ color: '#1C1C1A' }}>{item.nombre}</span>
        <button onClick={onRemove} className="text-xs" style={{ color: '#C4714A' }}>Quitar</button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[['g', 'cantidad_g'], ['kcal', 'calorias'], ['prot', 'proteina_g'], ['carbs', 'carbs_g']].map(([label, field]) => (
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

// ── Main component ─────────────────────────────────────────────────────────

export default function NutritionLog({ session, isActive }) {
  const [text, setText]       = useState('')
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed]   = useState(null)
  const [error, setError]     = useState('')
  const [saved, setSaved]     = useState(false)
  const [plan, setPlan]       = useState(null)
  const [todayFoods, setTodayFoods] = useState([])

  const fetchData = async () => {
    const uid = session.user.id
    const [planRes, todayRes] = await Promise.all([
      supabase.from('user_plan').select('nutricion').eq('user_id', uid).single(),
      supabase.from('nutrition_logs').select('alimentos').eq('user_id', uid).eq('fecha', todayDate()),
    ])
    setPlan(planRes.data?.nutricion || null)
    setTodayFoods((todayRes.data || []).flatMap(l => l.alimentos || []))
  }

  useEffect(() => { fetchData() }, [session])
  useEffect(() => { if (isActive) fetchData() }, [isActive])

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
        body: JSON.stringify({ text }),
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
      calorias:   acc.calorias   + (a.calorias   || 0),
      proteina_g: acc.proteina_g + (a.proteina_g || 0),
      carbs_g:    acc.carbs_g    + (a.carbs_g    || 0),
      grasa_g:    acc.grasa_g    + (a.grasa_g    || 0),
    }), { calorias: 0, proteina_g: 0, carbs_g: 0, grasa_g: 0 })
    setParsed({ alimentos: updated, totales })
  }

  const removeAlimento = (index) => {
    const updated = parsed.alimentos.filter((_, i) => i !== index)
    const totales = updated.reduce((acc, a) => ({
      calorias:   acc.calorias   + (a.calorias   || 0),
      proteina_g: acc.proteina_g + (a.proteina_g || 0),
      carbs_g:    acc.carbs_g    + (a.carbs_g    || 0),
      grasa_g:    acc.grasa_g    + (a.grasa_g    || 0),
    }), { calorias: 0, proteina_g: 0, carbs_g: 0, grasa_g: 0 })
    setParsed({ alimentos: updated, totales })
  }

  const save = async () => {
    if (!parsed) return
    setLoading(true)
    const { error: err } = await supabase.from('nutrition_logs').insert({
      user_id:               session.user.id,
      fecha:                 todayDate(),
      descripcion_original:  text,
      alimentos:             parsed.alimentos,
      totales:               parsed.totales,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setParsed(null)
    setText('')
    fetchData()
  }

  return (
    <div className="px-4 pt-8 pb-4">
      <h1 className="text-3xl mb-6" style={{ fontFamily: "'DM Serif Display', serif", color: '#1C1C1A' }}>
        Nutrición
      </h1>

      {plan
        ? <PlanTable plan={plan} todayFoods={todayFoods} />
        : <LoggedTable foods={todayFoods} />
      }

      <div className="mb-4">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Ej: comí 2 huevos, 150g de claras, 50g de avena con leche de almendra..."
          rows={4}
          className="w-full px-4 py-3 text-base outline-none border resize-none"
          style={{ background: '#EFEBE3', borderColor: '#DDD8CE', color: '#1C1C1A', borderRadius: 10, lineHeight: 1.5 }}
        />
        <button
          onClick={parseNutrition}
          disabled={loading || !text.trim()}
          className="w-full mt-2 py-3 font-medium text-white"
          style={{ background: loading || !text.trim() ? '#d89a80' : '#C4714A', borderRadius: 8 }}
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

      {parsed && (
        <div className="mb-4 p-4" style={{ background: '#EFEBE3', borderRadius: 12 }}>
          <p className="text-sm font-medium mb-3" style={{ color: '#888' }}>Confirma los valores</p>
          {parsed.alimentos.map((item, i) => (
            <AlimentoRow
              key={i}
              item={item}
              onChange={(f, v) => updateAlimento(i, f, v)}
              onRemove={() => removeAlimento(i)}
            />
          ))}
          <div className="mt-3 pt-3 grid grid-cols-4 gap-2 text-center">
            {[
              ['Calorías',  parsed.totales.calorias,   'kcal'],
              ['Proteína',  parsed.totales.proteina_g, 'g'],
              ['Carbs',     parsed.totales.carbs_g,    'g'],
              ['Grasa',     parsed.totales.grasa_g,    'g'],
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
    </div>
  )
}

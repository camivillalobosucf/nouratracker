import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DAYS_ES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, context } = req.body
  if (!messages?.length) return res.status(400).json({ error: 'Faltan mensajes' })

  const { goals, plan, recentNutrition, recentWorkouts, todayLogs } = context || {}
  const today = DAYS_ES[new Date().getDay()]

  const systemPrompt = `Eres Noura, asistente personal de nutrición y entrenamiento. Responde siempre en español, sé concisa y motivadora.

METAS DIARIAS DEL USUARIO:
- Calorías: ${goals?.kcal_meta || 1720} kcal
- Proteína: ${goals?.proteina_meta || 145}g
- Carbs: ${goals?.carbs_meta || 155}g
- Grasa: ${goals?.grasa_meta || 58}g

${plan ? `PLAN ACTUAL DEL USUARIO:
Nutrición: ${JSON.stringify(plan.nutricion, null, 2)}
Entrenamiento: ${JSON.stringify(plan.entrenamiento, null, 2)}` : 'PLAN ACTUAL: Aún no tiene un plan generado.'}

${todayLogs?.length ? `LO QUE COMIÓ HOY: ${todayLogs.map(l => `${l.descripcion_original} (${l.totales?.calorias} kcal, ${l.totales?.proteina_g}g prot)`).join(' | ')}` : ''}

${recentWorkouts?.length ? `ENTRENOS RECIENTES: ${recentWorkouts.slice(0,3).map(w => `${w.fecha}: ${(w.ejercicios||[]).map(e=>e.nombre).join(', ')}`).join(' | ')}` : ''}

HOY ES: ${today}

Cuando el usuario pida un plan completo de nutrición y/o entrenamiento, incluye el plan en JSON entre las etiquetas [PLAN_JSON] y [/PLAN_JSON] con este formato exacto:

[PLAN_JSON]
{
  "nutricion": {
    "desayuno": [{"nombre": "string", "cantidad_g": number, "descripcion": "string"}],
    "almuerzo": [{"nombre": "string", "cantidad_g": number, "descripcion": "string"}],
    "merienda": [{"nombre": "string", "cantidad_g": number, "descripcion": "string"}],
    "cena": [{"nombre": "string", "cantidad_g": number, "descripcion": "string"}],
    "post_entreno": [{"nombre": "string", "cantidad_g": number, "descripcion": "string"}],
    "suplementos": [{"nombre": "string", "cantidad_g": number, "momento": "string", "descripcion": "string"}]
  },
  "entrenamiento": {
    "lunes": {"nombre": "string", "ejercicios": [{"nombre": "string", "series": number, "reps": number, "peso_kg": number}]},
    "martes": {"nombre": "string", "ejercicios": []},
    "miercoles": {"nombre": "string", "ejercicios": []},
    "jueves": {"nombre": "string", "ejercicios": []},
    "viernes": {"nombre": "string", "ejercicios": []},
    "sabado": {"nombre": "string", "ejercicios": []},
    "domingo": {"nombre": "Descanso", "ejercicios": []}
  }
}
[/PLAN_JSON]

Fuera del JSON, explica el plan de forma clara y motivadora.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    })

    const rawContent = response.content[0].text
    let planExtracted = null
    let displayContent = rawContent

    const planMatch = rawContent.match(/\[PLAN_JSON\]([\s\S]*?)\[\/PLAN_JSON\]/)
    if (planMatch) {
      try {
        planExtracted = JSON.parse(planMatch[1].trim())
        displayContent = rawContent.replace(/\[PLAN_JSON\][\s\S]*?\[\/PLAN_JSON\]/, '').trim()
      } catch {
        // keep raw if parse fails
      }
    }

    return res.status(200).json({ content: displayContent, plan: planExtracted })
  } catch (err) {
    console.error('chat error:', err)
    return res.status(500).json({ error: 'Error al conectar con la IA. Intenta de nuevo.' })
  }
}

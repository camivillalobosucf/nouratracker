import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DAYS_ES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

const alimentoItem = {
  type: 'object',
  properties: {
    nombre:      { type: 'string', description: 'Nombre del alimento' },
    cantidad_g:  { type: 'number', description: 'Cantidad numérica en gramos (usa 0 si se mide en ml o unidades)' },
    descripcion: { type: 'string', description: 'Cantidad con su unidad en formato MUY corto: solo el número y la unidad. Ejemplos: "150ml", "40g", "2", "1 taza", "3 unidades", "400ml". NUNCA texto largo ni explicaciones.' }
  },
  required: ['nombre', 'cantidad_g', 'descripcion']
}

const diaEntrenamiento = {
  type: 'object',
  properties: {
    nombre: { type: 'string' },
    ejercicios: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre:  { type: 'string' },
          series:  { type: 'number' },
          reps:    { type: 'number' },
          peso_kg: { type: 'number' }
        },
        required: ['nombre', 'series', 'reps', 'peso_kg']
      }
    }
  },
  required: ['nombre', 'ejercicios']
}

const GUARDAR_PLAN_TOOL = {
  name: 'guardar_plan',
  description: 'Guarda el plan de nutrición y entrenamiento del usuario. Llama esta herramienta SIEMPRE que generes o actualices un plan.',
  input_schema: {
    type: 'object',
    properties: {
      nutricion: {
        type: 'object',
        properties: {
          desayuno:     { type: 'array', items: alimentoItem },
          almuerzo:     { type: 'array', items: alimentoItem },
          merienda:     { type: 'array', items: alimentoItem },
          post_entreno: { type: 'array', items: alimentoItem },
          cena:         { type: 'array', items: alimentoItem },
          suplementos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nombre:      { type: 'string' },
                cantidad_g:  { type: 'number' },
                momento:     { type: 'string' },
                descripcion: { type: 'string' }
              },
              required: ['nombre', 'cantidad_g', 'momento', 'descripcion']
            }
          }
        },
        required: ['desayuno', 'almuerzo', 'cena']
      },
      entrenamiento: {
        type: 'object',
        properties: {
          lunes:     diaEntrenamiento,
          martes:    diaEntrenamiento,
          miercoles: diaEntrenamiento,
          jueves:    diaEntrenamiento,
          viernes:   diaEntrenamiento,
          sabado:    diaEntrenamiento,
          domingo:   diaEntrenamiento
        },
        required: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
      }
    },
    required: ['nutricion', 'entrenamiento']
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, context } = req.body
  if (!messages?.length) return res.status(400).json({ error: 'Faltan mensajes' })

  const { goals, plan, recentWorkouts, todayLogs } = context || {}
  const today = DAYS_ES[new Date().getDay()]

  const systemPrompt = `Eres Noura, asistente personal de nutrición y entrenamiento. Responde siempre en español. Sé concisa, clara y motivadora.

METAS DIARIAS:
- Calorías: ${goals?.kcal_meta || 1720} kcal
- Proteína: ${goals?.proteina_meta || 145}g | Carbs: ${goals?.carbs_meta || 155}g | Grasa: ${goals?.grasa_meta || 58}g

${plan?.nutricion ? `PLAN ACTUAL DE NUTRICIÓN: ${JSON.stringify(plan.nutricion)}` : 'Sin plan de nutrición aún.'}
${plan?.entrenamiento ? `PLAN ACTUAL DE ENTRENAMIENTO: ${JSON.stringify(plan.entrenamiento)}` : 'Sin plan de entrenamiento aún.'}
${todayLogs?.length ? `HOY COMIÓ: ${todayLogs.map(l => `${l.descripcion_original} (${l.totales?.calorias} kcal)`).join(' | ')}` : ''}
${recentWorkouts?.length ? `ENTRENOS RECIENTES: ${recentWorkouts.slice(0, 3).map(w => `${w.fecha}: ${(w.ejercicios || []).map(e => e.nombre).join(', ')}`).join(' | ')}` : ''}

HOY ES: ${today}

INSTRUCCIÓN CRÍTICA: Cuando el usuario pida un plan de alimentación o entrenamiento, DEBES llamar la herramienta guardar_plan con todos los datos. Nunca escribas JSON en tu respuesta de texto. En tu texto explica el plan con lenguaje natural y motivador.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      tools: [GUARDAR_PLAN_TOOL],
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    })

    const textBlock  = response.content.find(b => b.type === 'text')
    const toolBlock  = response.content.find(b => b.type === 'tool_use' && b.name === 'guardar_plan')
    const planExtracted = toolBlock?.input || null

    // If only tool use (no text), get a follow-up text response
    if (toolBlock && !textBlock) {
      const followUp = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        tools: [GUARDAR_PLAN_TOOL],
        messages: [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'assistant', content: response.content },
          {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: 'Plan guardado.' }]
          }
        ]
      })
      const followText = followUp.content.find(b => b.type === 'text')
      return res.status(200).json({
        content: followText?.text || '¡Tu plan fue guardado! Ya puedes verlo en los tabs de Comida y Entreno.',
        plan: planExtracted
      })
    }

    return res.status(200).json({
      content: textBlock?.text || '✓ Listo.',
      plan: planExtracted
    })
  } catch (err) {
    console.error('chat error:', err)
    return res.status(500).json({ error: 'Error al conectar con la IA. Intenta de nuevo.' })
  }
}

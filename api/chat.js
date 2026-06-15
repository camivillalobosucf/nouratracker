import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DAYS_ES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

const GUARDAR_PLAN_TOOL = {
  name: 'guardar_plan',
  description: 'Guarda el plan de nutrición y entrenamiento del usuario. Llama esta herramienta SIEMPRE que generes o actualices un plan completo.',
  input_schema: {
    type: 'object',
    properties: {
      nutricion: {
        type: 'object',
        description: 'Plan de nutrición diario',
        properties: {
          desayuno:    { type: 'array', items: { $ref: '#/$defs/alimento' } },
          almuerzo:    { type: 'array', items: { $ref: '#/$defs/alimento' } },
          merienda:    { type: 'array', items: { $ref: '#/$defs/alimento' } },
          post_entreno:{ type: 'array', items: { $ref: '#/$defs/alimento' } },
          cena:        { type: 'array', items: { $ref: '#/$defs/alimento' } },
          suplementos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nombre:     { type: 'string' },
                cantidad_g: { type: 'number' },
                momento:    { type: 'string' },
                descripcion:{ type: 'string' }
              },
              required: ['nombre', 'cantidad_g', 'momento']
            }
          }
        },
        '$defs': {
          alimento: {
            type: 'object',
            properties: {
              nombre:     { type: 'string' },
              cantidad_g: { type: 'number' },
              descripcion:{ type: 'string' }
            },
            required: ['nombre', 'cantidad_g']
          }
        }
      },
      entrenamiento: {
        type: 'object',
        description: 'Plan de entrenamiento por día de la semana',
        properties: {
          lunes:    { $ref: '#/$defs/dia' },
          martes:   { $ref: '#/$defs/dia' },
          miercoles:{ $ref: '#/$defs/dia' },
          jueves:   { $ref: '#/$defs/dia' },
          viernes:  { $ref: '#/$defs/dia' },
          sabado:   { $ref: '#/$defs/dia' },
          domingo:  { $ref: '#/$defs/dia' }
        },
        '$defs': {
          dia: {
            type: 'object',
            properties: {
              nombre:    { type: 'string' },
              ejercicios: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    nombre:   { type: 'string' },
                    series:   { type: 'number' },
                    reps:     { type: 'number' },
                    peso_kg:  { type: 'number' }
                  },
                  required: ['nombre', 'series', 'reps', 'peso_kg']
                }
              }
            },
            required: ['nombre', 'ejercicios']
          }
        }
      }
    },
    required: ['nutricion', 'entrenamiento']
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, context } = req.body
  if (!messages?.length) return res.status(400).json({ error: 'Faltan mensajes' })

  const { goals, plan, recentNutrition, recentWorkouts, todayLogs } = context || {}
  const today = DAYS_ES[new Date().getDay()]

  const systemPrompt = `Eres Noura, asistente personal de nutrición y entrenamiento. Responde siempre en español. Sé concisa, clara y motivadora.

METAS DIARIAS:
- Calorías: ${goals?.kcal_meta || 1720} kcal
- Proteína: ${goals?.proteina_meta || 145}g | Carbs: ${goals?.carbs_meta || 155}g | Grasa: ${goals?.grasa_meta || 58}g

${plan?.nutricion ? `PLAN ACTUAL DE NUTRICIÓN: ${JSON.stringify(plan.nutricion)}` : 'Sin plan de nutrición aún.'}
${plan?.entrenamiento ? `PLAN ACTUAL DE ENTRENAMIENTO: ${JSON.stringify(plan.entrenamiento)}` : 'Sin plan de entrenamiento aún.'}

${todayLogs?.length ? `HOY COMIÓ: ${todayLogs.map(l => `${l.descripcion_original} (${l.totales?.calorias} kcal, ${l.totales?.proteina_g}g prot)`).join(' | ')}` : ''}
${recentWorkouts?.length ? `ENTRENOS RECIENTES: ${recentWorkouts.slice(0,3).map(w => `${w.fecha}: ${(w.ejercicios||[]).map(e=>e.nombre).join(', ')}`).join(' | ')}` : ''}

HOY ES: ${today}

REGLA IMPORTANTE: Cuando el usuario pida un plan (de comida, entrenamiento, o ambos), SIEMPRE llama la herramienta guardar_plan con el plan completo. No escribas el JSON en el texto — úsalo como herramienta. En tu texto de respuesta, explica el plan con lenguaje natural, motivador y claro.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      tools: [GUARDAR_PLAN_TOOL],
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    })

    // Extract text content
    const textBlock = response.content.find(b => b.type === 'text')
    const toolBlock = response.content.find(b => b.type === 'tool_use' && b.name === 'guardar_plan')

    const displayContent = textBlock?.text || '✓ Plan guardado.'
    const planExtracted = toolBlock?.input || null

    // If Claude called the tool, we need to complete the conversation turn
    // and get the final text response
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
            content: [{
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: 'Plan guardado correctamente.'
            }]
          }
        ]
      })
      const followText = followUp.content.find(b => b.type === 'text')
      return res.status(200).json({
        content: followText?.text || '✓ Tu plan fue guardado. Ya puedes verlo en los tabs de Comida y Entreno.',
        plan: planExtracted
      })
    }

    return res.status(200).json({ content: displayContent, plan: planExtracted })
  } catch (err) {
    console.error('chat error:', err)
    return res.status(500).json({ error: 'Error al conectar con la IA. Intenta de nuevo.' })
  }
}

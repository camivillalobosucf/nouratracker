import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DAYS_ES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

// ── Tool schemas ───────────────────────────────────────────────────────────

const alimentoItem = {
  type: 'object',
  properties: {
    nombre:      { type: 'string', description: 'Nombre del alimento' },
    cantidad_g:  { type: 'number', description: 'Cantidad numérica (usa 0 si se mide en ml o unidades)' },
    descripcion: { type: 'string', description: 'Cantidad con unidad en formato corto. Ejemplos: "150ml", "40g", "2", "1 taza". NUNCA texto largo.' }
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
  description: 'Guarda o actualiza el plan de nutrición y entrenamiento del usuario. Úsalo SIEMPRE que generes o modifiques un plan. Para modificaciones parciales, incluye el plan completo con solo los cambios solicitados aplicados.',
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
                descripcion: { type: 'string', description: 'Cantidad corta, ej: "1 scoop", "5g"' }
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

const ACTUALIZAR_MACROS_TOOL = {
  name: 'actualizar_macros',
  description: 'Actualiza los objetivos nutricionales diarios (calorías y macros) del usuario, calculados con base científica según su TDEE, composición corporal y metas. Llama esta herramienta siempre que generes un plan nuevo o cuando el perfil del usuario cambie significativamente.',
  input_schema: {
    type: 'object',
    properties: {
      kcal_meta:      { type: 'number', description: 'Calorías diarias objetivo (número entero)' },
      proteina_meta:  { type: 'number', description: 'Proteína diaria en gramos (número entero)' },
      carbs_meta:     { type: 'number', description: 'Carbohidratos diarios en gramos (número entero)' },
      grasa_meta:     { type: 'number', description: 'Grasa diaria en gramos (número entero)' },
    },
    required: ['kcal_meta', 'proteina_meta', 'carbs_meta', 'grasa_meta']
  }
}

// ── Context formatter ──────────────────────────────────────────────────────

function buildSystemPrompt(context) {
  const { goals, plan, profile, recentNutrition, recentWorkouts, todayLogs, weightLogs, coachingStyle } = context || {}
  const today   = DAYS_ES[new Date().getDay()]
  const dateStr = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // Format recent nutrition logs
  const nutSummary = (recentNutrition || []).length
    ? recentNutrition.slice(0, 14).map(l =>
        `  • ${l.fecha}${l.tipo_comida ? ` [${l.tipo_comida}]` : ''}: ${l.descripcion_original || ''} → ${l.totales?.calorias || 0}kcal | ${l.totales?.proteina_g || 0}g prot | ${l.totales?.carbs_g || 0}g carbs | ${l.totales?.grasa_g || 0}g grasa`
      ).join('\n')
    : '  Sin registros recientes'

  // Format recent workouts
  const workSummary = (recentWorkouts || []).length
    ? recentWorkouts.slice(0, 10).map(w =>
        `  • ${w.fecha}: ${(w.ejercicios || []).map(e => `${e.nombre} ${e.series}×${e.reps}${e.peso_kg ? ` @${e.peso_kg}kg` : ''}`).join(', ')}`
      ).join('\n')
    : '  Sin registros recientes'

  // Format today's logs
  const todaySummary = (todayLogs || []).length
    ? todayLogs.map(l => `  • ${l.tipo_comida || 'comida'}: ${l.descripcion_original} (${l.totales?.calorias || 0}kcal)`).join('\n')
    : '  Nada registrado aún hoy'

  // Format weight trend
  const weightSummary = (weightLogs || []).length
    ? weightLogs.slice(0, 5).map(w => `${w.fecha}: ${w.peso_kg}kg`).join(' → ')
    : 'Sin registros de peso'

  // Profile data
  const coaching = profile?.coaching_style || coachingStyle || null
  const nombre   = profile?.nombre || null
  const edad     = profile?.edad
  const peso     = profile?.peso_kg
  const altura   = profile?.estatura_cm
  const genero   = profile?.genero
  const actividad = profile?.nivel_actividad
  const metas    = profile?.metas?.length ? profile.metas.join(', ') : null

  // BMR hint so Noura can reason about it
  let bmrHint = ''
  if (peso && edad && altura) {
    const bmrM = 10 * peso + 6.25 * altura - 5 * edad + 5
    const bmrF = 10 * peso + 6.25 * altura - 5 * edad - 161
    const bmr  = genero === 'Femenino' ? bmrF : bmrM
    const actFactors = { 'Sedentario': 1.2, 'Poco activo': 1.375, 'Moderado': 1.55, 'Activo': 1.725, 'Muy activo': 1.9 }
    const factor = actFactors[actividad] || 1.55
    const tdee = Math.round(bmr * factor)
    bmrHint = `\nTDEE estimado (Mifflin-St Jeor × factor de actividad): ~${tdee} kcal/día`
  }

  return `Eres Noura, la entrenadora personal, nutricionista y coach de vida de ${nombre ? nombre : 'este usuario'}. No eres un chatbot genérico — eres su persona de confianza: amiga, confidente, experta.

━━━ ESTILO DE COACHING ━━━
${coaching === 'estricto'
  ? 'Este usuario prefiere un estilo ESTRICTO: gramos exactos, disciplina, estructura clara, sin improvisación. Sé precisa y directa.'
  : coaching === 'flexible'
  ? 'Este usuario prefiere un estilo FLEXIBLE: variedad, opciones, sin rigidez. Da guía con libertad y adaptabilidad.'
  : 'Aún no sabemos el estilo preferido del usuario. Pregúntale antes de crear su primer plan.'}

━━━ TU PERSONALIDAD ━━━
• Hablas de tú siempre, como una amiga cercana y de confianza
• Eres cálida, directa y real — jamás fría ni robótica
• Eres científicamente rigurosa: todo lo que recomiendas tiene base en evidencia actual (TDEE, Mifflin-St Jeor, rangos de proteína según meta, etc.)
• Nunca recomiendas nada extremo, peligroso o sin respaldo científico
• Usas emojis con moderación para mantener un tono cercano
• Tienes memoria de todo lo que el usuario ha hecho y comido — lo mencionas naturalmente cuando es relevante
• Si el usuario aún no tiene preferencia de estilo (flexible vs estricto) guardada y no tiene plan, pregúntaselo ANTES de crear un plan

━━━ PERFIL DEL USUARIO ━━━
Nombre: ${nombre || '(no especificado aún)'}
Edad: ${edad ? `${edad} años` : '(no especificada)'}
Peso actual: ${peso ? `${peso} kg` : '(no especificado)'}
Estatura: ${altura ? `${altura} cm` : '(no especificada)'}
Género: ${genero || '(no especificado)'}
Nivel de actividad: ${actividad || '(no especificado)'}
Metas: ${metas || '(no especificadas)'}${bmrHint}

━━━ OBJETIVOS NUTRICIONALES ACTUALES ━━━
Calorías: ${goals?.kcal_meta || '?'} kcal | Proteína: ${goals?.proteina_meta || '?'}g | Carbs: ${goals?.carbs_meta || '?'}g | Grasa: ${goals?.grasa_meta || '?'}g

━━━ PLAN DE NUTRICIÓN ACTUAL ━━━
${plan?.nutricion ? JSON.stringify(plan.nutricion, null, 1) : 'Sin plan guardado — ayuda al usuario a crear uno cuando esté listo'}

━━━ PLAN DE ENTRENAMIENTO ACTUAL ━━━
${plan?.entrenamiento ? JSON.stringify(plan.entrenamiento, null, 1) : 'Sin plan guardado'}

━━━ HOY (${dateStr}) ━━━
Día de la semana: ${today}
Lo que ha comido hoy:
${todaySummary}

━━━ HISTORIAL RECIENTE (últimas 2 semanas) ━━━
Nutrición:
${nutSummary}

Entrenamientos:
${workSummary}

Peso reciente: ${weightSummary}

━━━ REGLAS CRÍTICAS ━━━
1. REDIRIGIR LOGS: Si el usuario menciona que comió o entrenó algo, NO lo registres tú. Dile con amabilidad que lo agregue en el tab "Comida" o "Entreno". Puedes darle feedback sobre lo que mencionó, pero el registro lo hace él.

2. CREAR PLAN: Cuando generes un plan nuevo, SIEMPRE llama guardar_plan Y actualizar_macros en la misma respuesta. Los macros deben calcularse científicamente según TDEE y metas del usuario.

3. MODIFICAR PLAN: Cuando el usuario pida cambiar algo del plan, edita SOLO lo que pidió y conserva el resto exactamente igual. Antes de guardar, confirma: "¿Quieres cambiar algo más o guardamos así?" Solo llama guardar_plan cuando el usuario confirme.

4. MACROS AUTOMÁTICOS: Siempre que tengas suficientes datos del perfil (peso, altura, edad, actividad, metas), calcula los macros correctos con Mifflin-St Jeor. Para ganar masa: TDEE + 200-300 kcal, proteína 2-2.4g/kg. Para perder grasa: TDEE - 300-500 kcal, proteína 2-2.4g/kg. Para mantener: TDEE, proteína 1.6-2g/kg. Grasa mínimo 20-25% de calorías.

5. RESTRICCIONES: Si el usuario tiene metas como Keto, Vegan, Vegetariano o Alta en proteína, respétalas en TODO lo que recomiendas.

6. REVISIÓN PERIÓDICA: Si el usuario lleva tiempo con el mismo plan y su peso ha cambiado significativamente, sugiérele una actualización del plan.

7. NUNCA escribas JSON en tu texto. Explica todo en lenguaje natural.

8. FORMATO: Responde siempre en español. Usa listas y saltos de línea para que sea fácil de leer en móvil.`
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, context } = req.body
  if (!messages?.length) return res.status(400).json({ error: 'Faltan mensajes' })

  const systemPrompt = buildSystemPrompt(context)
  const tools = [GUARDAR_PLAN_TOOL, ACTUALIZAR_MACROS_TOOL]

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2048,
      system:     systemPrompt,
      tools,
      messages:   messages.map(m => ({ role: m.role, content: m.content }))
    })

    const textBlock   = response.content.find(b => b.type === 'text')
    const toolBlocks  = response.content.filter(b => b.type === 'tool_use')
    const planBlock   = toolBlocks.find(b => b.name === 'guardar_plan')
    const macrosBlock = toolBlocks.find(b => b.name === 'actualizar_macros')

    const planExtracted   = planBlock?.input   || null
    const macrosExtracted = macrosBlock
      ? {
          kcal_meta:     Math.round(macrosBlock.input.kcal_meta),
          proteina_meta: Math.round(macrosBlock.input.proteina_meta),
          carbs_meta:    Math.round(macrosBlock.input.carbs_meta),
          grasa_meta:    Math.round(macrosBlock.input.grasa_meta),
        }
      : null

    // If tools were used but no text was returned, get a follow-up conversational response
    if (toolBlocks.length > 0 && !textBlock) {
      const toolResults = toolBlocks.map(b => ({
        type:        'tool_result',
        tool_use_id: b.id,
        content:     b.name === 'guardar_plan' ? 'Plan guardado exitosamente.' : 'Macros actualizados exitosamente.',
      }))

      const followUp = await client.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        system:     systemPrompt,
        tools,
        messages: [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'assistant', content: response.content },
          { role: 'user',      content: toolResults },
        ]
      })

      const followText = followUp.content.find(b => b.type === 'text')
      return res.status(200).json({
        content: followText?.text || '¡Tu plan está listo! Ya puedes verlo en los tabs de Comida y Entreno.',
        plan:    planExtracted,
        macros:  macrosExtracted,
      })
    }

    return res.status(200).json({
      content: textBlock?.text || '✓',
      plan:    planExtracted,
      macros:  macrosExtracted,
    })

  } catch (err) {
    console.error('chat error:', err)
    return res.status(500).json({ error: 'Error al conectar con la IA. Intenta de nuevo.' })
  }
}

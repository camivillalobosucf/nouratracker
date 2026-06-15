import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text } = req.body
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Falta la descripción del entreno' })
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Analiza esta descripción de entrenamiento y devuelve SOLO un JSON válido (sin texto adicional, sin markdown, sin explicaciones).

Descripción: "${text.trim()}"

Formato exacto requerido:
{
  "ejercicios": [
    {
      "nombre": "nombre del ejercicio",
      "peso_kg": número (0 si es peso corporal),
      "series": número,
      "reps": número,
      "volumen_kg": número (peso_kg × series × reps)
    }
  ]
}

Si el ejercicio es con peso corporal (flexiones, dominadas, etc.), usa peso_kg: 0 y calcula volumen_kg como 0.`
        }
      ]
    })

    const raw = message.content[0].text.trim()
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(jsonStr)

    return res.status(200).json(parsed)
  } catch (err) {
    console.error('parse-workout error:', err)
    return res.status(500).json({ error: 'Error al analizar el entreno. Intenta de nuevo.' })
  }
}

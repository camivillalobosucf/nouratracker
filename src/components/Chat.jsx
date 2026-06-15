import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const today = () => new Date().toISOString().split('T')[0]

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className="max-w-[85%] px-4 py-3 text-sm"
        style={{
          background: isUser ? '#C4714A' : '#EFEBE3',
          color: isUser ? '#fff' : '#1C1C1A',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap'
        }}
      >
        {msg.content}
      </div>
    </div>
  )
}

export default function Chat({ session }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [planSaved, setPlanSaved] = useState(false)
  const [context, setContext] = useState({})
  const bottomRef = useRef(null)

  useEffect(() => {
    const uid = session.user.id
    const from = new Date()
    from.setDate(from.getDate() - 7)
    const fromStr = from.toISOString().split('T')[0]

    Promise.all([
      supabase.from('user_goals').select('*').eq('user_id', uid).single(),
      supabase.from('user_plan').select('*').eq('user_id', uid).single(),
      supabase.from('nutrition_logs').select('fecha, descripcion_original, totales').eq('user_id', uid).gte('fecha', fromStr).order('fecha', { ascending: false }),
      supabase.from('workout_logs').select('fecha, ejercicios').eq('user_id', uid).gte('fecha', fromStr).order('fecha', { ascending: false }),
      supabase.from('nutrition_logs').select('descripcion_original, totales').eq('user_id', uid).eq('fecha', today()),
      supabase.from('chat_messages').select('role, content').eq('user_id', uid).order('created_at').limit(40),
    ]).then(([goalsRes, planRes, nutRes, workRes, todayRes, chatRes]) => {
      setContext({
        goals: goalsRes.data,
        plan: planRes.data,
        recentNutrition: nutRes.data || [],
        recentWorkouts: workRes.data || [],
        todayLogs: todayRes.data || [],
      })
      if (chatRes.data?.length) {
        setMessages(chatRes.data)
      } else {
        setMessages([{
          role: 'assistant',
          content: '¡Hola! Soy Noura, tu asistente de nutrición y entrenamiento. 💪\n\nPuedo ayudarte a crear un plan personalizado con los alimentos exactos (en gramos), horarios y suplementos. ¿Cuáles son tus metas y qué alimentos te gustan?'
        }])
      }
    })
  }, [session])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages.filter(m => m.role), userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setPlanSaved(false)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, context })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const assistantMsg = { role: 'assistant', content: data.content }
      setMessages(prev => [...prev, assistantMsg])

      const uid = session.user.id

      // Save messages to Supabase
      await supabase.from('chat_messages').insert([
        { user_id: uid, role: 'user', content: text },
        { user_id: uid, role: 'assistant', content: data.content }
      ])

      // Save plan if Claude generated one
      if (data.plan) {
        const { data: existing } = await supabase.from('user_plan').select('id').eq('user_id', uid).single()
        if (existing) {
          await supabase.from('user_plan').update({
            nutricion: data.plan.nutricion,
            entrenamiento: data.plan.entrenamiento,
            updated_at: new Date().toISOString()
          }).eq('id', existing.id)
        } else {
          await supabase.from('user_plan').insert({
            user_id: uid,
            nutricion: data.plan.nutricion,
            entrenamiento: data.plan.entrenamiento,
          })
        }
        setContext(prev => ({ ...prev, plan: data.plan }))
        setPlanSaved(true)
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al conectar. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const clearChat = async () => {
    await supabase.from('chat_messages').delete().eq('user_id', session.user.id)
    setMessages([{
      role: 'assistant',
      content: '¡Hola! Soy Noura. ¿En qué te puedo ayudar hoy?'
    }])
  }

  return (
    <div className="flex flex-col h-dvh">
      {/* Header */}
      <div className="px-4 pt-8 pb-3 flex justify-between items-center">
        <h1 className="text-3xl" style={{ fontFamily: "'DM Serif Display', serif", color: '#1C1C1A' }}>
          Chat
        </h1>
        <button onClick={clearChat} className="text-xs" style={{ color: '#bbb' }}>
          Limpiar
        </button>
      </div>

      {planSaved && (
        <div className="mx-4 mb-2 px-3 py-2 text-sm" style={{ background: '#e8f0e9', color: '#7A9E7E', borderRadius: 8 }}>
          ✓ Plan guardado — ya aparece en Comida y Entreno
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {loading && (
          <div className="flex justify-start mb-3">
            <div className="px-4 py-3 text-sm" style={{ background: '#EFEBE3', borderRadius: '16px 16px 16px 4px', color: '#aaa' }}>
              <span className="animate-pulse">Noura está escribiendo...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="px-4 py-3 border-t flex gap-2 items-end"
        style={{
          background: '#F7F4EE',
          borderColor: '#DDD8CE',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)'
        }}
      >
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribe aquí... (Enter para enviar)"
          rows={2}
          className="flex-1 px-3 py-2 text-sm outline-none border resize-none"
          style={{
            background: '#EFEBE3',
            borderColor: '#DDD8CE',
            color: '#1C1C1A',
            borderRadius: 10,
            lineHeight: 1.5
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="shrink-0 w-10 h-10 flex items-center justify-center"
          style={{
            background: loading || !input.trim() ? '#d89a80' : '#C4714A',
            borderRadius: 10
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}

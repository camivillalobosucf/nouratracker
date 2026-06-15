import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
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
          lineHeight: 1.6,
          wordBreak: 'break-word',
        }}
      >
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p style={{ margin: '0 0 6px' }}>{children}</p>,
              strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
              ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 16 }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: 16 }}>{children}</ol>,
              li: ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>,
              h3: ({ children }) => <p style={{ fontWeight: 600, margin: '6px 0 2px' }}>{children}</p>,
              h2: ({ children }) => <p style={{ fontWeight: 600, margin: '6px 0 2px' }}>{children}</p>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}
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
  const [initialized, setInitialized] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (initialized) return
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
      supabase.from('chat_messages').select('role, content').eq('user_id', uid).order('created_at').limit(60),
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
          content: '¡Hola! Soy Noura, tu asistente de nutrición y entrenamiento.\n\nPuedo crearte un plan personalizado con los alimentos exactos (en gramos), horarios y suplementos. Cuéntame:\n\n• ¿Cuáles son tus metas?\n• ¿Qué alimentos te gustan o no te gustan?\n• ¿Cuántos días a la semana entrenas?'
        }])
      }
      setInitialized(true)
    })
  }, [session, initialized])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-grow textarea
  const handleInputChange = (e) => {
    setInput(e.target.value)
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
    }
  }

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setPlanSaved(false)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    setLoading(true)

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
      await supabase.from('chat_messages').insert([
        { user_id: uid, role: 'user', content: text },
        { user_id: uid, role: 'assistant', content: data.content }
      ])

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
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al conectar. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, context, session])

  const clearChat = async () => {
    await supabase.from('chat_messages').delete().eq('user_id', session.user.id)
    setMessages([{
      role: 'assistant',
      content: '¡Hola! Soy Noura. ¿En qué te puedo ayudar hoy?'
    }])
  }

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <div
        className="px-4 pt-10 pb-3 flex justify-between items-center shrink-0"
        style={{ background: '#F7F4EE' }}
      >
        <h1 className="text-3xl" style={{ fontFamily: "'DM Serif Display', serif", color: '#1C1C1A' }}>
          Chat
        </h1>
        <button onClick={clearChat} className="text-xs py-1 px-2" style={{ color: '#bbb' }}>
          Limpiar
        </button>
      </div>

      {planSaved && (
        <div
          className="mx-4 mb-1 px-3 py-2 text-sm shrink-0"
          style={{ background: '#e8f0e9', color: '#7A9E7E', borderRadius: 8 }}
        >
          ✓ Plan guardado — ya aparece en Comida y Entreno
        </div>
      )}

      {/* Messages — scrollable area */}
      <div className="flex-1 overflow-y-auto px-4 pt-2" style={{ overscrollBehavior: 'contain' }}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {loading && (
          <div className="flex justify-start mb-3">
            <div
              className="px-4 py-3 text-sm"
              style={{ background: '#EFEBE3', borderRadius: '16px 16px 16px 4px', color: '#aaa' }}
            >
              <span className="animate-pulse">Noura está escribiendo...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Input bar — fixed at bottom above BottomNav */}
      <div
        className="shrink-0 px-3 py-2 border-t flex gap-2 items-end"
        style={{
          background: '#F7F4EE',
          borderColor: '#DDD8CE',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)',
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          placeholder="Escribe un mensaje..."
          rows={1}
          className="flex-1 px-3 py-2.5 outline-none border resize-none"
          style={{
            background: '#EFEBE3',
            borderColor: '#DDD8CE',
            color: '#1C1C1A',
            borderRadius: 12,
            fontSize: 16,        // prevents iOS auto-zoom
            lineHeight: 1.5,
            maxHeight: 120,
            overflowY: 'auto',
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="shrink-0 w-11 h-11 flex items-center justify-center"
          style={{
            background: loading || !input.trim() ? '#d89a80' : '#C4714A',
            borderRadius: 12,
            transition: 'background 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
// Note: send is assigned to sendRef.current each render (no useCallback) to avoid
// a Rolldown TDZ bug where the [send] dependency array is evaluated before send is initialized.
import ReactMarkdown from 'react-markdown'
import { supabase } from '../lib/supabase'

const todayDate = () => new Date().toISOString().split('T')[0]

const GREETING = '¡Hola! Soy Noura, tu asistente de nutrición y entrenamiento.\n\nPuedo crearte un plan personalizado con los alimentos exactos (en gramos), horarios y suplementos. Cuéntame:\n\n• ¿Cuáles son tus metas?\n• ¿Qué alimentos te gustan o no te gustan?\n• ¿Cuántos días a la semana entrenas?'

function formatDate(iso) {
  const d   = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7)   return d.toLocaleDateString('es', { weekday: 'short' })
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

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
              p:      ({ children }) => <p style={{ margin: '0 0 6px' }}>{children}</p>,
              strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
              ul:     ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 16 }}>{children}</ul>,
              ol:     ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: 16 }}>{children}</ol>,
              li:     ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>,
              h3:     ({ children }) => <p style={{ fontWeight: 600, margin: '6px 0 2px' }}>{children}</p>,
              h2:     ({ children }) => <p style={{ fontWeight: 600, margin: '6px 0 2px' }}>{children}</p>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  )
}

export default function Chat({ session, isActive }) {
  const [view, setView]                   = useState('list')
  const [sessions, setSessions]           = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [activeChatId, setActiveChatId]   = useState(null)
  const [activeChatTitle, setActiveChatTitle] = useState('')
  const [messages, setMessages]           = useState([])
  const [input, setInput]                 = useState('')
  const [loading, setLoading]             = useState(false)
  const [planSaved, setPlanSaved]         = useState(false)
  const [context, setContext]             = useState({})
  const [newUserPending, setNewUserPending] = useState(false)
  const bottomRef  = useRef(null)
  const textareaRef = useRef(null)
  const sendRef    = useRef(null)

  // Load context (full profile + logs) once per mount
  useEffect(() => {
    if (!session) return
    const uid  = session.user.id
    const from = new Date()
    from.setDate(from.getDate() - 14)   // 2 weeks of history
    const fromStr = from.toISOString().split('T')[0]
    Promise.all([
      supabase.from('user_goals').select('*').eq('user_id', uid).single(),
      supabase.from('user_plan').select('*').eq('user_id', uid).single(),
      supabase.from('nutrition_logs').select('fecha, tipo_comida, descripcion_original, totales').eq('user_id', uid).gte('fecha', fromStr).order('fecha', { ascending: false }),
      supabase.from('workout_logs').select('fecha, ejercicios').eq('user_id', uid).gte('fecha', fromStr).order('fecha', { ascending: false }),
      supabase.from('nutrition_logs').select('tipo_comida, descripcion_original, totales').eq('user_id', uid).eq('fecha', todayDate()),
      supabase.from('user_profile').select('*').eq('user_id', uid).single(),
      supabase.from('weight_logs').select('fecha, peso_kg').eq('user_id', uid).order('fecha', { ascending: false }).limit(10),
    ]).then(([goalsRes, planRes, nutRes, workRes, todayRes, profileRes, weightRes]) => {
      setContext({
        goals:           goalsRes.data,
        plan:            planRes.data,
        recentNutrition: nutRes.data    || [],
        recentWorkouts:  workRes.data   || [],
        todayLogs:       todayRes.data  || [],
        profile:         profileRes.data,
        weightLogs:      weightRes.data || [],
      })
    })
  }, [session])

  // Load sessions list
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true)
    const { data } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    setSessions(data || [])
    setSessionsLoading(false)
  }, [session])

  useEffect(() => { loadSessions() }, [loadSessions])
  useEffect(() => { if (isActive && view === 'list') loadSessions() }, [isActive]) // eslint-disable-line

  // Detect new user flag on tab activation
  useEffect(() => {
    if (!isActive) return
    if (localStorage.getItem('noura_new_user') !== '1') return
    localStorage.removeItem('noura_new_user')
    setView('chat')
    setActiveChatId(null)
    setActiveChatTitle('Plan inicial')
    setMessages([{ role: 'assistant', content: GREETING }])
    setPlanSaved(false)
    setNewUserPending(true)
  }, [isActive]) // eslint-disable-line

  // Fire auto-trigger once context (profile) has loaded
  useEffect(() => {
    if (!newUserPending || !context.profile) return
    setNewUserPending(false)
    setTimeout(() => {
      sendRef.current?.(
        'Hola Noura! Acabo de registrarme y completar mi perfil. Por favor, crea mi plan personalizado de nutrición y entrenamiento basado en toda mi información.'
      )
    }, 400)
  }, [newUserPending, context.profile])

  // Auto-scroll when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Actions ──────────────────────────────────────────────────────────────

  const openSession = async (sess) => {
    setActiveChatId(sess.id)
    setActiveChatTitle(sess.title || 'Conversación')
    setPlanSaved(false)
    const { data } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', session.user.id)
      .eq('chat_id', sess.id)
      .order('created_at')
    setMessages(data || [])
    setView('chat')
  }

  const startNewChat = () => {
    setActiveChatId(null)
    setActiveChatTitle('Nueva conversación')
    setMessages([{ role: 'assistant', content: GREETING }])
    setPlanSaved(false)
    setInput('')
    setView('chat')
  }

  const goBack = () => {
    setView('list')
    setActiveChatId(null)
    setMessages([])
    setInput('')
    loadSessions()
  }

  const handleInputChange = (e) => {
    setInput(e.target.value)
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
    }
  }

  // Assigned each render so sendRef.current always closes over current state.
  // Using a ref instead of useCallback avoids a Rolldown TDZ in the [send] dep array.
  sendRef.current = async (textOverride) => {
    const text = (textOverride ?? input).trim()
    if (!text || loading) return

    const userMsg     = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    if (!textOverride) setInput('')
    setPlanSaved(false)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    try {
      let chatId = activeChatId
      if (!chatId) {
        const title = text.length > 45 ? text.slice(0, 42) + '…' : text
        const { data: newSession } = await supabase
          .from('chat_sessions')
          .insert({ user_id: session.user.id, title })
          .select('id')
          .single()
        if (!newSession) throw new Error('No se pudo crear la conversación')
        chatId = newSession.id
        setActiveChatId(chatId)
        setActiveChatTitle(title)
      }

      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: newMessages, context }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const assistantMsg = { role: 'assistant', content: data.content }
      setMessages(prev => [...prev, assistantMsg])

      await supabase.from('chat_messages').insert([
        { user_id: session.user.id, chat_id: chatId, role: 'user',      content: text },
        { user_id: session.user.id, chat_id: chatId, role: 'assistant', content: data.content },
      ])

      const uid = session.user.id

      if (data.plan) {
        const { data: existing } = await supabase.from('user_plan').select('id').eq('user_id', uid).single()
        if (existing) {
          await supabase.from('user_plan').update({
            nutricion:     data.plan.nutricion,
            entrenamiento: data.plan.entrenamiento,
            updated_at:    new Date().toISOString(),
          }).eq('id', existing.id)
        } else {
          await supabase.from('user_plan').insert({
            user_id:       uid,
            nutricion:     data.plan.nutricion,
            entrenamiento: data.plan.entrenamiento,
          })
        }
        setContext(prev => ({ ...prev, plan: data.plan }))
        setPlanSaved(true)
      }

      if (data.macros) {
        const { data: existingGoals } = await supabase.from('user_goals').select('id').eq('user_id', uid).single()
        const macroPayload = { ...data.macros, updated_at: new Date().toISOString() }
        if (existingGoals) {
          await supabase.from('user_goals').update(macroPayload).eq('id', existingGoals.id)
        } else {
          await supabase.from('user_goals').insert({ user_id: uid, ...macroPayload })
        }
        setContext(prev => ({ ...prev, goals: { ...prev.goals, ...data.macros } }))
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al conectar. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  // ── List view ─────────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="flex flex-col" style={{ height: '100dvh', background: '#F7F4EE' }}>
        {/* Header */}
        <div className="px-4 pt-10 pb-4 shrink-0" style={{ background: '#F7F4EE' }}>
          <h1 className="text-3xl mb-4" style={{ fontFamily: "'DM Serif Display', serif", color: '#1C1C1A' }}>
            Chat
          </h1>
          <button
            onClick={startNewChat}
            className="w-full py-3 font-medium text-white"
            style={{ background: '#C4714A', borderRadius: 10 }}
          >
            + Nuevo chat
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-24">
          {sessionsLoading ? (
            <p className="text-sm text-center mt-8" style={{ color: '#bbb' }}>Cargando...</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-center mt-8" style={{ color: '#bbb' }}>
              No hay conversaciones aún
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => openSession(s)}
                  className="w-full text-left px-4 py-3.5"
                  style={{ background: '#EFEBE3', borderRadius: 12 }}
                >
                  <div className="flex justify-between items-center gap-3">
                    <span
                      className="text-sm font-medium"
                      style={{ color: '#1C1C1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {s.title || 'Conversación'}
                    </span>
                    <span className="text-xs shrink-0" style={{ color: '#bbb' }}>
                      {formatDate(s.created_at)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Chat view ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#F7F4EE' }}>
      {/* Header */}
      <div
        className="px-4 pt-10 pb-3 flex items-center gap-3 shrink-0"
        style={{ background: '#F7F4EE', borderBottom: '1px solid #DDD8CE' }}
      >
        <button
          onClick={goBack}
          style={{ color: '#C4714A', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          ← Chats
        </button>
        <span
          className="text-sm flex-1 truncate"
          style={{ color: '#888' }}
        >
          {activeChatTitle}
        </span>
      </div>

      {planSaved && (
        <div
          className="mx-4 mt-2 px-3 py-2 text-sm shrink-0"
          style={{ background: '#e8f0e9', color: '#7A9E7E', borderRadius: 8 }}
        >
          ✓ Plan guardado — ya aparece en Comida y Entreno
        </div>
      )}

      {/* Messages */}
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

      {/* Input bar */}
      <div
        className="shrink-0 px-3 py-2 border-t flex gap-2 items-end"
        style={{
          background:    '#F7F4EE',
          borderColor:   '#DDD8CE',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)',
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendRef.current() } }}
          placeholder="Escribe un mensaje..."
          rows={1}
          className="flex-1 px-3 py-2.5 outline-none border resize-none"
          style={{
            background:  '#EFEBE3',
            borderColor: '#DDD8CE',
            color:       '#1C1C1A',
            borderRadius: 12,
            fontSize:    16,
            lineHeight:  1.5,
            maxHeight:   120,
            overflowY:   'auto',
          }}
        />
        <button
          onClick={() => sendRef.current()}
          disabled={loading || !input.trim()}
          className="shrink-0 w-11 h-11 flex items-center justify-center"
          style={{
            background:  loading || !input.trim() ? '#d89a80' : '#C4714A',
            borderRadius: 12,
            transition:  'background 0.15s',
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

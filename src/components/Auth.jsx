import { useState } from 'react'
import { supabase } from '../lib/supabase'
import logo from '../assets/logotransparent.svg'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Revisa tu correo para confirmar tu cuenta.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6" style={{ background: '#F7F4EE' }}>
      <div className="w-full max-w-sm">
        <img src={logo} alt="Noura" style={{ height: 52, marginBottom: 12 }} />
        <p className="text-sm mb-10" style={{ color: '#888' }}>
          Tu entrenadora personal de nutrición y fitness
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide mb-1 block" style={{ color: '#888' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 text-base outline-none border"
              style={{
                background: '#EFEBE3',
                borderColor: '#DDD8CE',
                color: '#1C1C1A',
                borderRadius: 8
              }}
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wide mb-1 block" style={{ color: '#888' }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 text-base outline-none border"
              style={{
                background: '#EFEBE3',
                borderColor: '#DDD8CE',
                color: '#1C1C1A',
                borderRadius: 8
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm px-3 py-2" style={{ background: '#fde8df', color: '#C4714A', borderRadius: 6 }}>
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm px-3 py-2" style={{ background: '#e8f0e9', color: '#7A9E7E', borderRadius: 6 }}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-base font-medium text-white"
            style={{
              background: loading ? '#d89a80' : '#C4714A',
              borderRadius: 8,
              transition: 'background 0.15s'
            }}
          >
            {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <button
          className="mt-6 text-sm w-full text-center"
          style={{ color: '#888' }}
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setMessage('') }}
        >
          {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Entra'}
        </button>
      </div>
    </div>
  )
}

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autorizado' })

  const admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verify JWT and get user
  const { data: { user }, error: authError } = await admin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

  // Delete from auth.users (cascades to all tables via FK)
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ success: true })
}

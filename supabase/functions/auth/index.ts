import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { action, data } = await req.json()
    let result = null

    switch (action) {
      case 'login': {
        const { data: { user }, error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password
        })

        if (error) throw new Error(error.message)

        // Buscar o crear perfil
        let { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        // Si no existe perfil, crearlo
        if (!profile) {
          const username = user.email.split('@')[0]
          await supabase.from('profiles').insert({
            id: user.id,
            username: username,
            full_name: user.email.split('@')[0],
            role: 'colaborador'
          })
          
          profile = {
            id: user.id,
            username: username,
            full_name: username,
            role: 'colaborador'
          }
        }

        // Registrar en logs
        await supabase.from('logs').insert({
          action: 'login',
          user_id: user.id,
          username: profile?.username,
          details: 'User logged in'
        })

        // Solo devolver el usuario, sin tokens complejos
        result = { user: profile }
        break
      }

      case 'register': {
        const { data: { user }, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              full_name: data.fullName || data.username
            }
          }
        })

        if (error) throw new Error(error.message)

        // Crear perfil
        if (user) {
          await supabase.from('profiles').insert({
            id: user.id,
            username: data.username || user.email.split('@')[0],
            full_name: data.fullName || data.username || user.email.split('@')[0],
            role: 'colaborador'
          })
        }

        result = { user: { id: user.id, email: user.email } }
        break
      }

      case 'logout': {
        // No hacer nada especial, el frontend maneja la sesión
        result = { success: true }
        break
      }

      default:
        throw new Error('Invalid action')
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

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
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    let user = null
    if (token) {
      const { data: { user: u } } = await supabase.auth.getUser(token)
      user = u
    }

    let result = null

    switch (action) {
      case 'get-profile': {
        if (!user) throw new Error('Unauthorized')
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        result = profile
        break
      }

      case 'update-profile': {
        if (!user) throw new Error('Unauthorized')
        const { data: profile } = await supabase
          .from('profiles')
          .update(data.updates)
          .eq('id', user.id)
          .select()
          .single()
        result = profile
        break
      }

      case 'get-users': {
        if (!user) throw new Error('Unauthorized')
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profile?.role !== 'admin') throw new Error('Forbidden')
        
        const { data: users } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })
        result = users
        break
      }

      case 'get-user': {
        if (!user) throw new Error('Unauthorized')
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profile?.role !== 'admin') throw new Error('Forbidden')
        
        const { data: targetUser } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.userId)
          .single()
        result = targetUser
        break
      }

      case 'update-user': {
        if (!user) throw new Error('Unauthorized')
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profile?.role !== 'admin') throw new Error('Forbidden')
        
        const { data: updated } = await supabase
          .from('profiles')
          .update(data.updates)
          .eq('id', data.userId)
          .select()
          .single()
        result = updated
        break
      }

      case 'delete-user': {
        if (!user) throw new Error('Unauthorized')
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profile?.role !== 'admin') throw new Error('Forbidden')
        
        await supabase.auth.admin.deleteUser(data.userId)
        result = { success: true }
        break
      }

      case 'change-password': {
        if (!user) throw new Error('Unauthorized')
        const { data: { error } } = await supabase.auth.admin.updateUser(
          user.id,
          { password: data.password }
        )
        if (error) throw new Error(error.message)
        result = { success: true }
        break
      }

      case 'change-own-password': {
        if (!user) throw new Error('Unauthorized')
        const { error } = await supabase.auth.updateUser({
          password: data.password
        })
        if (error) throw new Error(error.message)
        result = { success: true }
        break
      }

      case 'get-roles': {
        result = ['admin', 'colaborador', 'viewer']
        break
      }

      case 'create-user': {
        if (!user) throw new Error('Unauthorized')
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profile?.role !== 'admin') throw new Error('Forbidden')
        
        // Create user with Supabase Auth Admin API
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: data.email,
          password: data.password,
          email_confirm: data.email_confirm ?? true,
          user_metadata: { role: data.role }
        })
        
        if (createError) throw new Error(createError.message)
        
        // Create profile entry
        const { data: newProfile, error: profileError } = await supabase
          .from('profiles')
          .insert([{
            id: newUser.user.id,
            email: data.email,
            role: data.role,
            username: data.email.split('@')[0]
          }])
          .select()
          .single()
        
        if (profileError) {
          // Rollback: delete the auth user if profile creation fails
          await supabase.auth.admin.deleteUser(newUser.user.id)
          throw new Error(profileError.message)
        }
        
        result = newProfile
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

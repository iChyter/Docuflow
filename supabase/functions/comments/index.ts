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
    let profile = null
    if (token) {
      const { data: { user: u } } = await supabase.auth.getUser(token)
      user = u
      if (user) {
        const { data: p } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        profile = p
      }
    }

    let result = null

    switch (action) {
      case 'list': {
        if (!user) throw new Error('Unauthorized')
        
        let query = supabase
          .from('comments')
          .select('*, profiles(username, full_name)')
          .order('created_at', { ascending: false })

        if (data?.limit) query = query.limit(data.limit)

        const { data: comments } = await query
        result = comments
        break
      }

      case 'by-document': {
        if (!user) throw new Error('Unauthorized')
        
        const { data: comments } = await supabase
          .from('comments')
          .select('*, profiles(username, full_name)')
          .eq('document_id', data.documentId)
          .order('created_at', { ascending: true })
        
        result = comments
        break
      }

      case 'get': {
        if (!user) throw new Error('Unauthorized')
        
        const { data: comment } = await supabase
          .from('comments')
          .select('*, profiles(username, full_name)')
          .eq('id', data.id)
          .single()
        
        result = comment
        break
      }

      case 'create': {
        if (!user) throw new Error('Unauthorized')
        if (!profile) throw new Error('Profile not found')
        
        const { data: comment } = await supabase
          .from('comments')
          .insert({
            content: data.content,
            document_id: data.documentId,
            author_id: user.id,
            author_username: profile.username,
            is_task: data.isTask || false,
            assignees: data.assignees || []
          })
          .select()
          .single()
        
        result = comment

        if (comment) {
          await supabase.from('logs').insert({
            action: data.isTask ? 'task_created' : 'comment',
            user_id: user.id,
            document_id: data.documentId,
            details: data.isTask ? `Created task: ${data.content.substring(0, 50)}` : `Added comment`
          })

          if (data.assignees?.length > 0) {
            for (const assignee of data.assignees) {
              await supabase.from('notifications').insert({
                title: data.isTask ? 'New Task Assigned' : 'New Comment',
                message: `${profile.username} ${data.isTask ? 'assigned you a task' : 'commented on a document'}`,
                user_id: user.id,
                type: 'info',
                priority: 'medium'
              })
            }
          }
        }
        break
      }

      case 'update': {
        if (!user) throw new Error('Unauthorized')
        
        const { data: existing } = await supabase
          .from('comments')
          .select('author_id')
          .eq('id', data.id)
          .single()

        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (existing?.author_id !== user.id && currentProfile?.role !== 'admin') {
          throw new Error('Forbidden')
        }

        const { data: comment } = await supabase
          .from('comments')
          .update({
            content: data.content,
            updated_at: new Date().toISOString(),
            last_edited_by: profile?.username
          })
          .eq('id', data.id)
          .select()
          .single()
        
        result = comment
        break
      }

      case 'delete': {
        if (!user) throw new Error('Unauthorized')
        
        const { data: existing } = await supabase
          .from('comments')
          .select('author_id')
          .eq('id', data.id)
          .single()

        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (existing?.author_id !== user.id && currentProfile?.role !== 'admin') {
          throw new Error('Forbidden')
        }

        await supabase.from('comments').delete().eq('id', data.id)
        result = { success: true }
        break
      }

      case 'assign': {
        if (!user) throw new Error('Unauthorized')
        
        const { data: comment } = await supabase
          .from('comments')
          .update({
            assignees: data.assignees,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.id)
          .select()
          .single()
        
        result = comment
        break
      }

      case 'complete': {
        if (!user) throw new Error('Unauthorized')
        
        const { data: comment } = await supabase
          .from('comments')
          .update({
            completed: data.completed,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.id)
          .eq('is_task', true)
          .select()
          .single()
        
        if (comment) {
          await supabase.from('logs').insert({
            action: 'task_completed',
            user_id: user.id,
            document_id: comment.document_id,
            details: `Completed task: ${comment.content.substring(0, 50)}`
          })
        }
        
        result = comment
        break
      }

      case 'count': {
        if (!user) throw new Error('Unauthorized')
        
        const { count } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
        
        result = { count: count || 0 }
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

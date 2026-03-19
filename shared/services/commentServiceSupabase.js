import { supabase } from './supabaseClient.js'

export const commentService = {
  async list(limit = 100) {
    const { data, error } = await supabase
      .from('comments')
      .select('*, profiles(username, full_name)')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    return data || []
  },

  async byDocument(documentId) {
    const { data, error } = await supabase
      .from('comments')
      .select('*, profiles(username, full_name)')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  async get(id) {
    const { data, error } = await supabase
      .from('comments')
      .select('*, profiles(username, full_name)')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  async create(content, documentId = null, isTask = false, assignees = []) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    const { data, error } = await supabase
      .from('comments')
      .insert({
        content,
        document_id: documentId,
        author_id: user.id,
        author_username: profile?.username,
        is_task: isTask,
        assignees: assignees || []
      })
      .select()
      .single()
    
    if (error) throw error

    if (data) {
      await supabase.from('logs').insert({
        action: isTask ? 'task_created' : 'comment',
        user_id: user.id,
        document_id: documentId,
        details: isTask ? `Created task: ${content.substring(0, 50)}` : `Added comment`
      })

      if (assignees?.length > 0) {
        for (const assignee of assignees) {
          await supabase.from('notifications').insert({
            title: isTask ? 'New Task Assigned' : 'New Comment',
            message: `${profile?.username} ${isTask ? 'assigned you a task' : 'commented on a document'}`,
            user_id: assignee,
            type: 'info',
            priority: 'medium'
          })
        }
      }
    }

    return data
  },

  async update(id, content) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    const { data, error } = await supabase
      .from('comments')
      .update({
        content,
        updated_at: new Date().toISOString(),
        last_edited_by: profile?.username
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  async delete(id) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    return { success: true }
  },

  async assign(id, assignees) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
      .from('comments')
      .update({
        assignees,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      if (error.code === '42501') {
        throw new Error('No tienes permiso para asignar este comentario')
      }
      throw error
    }
    return data
  },

  async complete(id, completed = true) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
      .from('comments')
      .update({
        completed,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      if (error.code === '42501') {
        throw new Error('No tienes permiso para completar esta tarea')
      }
      throw error
    }

    if (data) {
      await supabase.from('logs').insert({
        action: 'task_completed',
        user_id: user.id,
        document_id: data.document_id,
        details: `Completed task: ${data.content.substring(0, 50)}`
      })
    }

    return data
  },

  async count() {
    const { count, error } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
    
    if (error) throw error
    return { count: count || 0 }
  }
}
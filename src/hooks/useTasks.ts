import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UiTaskStatus = 'To Do' | 'In Progress' | 'Done';
export type UiTaskPriority = 'High' | 'Medium' | 'Low';

export interface UiTask {
  id: string;
  title: string;
  clientId: string | null;
  clientName: string;
  assignee: string;
  status: UiTaskStatus;
  priority: UiTaskPriority;
  due: string; // yyyy-MM-dd
}

const STATUS_TO_DB: Record<UiTaskStatus, string> = { 'To Do': 'todo', 'In Progress': 'in_progress', Done: 'done' };
const STATUS_FROM_DB: Record<string, UiTaskStatus> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
const PRIORITY_TO_DB: Record<UiTaskPriority, string> = { High: 'high', Medium: 'medium', Low: 'low' };
const PRIORITY_FROM_DB: Record<string, UiTaskPriority> = { high: 'High', medium: 'Medium', low: 'Low' };

export function useTasks(clientLookup: Map<string, string>) {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const [tasks, setTasks] = useState<UiTask[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!orgId) return;
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    const mapped: UiTask[] = (data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      clientId: t.client_id,
      clientName: t.client_id ? (clientLookup.get(t.client_id) ?? '') : '',
      assignee: t.assignee ?? '',
      status: STATUS_FROM_DB[t.status] ?? 'To Do',
      priority: PRIORITY_FROM_DB[t.priority] ?? 'Medium',
      due: t.due_date ?? '',
    }));
    setTasks(mapped);
    setLoaded(true);
  }, [orgId, clientLookup]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const upsertTask = useCallback(async (task: UiTask) => {
    if (!orgId) return;
    const payload = {
      organization_id: orgId,
      title: task.title,
      client_id: task.clientId || null,
      assignee: task.assignee || null,
      status: STATUS_TO_DB[task.status],
      priority: PRIORITY_TO_DB[task.priority],
      due_date: task.due || null,
    };
    const isExisting = task.id && !task.id.startsWith('new-') && task.id.length === 36;
    if (isExisting) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', task.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('tasks').insert(payload);
      if (error) throw error;
    }
    await fetchAll();
  }, [orgId, fetchAll]);

  const updateStatus = useCallback(async (id: string, status: UiTaskStatus) => {
    const { error } = await supabase.from('tasks').update({ status: STATUS_TO_DB[status] }).eq('id', id);
    if (error) throw error;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  return { tasks, loaded, refetch: fetchAll, upsertTask, updateStatus, deleteTask };
}

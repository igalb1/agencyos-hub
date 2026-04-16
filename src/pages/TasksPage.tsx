import { useApp } from '@/contexts/AppContext';
import { mockTasks } from '@/lib/mock-data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Clock, Plus, Search, GripVertical, Pencil, Trash2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import NewTaskDialog from '@/components/tasks/NewTaskDialog';
import EditTaskDialog from '@/components/tasks/EditTaskDialog';

type TaskStatus = 'To Do' | 'In Progress' | 'Done';
type TaskPriority = 'High' | 'Medium' | 'Low';
type ViewMode = 'board' | 'list';

interface Task {
  id: string;
  title: string;
  clientName: string;
  assignee: string;
  status: TaskStatus;
  priority: TaskPriority;
  due: string;
}

const priorityConfig: Record<TaskPriority, { color: string; label: Record<string, string> }> = {
  High: { color: 'bg-destructive text-destructive-foreground', label: { he: 'גבוהה', en: 'High' } },
  Medium: { color: 'bg-amber-500 text-white', label: { he: 'בינונית', en: 'Medium' } },
  Low: { color: 'bg-muted text-muted-foreground', label: { he: 'נמוכה', en: 'Low' } },
};

const statusConfig: Record<TaskStatus, { icon: typeof Circle; color: string; label: Record<string, string> }> = {
  'To Do': { icon: Circle, color: 'text-muted-foreground', label: { he: 'לביצוע', en: 'To Do' } },
  'In Progress': { icon: Clock, color: 'text-amber-500', label: { he: 'בתהליך', en: 'In Progress' } },
  'Done': { icon: CheckCircle2, color: 'text-emerald-500', label: { he: 'הושלם', en: 'Done' } },
};

const columns: TaskStatus[] = ['To Do', 'In Progress', 'Done'];

export default function TasksPage() {
  const { lang } = useApp();
  const isRtl = lang === 'he';
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const addTask = useCallback((task: Task) => {
    setTasks(prev => [task, ...prev]);
  }, []);

  const updateTask = useCallback((updated: Task) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = !searchQuery ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.assignee.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
      return matchesSearch && matchesPriority;
    });
  }, [tasks, searchQuery, filterPriority]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = { 'To Do': [], 'In Progress': [], Done: [] };
    filteredTasks.forEach(t => grouped[t.status]?.push(t));
    return grouped;
  }, [filteredTasks]);

  const moveTask = useCallback((taskId: string, newStatus: TaskStatus, newIndex?: number) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
      if (newIndex !== undefined) {
        const task = updated.find(t => t.id === taskId)!;
        const without = updated.filter(t => t.id !== taskId);
        const inColumn = without.filter(t => t.status === newStatus);
        const others = without.filter(t => t.status !== newStatus);
        inColumn.splice(newIndex, 0, task);
        return [...others, ...inColumn];
      }
      return updated;
    });
  }, []);

  const onDragEnd = useCallback((result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    moveTask(draggableId, destination.droppableId as TaskStatus, destination.index);
  }, [moveTask]);

  const stats = useMemo(() => ({
    total: tasks.length,
    done: tasks.filter(t => t.status === 'Done').length,
    overdue: tasks.filter(t => new Date(t.due) < new Date() && t.status !== 'Done').length,
  }), [tasks]);

  const TaskCard = ({ task }: { task: Task }) => {
    const isOverdue = new Date(task.due) < new Date() && task.status !== 'Done';

    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all group">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start gap-2">
            <GripVertical size={14} className="text-muted-foreground/40 mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-snug">{task.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{task.clientName}</p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button onClick={(e) => { e.stopPropagation(); setEditingTask(task); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <Pencil size={12} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Badge className={cn("text-[10px] px-1.5 py-0 h-4", priorityConfig[task.priority].color)}>
                {priorityConfig[task.priority].label[lang]}
              </Badge>
              <span className={cn("text-[10px]", isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                {new Date(task.due).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-medium text-primary">
              {task.assignee.charAt(0)}
            </div>
          </div>
          {viewMode === 'board' && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {columns.filter(s => s !== task.status).map(s => (
                <button
                  key={s}
                  onClick={() => moveTask(task.id, s)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted-foreground/20 text-muted-foreground transition-colors"
                >
                  → {statusConfig[s].label[lang]}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {lang === 'he' ? 'משימות' : 'Tasks'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === 'he'
              ? `${stats.total} משימות · ${stats.done} הושלמו · ${stats.overdue} באיחור`
              : `${stats.total} tasks · ${stats.done} done · ${stats.overdue} overdue`}
          </p>
        </div>
        <Button className="gap-2" size="sm" onClick={() => setNewTaskOpen(true)}>
          <Plus size={16} />
          {lang === 'he' ? 'משימה חדשה' : 'New Task'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className={cn("absolute top-1/2 -translate-y-1/2 text-muted-foreground", isRtl ? 'right-3' : 'left-3')} />
          <Input
            placeholder={lang === 'he' ? 'חיפוש משימות...' : 'Search tasks...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(isRtl ? 'pr-9' : 'pl-9')}
          />
        </div>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === 'he' ? 'כל העדיפויות' : 'All Priorities'}</SelectItem>
            <SelectItem value="High">{lang === 'he' ? 'גבוהה' : 'High'}</SelectItem>
            <SelectItem value="Medium">{lang === 'he' ? 'בינונית' : 'Medium'}</SelectItem>
            <SelectItem value="Low">{lang === 'he' ? 'נמוכה' : 'Low'}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="board">{lang === 'he' ? 'לוח' : 'Board'}</SelectItem>
            <SelectItem value="list">{lang === 'he' ? 'רשימה' : 'List'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Board View */}
      {viewMode === 'board' ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {columns.map(status => {
              const StatusIcon = statusConfig[status].icon;
              const columnTasks = tasksByStatus[status];
              return (
                <div key={status} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <StatusIcon size={16} className={statusConfig[status].color} />
                    <span className="text-sm font-semibold text-foreground">
                      {statusConfig[status].label[lang]}
                    </span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {columnTasks.length}
                    </span>
                  </div>
                  <Droppable droppableId={status}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "space-y-2 min-h-[100px] p-2 rounded-lg border transition-colors",
                          snapshot.isDraggingOver
                            ? "bg-primary/10 border-primary/30"
                            : "bg-muted/30 border-border/30"
                        )}
                      >
                        {columnTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(snapshot.isDragging && "opacity-90")}
                              >
                                <TaskCard task={task} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                          <p className="text-xs text-muted-foreground text-center py-8">
                            {lang === 'he' ? 'אין משימות' : 'No tasks'}
                          </p>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      ) : (
        /* List View */
        <Card className="bg-card/60 backdrop-blur-sm border-border/50">
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {filteredTasks.map(task => {
                const StatusIcon = statusConfig[task.status].icon;
                const isOverdue = new Date(task.due) < new Date() && task.status !== 'Done';
                return (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <StatusIcon size={18} className={statusConfig[task.status].color} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.clientName}</p>
                    </div>
                    <Badge className={cn("text-[10px] px-1.5 py-0 h-4", priorityConfig[task.priority].color)}>
                      {priorityConfig[task.priority].label[lang]}
                    </Badge>
                    <span className={cn("text-xs", isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
                      {new Date(task.due).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short' })}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-medium text-primary">
                      {task.assignee.charAt(0)}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditingTask(task)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => deleteTask(task.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <Select value={task.status} onValueChange={(v) => moveTask(task.id, v as TaskStatus)}>
                      <SelectTrigger className="w-[100px] h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map(s => (
                          <SelectItem key={s} value={s}>{statusConfig[s].label[lang]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} onAdd={addTask} lang={lang} />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { mockClients } from '@/lib/mock-data';

type TaskStatus = 'To Do' | 'In Progress' | 'Done';
type TaskPriority = 'High' | 'Medium' | 'Low';

interface Task {
  id: string;
  title: string;
  clientName: string;
  assignee: string;
  status: TaskStatus;
  priority: TaskPriority;
  due: string;
}

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onSave: (task: Task) => void;
  onDelete: (taskId: string) => void;
  lang: 'he' | 'en';
}

export default function EditTaskDialog({ open, onOpenChange, task, onSave, onDelete, lang }: EditTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [status, setStatus] = useState<TaskStatus>('To Do');
  const [dueDate, setDueDate] = useState<Date>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isHe = lang === 'he';

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setClientName(task.clientName);
      setAssignee(task.assignee);
      setPriority(task.priority);
      setStatus(task.status);
      setDueDate(new Date(task.due));
      setConfirmDelete(false);
    }
  }, [task]);

  const handleSave = () => {
    if (!task || !title.trim() || !clientName || !assignee.trim() || !dueDate) return;
    onSave({
      ...task,
      title: title.trim(),
      clientName,
      assignee: assignee.trim(),
      priority,
      status,
      due: format(dueDate, 'yyyy-MM-dd'),
    });
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!task) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(task.id);
    onOpenChange(false);
  };

  const isValid = title.trim() && clientName && assignee.trim() && dueDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isHe ? 'עריכת משימה' : 'Edit Task'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{isHe ? 'שם המשימה' : 'Task Name'}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label>{isHe ? 'לקוח' : 'Client'}</Label>
            <Select value={clientName} onValueChange={setClientName}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {mockClients.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{isHe ? 'אחראי' : 'Assignee'}</Label>
            <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} maxLength={100} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{isHe ? 'עדיפות' : 'Priority'}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">{isHe ? 'גבוהה' : 'High'}</SelectItem>
                  <SelectItem value="Medium">{isHe ? 'בינונית' : 'Medium'}</SelectItem>
                  <SelectItem value="Low">{isHe ? 'נמוכה' : 'Low'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{isHe ? 'סטטוס' : 'Status'}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="To Do">{isHe ? 'לביצוע' : 'To Do'}</SelectItem>
                  <SelectItem value="In Progress">{isHe ? 'בתהליך' : 'In Progress'}</SelectItem>
                  <SelectItem value="Done">{isHe ? 'הושלם' : 'Done'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{isHe ? 'תאריך יעד' : 'Due Date'}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-start font-normal", !dueDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, 'PPP') : (isHe ? 'בחר תאריך' : 'Pick a date')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter className="flex !justify-between">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            {confirmDelete ? (isHe ? 'לחץ שוב לאישור' : 'Click again to confirm') : (isHe ? 'מחק' : 'Delete')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {isHe ? 'ביטול' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} disabled={!isValid}>
              {isHe ? 'שמור' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

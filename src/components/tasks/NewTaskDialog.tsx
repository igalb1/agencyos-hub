import { useState } from 'react';
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
import type { UiTask, UiTaskPriority } from '@/hooks/useTasks';
import type { Client } from '@/lib/types';

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (task: UiTask) => void;
  lang: 'he' | 'en';
  clients: Client[];
}

export default function NewTaskDialog({ open, onOpenChange, onAdd, lang, clients }: NewTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState<UiTaskPriority>('Medium');
  const [dueDate, setDueDate] = useState<Date>();

  const isHe = lang === 'he';

  const reset = () => {
    setTitle('');
    setClientId('');
    setAssignee('');
    setPriority('Medium');
    setDueDate(undefined);
  };

  const handleSubmit = () => {
    if (!title.trim() || !clientId || !assignee.trim() || !dueDate) return;
    const client = clients.find(c => c.id === clientId);
    onAdd({
      id: '',
      title: title.trim(),
      clientId,
      clientName: client?.name ?? '',
      assignee: assignee.trim(),
      status: 'To Do',
      priority,
      due: format(dueDate, 'yyyy-MM-dd'),
    });
    reset();
    onOpenChange(false);
  };

  const isValid = title.trim() && clientId && assignee.trim() && dueDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isHe ? 'משימה חדשה' : 'New Task'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{isHe ? 'שם המשימה' : 'Task Name'}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isHe ? 'לדוגמה: עדכון קריאייטיב' : 'e.g. Update creative'}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{isHe ? 'לקוח' : 'Client'}</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder={isHe ? 'בחר לקוח' : 'Select client'} />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{isHe ? 'אחראי' : 'Assignee'}</Label>
            <Input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder={isHe ? 'שם האחראי' : 'Assignee name'}
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{isHe ? 'עדיפות' : 'Priority'}</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as UiTaskPriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="High">{isHe ? 'גבוהה' : 'High'}</SelectItem>
                <SelectItem value="Medium">{isHe ? 'בינונית' : 'Medium'}</SelectItem>
                <SelectItem value="Low">{isHe ? 'נמוכה' : 'Low'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{isHe ? 'תאריך יעד' : 'Due Date'}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-start font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, 'PPP') : (isHe ? 'בחר תאריך' : 'Pick a date')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isHe ? 'ביטול' : 'Cancel'}
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            {isHe ? 'הוסף משימה' : 'Add Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

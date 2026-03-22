import { useListTasks, useCreateTask } from "@workspace/api-client-react"
import { Card, Badge, Button, Dialog, Input, Label } from "@/components/ui/shared"
import { Plus, Clock, MessageSquare } from "lucide-react"
import { useState } from "react"
import { formatDate } from "@/lib/utils"

export function TaskBoard() {
  const { data: tasks, refetch } = useListTasks();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const columns = [
    { id: 'new', title: 'جديدة', color: 'border-blue-500' },
    { id: 'in_progress', title: 'قيد التنفيذ', color: 'border-amber-500' },
    { id: 'completed', title: 'مكتملة', color: 'border-emerald-500' },
  ];

  const getPriorityBadge = (p: string) => {
    switch(p) {
      case 'urgent': return <Badge variant="destructive" className="scale-90 origin-right">عاجل</Badge>;
      case 'medium': return <Badge variant="warning" className="scale-90 origin-right">متوسط</Badge>;
      default: return <Badge variant="secondary" className="scale-90 origin-right">منخفض</Badge>;
    }
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-6">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">نظام المهام</h1>
          <p className="text-muted-foreground mt-1">تنظيم التكليفات ومتابعة الإنجاز</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2 bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-900/20">
          <Plus className="w-5 h-5" /> إضافة تذكرة
        </Button>
      </div>

      <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
        {columns.map(col => {
          const colTasks = tasks?.filter(t => t.status === col.id) || [];
          return (
            <div key={col.id} className="flex-1 min-w-[320px] max-w-[400px] flex flex-col bg-slate-100/50 rounded-2xl p-4 border border-border/50">
              <div className={`flex items-center justify-between mb-4 pb-2 border-b-2 ${col.color}`}>
                <h3 className="font-bold text-lg">{col.title}</h3>
                <span className="bg-white text-slate-600 px-2 py-0.5 rounded-full text-sm font-bold shadow-sm">{colTasks.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                {colTasks.map(task => (
                  <Card key={task.id} className="p-4 cursor-pointer hover:border-primary/50 transition-colors shadow-sm group">
                    <div className="flex justify-between items-start mb-2">
                      {getPriorityBadge(task.priority)}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDate(task.createdAt)}
                      </span>
                    </div>
                    <h4 className="font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{task.title}</h4>
                    {task.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{task.description}</p>}
                    
                    <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                          {task.assignedToName?.charAt(0) || '?'}
                        </div>
                        <span className="text-xs font-semibold">{task.assignedToName || 'غير معين'}</span>
                      </div>
                      <div className="text-muted-foreground hover:text-foreground transition-colors">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <CreateTaskDialog isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); refetch(); }} />
    </div>
  )
}

function CreateTaskDialog({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const create = useCreateTask();
  const [formData, setFormData] = useState({ title: '', description: '', priority: 'medium' as any });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({ data: formData }, { onSuccess: onClose });
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="تذكرة مهام جديدة">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>عنوان المهمة</Label>
          <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required placeholder="مثال: متابعة عميل شركة الفتح" />
        </div>
        <div>
          <Label>الوصف التفصيلي</Label>
          <textarea 
            className="w-full min-h-[100px] rounded-xl border border-input p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={formData.description} 
            onChange={e => setFormData({...formData, description: e.target.value})}
          />
        </div>
        <div>
          <Label>الأولوية</Label>
          <select 
            className="w-full h-11 rounded-xl border border-input px-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            value={formData.priority}
            onChange={e => setFormData({...formData, priority: e.target.value as any})}
          >
            <option value="low">منخفضة</option>
            <option value="medium">متوسطة</option>
            <option value="urgent">عاجلة</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
          <Button type="submit" isLoading={create.isPending}>إرسال المهمة</Button>
        </div>
      </form>
    </Dialog>
  )
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  useChecklistTemplates, useChecklistTemplateMutations, ChecklistTemplate,
} from "@/hooks/use-task-boards";
import { Plus, Trash2, X, ListChecks, GripVertical } from "lucide-react";

interface ChecklistTemplateManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChecklistTemplateManager({ open, onOpenChange }: ChecklistTemplateManagerProps) {
  const { data: templates, isLoading } = useChecklistTemplates();
  const { createTemplate, updateTemplate, deleteTemplate } = useChecklistTemplateMutations();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [items, setItems] = useState<{ title: string }[]>([]);
  const [newItemTitle, setNewItemTitle] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setItems([]);
    setNewItemTitle("");
  };

  const startEdit = (template: ChecklistTemplate) => {
    setEditingId(template.id);
    setName(template.name);
    setItems(template.items?.map(i => ({ title: i.title })) || []);
  };

  const addItem = () => {
    if (!newItemTitle.trim()) return;
    setItems(prev => [...prev, { title: newItemTitle }]);
    setNewItemTitle("");
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (editingId) {
      updateTemplate.mutate({ id: editingId, name, items });
    } else {
      createTemplate.mutate({ name, items });
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm("Excluir este template?")) {
      deleteTemplate.mutate(id);
      if (editingId === id) resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" /> Templates de Checklist
          </DialogTitle>
          <DialogDescription>Crie templates reutilizáveis para suas checklists</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Form */}
          <div className="border rounded-lg p-3 space-y-3">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome do template"
            />
            <div className="space-y-1">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{item.title}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(idx)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newItemTitle}
                onChange={e => setNewItemTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder="Novo item da checklist"
                className="h-8"
              />
              <Button size="sm" variant="outline" className="h-8" onClick={addItem}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
                {editingId ? "Atualizar" : "Criar Template"}
              </Button>
              {editingId && (
                <Button size="sm" variant="ghost" onClick={resetForm}>Cancelar</Button>
              )}
            </div>
          </div>

          {/* List */}
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {templates?.map(template => (
                <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                  <div className="flex-1 cursor-pointer" onClick={() => startEdit(template)}>
                    <p className="font-medium text-sm">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.items?.length || 0} itens
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => handleDelete(template.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {!templates?.length && !isLoading && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum template criado</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

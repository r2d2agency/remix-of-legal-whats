import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mail, Send, AlertCircle, Paperclip, X, FileText, Image, File } from "lucide-react";
import { useSMTPStatus, useEmailTemplates, useSendEmail } from "@/hooks/use-email";
import { RichEmailEditor } from "./RichEmailEditor";
import { useUpload } from "@/hooks/use-upload";
import { toast } from "sonner";

interface Attachment {
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
}

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toEmail?: string;
  toName?: string;
  contextType?: string;
  contextId?: string;
  variables?: Record<string, string>;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return Image;
  if (type.includes("pdf") || type.includes("document")) return FileText;
  return File;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SendEmailDialog({ 
  open, 
  onOpenChange,
  toEmail = "",
  toName = "",
  contextType,
  contextId,
  variables = {}
}: SendEmailDialogProps) {
  const { data: smtpStatus, isLoading: loadingStatus } = useSMTPStatus();
  const { data: templates = [] } = useEmailTemplates();
  const sendEmail = useSendEmail();
  const { uploadFile, isUploading } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [form, setForm] = useState({
    to_email: "",
    to_name: "",
    subject: "",
    body_html: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        to_email: toEmail,
        to_name: toName,
        subject: "",
        body_html: "",
      });
      setSelectedTemplateId("");
      setAttachments([]);
    }
  }, [open, toEmail, toName]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    
    if (templateId === "custom") return;

    const template = templates.find(t => t.id === templateId);
    if (template) {
      let subject = template.subject;
      let body = template.body_html;

      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\s*${key}\\s*\\}`, 'gi');
        subject = subject.replace(regex, value || '');
        body = body.replace(regex, value || '');
      });

      setForm(prev => ({ ...prev, subject, body_html: body }));
    }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`${file.name} excede o limite de 25MB`);
        continue;
      }
      try {
        const url = await uploadFile(file);
        if (url) {
          setAttachments(prev => [...prev, {
            file_url: url,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
          }]);
        }
      } catch {
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!form.to_email) {
      toast.error("Email do destinatário é obrigatório");
      return;
    }
    if (!form.subject) {
      toast.error("Assunto é obrigatório");
      return;
    }

    try {
      await sendEmail.mutateAsync({
        to_email: form.to_email,
        to_name: form.to_name,
        subject: form.subject,
        body_html: form.body_html,
        template_id: selectedTemplateId && selectedTemplateId !== "custom" ? selectedTemplateId : undefined,
        variables,
        context_type: contextType,
        context_id: contextId,
        send_immediately: true,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const isConfigured = smtpStatus?.configured && smtpStatus?.verified;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enviar E-mail
          </DialogTitle>
        </DialogHeader>

        {loadingStatus ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !isConfigured ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500" />
            <div>
              <p className="font-medium">SMTP não configurado</p>
              <p className="text-sm text-muted-foreground">
                Configure o servidor SMTP em Configurações → E-mail antes de enviar emails.
              </p>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="space-y-4 pr-2">
              {/* Template selector */}
              <div className="space-y-1.5">
                <Label className="text-xs">Template</Label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione um template ou escreva do zero" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Escrever do zero</SelectItem>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Recipient */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Email do destinatário *</Label>
                  <Input
                    type="email"
                    value={form.to_email}
                    onChange={(e) => setForm({ ...form, to_email: e.target.value })}
                    placeholder="email@exemplo.com"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome (opcional)</Label>
                  <Input
                    value={form.to_name}
                    onChange={(e) => setForm({ ...form, to_name: e.target.value })}
                    placeholder="Nome do destinatário"
                    className="h-9"
                  />
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label className="text-xs">Assunto *</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Assunto do email"
                  className="h-9"
                />
              </div>

              {/* Rich HTML Editor */}
              <div className="space-y-1.5">
                <Label className="text-xs">Mensagem</Label>
                <RichEmailEditor
                  value={form.body_html}
                  onChange={(val) => setForm({ ...form, body_html: val })}
                  placeholder="Escreva sua mensagem..."
                  className="min-h-[250px]"
                />
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Anexos</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileAttach}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="h-7 text-xs gap-1.5"
                    type="button"
                  >
                    {isUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Paperclip className="h-3.5 w-3.5" />
                    )}
                    {isUploading ? "Enviando..." : "Anexar arquivo"}
                  </Button>
                </div>

                {attachments.length > 0 && (
                  <div className="space-y-1.5">
                    {attachments.map((att, idx) => {
                      const Icon = getFileIcon(att.file_type);
                      return (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-md text-xs">
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate flex-1">{att.file_name}</span>
                          <span className="text-muted-foreground shrink-0">{formatFileSize(att.file_size)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() => removeAttachment(idx)}
                            type="button"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Variables info */}
              {Object.keys(variables).length > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Variáveis disponíveis:</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(variables).map(([key, value]) => (
                      <Badge key={key} variant="secondary" className="text-xs">
                        {`{${key}}`}: {value || "(vazio)"}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 pb-1">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button onClick={handleSend} disabled={sendEmail.isPending}>
                  {sendEmail.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

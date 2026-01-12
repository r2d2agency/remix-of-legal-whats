import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare,
  Plus,
  Image,
  Video,
  Mic,
  FileText,
  Variable,
  Eye,
  Trash2,
  Edit,
  Upload,
} from "lucide-react";

interface Message {
  id: string;
  name: string;
  content: string;
  hasMedia: boolean;
  mediaType?: "image" | "video" | "audio";
  createdAt: string;
}

const mockMessages: Message[] = [
  {
    id: "1",
    name: "Boas-vindas",
    content: "Olá {{nome}}! Seja bem-vindo(a) à nossa loja! 🎉",
    hasMedia: false,
    createdAt: "10/01/2026",
  },
  {
    id: "2",
    name: "Promoção",
    content:
      "{{nome}}, temos uma oferta especial para você! Confira nossa promoção exclusiva 🔥",
    hasMedia: true,
    mediaType: "image",
    createdAt: "08/01/2026",
  },
  {
    id: "3",
    name: "Lembrete",
    content: "Oi {{nome}}! Não esqueça do nosso compromisso amanhã. Até lá! 👋",
    hasMedia: false,
    createdAt: "05/01/2026",
  },
];

const Mensagens = () => {
  const [activeTab, setActiveTab] = useState("list");
  const [messageName, setMessageName] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [previewName, setPreviewName] = useState("João");

  const insertVariable = (variable: string) => {
    setMessageContent((prev) => prev + `{{${variable}}}`);
  };

  const getPreviewContent = () => {
    return messageContent.replace(/\{\{nome\}\}/gi, previewName);
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between animate-slide-up">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mensagens</h1>
            <p className="mt-1 text-muted-foreground">
              Crie e gerencie seus templates de mensagem
            </p>
          </div>
          <Button variant="gradient" onClick={() => setActiveTab("create")}>
            <Plus className="h-4 w-4" />
            Nova Mensagem
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="list">Mensagens Salvas</TabsTrigger>
            <TabsTrigger value="create">Criar Mensagem</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4 mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {mockMessages.map((message, index) => (
                <Card
                  key={message.id}
                  className="transition-all duration-200 hover:shadow-elevated animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{message.name}</CardTitle>
                        <CardDescription>{message.createdAt}</CardDescription>
                      </div>
                      {message.hasMedia && (
                        <Badge variant="secondary" className="capitalize">
                          {message.mediaType === "image" && <Image className="h-3 w-3 mr-1" />}
                          {message.mediaType === "video" && <Video className="h-3 w-3 mr-1" />}
                          {message.mediaType === "audio" && <Mic className="h-3 w-3 mr-1" />}
                          {message.mediaType}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {message.content}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit className="h-3 w-3" />
                        Editar
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="create" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Editor */}
              <Card className="animate-fade-in shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Editor de Mensagem
                  </CardTitle>
                  <CardDescription>
                    Crie sua mensagem personalizada com variáveis
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="messageName">Nome da Mensagem</Label>
                    <Input
                      id="messageName"
                      placeholder="Ex: Boas-vindas"
                      value={messageName}
                      onChange={(e) => setMessageName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="messageContent">Conteúdo</Label>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => insertVariable("nome")}
                        >
                          <Variable className="h-3 w-3 mr-1" />
                          Nome
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      id="messageContent"
                      placeholder="Digite sua mensagem aqui... Use {{nome}} para personalizar"
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      className="min-h-[150px] resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use <code className="rounded bg-muted px-1">{"{{nome}}"}</code> para
                      inserir o nome do contato
                    </p>
                  </div>

                  {/* Media Upload */}
                  <div className="space-y-2">
                    <Label>Mídia (Opcional)</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button variant="outline" className="h-20 flex-col gap-2">
                        <Image className="h-5 w-5 text-muted-foreground" />
                        <span className="text-xs">Imagem</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex-col gap-2">
                        <Video className="h-5 w-5 text-muted-foreground" />
                        <span className="text-xs">Vídeo</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex-col gap-2">
                        <Mic className="h-5 w-5 text-muted-foreground" />
                        <span className="text-xs">Áudio</span>
                      </Button>
                    </div>
                  </div>

                  <Button variant="gradient" className="w-full">
                    <FileText className="h-4 w-4" />
                    Salvar Mensagem
                  </Button>
                </CardContent>
              </Card>

              {/* Preview */}
              <Card className="animate-fade-in shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" />
                    Preview da Mensagem
                  </CardTitle>
                  <CardDescription>
                    Veja como sua mensagem vai aparecer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="previewName">Nome para preview</Label>
                      <Input
                        id="previewName"
                        value={previewName}
                        onChange={(e) => setPreviewName(e.target.value)}
                        placeholder="Nome do contato"
                      />
                    </div>

                    {/* WhatsApp-style preview */}
                    <div className="rounded-xl bg-[#e5ddd5] p-4">
                      <div className="flex justify-end">
                        <div className="max-w-[80%] rounded-lg bg-[#dcf8c6] px-3 py-2 shadow-sm">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">
                            {getPreviewContent() || "Digite sua mensagem para ver o preview..."}
                          </p>
                          <p className="mt-1 text-right text-[10px] text-gray-500">
                            12:00 ✓✓
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-accent/50 p-3">
                      <p className="text-xs text-muted-foreground">
                        <strong>Dica:</strong> As variáveis serão substituídas
                        automaticamente pelos dados de cada contato no momento do
                        envio.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Mensagens;

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUpload } from "@/hooks/use-upload";
import { toast } from "sonner";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link,
  Image,
  Type,
  Palette,
  Undo,
  Redo,
  Code,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Loader2,
  Eye,
  Pencil,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichEmailEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px", "48px"];

const COLORS = [
  "#000000", "#333333", "#555555", "#777777", "#999999", "#BBBBBB", "#DDDDDD", "#FFFFFF",
  "#E53935", "#D81B60", "#8E24AA", "#5E35B1", "#3949AB", "#1E88E5", "#039BE5", "#00ACC1",
  "#00897B", "#43A047", "#7CB342", "#C0CA33", "#FDD835", "#FFB300", "#FB8C00", "#F4511E",
];

const BG_COLORS = [
  "transparent", "#FFFFFF", "#F5F5F5", "#EEEEEE", "#E0E0E0",
  "#FFEBEE", "#FCE4EC", "#F3E5F5", "#EDE7F9", "#E8EAF6", "#E3F2FD", "#E1F5FE", "#E0F7FA",
  "#E0F2F1", "#E8F5E9", "#F1F8E9", "#F9FBE7", "#FFFDE7", "#FFF8E1", "#FFF3E0", "#FBE9E7",
];

export function RichEmailEditor({ value, onChange, placeholder, className }: RichEmailEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const { uploadFile, isUploading } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    syncContent();
  }, []);

  const syncContent = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    syncContent();
  }, [syncContent]);

  const insertLink = () => {
    if (linkUrl) {
      execCommand("createLink", linkUrl);
      setLinkUrl("");
      setLinkOpen(false);
    }
  };

  const insertImage = (url: string) => {
    if (url) {
      execCommand("insertHTML", `<img src="${url}" alt="Imagem" style="max-width: 100%; height: auto; margin: 10px 0;" />`);
      setImageUrl("");
      setImageOpen(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas");
      return;
    }

    try {
      const url = await uploadFile(file);
      if (url) {
        insertImage(url);
        toast.success("Imagem inserida!");
      }
    } catch (error) {
      toast.error("Erro ao carregar imagem");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const ToolbarButton = ({ icon: Icon, onClick, title, active = false }: { 
    icon: React.ElementType; 
    onClick: () => void; 
    title: string;
    active?: boolean;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-8 w-8 p-0", active && "bg-muted")}
      onClick={onClick}
      title={title}
      type="button"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );

  return (
    <div className={cn("border rounded-lg overflow-hidden bg-background", className)}>
      {/* Toolbar */}
      <div className="border-b bg-muted/30 p-1">
        <div className="flex flex-wrap items-center gap-0.5">
          {/* Undo/Redo */}
          <ToolbarButton icon={Undo} onClick={() => execCommand("undo")} title="Desfazer" />
          <ToolbarButton icon={Redo} onClick={() => execCommand("redo")} title="Refazer" />
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          {/* Headings */}
          <ToolbarButton icon={Heading1} onClick={() => execCommand("formatBlock", "h1")} title="Título 1" />
          <ToolbarButton icon={Heading2} onClick={() => execCommand("formatBlock", "h2")} title="Título 2" />
          <ToolbarButton icon={Heading3} onClick={() => execCommand("formatBlock", "h3")} title="Título 3" />
          <ToolbarButton icon={Type} onClick={() => execCommand("formatBlock", "p")} title="Parágrafo" />
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          {/* Text formatting */}
          <ToolbarButton icon={Bold} onClick={() => execCommand("bold")} title="Negrito" />
          <ToolbarButton icon={Italic} onClick={() => execCommand("italic")} title="Itálico" />
          <ToolbarButton icon={Underline} onClick={() => execCommand("underline")} title="Sublinhado" />
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          {/* Font size */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" type="button">
                <Type className="h-3 w-3 mr-1" />
                Tamanho
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-32 p-2">
              <div className="grid gap-1">
                {FONT_SIZES.map((size) => (
                  <Button
                    key={size}
                    variant="ghost"
                    size="sm"
                    className="justify-start h-7"
                    onClick={() => execCommand("fontSize", "7")}
                    type="button"
                  >
                    <span style={{ fontSize: size }}>{size}</span>
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Text color */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Cor do texto" type="button">
                <Palette className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3">
              <Label className="text-xs text-muted-foreground mb-2 block">Cor do texto</Label>
              <div className="grid grid-cols-8 gap-1">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => execCommand("foreColor", color)}
                    type="button"
                  />
                ))}
              </div>
              <Label className="text-xs text-muted-foreground mt-3 mb-2 block">Cor de fundo</Label>
              <div className="grid grid-cols-8 gap-1">
                {BG_COLORS.map((color, i) => (
                  <button
                    key={`bg-${i}`}
                    className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color === "transparent" ? "#FFF" : color }}
                    onClick={() => execCommand("hiliteColor", color)}
                    type="button"
                  >
                    {color === "transparent" && <Minus className="h-4 w-4 text-muted-foreground" />}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          {/* Alignment */}
          <ToolbarButton icon={AlignLeft} onClick={() => execCommand("justifyLeft")} title="Alinhar à esquerda" />
          <ToolbarButton icon={AlignCenter} onClick={() => execCommand("justifyCenter")} title="Centralizar" />
          <ToolbarButton icon={AlignRight} onClick={() => execCommand("justifyRight")} title="Alinhar à direita" />
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          {/* Lists */}
          <ToolbarButton icon={List} onClick={() => execCommand("insertUnorderedList")} title="Lista" />
          <ToolbarButton icon={ListOrdered} onClick={() => execCommand("insertOrderedList")} title="Lista numerada" />
          <ToolbarButton icon={Quote} onClick={() => execCommand("formatBlock", "blockquote")} title="Citação" />
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          {/* Link */}
          <Popover open={linkOpen} onOpenChange={setLinkOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Inserir link" type="button">
                <Link className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3">
              <div className="space-y-2">
                <Label>URL do link</Label>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://exemplo.com"
                />
                <Button size="sm" onClick={insertLink} className="w-full" type="button">
                  Inserir Link
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Image */}
          <Popover open={imageOpen} onOpenChange={setImageOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Inserir imagem" type="button">
                <Image className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3">
              <div className="space-y-3">
                <div>
                  <Label className="mb-2 block">Upload de imagem</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full"
                    type="button"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Image className="h-4 w-4 mr-2" />
                        Escolher arquivo
                      </>
                    )}
                  </Button>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-popover px-2 text-muted-foreground">ou</span>
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">URL da imagem</Label>
                  <Input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://exemplo.com/imagem.jpg"
                  />
                  <Button 
                    size="sm" 
                    onClick={() => insertImage(imageUrl)} 
                    className="w-full mt-2"
                    disabled={!imageUrl}
                    type="button"
                  >
                    Inserir Imagem
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          {/* View HTML */}
          <ToolbarButton icon={Code} onClick={() => {/* TODO: HTML mode */}} title="Ver HTML" />
          
          {/* Preview toggle */}
          <div className="ml-auto">
            <Button
              variant={showPreview ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1"
              onClick={() => setShowPreview(!showPreview)}
              type="button"
            >
              {showPreview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPreview ? "Editar" : "Preview"}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Editor / Preview */}
      <Tabs value={showPreview ? "preview" : "edit"} className="w-full">
        <TabsContent value="edit" className="m-0">
          <div
            ref={editorRef}
            contentEditable
            className="min-h-[300px] max-h-[500px] overflow-y-auto p-4 focus:outline-none prose prose-sm max-w-none"
            onInput={handleInput}
            onBlur={syncContent}
            dangerouslySetInnerHTML={{ __html: value }}
            data-placeholder={placeholder}
            style={{ 
              minHeight: "300px",
              wordBreak: "break-word",
            }}
          />
        </TabsContent>
        <TabsContent value="preview" className="m-0">
          <div 
            className="min-h-[300px] max-h-[500px] overflow-y-auto p-4 bg-white"
            dangerouslySetInnerHTML={{ __html: value }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Type,
  Image,
  Video,
  Mic,
  FileText,
  Images,
  MousePointerClick,
  List,
  BarChart3,
} from "lucide-react";
import { MessageItemType } from "./MessageItemEditor";

interface AddMessageButtonProps {
  onAdd: (type: MessageItemType) => void;
  /** Quando true, exibe opções interativas exclusivas do UAZAPI (botões/lista/enquete) */
  isUazapi?: boolean;
}

export function AddMessageButton({ onAdd, isUazapi = false }: AddMessageButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full border-dashed border-2 h-14 hover:border-primary hover:bg-accent transition-all"
        >
          <Plus className="h-5 w-5 mr-2" />
          Adicionar Mensagem
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuItem onClick={() => onAdd("text")} className="cursor-pointer">
          <Type className="h-4 w-4 mr-2 text-blue-500" />
          Texto
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("image")} className="cursor-pointer">
          <Image className="h-4 w-4 mr-2 text-green-500" />
          Imagem
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("gallery")} className="cursor-pointer">
          <Images className="h-4 w-4 mr-2 text-teal-500" />
          Galeria de Imagens
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onAdd("video")} className="cursor-pointer">
          <Video className="h-4 w-4 mr-2 text-purple-500" />
          Vídeo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("audio")} className="cursor-pointer">
          <Mic className="h-4 w-4 mr-2 text-orange-500" />
          Áudio
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("document")} className="cursor-pointer">
          <FileText className="h-4 w-4 mr-2 text-red-500" />
          Documento
        </DropdownMenuItem>

        {isUazapi && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Interativos (UAZAPI)
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onAdd("buttons")} className="cursor-pointer">
              <MousePointerClick className="h-4 w-4 mr-2 text-pink-500" />
              Botões (até 3)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAdd("list")} className="cursor-pointer">
              <List className="h-4 w-4 mr-2 text-indigo-500" />
              Lista interativa
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAdd("poll")} className="cursor-pointer">
              <BarChart3 className="h-4 w-4 mr-2 text-yellow-500" />
              Enquete (Poll)
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

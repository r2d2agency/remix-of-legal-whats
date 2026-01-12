import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Plus, Search, Users, FileSpreadsheet, Trash2, Eye } from "lucide-react";

interface ContactList {
  id: string;
  name: string;
  contactCount: number;
  createdAt: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  listId: string;
}

const mockLists: ContactList[] = [
  { id: "1", name: "Clientes VIP", contactCount: 250, createdAt: "10/01/2026" },
  { id: "2", name: "Leads Janeiro", contactCount: 180, createdAt: "05/01/2026" },
  { id: "3", name: "Reativação", contactCount: 420, createdAt: "01/01/2026" },
];

const mockContacts: Contact[] = [
  { id: "1", name: "João Silva", phone: "+55 11 99999-1111", listId: "1" },
  { id: "2", name: "Maria Santos", phone: "+55 11 99999-2222", listId: "1" },
  { id: "3", name: "Pedro Oliveira", phone: "+55 11 99999-3333", listId: "1" },
  { id: "4", name: "Ana Costa", phone: "+55 11 99999-4444", listId: "2" },
  { id: "5", name: "Carlos Lima", phone: "+55 11 99999-5555", listId: "2" },
];

const Contatos = () => {
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  const filteredContacts = mockContacts.filter(
    (contact) =>
      (!selectedList || contact.listId === selectedList) &&
      (contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.phone.includes(searchTerm))
  );

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between animate-slide-up">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Contatos</h1>
            <p className="mt-1 text-muted-foreground">
              Gerencie suas listas de contatos
            </p>
          </div>
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Upload className="h-4 w-4" />
                Importar Lista
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Importar Lista de Contatos</DialogTitle>
                <DialogDescription>
                  Faça upload de uma planilha com os contatos (CSV ou Excel)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="listName">Nome da Lista</Label>
                  <Input
                    id="listName"
                    placeholder="Ex: Clientes Janeiro"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Arquivo</Label>
                  <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary">
                    <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Arraste seu arquivo ou clique para selecionar
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Suporta CSV, XLS, XLSX
                    </p>
                    <Input
                      type="file"
                      accept=".csv,.xls,.xlsx"
                      className="mt-4"
                    />
                  </div>
                </div>
                <div className="rounded-lg bg-accent/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    <strong>Formato esperado:</strong> A planilha deve ter as colunas
                    "nome" e "telefone" (com código do país).
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="gradient">
                  <Upload className="h-4 w-4" />
                  Importar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lists Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card
            className={`cursor-pointer transition-all duration-200 hover:shadow-elevated animate-fade-in ${
              selectedList === null ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setSelectedList(null)}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Todos os Contatos</p>
                <p className="text-sm text-muted-foreground">
                  {mockContacts.length} contatos
                </p>
              </div>
            </CardContent>
          </Card>

          {mockLists.map((list, index) => (
            <Card
              key={list.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-elevated animate-fade-in ${
                selectedList === list.id ? "ring-2 ring-primary" : ""
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => setSelectedList(list.id)}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                    <FileSpreadsheet className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{list.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {list.contactCount} contatos
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">{list.createdAt}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Contacts Table */}
        <Card className="animate-fade-in shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {selectedList
                    ? mockLists.find((l) => l.id === selectedList)?.name
                    : "Todos os Contatos"}
                </CardTitle>
                <CardDescription>
                  {filteredContacts.length} contatos encontrados
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar contatos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Lista</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {mockLists.find((l) => l.id === contact.listId)?.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Contatos;

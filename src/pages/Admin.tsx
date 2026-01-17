import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { useSuperadmin } from '@/hooks/use-superadmin';
import { toast } from 'sonner';
import { Shield, Building2, Users, Plus, Trash2, Loader2, Pencil, Upload, Crown, Image } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  name: string;
  is_superadmin: boolean;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  member_count?: number;
  created_at: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  
  // Create org dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgLogo, setNewOrgLogo] = useState('');
  const [newOrgOwner, setNewOrgOwner] = useState('');

  // Edit org dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editOrgName, setEditOrgName] = useState('');
  const [editOrgLogo, setEditOrgLogo] = useState('');

  const { 
    loading: actionLoading,
    error,
    checkSuperadmin,
    getAllUsers,
    getAllOrganizations,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    setSuperadmin
  } = useSuperadmin();

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    const isAdmin = await checkSuperadmin();
    setIsSuperadmin(isAdmin);
    
    if (!isAdmin) {
      toast.error('Acesso negado. Apenas superadmins podem acessar esta página.');
      navigate('/');
      return;
    }
    
    loadData();
  };

  const loadData = async () => {
    setLoading(true);
    const [usersData, orgsData] = await Promise.all([
      getAllUsers(),
      getAllOrganizations()
    ]);
    setUsers(usersData);
    setOrganizations(orgsData);
    setLoading(false);
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleCreateOrg = async () => {
    if (!newOrgName || !newOrgSlug || !newOrgOwner) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const org = await createOrganization({
      name: newOrgName,
      slug: newOrgSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      logo_url: newOrgLogo || undefined,
      owner_email: newOrgOwner
    });

    if (org) {
      toast.success('Organização criada com sucesso!');
      setCreateDialogOpen(false);
      setNewOrgName('');
      setNewOrgSlug('');
      setNewOrgLogo('');
      setNewOrgOwner('');
      loadData();
    } else if (error) {
      toast.error(error);
    }
  };

  const handleUpdateOrg = async () => {
    if (!editingOrg) return;

    const updated = await updateOrganization(editingOrg.id, {
      name: editOrgName,
      logo_url: editOrgLogo || undefined
    });

    if (updated) {
      toast.success('Organização atualizada!');
      setEditDialogOpen(false);
      setEditingOrg(null);
      loadData();
    } else if (error) {
      toast.error(error);
    }
  };

  const handleDeleteOrg = async (id: string) => {
    const success = await deleteOrganization(id);
    if (success) {
      toast.success('Organização removida!');
      loadData();
    } else if (error) {
      toast.error(error);
    }
  };

  const handleToggleSuperadmin = async (userId: string, currentValue: boolean) => {
    const success = await setSuperadmin(userId, !currentValue);
    if (success) {
      toast.success(!currentValue ? 'Superadmin ativado!' : 'Superadmin removido!');
      loadData();
    } else if (error) {
      toast.error(error);
    }
  };

  const openEditDialog = (org: Organization) => {
    setEditingOrg(org);
    setEditOrgName(org.name);
    setEditOrgLogo(org.logo_url || '');
    setEditDialogOpen(true);
  };

  if (!isSuperadmin) {
    return null;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary neon-text" />
              Painel Superadmin
            </h1>
            <p className="text-muted-foreground">
              Gerencie todas as organizações e usuários do sistema
            </p>
          </div>
        </div>

        <Tabs defaultValue="organizations" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="organizations" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organizações
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
          </TabsList>

          {/* Organizations Tab */}
          <TabsContent value="organizations" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Todas as Organizações</h2>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="neon-glow">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Organização
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Criar Organização</DialogTitle>
                    <DialogDescription>
                      Crie uma nova organização e defina o proprietário
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nome da Empresa *</Label>
                      <Input
                        placeholder="Empresa XYZ"
                        value={newOrgName}
                        onChange={(e) => {
                          setNewOrgName(e.target.value);
                          setNewOrgSlug(generateSlug(e.target.value));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Slug (URL) *</Label>
                      <Input
                        placeholder="empresa-xyz"
                        value={newOrgSlug}
                        onChange={(e) => setNewOrgSlug(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email do Proprietário *</Label>
                      <Input
                        type="email"
                        placeholder="proprietario@email.com"
                        value={newOrgOwner}
                        onChange={(e) => setNewOrgOwner(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Image className="h-4 w-4" />
                        URL do Logo (opcional)
                      </Label>
                      <Input
                        placeholder="https://example.com/logo.png"
                        value={newOrgLogo}
                        onChange={(e) => setNewOrgLogo(e.target.value)}
                      />
                      {newOrgLogo && (
                        <div className="mt-2 flex justify-center">
                          <img 
                            src={newOrgLogo} 
                            alt="Preview" 
                            className="h-16 w-16 rounded-lg object-cover border border-border"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateOrg} disabled={actionLoading}>
                      {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Criar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : organizations.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhuma organização cadastrada</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Logo</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Membros</TableHead>
                        <TableHead>Criada em</TableHead>
                        <TableHead className="w-[120px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {organizations.map((org) => (
                        <TableRow key={org.id}>
                          <TableCell>
                            {org.logo_url ? (
                              <img 
                                src={org.logo_url} 
                                alt={org.name}
                                className="h-10 w-10 rounded-lg object-cover border border-border"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-primary" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{org.name}</TableCell>
                          <TableCell className="text-muted-foreground">/{org.slug}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{org.member_count || 0} membros</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(org.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => openEditDialog(org)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Deletar organização?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação é irreversível. A organização "{org.name}" e todos os dados associados serão permanentemente removidos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteOrg(org.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Deletar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <h2 className="text-xl font-semibold">Todos os Usuários</h2>
            
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum usuário cadastrado</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Superadmin</TableHead>
                        <TableHead>Cadastrado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{user.name}</span>
                              {user.is_superadmin && (
                                <Crown className="h-4 w-4 text-amber-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell>
                            <Switch
                              checked={user.is_superadmin}
                              onCheckedChange={() => handleToggleSuperadmin(user.id, user.is_superadmin)}
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Organization Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Organização</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editOrgName}
                onChange={(e) => setEditOrgName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                URL do Logo
              </Label>
              <Input
                placeholder="https://example.com/logo.png"
                value={editOrgLogo}
                onChange={(e) => setEditOrgLogo(e.target.value)}
              />
              {editOrgLogo && (
                <div className="mt-2 flex justify-center">
                  <img 
                    src={editOrgLogo} 
                    alt="Preview" 
                    className="h-16 w-16 rounded-lg object-cover border border-border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateOrg} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
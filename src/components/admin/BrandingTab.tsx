import { useState, useRef } from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminSettings, applyThemeColors } from '@/hooks/use-branding';
import { useUpload } from '@/hooks/use-upload';
import { toast } from 'sonner';
import { Upload, Loader2, Trash2, Image, Layout, Star, Save, Building2 } from 'lucide-react';
import { ThemeCustomizer } from './ThemeCustomizer';

interface LogoUploaderProps {
  label: string;
  description: string;
  settingKey: string;
  currentValue: string | null;
  onUpdate: (key: string, value: string | null) => Promise<void>;
  aspectHint?: string;
}

function LogoUploader({ label, description, settingKey, currentValue, onUpdate, aspectHint }: LogoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload();
  const [updating, setUpdating] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadFile(file);
      if (url) {
        setUpdating(true);
        await onUpdate(settingKey, url);
        toast.success(`${label} atualizado!`);
      }
    } catch (error) {
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUpdating(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    try {
      setUpdating(true);
      await onUpdate(settingKey, null);
      toast.success(`${label} removido`);
    } catch (error) {
      toast.error('Erro ao remover');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        {currentValue ? (
          <div className="space-y-3">
            <div className="relative rounded-lg border bg-muted/50 p-4 flex items-center justify-center min-h-[120px]">
              <img
                src={currentValue}
                alt={label}
                className="max-h-24 max-w-full object-contain"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || updating}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Alterar
              </Button>
              <Button
                variant="outline"
                onClick={handleRemove}
                disabled={updating}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full h-28 border-dashed flex flex-col gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || updating}
          >
            {isUploading || updating ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-xs">Enviando...</span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6" />
                <span className="text-xs">Clique para fazer upload</span>
                {aspectHint && <span className="text-xs text-muted-foreground">{aspectHint}</span>}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function CompanyNameEditor({ currentValue, onUpdate }: { currentValue: string | null; onUpdate: (key: string, value: string | null) => Promise<void> }) {
  const [name, setName] = useState(currentValue || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate('company_name', name || null);
      toast.success('Nome da empresa atualizado!');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Nome da Empresa
        </CardTitle>
        <CardDescription>Exibido na barra superior central</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Minha Empresa LTDA"
        />
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

export function BrandingTab() {
  const { settings, updateSetting } = useAdminSettings();

  const getSetting = (key: string) => {
    const setting = settings.find(s => s.key === key);
    return setting?.value || null;
  };

  const handleUpdate = async (key: string, value: string | null) => {
    await updateSetting(key, value);
  };

  return (
    <TabsContent value="branding" className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Branding</h2>
        <p className="text-sm text-muted-foreground">
          Personalize as logos, ícones e identidade do sistema
        </p>
      </div>

      {/* Company Identity Section */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Identidade da Empresa</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <CompanyNameEditor
            currentValue={getSetting('company_name')}
            onUpdate={handleUpdate}
          />

          <LogoUploader
            label="Logo da Barra Superior"
            description="Exibida ao lado do nome da empresa"
            settingKey="logo_topbar"
            currentValue={getSetting('logo_topbar')}
            onUpdate={handleUpdate}
            aspectHint="Recomendado: 32x32px"
          />
        </div>
      </div>

      {/* Logos Section */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Logos do Sistema</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <LogoUploader
            label="Logo do Login"
            description="Exibida na tela de login"
            settingKey="logo_login"
            currentValue={getSetting('logo_login')}
            onUpdate={handleUpdate}
            aspectHint="Recomendado: 200x60px"
          />

          <LogoUploader
            label="Ícone da Sidebar"
            description="Exibido no topo da barra lateral"
            settingKey="logo_sidebar"
            currentValue={getSetting('logo_sidebar')}
            onUpdate={handleUpdate}
            aspectHint="Recomendado: 40x40px"
          />

          <LogoUploader
            label="Favicon"
            description="Ícone da aba do navegador"
            settingKey="favicon"
            currentValue={getSetting('favicon')}
            onUpdate={handleUpdate}
            aspectHint="Recomendado: 32x32px ICO/PNG"
          />
        </div>
      </div>

      {/* Theme Colors Section */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Cores e Tema</h3>
        <ThemeCustomizer
          currentPreset={getSetting('theme_preset')}
          currentCustomColors={getSetting('theme_custom_colors')}
          onSave={async (preset, customColors) => {
            await handleUpdate('theme_preset', preset);
            await handleUpdate('theme_custom_colors', customColors);
            applyThemeColors(preset, customColors);
          }}
        />
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 py-4">
          <Star className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-500">Dica</p>
            <p className="text-muted-foreground">
              Após alterar as logos ou cores, os usuários precisam atualizar a página (F5) para ver as mudanças.
              O favicon pode demorar um pouco mais para atualizar devido ao cache do navegador.
            </p>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

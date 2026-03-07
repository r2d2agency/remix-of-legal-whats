import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { THEME_PRESETS, ThemeColors, ThemeModeColors, applyThemeColors, parseThemeColors } from '@/hooks/use-branding';
import { toast } from 'sonner';
import { Check, Loader2, Palette, RotateCcw, Save, Paintbrush, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemeCustomizerProps {
  currentPreset: string | null;
  currentCustomColors: string | null;
  onSave: (preset: string, customColors: string | null) => Promise<void>;
}

function hslToHex(hsl: string): string {
  const parts = hsl.trim().split(/\s+/);
  const h = parseFloat(parts[0]) || 0;
  const s = (parseFloat(parts[1]) || 0) / 100;
  const l = (parseFloat(parts[2]) || 0) / 100;

  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): string {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const DEFAULT_LIGHT: ThemeModeColors = THEME_PRESETS.default.colors.light;
const DEFAULT_DARK: ThemeModeColors = THEME_PRESETS.default.colors.dark;

function ColorPickerGroup({ colors, onChange, mode }: {
  colors: ThemeModeColors;
  onChange: (field: keyof ThemeModeColors, hex: string) => void;
  mode: 'light' | 'dark';
}) {
  const fields: { key: keyof ThemeModeColors; label: string }[] = [
    { key: 'primary', label: 'Cor Principal' },
    { key: 'secondary', label: 'Secundária' },
    { key: 'accent', label: 'Destaque' },
    { key: 'sidebar', label: 'Sidebar' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {fields.map(({ key, label }) => (
          <div key={key} className="space-y-2">
            <Label className="text-xs">{label}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hslToHex(colors[key])}
                onChange={(e) => onChange(key, e.target.value)}
                className="w-10 h-10 rounded-md cursor-pointer border-2 border-border"
              />
              <Input
                value={hslToHex(colors[key])}
                onChange={(e) => {
                  if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                    onChange(key, e.target.value);
                  }
                }}
                className="h-8 text-xs font-mono"
                placeholder="#000000"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Preview */}
      <div className={cn(
        "rounded-lg border p-4 space-y-2",
        mode === 'dark' ? "bg-[#1a1a2e]" : "bg-[#f5f5f5]"
      )}>
        <Label className={cn("text-xs", mode === 'dark' ? "text-gray-400" : "text-gray-500")}>
          Pré-visualização ({mode === 'dark' ? 'Escuro' : 'Claro'})
        </Label>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg" style={{ backgroundColor: `hsl(${colors.primary})` }} />
          <div className="h-10 w-10 rounded-lg" style={{ backgroundColor: `hsl(${colors.secondary})` }} />
          <div className="h-10 w-10 rounded-lg" style={{ backgroundColor: `hsl(${colors.accent})` }} />
          <div className="h-10 w-10 rounded-lg" style={{ backgroundColor: `hsl(${colors.sidebar})` }} />
          <div className="flex-1 space-y-1">
            <div className="h-2 rounded-full w-3/4" style={{ backgroundColor: `hsl(${colors.primary})` }} />
            <div className="h-2 rounded-full w-1/2" style={{ backgroundColor: `hsl(${colors.secondary})` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThemeCustomizer({ currentPreset, currentCustomColors, onSave }: ThemeCustomizerProps) {
  const [selectedPreset, setSelectedPreset] = useState(currentPreset || 'default');
  const [customColors, setCustomColors] = useState<ThemeColors>(() => {
    if (currentCustomColors) {
      const parsed = parseThemeColors(currentCustomColors);
      if (parsed) return parsed;
    }
    return THEME_PRESETS.default.colors;
  });
  const [saving, setSaving] = useState(false);
  const [showCustom, setShowCustom] = useState(currentPreset === 'custom');

  useEffect(() => {
    setSelectedPreset(currentPreset || 'default');
    setShowCustom(currentPreset === 'custom');
    if (currentCustomColors) {
      const parsed = parseThemeColors(currentCustomColors);
      if (parsed) setCustomColors(parsed);
    }
  }, [currentPreset, currentCustomColors]);

  const handlePresetClick = (key: string) => {
    setSelectedPreset(key);
    setShowCustom(false);
    applyThemeColors(key, null);
  };

  const handleCustomColorChange = (mode: 'light' | 'dark', field: keyof ThemeModeColors, hex: string) => {
    const hsl = hexToHsl(hex);
    const updated = {
      ...customColors,
      [mode]: {
        ...customColors[mode],
        [field]: hsl,
        ...(field === 'primary' ? { sidebar: hsl } : {}),
      },
    };
    setCustomColors(updated);
    applyThemeColors('custom', JSON.stringify(updated));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const preset = showCustom ? 'custom' : selectedPreset;
      const colors = showCustom ? JSON.stringify(customColors) : null;
      await onSave(preset, colors);
      toast.success('Tema salvo com sucesso!');
    } catch {
      toast.error('Erro ao salvar tema');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedPreset('default');
    setShowCustom(false);
    applyThemeColors('default', null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Templates de Cores
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(THEME_PRESETS).map(([key, preset]) => (
            <Card
              key={key}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md relative overflow-hidden",
                selectedPreset === key && !showCustom && "ring-2 ring-primary shadow-md"
              )}
              onClick={() => handlePresetClick(key)}
            >
              <CardContent className="p-3">
                <div className="flex gap-1 mb-2">
                  {preset.preview.map((color, i) => (
                    <div
                      key={i}
                      className="h-6 flex-1 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate">{preset.name}</span>
                  {selectedPreset === key && !showCustom && (
                    <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Custom Color Section */}
      <Card className={cn(
        "transition-all",
        showCustom && "ring-2 ring-primary"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Paintbrush className="h-4 w-4" />
                Cores Personalizadas
              </CardTitle>
              <CardDescription>Escolha cores separadas para tema claro e escuro</CardDescription>
            </div>
            <Button
              variant={showCustom ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowCustom(true);
                setSelectedPreset('custom');
                applyThemeColors('custom', JSON.stringify(customColors));
              }}
            >
              {showCustom ? <Check className="h-4 w-4 mr-1" /> : null}
              {showCustom ? 'Selecionado' : 'Personalizar'}
            </Button>
          </div>
        </CardHeader>
        {showCustom && (
          <CardContent>
            <Tabs defaultValue="light" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="light" className="flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  Tema Claro
                </TabsTrigger>
                <TabsTrigger value="dark" className="flex items-center gap-2">
                  <Moon className="h-4 w-4" />
                  Tema Escuro
                </TabsTrigger>
              </TabsList>
              <TabsContent value="light">
                <ColorPickerGroup
                  colors={customColors.light}
                  onChange={(field, hex) => handleCustomColorChange('light', field, hex)}
                  mode="light"
                />
              </TabsContent>
              <TabsContent value="dark">
                <ColorPickerGroup
                  colors={customColors.dark}
                  onChange={(field, hex) => handleCustomColorChange('dark', field, hex)}
                  mode="dark"
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        )}
      </Card>

      {/* Save / Reset */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Tema
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={saving}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Restaurar Padrão
        </Button>
      </div>
    </div>
  );
}

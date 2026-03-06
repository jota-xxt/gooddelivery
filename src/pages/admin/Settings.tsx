import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Settings, Percent, Info } from 'lucide-react';

const AdminSettings = () => {
  const [fee, setFee] = useState(10);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'platform_fee_percentage').maybeSingle()
      .then(({ data }) => { if (data) setFee(Number(data.value)); setPageLoading(false); });
  }, []);

  const save = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('app_settings')
      .update({ value: String(fee) })
      .eq('key', 'platform_fee_percentage');
    setLoading(false);
    if (error) toast.error('Erro ao salvar');
    else toast.success('Configuração salva!');
  };

  if (pageLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 max-w-lg rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Configurações</h1>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Percent className="h-4 w-4 text-primary" />
            Taxa da Plataforma
          </CardTitle>
          <CardDescription>
            Porcentagem cobrada sobre cada entrega como taxa de serviço da plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Porcentagem</Label>
              <Badge variant="outline" className="text-lg font-bold px-3 py-1">
                {fee}%
              </Badge>
            </div>
            <Slider
              value={[fee]}
              onValueChange={([v]) => setFee(v)}
              min={0}
              max={50}
              step={1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent text-accent-foreground text-sm">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>A taxa será aplicada automaticamente ao calcular os repasses financeiros semanais.</p>
          </div>

          <Button onClick={save} disabled={loading} className="w-full">
            {loading ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings;

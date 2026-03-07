import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Settings, Percent, Info, Users, ListOrdered, ShieldAlert } from 'lucide-react';

const AdminSettings = () => {
  const [fee, setFee] = useState(10);
  const [deliveryMode, setDeliveryMode] = useState<'pool' | 'queue'>('pool');
  const [penaltyThreshold, setPenaltyThreshold] = useState(3);
  const [penaltyDuration, setPenaltyDuration] = useState(30);
  const [loading, setLoading] = useState(false);
  const [modeLoading, setModeLoading] = useState(false);
  const [penaltyLoading, setPenaltyLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('app_settings').select('key, value').in('key', ['platform_fee_percentage', 'delivery_mode', 'queue_penalty_threshold', 'queue_penalty_duration_minutes']),
    ]).then(([{ data }]) => {
      if (data) {
        const feeRow = data.find(r => r.key === 'platform_fee_percentage');
        const modeRow = data.find(r => r.key === 'delivery_mode');
        const thresholdRow = data.find(r => r.key === 'queue_penalty_threshold');
        const durationRow = data.find(r => r.key === 'queue_penalty_duration_minutes');
        if (feeRow) setFee(Number(feeRow.value));
        if (modeRow) setDeliveryMode(modeRow.value as 'pool' | 'queue');
        if (thresholdRow) setPenaltyThreshold(Number(thresholdRow.value));
        if (durationRow) setPenaltyDuration(Number(durationRow.value));
      }
      setPageLoading(false);
    });
  }, []);

  const saveFee = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('app_settings')
      .update({ value: String(fee) })
      .eq('key', 'platform_fee_percentage');
    setLoading(false);
    if (error) toast.error('Erro ao salvar');
    else toast.success('Configuração salva!');
  };

  const toggleDeliveryMode = async () => {
    const newMode = deliveryMode === 'pool' ? 'queue' : 'pool';
    setModeLoading(true);
    const { error } = await supabase
      .from('app_settings')
      .update({ value: newMode })
      .eq('key', 'delivery_mode');
    setModeLoading(false);
    if (error) {
      toast.error('Erro ao alterar modo');
    } else {
      setDeliveryMode(newMode);
      toast.success(newMode === 'queue' ? 'Modo Fila ativado!' : 'Modo Pool ativado!');
    }
  };

  const savePenalty = async () => {
    setPenaltyLoading(true);
    const [r1, r2] = await Promise.all([
      supabase.from('app_settings').update({ value: String(penaltyThreshold) }).eq('key', 'queue_penalty_threshold'),
      supabase.from('app_settings').update({ value: String(penaltyDuration) }).eq('key', 'queue_penalty_duration_minutes'),
    ]);
    setPenaltyLoading(false);
    if (r1.error || r2.error) toast.error('Erro ao salvar punição');
    else toast.success('Configurações de punição salvas!');
  };

  if (pageLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 max-w-lg rounded-xl" />
        <Skeleton className="h-48 max-w-lg rounded-xl" />
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

      {/* Delivery Mode */}
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {deliveryMode === 'queue' ? (
              <ListOrdered className="h-4 w-4 text-primary" />
            ) : (
              <Users className="h-4 w-4 text-primary" />
            )}
            Modo de Distribuição
          </CardTitle>
          <CardDescription>
            Como as corridas são distribuídas para os entregadores.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">
                {deliveryMode === 'queue' ? 'Fila' : 'Pool Aberto'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {deliveryMode === 'queue'
                  ? 'Corridas são oferecidas uma a uma ao próximo da fila.'
                  : 'Todos os entregadores online veem todas as corridas.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={deliveryMode === 'queue' ? 'default' : 'secondary'}>
                {deliveryMode === 'queue' ? 'Fila' : 'Pool'}
              </Badge>
              <Switch
                checked={deliveryMode === 'queue'}
                onCheckedChange={toggleDeliveryMode}
                disabled={modeLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-lg border-2 transition-colors ${deliveryMode === 'pool' ? 'border-primary bg-primary/5' : 'border-muted'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Pool Aberto</span>
              </div>
              <p className="text-xs text-muted-foreground">Primeiro a aceitar leva a corrida</p>
            </div>
            <div className={`p-3 rounded-lg border-2 transition-colors ${deliveryMode === 'queue' ? 'border-primary bg-primary/5' : 'border-muted'}`}>
              <div className="flex items-center gap-2 mb-1">
                <ListOrdered className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Fila</span>
              </div>
              <p className="text-xs text-muted-foreground">Distribuição justa por ordem de chegada</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent text-accent-foreground text-sm">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              {deliveryMode === 'queue'
                ? 'No modo fila, cada corrida é oferecida ao próximo entregador por 60 segundos. Se rejeitada ou expirada, vai para o próximo.'
                : 'No modo pool, todas as corridas ficam visíveis para todos os entregadores online. O mais rápido aceita.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Penalty Settings */}
      {deliveryMode === 'queue' && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Punição por Inatividade
            </CardTitle>
            <CardDescription>
              Bloqueia temporariamente entregadores que recusam ou perdem ofertas repetidamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Limite de infrações (24h)</Label>
                <Badge variant="outline" className="text-lg font-bold px-3 py-1">
                  {penaltyThreshold}x
                </Badge>
              </div>
              <Slider
                value={[penaltyThreshold]}
                onValueChange={([v]) => setPenaltyThreshold(v)}
                min={1}
                max={10}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1x</span>
                <span>5x</span>
                <span>10x</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Tempo de bloqueio</Label>
                <Badge variant="outline" className="text-lg font-bold px-3 py-1">
                  {penaltyDuration} min
                </Badge>
              </div>
              <Slider
                value={[penaltyDuration]}
                onValueChange={([v]) => setPenaltyDuration(v)}
                min={5}
                max={120}
                step={5}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5 min</span>
                <span>60 min</span>
                <span>120 min</span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-accent text-accent-foreground text-sm">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>Se um entregador recusar ou perder {penaltyThreshold} ofertas em 24h, será bloqueado por {penaltyDuration} minutos.</p>
            </div>

            <Button onClick={savePenalty} disabled={penaltyLoading} className="w-full">
              {penaltyLoading ? 'Salvando...' : 'Salvar Punição'}
            </Button>
          </CardContent>
        </Card>
      )}

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

          <Button onClick={saveFee} disabled={loading} className="w-full">
            {loading ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings;

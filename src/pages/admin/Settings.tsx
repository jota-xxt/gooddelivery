import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const AdminSettings = () => {
  const [fee, setFee] = useState('10');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'platform_fee_percentage').single()
      .then(({ data }) => { if (data) setFee(data.value); });
  }, []);

  const save = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('app_settings')
      .update({ value: fee })
      .eq('key', 'platform_fee_percentage');
    setLoading(false);
    if (error) toast.error('Erro ao salvar');
    else toast.success('Configuração salva!');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Taxa da Plataforma</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Porcentagem (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
          </div>
          <Button onClick={save} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings;

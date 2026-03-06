import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Truck } from 'lucide-react';

type UserType = 'driver' | 'establishment';

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'type' | 'form'>('type');
  const [userType, setUserType] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(false);

  // Common
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // Driver
  const [cpf, setCpf] = useState('');
  const [vehicleType, setVehicleType] = useState<string>('motorcycle');
  const [plate, setPlate] = useState('');

  // Establishment
  const [businessName, setBusinessName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [address, setAddress] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userType) return;
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          role: userType,
        },
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      toast.error('Erro ao criar conta');
      setLoading(false);
      return;
    }

    if (userType === 'driver') {
      const { error: driverError } = await supabase.from('drivers').insert({
        user_id: userId,
        cpf,
        phone,
        vehicle_type: vehicleType as 'motorcycle' | 'bicycle' | 'car',
        plate: plate || null,
      });
      if (driverError) {
        toast.error('Erro ao salvar dados do entregador');
        setLoading(false);
        return;
      }
    } else {
      const { error: estError } = await supabase.from('establishments').insert({
        user_id: userId,
        business_name: businessName,
        cnpj,
        address,
        phone,
        responsible_name: fullName,
      });
      if (estError) {
        toast.error('Erro ao salvar dados do estabelecimento');
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    toast.success('Conta criada! Aguarde aprovação do administrador.');
    navigate('/pending-approval');
  };

  if (step === 'type') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <Truck className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">Cadastro</CardTitle>
            <CardDescription>Selecione o tipo de conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-20 flex flex-col gap-1 text-left"
              onClick={() => { setUserType('driver'); setStep('form'); }}
            >
              <span className="font-semibold text-base">🏍️ Entregador</span>
              <span className="text-xs text-muted-foreground">Quero fazer entregas</span>
            </Button>
            <Button
              variant="outline"
              className="w-full h-20 flex flex-col gap-1 text-left"
              onClick={() => { setUserType('establishment'); setStep('form'); }}
            >
              <span className="font-semibold text-base">🏪 Estabelecimento</span>
              <span className="text-xs text-muted-foreground">Quero solicitar entregas</span>
            </Button>
            <div className="text-center text-sm text-muted-foreground pt-4">
              Já tem uma conta?{' '}
              <Link to="/login" className="font-semibold text-primary hover:underline">Entrar</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-xl font-bold">
            {userType === 'driver' ? '🏍️ Cadastro Entregador' : '🏪 Cadastro Estabelecimento'}
          </CardTitle>
          <CardDescription>Preencha seus dados</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" required />
            </div>

            {userType === 'driver' && (
              <>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" required />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de veículo</Label>
                  <Select value={vehicleType} onValueChange={setVehicleType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="motorcycle">Moto</SelectItem>
                      <SelectItem value="bicycle">Bicicleta</SelectItem>
                      <SelectItem value="car">Carro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Placa (se aplicável)</Label>
                  <Input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="ABC-1234" />
                </div>
              </>
            )}

            {userType === 'establishment' && (
              <>
                <div className="space-y-2">
                  <Label>Nome do negócio</Label>
                  <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" required />
                </div>
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} required />
                </div>
              </>
            )}

            <Button type="submit" className="w-full font-semibold" disabled={loading}>
              {loading ? 'Cadastrando...' : 'Criar conta'}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('type')}>
              ← Voltar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;

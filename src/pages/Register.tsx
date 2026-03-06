import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Truck, Bike, ArrowLeft, Mail, Lock, User, Phone, FileText, Building2, MapPin, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [vehicleType, setVehicleType] = useState<'motorcycle' | 'bicycle'>('motorcycle');

  // Establishment
  const [businessName, setBusinessName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [address, setAddress] = useState('');

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userType) return;
    setLoading(true);

    try {
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

      await new Promise(resolve => setTimeout(resolve, 500));

      if (userType === 'driver') {
        const { error: driverError } = await supabase.from('drivers').insert({
          user_id: userId,
          cpf,
          phone,
          vehicle_type: vehicleType,
        });
        if (driverError) {
          console.error('Driver insert error:', driverError);
          toast.error('Erro ao salvar dados do entregador: ' + driverError.message);
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
          console.error('Establishment insert error:', estError);
          toast.error('Erro ao salvar dados do estabelecimento: ' + estError.message);
          setLoading(false);
          return;
        }
      }

      toast.success('Conta criada! Aguarde aprovação do administrador.');
      navigate('/pending-approval');
    } catch (err) {
      console.error('Registration error:', err);
      toast.error('Erro inesperado ao cadastrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'type') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
              <Truck className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Criar conta</h1>
            <p className="text-muted-foreground">Como você quer usar a plataforma?</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => { setUserType('driver'); setStep('form'); }}
              className="w-full group relative overflow-hidden rounded-xl border-2 border-border bg-card p-5 text-left transition-all hover:border-primary hover:shadow-lg"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Bike className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Entregador</p>
                  <p className="text-sm text-muted-foreground">Faça entregas e ganhe dinheiro</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => { setUserType('establishment'); setStep('form'); }}
              className="w-full group relative overflow-hidden rounded-xl border-2 border-border bg-card p-5 text-left transition-all hover:border-primary hover:shadow-lg"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Estabelecimento</p>
                  <p className="text-sm text-muted-foreground">Solicite entregas para seus clientes</p>
                </div>
              </div>
            </button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Já tem uma conta?{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">Entrar</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="space-y-1 pb-4">
          <button
            type="button"
            onClick={() => setStep('type')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              "bg-primary text-primary-foreground"
            )}>
              {userType === 'driver' ? <Bike className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
            </div>
            <div>
              <CardTitle className="text-lg font-bold">
                {userType === 'driver' ? 'Cadastro Entregador' : 'Cadastro Estabelecimento'}
              </CardTitle>
              <CardDescription className="text-xs">Preencha seus dados para começar</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-3">
            {/* Common fields */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" required />
              </div>
            </div>

            {/* Driver fields */}
            {userType === 'driver' && (
              <>
                <div className="border-t border-border pt-3 mt-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados do entregador</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">CPF</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tipo de veículo</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVehicleType('motorcycle')}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all",
                        vehicleType === 'motorcycle'
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
                      )}
                    >
                      <span className="text-2xl">🏍️</span>
                      <span className="text-xs font-medium">Moto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVehicleType('bicycle')}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all",
                        vehicleType === 'bicycle'
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
                      )}
                    >
                      <span className="text-2xl">🚲</span>
                      <span className="text-xs font-medium">Bicicleta</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Establishment fields */}
            {userType === 'establishment' && (
              <>
                <div className="border-t border-border pt-3 mt-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dados do estabelecimento</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Nome do negócio</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Nome da sua empresa" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">CNPJ</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" value={cnpj} onChange={(e) => setCnpj(formatCnpj(e.target.value))} placeholder="00.000.000/0001-00" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Endereço</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro" required />
                  </div>
                </div>
              </>
            )}

            <div className="pt-2">
              <Button type="submit" className="w-full font-semibold h-11" disabled={loading}>
                {loading ? 'Cadastrando...' : 'Criar conta'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;

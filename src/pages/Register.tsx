import { useState, useCallback } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Bike, ArrowLeft, User, Mail, Lock, Phone, FileText, Building2, MapPin, ChevronRight, LocateFixed } from 'lucide-react';
import logo from '@/assets/logo.png';
import MapPicker from '@/components/MapPicker';

type UserType = 'driver' | 'establishment';
type VehicleType = 'motorcycle' | 'bicycle';

const Register = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(false);

  // Common
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // Driver
  const [cpf, setCpf] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('motorcycle');

  // Establishment
  const [businessName, setBusinessName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);

  const formatPhone = useCallback((value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }, []);

  const formatCpf = useCallback((value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }, []);

  const formatCnpj = useCallback((value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }, []);

  const canAdvance = () => {
    if (step === 0) return !!userType;
    if (step === 1) return fullName.trim().length >= 3 && email.includes('@') && password.length >= 6 && phone.replace(/\D/g, '').length >= 10;
    if (step === 2) {
      if (userType === 'driver') return cpf.replace(/\D/g, '').length === 11;
      return businessName.trim().length >= 2 && cnpj.replace(/\D/g, '').length === 14 && address.trim().length >= 5 && latitude !== null && longitude !== null;
    }
    return false;
  };

  const handleRegister = async () => {
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
          latitude,
          longitude,
        });
        if (estError) {
          console.error('Establishment insert error:', estError);
          toast.error('Erro ao salvar dados do estabelecimento: ' + estError.message);
          setLoading(false);
          return;
        }
      }

      // Send WhatsApp notification
      const cleanPhone = phone.replace(/\D/g, '');
      const whatsappPhone = cleanPhone.length === 11 ? `55${cleanPhone}` : cleanPhone;
      supabase.functions.invoke('send-whatsapp', {
        body: {
          phone: whatsappPhone,
          template: 'registration_received',
          vars: { name: fullName },
        },
      }).catch(() => {});

      toast.success('Conta criada! Aguarde aprovação do administrador.');
      navigate('/pending-approval');
    } catch (err) {
      console.error('Registration error:', err);
      toast.error('Erro inesperado ao cadastrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Redirect if already logged in
  if (!authLoading && user) return <Navigate to="/" replace />;

  const totalSteps = 3;
  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md border-0 shadow-xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <CardHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto">
            <img src={logo} alt="Good Delivery" className="h-16 w-16 object-contain rounded-2xl" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">
              {step === 0 && 'Como deseja usar o app?'}
              {step === 1 && 'Seus dados'}
              {step === 2 && userType === 'driver' && 'Dados do entregador'}
              {step === 2 && userType === 'establishment' && 'Dados do negócio'}
            </CardTitle>
            <CardDescription className="mt-1">
              {step === 0 && 'Escolha seu perfil para começar'}
              {step === 1 && 'Informações básicas da conta'}
              {step === 2 && `Etapa ${step + 1} de ${totalSteps} — quase lá!`}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-2 pb-6">
          {/* Step 0: Choose type */}
          {step === 0 && (
            <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
              <button
                type="button"
                onClick={() => setUserType('driver')}
                className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                  userType === 'driver'
                    ? 'border-primary bg-accent shadow-sm'
                    : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                }`}
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                  userType === 'driver' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                } transition-colors`}>
                  <Bike className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Entregador</p>
                  <p className="text-sm text-muted-foreground">Quero fazer entregas e ganhar dinheiro</p>
                </div>
                {userType === 'driver' && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setUserType('establishment')}
                className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                  userType === 'establishment'
                    ? 'border-primary bg-accent shadow-sm'
                    : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                }`}
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                  userType === 'establishment' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                } transition-colors`}>
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Estabelecimento</p>
                  <p className="text-sm text-muted-foreground">Quero solicitar entregas para meus clientes</p>
                </div>
                {userType === 'establishment' && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                  </div>
                )}
              </button>
            </div>
          )}

          {/* Step 1: Basic info */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" /> Nome completo
                </Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Senha
                </Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Telefone
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          )}

          {/* Step 2: Role-specific */}
          {step === 2 && userType === 'driver' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" /> CPF
                </Label>
                <Input
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Veículo</Label>
                <RadioGroup
                  value={vehicleType}
                  onValueChange={(v) => setVehicleType(v as VehicleType)}
                  className="grid grid-cols-2 gap-3"
                >
                  <Label
                    htmlFor="motorcycle"
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 cursor-pointer transition-all duration-200 ${
                      vehicleType === 'motorcycle'
                        ? 'border-primary bg-accent'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <RadioGroupItem value="motorcycle" id="motorcycle" className="sr-only" />
                    <span className="text-2xl">🏍️</span>
                    <span className="text-sm font-medium">Moto</span>
                  </Label>
                  <Label
                    htmlFor="bicycle"
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 cursor-pointer transition-all duration-200 ${
                      vehicleType === 'bicycle'
                        ? 'border-primary bg-accent'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <RadioGroupItem value="bicycle" id="bicycle" className="sr-only" />
                    <span className="text-2xl">🚲</span>
                    <span className="text-sm font-medium">Bicicleta</span>
                  </Label>
                </RadioGroup>
              </div>
            </div>
          )}

          {step === 2 && userType === 'establishment' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Nome do negócio
                </Label>
                <Input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ex: Pizzaria do João"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" /> CNPJ
                </Label>
                <Input
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                  placeholder="00.000.000/0001-00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Endereço completo
                </Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, número, bairro, cidade"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Localização no mapa *
                </Label>
                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={locatingGps}
                    onClick={() => {
                      setLocatingGps(true);
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setLatitude(pos.coords.latitude);
                          setLongitude(pos.coords.longitude);
                          setLocatingGps(false);
                          toast.success('Localização capturada!');
                        },
                        () => {
                          toast.error('Não foi possível obter sua localização');
                          setLocatingGps(false);
                        },
                        { enableHighAccuracy: true }
                      );
                    }}
                  >
                    <LocateFixed className="h-4 w-4 mr-1" />
                    {locatingGps ? 'Localizando...' : 'Usar minha localização'}
                  </Button>
                </div>
                <MapPicker
                  mode="pick"
                  height="200px"
                  center={latitude && longitude ? [latitude, longitude] : [-14.235, -51.925]}
                  zoom={latitude && longitude ? 16 : 4}
                  markers={latitude && longitude ? [{ lat: latitude, lng: longitude, color: 'hsl(358, 82%, 53%)' }] : []}
                  onLocationSelect={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                  }}
                  searchEnabled
                />
                {latitude && longitude && (
                  <p className="text-xs text-muted-foreground">
                    📍 {latitude.toFixed(5)}, {longitude.toFixed(5)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep(step - 1)}
                disabled={loading}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            )}
            {step < 2 ? (
              <Button
                type="button"
                className="flex-1 font-semibold"
                disabled={!canAdvance()}
                onClick={() => setStep(step + 1)}
              >
                Continuar <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                className="flex-1 font-semibold"
                disabled={!canAdvance() || loading}
                onClick={handleRegister}
              >
                {loading ? 'Cadastrando...' : 'Criar conta'}
              </Button>
            )}
          </div>

          {step === 0 && (
            <div className="text-center text-sm text-muted-foreground pt-1">
              Já tem uma conta?{' '}
              <Link to="/login" className="font-semibold text-primary hover:underline">Entrar</Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;

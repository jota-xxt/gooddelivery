import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';

const PendingApproval = () => {
  const { signOut, status } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-0 shadow-xl text-center">
        <CardContent className="pt-8 pb-8 space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-warning/10">
            <Clock className="h-10 w-10 text-warning" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Aguardando Aprovação</h1>
            <p className="text-muted-foreground">
              {status === 'rejected'
                ? 'Seu cadastro foi recusado. Entre em contato com o suporte.'
                : status === 'suspended'
                ? 'Sua conta está suspensa. Entre em contato com o administrador.'
                : 'Seu cadastro está sendo analisado pelo administrador. Você será notificado quando for aprovado.'}
            </p>
          </div>
          <Button variant="outline" onClick={signOut} className="w-full">
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;

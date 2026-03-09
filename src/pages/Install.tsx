import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Monitor, Share2, MoreVertical } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-3">
          <img
            src="/pwa-192x192.png"
            alt="Good Delivery"
            className="w-24 h-24 mx-auto rounded-2xl shadow-lg"
          />
          <h1 className="text-2xl font-bold text-foreground">Good Delivery</h1>
          <p className="text-muted-foreground">
            Instale o app para uma experiência completa com acesso rápido e notificações.
          </p>
        </div>

        {isInstalled ? (
          <Card className="border-green-500/30 bg-green-500/10">
            <CardContent className="pt-6 text-center">
              <p className="text-green-600 font-medium">
                ✅ App já está instalado! Abra pelo ícone na sua tela inicial.
              </p>
            </CardContent>
          </Card>
        ) : deferredPrompt ? (
          <Button
            onClick={handleInstall}
            className="w-full h-14 text-lg gap-3"
            size="lg"
          >
            <Download className="h-5 w-5" />
            Instalar Good Delivery
          </Button>
        ) : null}

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                No celular (Android)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Abra este site no Chrome</p>
              <p className="flex items-center gap-1">
                2. Toque em <MoreVertical className="h-4 w-4 inline" /> (menu)
              </p>
              <p>3. Selecione "Instalar app" ou "Adicionar à tela inicial"</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                No celular (iPhone)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Abra este site no Safari</p>
              <p className="flex items-center gap-1">
                2. Toque em <Share2 className="h-4 w-4 inline" /> (compartilhar)
              </p>
              <p>3. Selecione "Adicionar à Tela de Início"</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                No computador
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Abra este site no Chrome ou Edge</p>
              <p>2. Clique no ícone de instalação na barra de endereço</p>
              <p>3. Confirme a instalação</p>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Good Delivery © {new Date().getFullYear()} — Always Ahead
        </p>
      </div>
    </div>
  );
};

export default Install;

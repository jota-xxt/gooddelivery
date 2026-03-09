import { useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";

export function PushNotificationToggle() {
  const { permission, isSubscribed, loading, subscribe, unsubscribe, isSupported } = usePushNotifications();
  const [busy, setBusy] = useState(false);

  if (!isSupported) return null;

  const handleToggle = async () => {
    setBusy(true);
    if (isSubscribed) {
      await unsubscribe();
      toast.info("Notificações push desativadas");
    } else {
      const success = await subscribe();
      if (success) {
        toast.success("Notificações push ativadas! 🔔");
      } else if (permission === "denied") {
        toast.error("Permissão de notificações bloqueada. Ative nas configurações do navegador.");
      } else {
        toast.error("Não foi possível ativar as notificações push.");
      }
    }
    setBusy(false);
  };

  return (
    <Button
      variant={isSubscribed ? "default" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={loading || busy}
      className="gap-2"
    >
      {isSubscribed ? (
        <>
          <BellRing className="h-4 w-4" />
          Push ativo
        </>
      ) : (
        <>
          <Bell className="h-4 w-4" />
          Ativar Push
        </>
      )}
    </Button>
  );
}

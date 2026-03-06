import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

export const useDeliveryActions = () => {
  const [loading, setLoading] = useState(false);

  const invokeAction = async (deliveryId: string, action: string, extraData?: Record<string, string>) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-delivery-status', {
        body: { delivery_id: deliveryId, action, ...extraData },
      });

      if (error) {
        toast.error('Erro de conexão. Tente novamente.');
        return false;
      }

      if (data?.error) {
        toast.error(data.error);
        return false;
      }

      return true;
    } catch {
      toast.error('Erro inesperado. Tente novamente.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const acceptDelivery = async (deliveryId: string) => {
    const ok = await invokeAction(deliveryId, 'accept');
    if (ok) toast.success('Corrida aceita!');
    return ok;
  };

  const advanceDelivery = async (deliveryId: string) => {
    const ok = await invokeAction(deliveryId, 'advance');
    return ok;
  };

  const cancelDelivery = async (deliveryId: string, reason?: string) => {
    const ok = await invokeAction(deliveryId, 'cancel', reason ? { cancel_reason: reason } : undefined);
    if (ok) toast.success('Entrega cancelada');
    return ok;
  };

  return { acceptDelivery, advanceDelivery, cancelDelivery, loading };
};

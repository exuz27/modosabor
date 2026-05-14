import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { useAppConfig } from '../context/AppConfigContext.jsx';
import { socketManager } from '../lib/socket.js';
import { claimAlertKey, runDeliveredAlert, runOrderAlert, useOrderAlertPlayback } from '../lib/orderAlerts.js';

function wasCreatedRecently(value) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Math.abs(Date.now() - timestamp) <= 2 * 60 * 1000;
}

export default function GlobalOrderAlerts() {
  const { isAuth, token } = useAuth();
  const { config } = useAppConfig();
  const { audioContextRef, voiceRef, fallbackAudioRef } = useOrderAlertPlayback();
  const seenOrdersRef = useRef(new Set());
  const deliveredSeenRef = useRef(new Set());
  const lastEstadoRef = useRef(new Map());
  const lastAudioErrorAtRef = useRef(0);

  useEffect(() => {
    if (!isAuth || !token) return undefined;

    let released = false;
    let unsubscribe = () => {};

    const announceOrder = async (pedido, source = 'nuevo_pedido') => {
      if (!pedido?.id || seenOrdersRef.current.has(pedido.id)) return;
      if (!claimAlertKey(`nuevo:${pedido.id}`)) return;

      seenOrdersRef.current.add(pedido.id);
      if (seenOrdersRef.current.size > 100) {
        const recentIds = [...seenOrdersRef.current].slice(-60);
        seenOrdersRef.current = new Set(recentIds);
      }

      try {
        await runOrderAlert({
          pedido,
          config,
          audioContextRef,
          voiceRef,
          fallbackAudioRef,
        });
        console.info('[GlobalOrderAlerts] alerta lanzada', {
          source,
          pedidoId: pedido.id,
          numero: pedido.numero,
        });
      } catch (error) {
        console.warn('[GlobalOrderAlerts] no se pudo reproducir la alerta', error);
        if (Date.now() - lastAudioErrorAtRef.current > 8000) {
          lastAudioErrorAtRef.current = Date.now();
          toast('Llego un pedido, pero el navegador bloqueo el audio. Hace un click en el panel y proba de nuevo.', {
            icon: '🔔',
          });
        }
      }
    };

    const announceFromAdminUpdate = async (pedido) => {
      const estado = String(pedido?.estado || '').trim().toLowerCase();
      const prevEstado = lastEstadoRef.current.get(pedido.id);
      lastEstadoRef.current.set(pedido.id, estado);

      if (estado !== 'entregado') {
        deliveredSeenRef.current.delete(pedido.id);
      }

      if (estado === 'entregado') {
        if (prevEstado === 'entregado' || deliveredSeenRef.current.has(pedido.id)) return;
        if (!claimAlertKey(`entregado:${pedido.id}`)) return;
        deliveredSeenRef.current.add(pedido.id);
        if (deliveredSeenRef.current.size > 100) {
          const recentIds = [...deliveredSeenRef.current].slice(-60);
          deliveredSeenRef.current = new Set(recentIds);
        }

        try {
          await runDeliveredAlert({
            pedido,
            audioContextRef,
            voiceRef,
            fallbackAudioRef,
            scope: 'admin',
          });
          toast.success(`Se entrego el pedido #${pedido.numero || pedido.id}`);
        } catch {}
        return;
      }

      if (!pedido?.id || seenOrdersRef.current.has(pedido.id)) return;
      const eligible = estado === 'nuevo' || (estado === 'confirmado' && wasCreatedRecently(pedido?.creado_en));
      if (!eligible) return;
      await announceOrder(pedido, 'pedido_actualizado_admin');
    };

    socketManager.retainAuthenticated(token).catch(() => {});
    const unsubscribeNuevo = socketManager.on('nuevo_pedido', (pedido) => announceOrder(pedido, 'nuevo_pedido'));
    const unsubscribeSystemNuevo = socketManager.on('system_nuevo_pedido', (pedido) => announceOrder(pedido, 'system_nuevo_pedido'));
    const unsubscribeAdminUpdate = socketManager.on('pedido_actualizado_admin', announceFromAdminUpdate);
    unsubscribe = () => {
      unsubscribeNuevo();
      unsubscribeSystemNuevo();
      unsubscribeAdminUpdate();
    };

    return () => {
      unsubscribe();
      if (!released) {
        released = true;
        socketManager.releaseAuthenticated();
      }
    };
  }, [audioContextRef, config, fallbackAudioRef, isAuth, token, voiceRef]);

  return null;
}

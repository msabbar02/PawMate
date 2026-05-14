/**
 * Hook de auto-refresco periódico para páginas del panel admin.
 *
 * Llama a la función `callback` cada `intervalMs` milisegundos mientras
 * el componente esté montado. Pausa cuando la pestaña no está visible
 * (`document.hidden`) y dispara una recarga inmediata al volver al
 * foco para evitar trabajo innecesario en segundo plano.
 *
 * Se utiliza como complemento (o alternativa) a las suscripciones
 * Realtime de Supabase: si Realtime falla, se cierra el canal o la
 * tabla no está habilitada en Realtime, el polling garantiza que los
 * datos se mantengan al día sin tener que pulsar F5.
 *
 * @param {() => any} callback Función a invocar (puede ser async).
 * @param {number} [intervalMs=10000] Intervalo en milisegundos.
 * @param {boolean} [enabled=true] Permite desactivar el polling.
 */
import { useEffect, useRef } from 'react';

export function useAutoRefresh(callback, intervalMs = 10000, enabled = true) {
    const cbRef = useRef(callback);
    useEffect(() => { cbRef.current = callback; }, [callback]);

    useEffect(() => {
        if (!enabled) return undefined;

        let timer = null;

        const tick = () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            try {
                const result = cbRef.current?.();
                if (result && typeof result.then === 'function') {
                    result.catch(err => console.warn('[useAutoRefresh] callback error:', err));
                }
            } catch (err) {
                console.warn('[useAutoRefresh] callback exception:', err);
            }
        };

        const start = () => {
            stop();
            timer = setInterval(tick, intervalMs);
        };
        const stop = () => {
            if (timer) { clearInterval(timer); timer = null; }
        };

        const onVisibility = () => {
            if (document.hidden) {
                stop();
            } else {
                tick();
                start();
            }
        };

        start();
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [intervalMs, enabled]);
}

export default useAutoRefresh;

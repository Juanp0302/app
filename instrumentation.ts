/**
 * Se ejecuta una vez al arrancar el servidor de Next. Arranca el reloj de las ventas automáticas (lib/reloj-ventas.ts):
 * GitHub Actions no garantiza sus horarios, así que la app misma revisa cada 5 minutos si toca el ciclo de la hora.
 * Solo en producción y en el runtime de Node; RELOJ_VENTAS=apagado lo desactiva (queda solo GitHub como reloj).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PHASE === 'phase-production-build') return
  if (process.env.RELOJ_VENTAS === 'apagado') return
  const { iniciarRelojVentas } = await import('./lib/reloj-ventas')
  iniciarRelojVentas()
}

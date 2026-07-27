/**
 * lib/push-notify.ts
 * Envío de notificaciones push a la app móvil de administradores, vía el
 * servicio de push de Expo (funciona tanto en Expo Go como en el .apk
 * final — no requiere un proyecto de Firebase propio).
 */
import { Expo } from 'expo-server-sdk'
import { tokensDeUsuario } from './push-tokens-db'

const expo = new Expo()

/** Envía una notificación push a todos los dispositivos registrados de un administrador. */
export async function notificarPush(userId: string, opts: { titulo: string; cuerpo: string; data?: Record<string, string> }) {
  const tokens = await tokensDeUsuario(userId)
  const validos = tokens.filter(t => Expo.isExpoPushToken(t))
  if (validos.length === 0) return

  const mensajes = validos.map(token => ({
    to: token,
    sound: 'default' as const,
    title: opts.titulo,
    body: opts.cuerpo,
    data: opts.data ?? {},
  }))

  const chunks = expo.chunkPushNotifications(mensajes)
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk)
    } catch (e) {
      console.error('[push-notify] Error enviando push:', e)
    }
  }
}

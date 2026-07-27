/**
 * lib/push-notify.ts
 * Envío de notificaciones push (Firebase Cloud Messaging) a la app móvil
 * de administradores. No hace nada si las credenciales de Firebase no
 * están configuradas — así el resto de la app funciona igual mientras
 * se configura el proyecto de Firebase.
 *
 * Variables de entorno requeridas (ver README de la app móvil):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (con los \n literales del archivo JSON)
 */
import { tokensDeUsuario } from './push-tokens-db'

let _app: any = null
let _initTried = false

function getApp() {
  if (_initTried) return _app
  _initTried = true

  const projectId   = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[push-notify] Firebase no configurado — se omiten las notificaciones push')
    return null
  }

  try {
    const admin = require('firebase-admin')
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      })
    }
    _app = admin
    return _app
  } catch (e) {
    console.error('[push-notify] Error inicializando Firebase:', e)
    return null
  }
}

/** Envía una notificación push a todos los dispositivos registrados de un administrador. */
export async function notificarPush(userId: string, opts: { titulo: string; cuerpo: string; data?: Record<string, string> }) {
  const admin = getApp()
  if (!admin) return

  const tokens = await tokensDeUsuario(userId)
  if (tokens.length === 0) return

  try {
    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title: opts.titulo, body: opts.cuerpo },
      data: opts.data ?? {},
    })
  } catch (e) {
    console.error('[push-notify] Error enviando push:', e)
  }
}

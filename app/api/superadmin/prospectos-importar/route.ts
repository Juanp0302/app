/**
 * POST /api/superadmin/prospectos-importar
 * Carga una base de contactos (Excel .xlsx o CSV) a Prospectos y la reparte entre responsables.
 * multipart/form-data: archivo, campana (nombre), responsables (ids separados por coma), confirmar ("1" para cargar).
 * Sin confirmar devuelve solo la vista previa (no escribe nada). Solo superadmin. Ver lib/carga-prospectos.ts.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { leerTabla } from '@/lib/excel'
import { planificarCarga, ejecutarCarga, validarCampana } from '@/lib/carga-prospectos'

const MAX_BYTES = 5 * 1024 * 1024

async function requireSuperadmin() {
  const session = await auth()
  const user = session?.user as any
  return user?.is_superadmin ? user : null
}

export async function POST(req: Request) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const archivo = form?.get('archivo')
  if (!(archivo instanceof File)) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
  if (archivo.size > MAX_BYTES) return NextResponse.json({ error: 'El archivo pesa más de 5 MB' }, { status: 400 })
  const responsables = String(form?.get('responsables') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const confirmar = form?.get('confirmar') === '1'

  try {
    const campana = validarCampana(form?.get('campana'))
    const filas = await leerTabla(archivo.name, await archivo.arrayBuffer())
    const plan = await planificarCarga(filas, responsables)
    const resumen = {
      columnas: Object.fromEntries(Object.entries(plan.columnas).map(([campo, i]) => [campo, i >= 0 ? plan.encabezados[i] : null])),
      nuevos: plan.nuevos.length,
      vacias: plan.vacias,
      repetidas: plan.repetidas,
      revisarIcp: plan.nuevos.filter(n => n.icp).length,
      porResponsable: plan.porResponsable,
      existentes: plan.existentes.map(e => ({
        fila: e.registro.fila, contacto: e.registro.nombre || e.registro.correo, enArchivo: e.registro.empresa,
        empresa: e.empresa, responsable: e.responsable, estado: e.estado,
      })),
      muestra: plan.nuevos.slice(0, 8).map(n => ({
        fila: n.fila, empresa: n.empresa, nombre: n.nombre, telefono: n.telefono, correo: n.correo,
        responsable: plan.porResponsable.find(r => r.id === n.responsable)?.nombre, icp: n.icp,
      })),
    }
    if (!confirmar) return NextResponse.json({ previa: true, campana, ...resumen })
    const { cargados } = await ejecutarCarga(plan, { campana, archivo: archivo.name, userId: user.id })
    return NextResponse.json({ ok: true, campana, cargados, ...resumen })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'No se pudo leer el archivo' }, { status: 400 })
  }
}

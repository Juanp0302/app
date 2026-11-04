/**
 * POST /api/superadmin/radiografias — carga radiografías (PDF) y las asocia a sus prospectos. Solo superadmin.
 *   JSON  { archivos: string[] }          → vista previa: a qué prospectos se asociaría cada archivo (no guarda nada).
 *   multipart  archivos (varios PDF)      → guarda cada uno en sus prospectos; devuelve los que no tuvieron pareja.
 * El emparejamiento (NIT del nombre del archivo o nombre de la empresa) está en lib/radiografias.ts.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { execute } from '@/lib/db'
import { candidatos, emparejar, guardarRadiografia, esPdf, MAX_BYTES_PDF, migrateRadiografias } from '@/lib/radiografias'

const MAX_ARCHIVOS_POR_PETICION = 12

async function requireSuperadmin() {
  const session = await auth()
  const user = session?.user as any
  return user?.is_superadmin ? user : null
}

export async function POST(req: Request) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await migrateRadiografias()
  const todos = await candidatos()
  const nombres = new Map(todos.map(c => [c.id, c.empresa]))

  // Vista previa: solo nombres de archivo, para no subir 40 MB antes de saber si sirven.
  if ((req.headers.get('content-type') ?? '').includes('application/json')) {
    const body = await req.json().catch(() => null)
    const archivos = Array.isArray(body?.archivos) ? body.archivos.map(String).slice(0, 2000) : []
    if (!archivos.length) return NextResponse.json({ error: 'Faltan los archivos' }, { status: 400 })
    const parejas = emparejar(archivos, todos)
    return NextResponse.json({
      previa: true,
      parejas: parejas.map(p => ({ archivo: p.archivo, por: p.por, empresas: p.ids.map(id => nombres.get(id)) })),
      conPareja: parejas.filter(p => p.ids.length).length,
      sinPareja: parejas.filter(p => !p.ids.length).map(p => p.archivo),
      variasFilas: parejas.filter(p => p.ids.length > 1).length,
    })
  }

  const form = await req.formData().catch(() => null)
  const archivos = (form?.getAll('archivos') ?? []).filter((f): f is File => f instanceof File)
  if (!archivos.length) return NextResponse.json({ error: 'Faltan los archivos' }, { status: 400 })
  if (archivos.length > MAX_ARCHIVOS_POR_PETICION) return NextResponse.json({ error: `Máximo ${MAX_ARCHIVOS_POR_PETICION} archivos por envío` }, { status: 400 })

  const parejas = emparejar(archivos.map(a => a.name), todos)
  let guardados = 0
  const sinPareja: string[] = [], rechazados: { archivo: string; motivo: string }[] = []
  for (const [i, f] of archivos.entries()) {
    const bytes = new Uint8Array(await f.arrayBuffer())
    if (!esPdf(bytes)) { rechazados.push({ archivo: f.name, motivo: 'No es un PDF' }); continue }
    if (bytes.byteLength > MAX_BYTES_PDF) { rechazados.push({ archivo: f.name, motivo: 'Pesa más de 3 MB' }); continue }
    const par = parejas[i]
    if (!par.ids.length) { sinPareja.push(f.name); continue }
    for (const id of par.ids) {
      await guardarRadiografia(id, f.name, bytes, user.id)
      // El nombre trae el NIT y la fila (p. ej. un inscrito al webinar) no lo tenía: se lo dejamos.
      if (par.nit) await execute(`UPDATE prospectos_isp SET nit = ? WHERE id = ? AND (nit IS NULL OR nit = '')`, [par.nit, id])
    }
    guardados++
  }
  return NextResponse.json({ ok: true, guardados, sinPareja, rechazados })
}

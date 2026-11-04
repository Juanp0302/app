'use client'

import { useState } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622' }
const POR_ENVIO = 8

/**
 * Carga masiva de radiografías (PDF), solo superadmin. Primero se mandan solo los nombres de los archivos para ver
 * con qué prospecto se asocia cada uno; después se suben los PDF de a pocos, para no mandar 40 MB en una sola petición.
 */
export default function CargarRadiografias({ onCerrar, onCargado }: { onCerrar: () => void; onCargado: () => void }) {
  const [archivos, setArchivos] = useState<File[]>([])
  const [previa, setPrevia] = useState<any>(null)
  const [progreso, setProgreso] = useState<number | null>(null)
  const [resultado, setResultado] = useState<{ guardados: number; sinPareja: string[]; rechazados: { archivo: string; motivo: string }[] } | null>(null)
  const [error, setError] = useState('')
  const [leyendo, setLeyendo] = useState(false)

  async function verPrevia(lista: File[]) {
    setArchivos(lista); setPrevia(null); setError('')
    if (!lista.length) return
    setLeyendo(true)
    try {
      const r = await fetch('/api/superadmin/radiografias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivos: lista.map(f => f.name) }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) setError(d.error ?? 'No se pudo revisar los archivos'); else setPrevia(d)
    } finally { setLeyendo(false) }
  }

  async function cargar() {
    if (!previa) return
    // Solo se suben los que tienen pareja; los demás se quedan afuera.
    const sin = new Set<string>(previa.sinPareja)
    const subir = archivos.filter(f => !sin.has(f.name))
    const total = { guardados: 0, sinPareja: [...sin], rechazados: [] as { archivo: string; motivo: string }[] }
    setError(''); setProgreso(0)
    try {
      for (let i = 0; i < subir.length; i += POR_ENVIO) {
        const fd = new FormData()
        subir.slice(i, i + POR_ENVIO).forEach(f => fd.append('archivos', f))
        const r = await fetch('/api/superadmin/radiografias', { method: 'POST', body: fd })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) { setError(`${d.error ?? 'Falló un envío'}. Se guardaron ${total.guardados}; vuelva a elegir los archivos para continuar con el resto.`); break }
        total.guardados += d.guardados; total.sinPareja.push(...d.sinPareja); total.rechazados.push(...d.rechazados)
        setProgreso(Math.min(100, Math.round(((i + POR_ENVIO) / subir.length) * 100)))
      }
      setResultado(total)
      if (total.guardados) onCargado()
    } finally { setProgreso(null) }
  }

  const caja: React.CSSProperties = { fontSize: 12, maxHeight: 150, overflowY: 'auto', background: '#faf8f3', borderRadius: 6, padding: '6px 10px' }

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 620, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.4rem 1.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: C.vino }}>Cargar radiografías (PDF)</div>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {resultado ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.8rem 1rem', fontSize: 13, color: '#166534' }}>
              ✓ Se guardaron <b>{resultado.guardados}</b> radiografías. Cada prospecto con radiografía ya muestra el botón para descargarla.
            </div>
            {resultado.sinPareja.length > 0 && (
              <div><div style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>{resultado.sinPareja.length} sin prospecto (no se guardaron)</div>
                <div style={caja}>{resultado.sinPareja.map(a => <div key={a}>{a}</div>)}</div></div>
            )}
            {resultado.rechazados.length > 0 && (
              <div><div style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>{resultado.rechazados.length} rechazados</div>
                <div style={caja}>{resultado.rechazados.map(a => <div key={a.archivo}>{a.archivo}: {a.motivo}</div>)}</div></div>
            )}
            <button onClick={onCerrar} style={{ alignSelf: 'flex-end', background: C.vino, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cerrar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <input type="file" accept=".pdf,application/pdf" multiple onChange={e => verPrevia([...(e.target.files ?? [])])} style={{ fontSize: 13 }} />
              <div style={{ fontSize: 11.5, color: '#888', marginTop: 4, lineHeight: 1.6 }}>
                Elija los PDF que generó (puede seleccionar todos a la vez). Cada uno se asocia al prospecto por el <b>NIT</b> del nombre del archivo
                (<code>Radiografia_900860597_NOMBRE.pdf</code>) o, si no lo trae, por el <b>nombre de la empresa</b>. Si una radiografía ya estaba cargada, se reemplaza.
              </div>
            </div>
            {error && <div style={{ color: '#b91c1c', fontSize: 12.5, background: '#fef2f2', padding: '0.6rem 0.8rem', borderRadius: 6 }}>{error}</div>}
            {leyendo && <div style={{ fontSize: 12.5, color: '#888' }}>Revisando {archivos.length} archivos…</div>}
            {previa && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid #eee', paddingTop: '0.9rem' }}>
                <div style={{ fontSize: 13 }}>
                  <b>{previa.conPareja}</b> de {archivos.length} archivos tienen prospecto.
                  {previa.variasFilas > 0 && <> {previa.variasFilas} se asocian a más de una fila de la misma empresa y se guardan en todas.</>}
                </div>
                {previa.sinPareja.length > 0 && (
                  <details style={{ fontSize: 12 }} open={previa.sinPareja.length <= 8}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#b45309' }}>{previa.sinPareja.length} sin prospecto: no se cargarán</summary>
                    <div style={{ ...caja, marginTop: 6 }}>{previa.sinPareja.map((a: string) => <div key={a}>{a}</div>)}</div>
                  </details>
                )}
              </div>
            )}
            {progreso !== null && (
              <div style={{ background: '#eee', borderRadius: 6, height: 10 }}><div style={{ width: `${progreso}%`, height: '100%', background: C.olivo, borderRadius: 6, transition: 'width 0.3s' }} /></div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={cargar} disabled={!previa || !previa.conPareja || progreso !== null}
                style={{ background: previa?.conPareja ? C.olivo : '#ccc', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 700, fontSize: 12, cursor: previa?.conPareja ? 'pointer' : 'default' }}>
                {progreso !== null ? `Cargando… ${progreso} %` : previa ? `Cargar ${previa.conPareja} radiografías` : 'Cargar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

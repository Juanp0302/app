'use client'

import { useState } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622' }

const CAMPO_LABEL: Record<string, string> = {
  empresa: 'Empresa', nombre: 'Contacto', correo: 'Correo', telefono: 'Celular / teléfono', nit: 'NIT',
  municipio: 'Municipio', departamento: 'Departamento', notas: 'Notas',
}

/**
 * Carga de una base de contactos (Excel o CSV) a Prospectos, solo superadmin: primero muestra la vista
 * previa (qué columnas reconoció, cuántos le tocan a cada uno, cuáles ya existen) y después carga.
 */
export default function CargarBase({ admins, onCerrar, onCargado }: {
  admins: { id: string; nombre: string }[]; onCerrar: () => void; onCargado: () => void
}) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [campana, setCampana] = useState('')
  const [elegidos, setElegidos] = useState<Set<string>>(new Set(admins.map(a => a.id)))
  const [previa, setPrevia] = useState<any>(null)
  const [resultado, setResultado] = useState<any>(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#888', marginBottom: 4, display: 'block' }

  // Cualquier cambio invalida la vista previa: hay que volver a verla antes de cargar.
  const cambiar = (f: () => void) => { f(); setPrevia(null); setError('') }

  async function enviar(confirmar: boolean) {
    if (!archivo) return
    setEnviando(true); setError('')
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      fd.append('campana', campana)
      fd.append('responsables', [...elegidos].join(','))
      if (confirmar) fd.append('confirmar', '1')
      const r = await fetch('/api/superadmin/prospectos-importar', { method: 'POST', body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setError(d.error ?? 'No se pudo procesar el archivo'); return }
      if (confirmar) { setResultado(d); onCargado() } else setPrevia(d)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 640, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.4rem 1.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: C.vino }}>Cargar base de contactos</div>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {resultado ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.8rem 1rem', fontSize: 13, color: '#166534' }}>
              ✓ Se cargaron <b>{resultado.cargados}</b> prospectos en la campaña <b>{resultado.campana}</b>, en estado Pendiente.
              {resultado.existentes.length > 0 && <> {resultado.existentes.length} ya estaban en Prospectos y no se tocaron.</>}
            </div>
            <Reparto filas={resultado.porResponsable} />
            <button onClick={onCerrar} style={{ alignSelf: 'flex-end', background: C.vino, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              Cerrar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <label style={label}>Archivo (.xlsx o .csv)</label>
              <input type="file" accept=".xlsx,.csv" onChange={e => cambiar(() => setArchivo(e.target.files?.[0] ?? null))} style={{ fontSize: 13 }} />
              <div style={{ fontSize: 11.5, color: '#888', marginTop: 4 }}>
                Se lee la primera hoja. La primera fila deben ser los encabezados; se reconocen empresa (o ISP), nombre o contacto,
                correo, celular o teléfono, NIT, municipio, departamento y notas, en cualquier orden.
              </div>
            </div>
            <div>
              <label style={label}>Nombre de la campaña</label>
              <input value={campana} onChange={e => cambiar(() => setCampana(e.target.value))} style={inp} placeholder='Ej.: "Expo ISP 2026" o "Base Asotic"' maxLength={60} />
              <div style={{ fontSize: 11.5, color: '#888', marginTop: 4 }}>Queda como etiqueta de cada prospecto y como filtro en la lista.</div>
            </div>
            <div>
              <label style={label}>Repartir en partes iguales entre</label>
              <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                {admins.map(a => (
                  <label key={a.id} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={elegidos.has(a.id)}
                      onChange={() => cambiar(() => setElegidos(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n }))} />
                    {a.nombre}
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: '#888', marginTop: 4 }}>Los contactos de una misma empresa quedan con la misma persona.</div>
            </div>

            {error && <div style={{ color: '#b91c1c', fontSize: 12.5, background: '#fef2f2', padding: '0.6rem 0.8rem', borderRadius: 6 }}>{error}</div>}

            {previa && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', borderTop: '1px solid #eee', paddingTop: '0.9rem' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.vino }}>Vista previa (todavía no se ha cargado nada)</div>
                <div style={{ fontSize: 12, color: '#555', lineHeight: 1.7 }}>
                  <b>Columnas reconocidas:</b>{' '}
                  {Object.entries(previa.columnas).filter(([, v]) => v).map(([k, v]) => `${CAMPO_LABEL[k] ?? k} ← "${v}"`).join(' · ')}
                  {Object.entries(previa.columnas).some(([k, v]) => !v && ['empresa', 'telefono', 'correo'].includes(k)) && (
                    <div style={{ color: '#b45309' }}>
                      Sin columna de: {Object.entries(previa.columnas).filter(([k, v]) => !v && ['empresa', 'telefono', 'correo'].includes(k)).map(([k]) => CAMPO_LABEL[k]).join(', ')}.
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 13 }}>
                  Se cargarían <b>{previa.nuevos}</b> prospectos nuevos.
                  {previa.vacias > 0 && <> {previa.vacias} filas vacías se ignoran.</>}
                  {previa.repetidas > 0 && <> {previa.repetidas} correos repetidos en el archivo se cargan una sola vez.</>}
                  {previa.revisarIcp > 0 && <> <span style={{ color: '#b45309' }}>{previa.revisarIcp} quedarán con "⚠ ¿ISP?" para revisar.</span></>}
                </div>
                <Reparto filas={previa.porResponsable} />
                {previa.existentes.length > 0 && (
                  <details style={{ fontSize: 12 }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700, color: C.bordo }}>
                      {previa.existentes.length} ya están en Prospectos: no se cargan ni se reasignan
                    </summary>
                    <div style={{ marginTop: 6, maxHeight: 160, overflowY: 'auto' }}>
                      {previa.existentes.map((e: any) => (
                        <div key={e.fila} style={{ padding: '3px 0', borderBottom: '1px solid #f3f3f3' }}>
                          Fila {e.fila}: {e.enArchivo || e.contacto} → ya está como <b>{e.empresa}</b> ({e.estado}, a cargo de {e.responsable ?? 'sin asignar'})
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {previa.muestra.length > 0 && (
                  <div style={{ fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: '#666', marginBottom: 4 }}>Primeros de la lista</div>
                    {previa.muestra.map((m: any) => (
                      <div key={m.fila} style={{ padding: '3px 0', borderBottom: '1px solid #f3f3f3', color: '#444' }}>
                        <b>{m.empresa || '—'}</b> · {m.nombre || '—'} · {m.telefono || m.correo || 'sin contacto'} → {m.responsable}{m.icp ? ' · ⚠ ¿ISP?' : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => enviar(false)} disabled={!archivo || !elegidos.size || enviando}
                style={{ background: '#fff', color: C.vino, border: `1px solid ${C.vino}`, borderRadius: 6, padding: '8px 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: !archivo || !elegidos.size ? 0.5 : 1 }}>
                {enviando && !previa ? 'Leyendo…' : 'Ver vista previa'}
              </button>
              <button onClick={() => enviar(true)} disabled={!previa || !previa.nuevos || enviando}
                style={{ background: previa?.nuevos ? C.olivo : '#ccc', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 700, fontSize: 12, cursor: previa?.nuevos ? 'pointer' : 'default' }}>
                {enviando && previa ? 'Cargando…' : previa ? `Cargar ${previa.nuevos} prospectos` : 'Cargar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Reparto({ filas }: { filas: { id: string; nombre: string; cantidad: number }[] }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {filas.map(f => (
        <div key={f.id} style={{ flex: '1 1 140px', background: '#faf8f3', borderRadius: 8, padding: '0.5rem 0.8rem' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.vino }}>{f.cantidad}</div>
          <div style={{ fontSize: 11.5, color: '#666' }}>{f.nombre}</div>
        </div>
      ))}
    </div>
  )
}

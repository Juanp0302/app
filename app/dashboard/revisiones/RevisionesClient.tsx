'use client'

import { useEffect, useState, useCallback } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

const ASPECTO_COLOR: Record<string, string> = {
  FINANCIERO: '#f59e0b', 'JURÍDICO': '#8b5cf6', 'TÉCNICO': '#3b82f6',
  TRANSVERSAL: '#10b981', ADMINISTRATIVO: '#ec4899',
}

interface DocPendiente {
  id:               string
  nombre_archivo:   string
  ruta:             string
  anio:             number
  trimestre:        number | null
  uploaded_at:      string
  subido_por_nombre: string
  subido_por_email:  string
  razon_social:          string
  cliente_id:            string
  cliente_obl_id:        string | null
  admin_revision_id:     string | null
  admin_revision_nombre: string | null
  admin_revision_email:  string | null
  aspecto:          string | null
  obligacion:       string | null
  sub_titulo:       string | null
  servicio:         string | null
  periodicidad:     string | null
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function iconoPorNombre(nombre: string): string {
  const ext = nombre.split('.').pop()?.toLowerCase()
  if (ext === 'pdf')                        return '📄'
  if (['doc','docx'].includes(ext ?? ''))   return '📝'
  if (['xls','xlsx'].includes(ext ?? ''))   return '📊'
  if (['jpg','jpeg','png'].includes(ext ?? '')) return '🖼️'
  return '📎'
}

export default function RevisionesClient() {
  const [docs,    setDocs]    = useState<DocPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro,  setFiltro]  = useState('')

  // Estado de revisión por documento
  const [revisando,    setRevisando]    = useState<string | null>(null)
  const [comentarios,  setComentarios]  = useState<Record<string, string>>({})
  const [expandidos,   setExpandidos]   = useState<Set<string>>(new Set())
  const [resultado,    setResultado]    = useState<Record<string, 'ok' | 'error'>>({})
  const [aprobados,    setAprobados]    = useState<Record<string, boolean>>({})

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/documentos/revisiones')
      setDocs(await r.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function revisar(docId: string, aprobado: boolean) {
    const comentario = comentarios[docId] ?? ''
    if (!aprobado && !comentario.trim()) {
      alert('Escribe el motivo del rechazo antes de continuar.')
      return
    }
    setRevisando(docId)
    try {
      const res = await fetch('/api/documentos', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ docId, aprobado, comentario }),
      })
      if (res.ok) {
        // Feedback inmediato: marcar aprobado/rechazado y colapsar panel
        setAprobados(r => ({ ...r, [docId]: aprobado }))
        setResultado(r => ({ ...r, [docId]: 'ok' }))
        setExpandidos(prev => { const s = new Set(prev); s.delete(docId); return s })
        // Quitar de la lista después de un breve instante
        setTimeout(() => {
          setDocs(prev => prev.filter(d => d.id !== docId))
          setResultado(r => { const c = { ...r }; delete c[docId]; return c })
          setAprobados(r => { const c = { ...r }; delete c[docId]; return c })
        }, 900)
      } else {
        let mensaje = 'Error al guardar la revisión'
        try {
          const j = await res.json()
          mensaje = j.error ?? mensaje
        } catch { /* respuesta no es JSON */ }
        alert(mensaje)
        setResultado(r => ({ ...r, [docId]: 'error' }))
      }
    } finally { setRevisando(null) }
  }

  function toggleExpandir(id: string) {
    setExpandidos(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const docsFiltrados = docs.filter(d => {
    if (!filtro) return true
    const f = filtro.toLowerCase()
    return (
      d.razon_social?.toLowerCase().includes(f) ||
      d.nombre_archivo?.toLowerCase().includes(f) ||
      d.aspecto?.toLowerCase().includes(f) ||
      d.obligacion?.toLowerCase().includes(f)
    )
  })

  // Agrupar por cliente
  const porCliente: Record<string, DocPendiente[]> = {}
  for (const d of docsFiltrados) {
    if (!porCliente[d.razon_social]) porCliente[d.razon_social] = []
    porCliente[d.razon_social].push(d)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.vino, fontFamily: "'Josefin Sans', sans-serif", color: C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{ background: 'rgba(39,2,5,0.97)', borderBottom: '1px solid rgba(150,134,34,0.2)',
        padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', gap: '1.5rem',
        position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem',
          fontWeight: 700, color: C.marfil, textDecoration: 'none' }}>Owl Compliance</a>
        <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em',
          textTransform: 'uppercase', color: C.olivo }}>Revisión de Documentos</span>
        <a href="/signout" style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700,
          letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'rgba(231,223,202,0.5)', textDecoration: 'none' }}>Salir</a>
      </nav>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(1.3rem,2.5vw,1.8rem)', fontWeight: 700, marginBottom: '0.3rem' }}>
              Revisión de documentos
            </div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(231,223,202,0.5)' }}>
              {loading ? 'Cargando…' : `${docs.length} documento${docs.length !== 1 ? 's' : ''} pendiente${docs.length !== 1 ? 's' : ''} de revisión`}
            </div>
          </div>
          <input
            placeholder="Buscar cliente, archivo, aspecto…"
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            style={{ background: 'rgba(231,223,202,0.07)', border: '1px solid rgba(150,134,34,0.3)',
              borderRadius: 8, padding: '0.6rem 1rem', color: C.marfil, fontSize: '0.85rem',
              fontFamily: 'inherit', outline: 'none', width: 280 }}
          />
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(231,223,202,0.3)' }}>
            Cargando documentos…
          </div>
        )}

        {!loading && docs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '5rem', color: 'rgba(231,223,202,0.3)', fontSize: '0.9rem' }}>
            No hay documentos pendientes de revisión.
          </div>
        )}

        {!loading && Object.entries(porCliente).map(([cliente, cdocs]) => (
          <div key={cliente} style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em',
                textTransform: 'uppercase', color: C.olivo,
                display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span>{cliente}</span>
                <span style={{ background: 'rgba(150,134,34,0.15)', padding: '2px 10px',
                  borderRadius: 20, fontSize: '0.6rem' }}>
                  {cdocs.length} pendiente{cdocs.length !== 1 ? 's' : ''}
                </span>
              </div>
              {cdocs[0].admin_revision_nombre ? (
                <span style={{ fontSize: '0.62rem', color: 'rgba(231,223,202,0.45)',
                  background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '3px 10px' }}>
                  🛡️ Revisor: <strong style={{ color: C.marfil }}>{cdocs[0].admin_revision_nombre}</strong>
                </span>
              ) : (
                <span style={{ fontSize: '0.62rem', color: 'rgba(231,223,202,0.3)',
                  background: 'rgba(0,0,0,0.15)', borderRadius: 6, padding: '3px 10px', fontStyle: 'italic' }}>
                  Sin revisor asignado
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {cdocs.map(doc => {
                const color      = ASPECTO_COLOR[doc.aspecto ?? ''] ?? C.olivo
                const expanded   = expandidos.has(doc.id)
                const ok         = resultado[doc.id] === 'ok'
                const isBusy     = revisando === doc.id
                const fueAprobado = aprobados[doc.id]

                const bgColor  = ok ? (fueAprobado ? 'rgba(16,185,129,0.08)' : 'rgba(220,38,38,0.06)') : 'rgba(231,223,202,0.04)'
                const bdrColor = ok ? (fueAprobado ? 'rgba(16,185,129,0.4)'  : 'rgba(220,38,38,0.3)')  : 'rgba(150,134,34,0.2)'

                return (
                  <div key={doc.id} style={{
                    background: bgColor,
                    border: `1px solid ${bdrColor}`,
                    borderRadius: 12, overflow: 'hidden',
                    transition: 'border-color 0.3s, background 0.3s',
                  }}>
                    {/* Cabecera del documento */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem',
                      padding: '1rem 1.25rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.4rem' }}>{iconoPorNombre(doc.nombre_archivo)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.nombre_archivo}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(231,223,202,0.45)', marginTop: '0.2rem' }}>
                          Subido por {doc.subido_por_nombre} · {formatFecha(doc.uploaded_at)}
                        </div>
                      </div>

                      {/* Badges */}
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {doc.aspecto && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
                            textTransform: 'uppercase', background: `${color}22`, color,
                            padding: '0.15rem 0.6rem', borderRadius: 8 }}>
                            {doc.aspecto}
                          </span>
                        )}
                        {doc.servicio && (
                          <span style={{ fontSize: '0.6rem', background: 'rgba(150,134,34,0.1)',
                            color: 'rgba(150,134,34,0.8)', padding: '0.15rem 0.6rem', borderRadius: 8 }}>
                            {doc.servicio}
                          </span>
                        )}
                        <span style={{ fontSize: '0.6rem', background: 'rgba(150,134,34,0.12)',
                          color: C.olivo, padding: '0.15rem 0.6rem', borderRadius: 8, fontWeight: 700 }}>
                          {doc.anio}{doc.trimestre ? ` · Q${doc.trimestre}` : ''}
                        </span>
                      </div>

                      {/* Acciones rápidas */}
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <a href={`/api/documentos/archivo?docId=${doc.id}`} target="_blank"
                          style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
                            textTransform: 'uppercase', color: C.olivo, textDecoration: 'none',
                            background: 'rgba(150,134,34,0.12)', padding: '0.35rem 0.75rem',
                            borderRadius: 6, whiteSpace: 'nowrap' }}>
                          Ver doc.
                        </a>
                        <button onClick={() => toggleExpandir(doc.id)}
                          style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
                            textTransform: 'uppercase', border: '1px solid rgba(150,134,34,0.3)',
                            background: 'transparent', color: C.marfil, padding: '0.35rem 0.75rem',
                            borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                          {expanded ? 'Ocultar' : 'Revisar'}
                        </button>
                      </div>
                    </div>

                    {/* Panel de revisión expandido */}
                    {expanded && !ok && (
                      <div style={{ borderTop: '1px solid rgba(150,134,34,0.12)',
                        padding: '1rem 1.25rem', background: 'rgba(0,0,0,0.15)' }}>

                        {/* Obligación vinculada */}
                        {doc.obligacion && (
                          <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem',
                            background: 'rgba(231,223,202,0.04)', borderRadius: 8,
                            border: '1px solid rgba(150,134,34,0.15)' }}>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em',
                              textTransform: 'uppercase', color: 'rgba(231,223,202,0.35)',
                              marginBottom: '0.3rem' }}>Obligación vinculada</div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{doc.obligacion}</div>
                            {doc.sub_titulo && (
                              <div style={{ fontSize: '0.72rem', color: 'rgba(231,223,202,0.5)',
                                marginTop: '0.2rem' }}>{doc.sub_titulo}</div>
                            )}
                            {doc.cliente_obl_id && (
                              <div style={{ fontSize: '0.62rem', color: '#34d399', marginTop: '0.35rem' }}>
                                Al aprobar, la obligación se marcará automáticamente como cumplida.
                              </div>
                            )}
                          </div>
                        )}

                        {/* Campo de comentario */}
                        <div style={{ marginBottom: '0.85rem' }}>
                          <label style={{ display: 'block', fontSize: '0.62rem', fontWeight: 700,
                            letterSpacing: '0.12em', textTransform: 'uppercase',
                            color: 'rgba(231,223,202,0.45)', marginBottom: '0.4rem' }}>
                            Comentario
                            <span style={{ fontWeight: 400, marginLeft: '0.3rem' }}>
                              (obligatorio al rechazar, opcional al aprobar)
                            </span>
                          </label>
                          <textarea
                            value={comentarios[doc.id] ?? ''}
                            onChange={e => setComentarios(c => ({ ...c, [doc.id]: e.target.value }))}
                            rows={3}
                            placeholder="Escribe aquí observaciones o el motivo de rechazo…"
                            style={{ width: '100%', background: 'rgba(231,223,202,0.06)',
                              border: '1px solid rgba(150,134,34,0.3)', borderRadius: 8,
                              padding: '0.65rem 0.9rem', color: C.marfil, fontSize: '0.85rem',
                              fontFamily: 'inherit', outline: 'none', resize: 'vertical',
                              boxSizing: 'border-box' }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => revisar(doc.id, false)} disabled={isBusy}
                            style={{ background: 'rgba(220,38,38,0.12)', color: '#f87171',
                              border: '1px solid rgba(220,38,38,0.35)', borderRadius: 8,
                              padding: '0.6rem 1.25rem', fontSize: '0.72rem', fontWeight: 700,
                              letterSpacing: '0.12em', textTransform: 'uppercase',
                              cursor: isBusy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                            {isBusy ? 'Guardando…' : 'Rechazar'}
                          </button>
                          <button onClick={() => revisar(doc.id, true)} disabled={isBusy}
                            style={{ background: isBusy ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.15)',
                              color: '#34d399', border: '1px solid rgba(16,185,129,0.35)',
                              borderRadius: 8, padding: '0.6rem 1.25rem', fontSize: '0.72rem',
                              fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                              cursor: isBusy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                            {isBusy ? 'Guardando…' : 'Aprobar'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Confirmación visual */}
                    {ok && (
                      <div style={{ padding: '0.75rem 1.25rem',
                        borderTop: `1px solid ${fueAprobado ? 'rgba(16,185,129,0.2)' : 'rgba(220,38,38,0.2)'}`,
                        background: fueAprobado ? 'rgba(16,185,129,0.06)' : 'rgba(220,38,38,0.06)',
                        fontSize: '0.78rem',
                        color: fueAprobado ? '#34d399' : '#f87171' }}>
                        {fueAprobado ? '✓ Documento aprobado correctamente.' : '✕ Documento rechazado.'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}

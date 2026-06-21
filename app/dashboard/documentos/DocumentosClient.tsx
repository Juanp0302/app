'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

interface ArchivoReconocido {
  ref:            string
  ruta:           string
  nombre:         string
  anio:           number
  trimestre:      number | null
  aspecto:        string
  obligacion:     string
  sub_titulo?:    string
  periodicidad?:  string
  cliente_obl_id: string | null
}

interface ArchivoNoReconocido {
  ref:    string
  ruta:   string
  nombre: string
  razon?: string
}

const ASPECTO_COLOR: Record<string, string> = {
  FINANCIERO: '#f59e0b', JURÍDICO: '#8b5cf6', TÉCNICO: '#3b82f6',
  TRANSVERSAL: '#10b981', ADMINISTRATIVO: '#ec4899',
}

const TRIMESTRES = [
  { val: null, label: 'Todo el año' },
  { val: 1,   label: 'Q1 — Ene a Mar' },
  { val: 2,   label: 'Q2 — Abr a Jun' },
  { val: 3,   label: 'Q3 — Jul a Sep' },
  { val: 4,   label: 'Q4 — Oct a Dic' },
]

interface Archivo {
  id:               string
  nombre_archivo:   string
  uploaded_at:      string
  subido_por:       string
  subido_por_email: string
}

interface Grupo {
  aspecto:    string
  obligacion: string
  anio:       number
  trimestre:  number | null
  archivos:   Archivo[]
}

export default function DocumentosClient({
  userRole, clienteId: initialId, clientes, obligaciones,
}: {
  userRole:     string
  clienteId:    string | null
  clientes:     any[]
  obligaciones: any[]
}) {
  const anioActual = new Date().getFullYear()
  const [clienteId,    setClienteId]    = useState(initialId)
  const [grupos,       setGrupos]       = useState<Grupo[]>([])
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(false)
  const [uploadOpen,   setUploadOpen]   = useState(false)
  const [abiertos,     setAbiertos]     = useState<Set<string>>(new Set())

  // Formulario de subida
  const [upAspecto,    setUpAspecto]    = useState('')
  const [upObligacion, setUpObligacion] = useState('')
  const [upOblId,      setUpOblId]      = useState('')
  const [upAnio,       setUpAnio]       = useState(anioActual)
  const [upTrimestre,  setUpTrimestre]  = useState<number | null>(null)
  const [upArchivo,    setUpArchivo]    = useState<File | null>(null)
  const [uploading,    setUploading]    = useState(false)
  const [upError,      setUpError]      = useState('')

  // ZIP
  const [zipAnio,      setZipAnio]      = useState(anioActual)
  const [zipTrim,      setZipTrim]      = useState<number | null>(null)
  const [zipping,      setZipping]      = useState(false)

  // Scanner
  const [scanOpen,        setScanOpen]        = useState(false)
  const [scanning,        setScanning]        = useState(false)
  const [scanResult,      setScanResult]      = useState<null | {
    total: number; ya_registrados: number
    reconocidos: ArchivoReconocido[]; no_reconocidos: ArchivoNoReconocido[]
  }>(null)
  const [scanError,       setScanError]       = useState('')
  const [scanSeleccion,   setScanSeleccion]   = useState<Set<string>>(new Set())
  const [importando,      setImportando]      = useState(false)
  const [importResult,    setImportResult]    = useState<null | { importados: number }>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async (cid: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/documentos?clienteId=${cid}`)
      const json = await res.json()
      setGrupos(json.grupos ?? [])
      setTotal(json.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (clienteId) cargar(clienteId) }, [clienteId, cargar])

  // Obligaciones únicas por aspecto (sin duplicados)
  const oblsUnicas = obligaciones.reduce((acc: any[], o: any) => {
    const key = `${o.aspecto}||${o.obligacion}`
    if (!acc.find((x: any) => `${x.aspecto}||${x.obligacion}` === key)) acc.push(o)
    return acc
  }, [])

  async function subirArchivo(e: React.FormEvent) {
    e.preventDefault()
    if (!upArchivo || !clienteId) return
    setUploading(true); setUpError('')
    try {
      const fd = new FormData()
      fd.append('clienteId',    clienteId)
      fd.append('clienteOblId', upOblId)
      fd.append('aspecto',      upAspecto)
      fd.append('obligacion',   upObligacion)
      fd.append('anio',         String(upAnio))
      if (upTrimestre) fd.append('trimestre', String(upTrimestre))
      fd.append('archivo', upArchivo)

      const res = await fetch('/api/documentos', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setUpError(json.error ?? 'Error al subir'); return }

      setUpArchivo(null)
      if (fileRef.current) fileRef.current.value = ''
      setUploadOpen(false)
      cargar(clienteId)
    } finally {
      setUploading(false)
    }
  }

  async function eliminar(docId: string) {
    if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return
    await fetch(`/api/documentos?docId=${docId}`, { method: 'DELETE' })
    if (clienteId) cargar(clienteId)
  }

  async function iniciarScan() {
    if (!clienteId) return
    setScanning(true); setScanError(''); setScanResult(null); setImportResult(null)
    setScanSeleccion(new Set())
    try {
      const res  = await fetch(`/api/documentos/scan?clienteId=${clienteId}`)
      const json = await res.json()
      if (!res.ok) { setScanError(json.error ?? 'Error al escanear'); return }
      setScanResult(json)
      // Pre-seleccionar todos los reconocidos
      setScanSeleccion(new Set(json.reconocidos.map((a: ArchivoReconocido) => a.ref)))
    } catch (e: any) {
      setScanError(e.message)
    } finally {
      setScanning(false)
    }
  }

  async function importarSeleccionados() {
    if (!clienteId || !scanResult) return
    const seleccionados = scanResult.reconocidos.filter(a => scanSeleccion.has(a.ref))
    if (seleccionados.length === 0) return
    setImportando(true)
    try {
      const res  = await fetch('/api/documentos/scan', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clienteId, archivos: seleccionados }),
      })
      const json = await res.json()
      setImportResult({ importados: json.importados })
      cargar(clienteId)
    } finally {
      setImportando(false)
    }
  }

  function toggleScanItem(ref: string) {
    setScanSeleccion(prev => {
      const n = new Set(prev)
      n.has(ref) ? n.delete(ref) : n.add(ref)
      return n
    })
  }

  async function descargarZip() {
    if (!clienteId) return
    setZipping(true)
    try {
      const trimParam = zipTrim ? `&trimestre=${zipTrim}` : ''
      const url = `/api/documentos/zip?clienteId=${clienteId}&anio=${zipAnio}${trimParam}`
      const res = await fetch(url)
      if (!res.ok) {
        const j = await res.json()
        alert(j.error ?? 'No hay documentos para ese período.')
        return
      }
      const blob = await res.blob()
      const a    = document.createElement('a')
      a.href     = URL.createObjectURL(blob)
      a.download = `documentos_${zipAnio}${zipTrim ? `_Q${zipTrim}` : ''}.zip`
      a.click()
    } finally {
      setZipping(false)
    }
  }

  function toggleGrupo(key: string) {
    setAbiertos(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  function grupoKey(g: Grupo) {
    return `${g.aspecto}||${g.obligacion}||${g.anio}||${g.trimestre ?? 0}`
  }

  function formatFecha(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
  }

  return (
    <div style={{ minHeight:'100vh', background: C.vino, fontFamily:"'Josefin Sans', sans-serif", color: C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{ background:'rgba(39,2,5,0.97)', borderBottom:'1px solid rgba(150,134,34,0.2)', padding:'0.9rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'1.5rem' }}>
          <a href="/dashboard" style={{ fontFamily:"'Playfair Display', serif", fontSize:'1.1rem', fontWeight:700, color:C.marfil, textDecoration:'none' }}>Owl Compliance</a>
          <span style={{ color:'rgba(231,223,202,0.3)' }}>›</span>
          <span style={{ fontSize:'0.72rem', fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:C.olivo }}>Acreditación de Cumplimiento</span>
        </div>
        <a href="/api/auth/signout" style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'rgba(231,223,202,0.5)', textDecoration:'none' }}>Salir</a>
      </nav>

      <main style={{ maxWidth:'1100px', margin:'0 auto', padding:'2rem' }}>

        {/* Selector cliente */}
        {userRole === 'admin' && clientes.length > 0 && (
          <div style={{ marginBottom:'1.5rem' }}>
            <select value={clienteId ?? ''} onChange={e => setClienteId(e.target.value)}
              style={{ background:'rgba(231,223,202,0.08)', border:'1px solid rgba(150,134,34,0.35)', borderRadius:'8px', padding:'0.7rem 1rem', color:C.marfil, fontSize:'0.9rem', fontFamily:'inherit', maxWidth:'420px', width:'100%', cursor:'pointer' }}>
              <option value="" disabled>Selecciona un cliente…</option>
              {clientes.map((c:any) => <option key={c.id} value={c.id} style={{ background:C.vino }}>{c.razon_social}</option>)}
            </select>
          </div>
        )}

        {/* Header + acciones */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem', marginBottom:'2rem' }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:'clamp(1.4rem,2.5vw,1.9rem)', fontWeight:700, marginBottom:'0.3rem' }}>
              Documentos de Acreditación
            </div>
            <div style={{ fontSize:'0.78rem', color:'rgba(231,223,202,0.5)' }}>
              {total} archivo{total !== 1 ? 's' : ''} almacenado{total !== 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
            <button onClick={() => { setScanOpen(true); iniciarScan() }}
              disabled={!clienteId}
              style={{ background:'rgba(150,134,34,0.15)', color:C.olivo, border:`1px solid ${C.olivo}`, borderRadius:'8px', padding:'0.7rem 1.3rem', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', cursor: clienteId ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>
              Escanear carpeta
            </button>
            <button onClick={() => setUploadOpen(true)}
              style={{ background:C.olivo, color:C.vino, border:'none', borderRadius:'8px', padding:'0.7rem 1.3rem', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', cursor:'pointer', fontFamily:'inherit' }}>
              + Subir documento
            </button>
          </div>
        </div>

        {/* ── PANEL DESCARGA ZIP ── */}
        <div style={{ background:'rgba(231,223,202,0.05)', border:'1px solid rgba(150,134,34,0.2)', borderRadius:'12px', padding:'1.5rem', marginBottom:'2rem' }}>
          <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:C.olivo, marginBottom:'1rem' }}>
            Descargar paquete para el Ministerio
          </div>
          <div style={{ display:'flex', gap:'1rem', alignItems:'flex-end', flexWrap:'wrap' }}>
            <div>
              <label style={labelStyle}>Año</label>
              <input type="number" value={zipAnio} onChange={e => setZipAnio(parseInt(e.target.value))}
                min={2020} max={2030}
                style={{ ...inputStyle, width:'100px' }} />
            </div>
            <div>
              <label style={labelStyle}>Trimestre</label>
              <select value={zipTrim ?? ''} onChange={e => setZipTrim(e.target.value ? parseInt(e.target.value) : null)}
                style={{ ...inputStyle, width:'180px' }}>
                {TRIMESTRES.map(t => <option key={String(t.val)} value={t.val ?? ''} style={{ background:C.vino }}>{t.label}</option>)}
              </select>
            </div>
            <button onClick={descargarZip} disabled={zipping || !clienteId}
              style={{ background: zipping ? 'rgba(150,134,34,0.5)' : C.olivo, color:C.vino, border:'none', borderRadius:'8px', padding:'0.7rem 1.3rem', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', cursor: zipping ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
              {zipping ? 'Generando…' : 'Descargar ZIP'}
            </button>
          </div>
          <div style={{ fontSize:'0.7rem', color:'rgba(231,223,202,0.4)', marginTop:'0.8rem', lineHeight:1.6 }}>
            El archivo ZIP contendrá los documentos organizados por Aspecto › Obligación › Archivo, listos para presentar al Ministerio.
          </div>
        </div>

        {/* ── LISTA DE DOCUMENTOS ── */}
        {loading && <div style={{ textAlign:'center', padding:'3rem', color:'rgba(231,223,202,0.4)', fontSize:'0.85rem' }}>Cargando documentos…</div>}

        {!loading && grupos.length === 0 && (
          <div style={{ textAlign:'center', padding:'4rem', color:'rgba(231,223,202,0.3)', fontSize:'0.85rem' }}>
            No hay documentos aún. Sube el primer archivo con el botón de arriba.
          </div>
        )}

        {!loading && grupos.map(grupo => {
          const key    = grupoKey(grupo)
          const isOpen = abiertos.has(key)
          const color  = ASPECTO_COLOR[grupo.aspecto] ?? C.olivo

          return (
            <div key={key} style={{ marginBottom:'0.75rem', border:'1px solid rgba(150,134,34,0.2)', borderRadius:'10px', overflow:'hidden' }}>
              {/* Header grupo */}
              <button onClick={() => toggleGrupo(key)}
                style={{ width:'100%', background:'rgba(231,223,202,0.04)', border:'none', cursor:'pointer', padding:'1rem 1.3rem', display:'flex', alignItems:'center', justifyContent:'space-between', color:C.marfil, fontFamily:'inherit' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.8rem' }}>
                  <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:color, flexShrink:0 }} />
                  <span style={{ fontSize:'0.82rem', fontWeight:600 }}>{grupo.obligacion}</span>
                  <span style={{ fontSize:'0.65rem', background:`${color}22`, color, padding:'0.15rem 0.6rem', borderRadius:'8px', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>{grupo.aspecto}</span>
                  <span style={{ fontSize:'0.65rem', background:'rgba(150,134,34,0.12)', color:C.olivo, padding:'0.15rem 0.6rem', borderRadius:'8px', fontWeight:700 }}>
                    {grupo.anio}{grupo.trimestre ? ` · Q${grupo.trimestre}` : ''}
                  </span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.8rem' }}>
                  <span style={{ fontSize:'0.7rem', color:'rgba(231,223,202,0.45)' }}>{grupo.archivos.length} archivo{grupo.archivos.length !== 1 ? 's' : ''}</span>
                  <span style={{ color:'rgba(231,223,202,0.4)', fontSize:'0.75rem', transform: isOpen ? 'rotate(180deg)' : 'none', transition:'0.2s' }}>▼</span>
                </div>
              </button>

              {/* Archivos */}
              {isOpen && (
                <div style={{ borderTop:'1px solid rgba(150,134,34,0.12)', padding:'0.5rem' }}>
                  {grupo.archivos.map(arch => (
                    <div key={arch.id} style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'0.7rem 0.8rem', borderRadius:'8px', background:'rgba(0,0,0,0.15)', marginBottom:'0.4rem' }}>
                      <span style={{ fontSize:'1.3rem' }}>{iconoPorNombre(arch.nombre_archivo)}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'0.82rem', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {arch.nombre_archivo}
                        </div>
                        <div style={{ fontSize:'0.65rem', color:'rgba(231,223,202,0.45)', marginTop:'0.2rem' }}>
                          Subido por {arch.subido_por} · {formatFecha(arch.uploaded_at)}
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'0.5rem', flexShrink:0 }}>
                        <a href={`/api/documentos/archivo?docId=${arch.id}`} target="_blank"
                          style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.olivo, textDecoration:'none', background:'rgba(150,134,34,0.12)', padding:'0.3rem 0.7rem', borderRadius:'6px' }}>
                          Ver
                        </a>
                        <button onClick={() => eliminar(arch.id)}
                          style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#dc2626', background:'rgba(220,38,38,0.1)', border:'none', padding:'0.3rem 0.7rem', borderRadius:'6px', cursor:'pointer', fontFamily:'inherit' }}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </main>

      {/* ── MODAL SCANNER ── */}
      {scanOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'1rem' }}>
          <div style={{ background:'#1a0204', border:'1px solid rgba(150,134,34,0.3)', borderRadius:'16px', padding:'2rem', width:'100%', maxWidth:'760px', maxHeight:'90vh', overflowY:'auto' }}>

            {/* Título */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem' }}>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:'1.3rem', fontWeight:700 }}>Escanear carpeta del proveedor</div>
              <button onClick={() => { setScanOpen(false); setScanResult(null); setImportResult(null) }}
                style={{ background:'none', border:'none', color:'rgba(231,223,202,0.5)', fontSize:'1.2rem', cursor:'pointer', fontFamily:'inherit' }}>
                ✕
              </button>
            </div>

            {/* Estado: escaneando */}
            {scanning && (
              <div style={{ textAlign:'center', padding:'3rem', color:'rgba(231,223,202,0.5)', fontSize:'0.85rem' }}>
                Escaneando carpeta…
              </div>
            )}

            {/* Error */}
            {scanError && (
              <div style={{ background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:'8px', padding:'1rem', fontSize:'0.82rem', color:'#f87171' }}>
                {scanError}
              </div>
            )}

            {/* Resultado importación */}
            {importResult && (
              <div style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:'8px', padding:'1rem', fontSize:'0.82rem', color:'#6ee7b7', marginBottom:'1rem' }}>
                Se importaron {importResult.importados} documento{importResult.importados !== 1 ? 's' : ''} correctamente.
              </div>
            )}

            {/* Resultado del scan */}
            {!scanning && scanResult && (
              <>
                {/* Resumen */}
                <div style={{ display:'flex', gap:'1.5rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
                  {[
                    { label: 'Total encontrados', val: scanResult.total },
                    { label: 'Ya registrados',    val: scanResult.ya_registrados },
                    { label: 'Por importar',       val: scanResult.reconocidos.length },
                    { label: 'No reconocidos',     val: scanResult.no_reconocidos.length },
                  ].map(stat => (
                    <div key={stat.label} style={{ background:'rgba(231,223,202,0.05)', border:'1px solid rgba(150,134,34,0.2)', borderRadius:'10px', padding:'0.8rem 1.2rem', minWidth:'120px' }}>
                      <div style={{ fontSize:'1.4rem', fontWeight:700, color:C.olivo }}>{stat.val}</div>
                      <div style={{ fontSize:'0.65rem', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(231,223,202,0.45)', marginTop:'0.2rem' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Lista reconocidos */}
                {scanResult.reconocidos.length > 0 && (
                  <>
                    <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:C.olivo, marginBottom:'0.8rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span>Archivos reconocidos ({scanResult.reconocidos.length})</span>
                      <div style={{ display:'flex', gap:'0.5rem' }}>
                        <button onClick={() => setScanSeleccion(new Set(scanResult.reconocidos.map(a => a.ref)))}
                          style={{ fontSize:'0.62rem', background:'none', border:'1px solid rgba(150,134,34,0.4)', color:C.olivo, borderRadius:'6px', padding:'0.25rem 0.6rem', cursor:'pointer', fontFamily:'inherit' }}>
                          Seleccionar todo
                        </button>
                        <button onClick={() => setScanSeleccion(new Set())}
                          style={{ fontSize:'0.62rem', background:'none', border:'1px solid rgba(231,223,202,0.2)', color:'rgba(231,223,202,0.5)', borderRadius:'6px', padding:'0.25rem 0.6rem', cursor:'pointer', fontFamily:'inherit' }}>
                          Ninguno
                        </button>
                      </div>
                    </div>
                    <div style={{ maxHeight:'280px', overflowY:'auto', marginBottom:'1.5rem', borderRadius:'8px', border:'1px solid rgba(150,134,34,0.15)' }}>
                      {scanResult.reconocidos.map(a => (
                        <label key={a.ref} style={{ display:'flex', alignItems:'center', gap:'0.9rem', padding:'0.75rem 1rem', cursor:'pointer', borderBottom:'1px solid rgba(150,134,34,0.08)', background: scanSeleccion.has(a.ref) ? 'rgba(150,134,34,0.07)' : 'transparent' }}>
                          <input type="checkbox" checked={scanSeleccion.has(a.ref)}
                            onChange={() => toggleScanItem(a.ref)}
                            style={{ accentColor: C.olivo, width:'16px', height:'16px', flexShrink:0 }} />
                          <span style={{ fontSize:'1rem', flexShrink:0 }}>{iconoPorNombre(a.nombre)}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:'0.82rem', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {a.nombre}
                            </div>
                            <div style={{ fontSize:'0.65rem', color:'rgba(231,223,202,0.4)', marginTop:'0.15rem' }}>
                              {a.aspecto} › {a.obligacion} · {a.anio}{a.trimestre ? ` Q${a.trimestre}` : ' · Permanente'}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </>
                )}

                {/* No reconocidos */}
                {scanResult.no_reconocidos.length > 0 && (
                  <details style={{ marginBottom:'1.5rem' }}>
                    <summary style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'rgba(231,223,202,0.35)', cursor:'pointer' }}>
                      Archivos no reconocidos ({scanResult.no_reconocidos.length}) — fuera de estructura esperada
                    </summary>
                    <div style={{ marginTop:'0.6rem', maxHeight:'180px', overflowY:'auto', borderRadius:'8px', border:'1px solid rgba(231,223,202,0.08)' }}>
                      {scanResult.no_reconocidos.map(a => (
                        <div key={a.ref} style={{ padding:'0.6rem 1rem', borderBottom:'1px solid rgba(231,223,202,0.05)', fontSize:'0.75rem', color:'rgba(231,223,202,0.4)' }}>
                          <span style={{ fontWeight:600 }}>{a.nombre}</span>
                          {a.razon && <span style={{ marginLeft:'0.5rem', fontSize:'0.65rem' }}>— {a.razon}</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {scanResult.reconocidos.length === 0 && scanResult.no_reconocidos.length === 0 && (
                  <div style={{ textAlign:'center', padding:'2rem', color:'rgba(231,223,202,0.3)', fontSize:'0.85rem' }}>
                    No se encontraron archivos nuevos en la carpeta.
                  </div>
                )}

                {/* Acciones */}
                <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end', marginTop:'0.5rem' }}>
                  <button onClick={iniciarScan} disabled={scanning}
                    style={{ background:'rgba(231,223,202,0.08)', color:C.marfil, border:'1px solid rgba(231,223,202,0.15)', borderRadius:'8px', padding:'0.7rem 1.2rem', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', cursor:'pointer', fontFamily:'inherit' }}>
                    Volver a escanear
                  </button>
                  <button onClick={importarSeleccionados}
                    disabled={importando || scanSeleccion.size === 0}
                    style={{ background: (importando || scanSeleccion.size === 0) ? 'rgba(150,134,34,0.4)' : C.olivo, color:C.vino, border:'none', borderRadius:'8px', padding:'0.7rem 1.5rem', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', cursor: (importando || scanSeleccion.size === 0) ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                    {importando ? 'Importando…' : `Importar ${scanSeleccion.size > 0 ? scanSeleccion.size + ' archivo' + (scanSeleccion.size !== 1 ? 's' : '') : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL SUBIR ARCHIVO ── */}
      {uploadOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'1rem' }}>
          <div style={{ background:'#1a0204', border:'1px solid rgba(150,134,34,0.3)', borderRadius:'16px', padding:'2rem', width:'100%', maxWidth:'540px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:'1.3rem', fontWeight:700, marginBottom:'1.5rem' }}>Subir documento</div>

            <form onSubmit={subirArchivo}>
              {/* Obligación */}
              <div style={{ marginBottom:'1.1rem' }}>
                <label style={labelStyle}>Obligación</label>
                <select required value={upOblId}
                  onChange={e => {
                    const obl = obligaciones.find(o => o.obl_id === e.target.value)
                    setUpOblId(e.target.value)
                    setUpAspecto(obl?.aspecto ?? '')
                    setUpObligacion(obl?.obligacion ?? '')
                  }}
                  style={{ ...inputStyle, width:'100%' }}>
                  <option value="">Selecciona la obligación…</option>
                  {oblsUnicas.map((o: any, i: number) => (
                    <option key={i} value={o.obl_id} style={{ background:C.vino }}>
                      [{o.aspecto}] {o.obligacion}
                    </option>
                  ))}
                </select>
              </div>

              {/* Año y trimestre */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.1rem' }}>
                <div>
                  <label style={labelStyle}>Año</label>
                  <input type="number" required value={upAnio} onChange={e => setUpAnio(parseInt(e.target.value))}
                    min={2020} max={2030} style={{ ...inputStyle, width:'100%' }} />
                </div>
                <div>
                  <label style={labelStyle}>Trimestre</label>
                  <select value={upTrimestre ?? ''} onChange={e => setUpTrimestre(e.target.value ? parseInt(e.target.value) : null)}
                    style={{ ...inputStyle, width:'100%' }}>
                    {TRIMESTRES.map(t => <option key={String(t.val)} value={t.val ?? ''} style={{ background:C.vino }}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Archivo */}
              <div style={{ marginBottom:'1.5rem' }}>
                <label style={labelStyle}>Archivo (PDF, Word, Excel, imagen — máx. 20 MB)</label>
                <input ref={fileRef} type="file" required
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  onChange={e => setUpArchivo(e.target.files?.[0] ?? null)}
                  style={{ display:'block', width:'100%', padding:'0.7rem', background:'rgba(231,223,202,0.06)', border:'1px solid rgba(150,134,34,0.3)', borderRadius:'8px', color:C.marfil, fontSize:'0.82rem', fontFamily:'inherit', cursor:'pointer' }} />
              </div>

              {upError && (
                <div style={{ background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:'8px', padding:'0.7rem 1rem', fontSize:'0.8rem', color:'#f87171', marginBottom:'1rem' }}>
                  {upError}
                </div>
              )}

              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
                <button type="button" onClick={() => { setUploadOpen(false); setUpError('') }}
                  style={{ background:'rgba(231,223,202,0.08)', color:C.marfil, border:'1px solid rgba(231,223,202,0.15)', borderRadius:'8px', padding:'0.7rem 1.3rem', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', cursor:'pointer', fontFamily:'inherit' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={uploading || !upOblId || !upArchivo}
                  style={{ background: uploading ? 'rgba(150,134,34,0.5)' : C.olivo, color:C.vino, border:'none', borderRadius:'8px', padding:'0.7rem 1.5rem', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', cursor: uploading ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                  {uploading ? 'Subiendo…' : 'Subir archivo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display:'block', fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.15em',
  textTransform:'uppercase', color:'rgba(231,223,202,0.6)', marginBottom:'0.4rem',
}

const inputStyle: React.CSSProperties = {
  background:'rgba(231,223,202,0.06)', border:'1px solid rgba(150,134,34,0.3)',
  borderRadius:'8px', padding:'0.65rem 0.9rem', color:'#e7dfca',
  fontSize:'0.88rem', fontFamily:'inherit', outline:'none',
}

function iconoPorNombre(nombre: string): string {
  const ext = nombre.split('.').pop()?.toLowerCase()
  if (ext === 'pdf')              return '📄'
  if (['doc','docx'].includes(ext ?? '')) return '📝'
  if (['xls','xlsx'].includes(ext ?? '')) return '📊'
  if (['jpg','jpeg','png'].includes(ext ?? '')) return '🖼️'
  return '📎'
}

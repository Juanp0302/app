'use client'

import { useEffect, useState, useCallback } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

const ESPECIALIDADES = ['financiera', 'tecnica', 'juridica', 'transversal'] as const
const TIPOS          = ['ticket', 'chat', 'documento'] as const

const ESP_LABEL: Record<string, string> = {
  financiera:  'Financiera',
  tecnica:     'Técnica',
  juridica:    'Jurídica',
  transversal: 'Transversal',
}
const ESP_COLOR: Record<string, string> = {
  financiera:  '#3b82f6',
  tecnica:     '#10b981',
  juridica:    '#f59e0b',
  transversal: '#8b5cf6',
}
const TIPO_LABEL: Record<string, string> = { ticket: 'Tickets', chat: 'Chats', documento: 'Documentos' }
const TIPO_ICON:  Record<string, string> = { ticket: '🎫', chat: '💬', documento: '📁' }

interface AdminInfo { id: string; nombre: string; email: string; especialidades: string[] }

interface CeldaConfig {
  modo:     'unico' | 'consecutivo'
  adminIds: string[]
  contador: number
}

type Configs = Record<string, Record<string, CeldaConfig>>

export default function AsignacionClient() {
  const [admins,   setAdmins]   = useState<AdminInfo[]>([])
  const [configs,  setConfigs]  = useState<Configs>({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState<string | null>(null)   // "esp:tipo"
  const [saved,    setSaved]    = useState<string | null>(null)   // feedback visual
  const [error,    setError]    = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/superadmin/asignacion')
      const d = await r.json()
      setAdmins(d.admins ?? [])
      setConfigs(d.configs ?? {})
    } catch { setError('Error al cargar configuraciones') }
    finally  { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function getCelda(esp: string, tipo: string): CeldaConfig {
    return configs[esp]?.[tipo] ?? { modo: 'consecutivo', adminIds: [], contador: 0 }
  }

  function setCelda(esp: string, tipo: string, patch: Partial<CeldaConfig>) {
    setConfigs(prev => ({
      ...prev,
      [esp]: {
        ...(prev[esp] ?? {}),
        [tipo]: { ...getCelda(esp, tipo), ...patch },
      },
    }))
  }

  async function guardar(esp: string, tipo: string) {
    const celda = getCelda(esp, tipo)
    const key   = `${esp}:${tipo}`
    setSaving(key)
    try {
      const res = await fetch('/api/superadmin/asignacion', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tipo, especialidad: esp, modo: celda.modo, adminIds: celda.adminIds }),
      })
      if (!res.ok) { setError('Error al guardar'); return }
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
    } catch { setError('Error de red') }
    finally  { setSaving(null) }
  }

  function moverAdmin(esp: string, tipo: string, idx: number, dir: -1 | 1) {
    const celda = getCelda(esp, tipo)
    const ids   = [...celda.adminIds]
    const dest  = idx + dir
    if (dest < 0 || dest >= ids.length) return
    ;[ids[idx], ids[dest]] = [ids[dest], ids[idx]]
    setCelda(esp, tipo, { adminIds: ids })
  }

  function toggleAdmin(esp: string, tipo: string, adminId: string) {
    const celda  = getCelda(esp, tipo)
    const tiene  = celda.adminIds.includes(adminId)
    const ids    = tiene
      ? celda.adminIds.filter(id => id !== adminId)
      : [...celda.adminIds, adminId]
    setCelda(esp, tipo, { adminIds: ids })
  }

  const adminsPorEsp = (esp: string) =>
    admins.filter(a => a.especialidades.includes(esp))

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.vino, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: 'rgba(231,223,202,0.4)', fontFamily: "'Josefin Sans', sans-serif" }}>
      Cargando configuraciones…
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.vino, fontFamily: "'Josefin Sans', sans-serif", color: C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{ background: 'rgba(39,2,5,0.97)', borderBottom: '1px solid rgba(150,134,34,0.2)',
        padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem',
        position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/dashboard/superadmin" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem',
          fontWeight: 700, color: C.marfil, textDecoration: 'none' }}>Owl Compliance</a>
        <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
        <a href="/dashboard/superadmin" style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', textDecoration: 'none' }}>
          Vista Global
        </a>
        <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: C.olivo }}>
          Reglas de Asignación
        </span>
        <a href="/signout" style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700,
          letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'rgba(231,223,202,0.5)', textDecoration: 'none' }}>Salir</a>
      </nav>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem' }}>

        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(1.3rem,2.5vw,1.8rem)',
          fontWeight: 700, marginBottom: '0.4rem' }}>Reglas de Asignación</div>
        <p style={{ fontSize: '0.82rem', color: 'rgba(231,223,202,0.55)', marginBottom: '2.5rem', lineHeight: 1.7 }}>
          Configura cómo se asignan los tickets, chats y revisiones de documentos a cada administrador según su especialidad.
          Los cambios aplican a las nuevas asignaciones; las existentes no se reasignan.
        </p>

        {error && (
          <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
            borderRadius: 10, padding: '0.8rem 1.2rem', fontSize: '0.82rem', color: '#f87171', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {ESPECIALIDADES.map(esp => {
            const disponibles = adminsPorEsp(esp)
            const color       = ESP_COLOR[esp]

            return (
              <div key={esp}>
                {/* Cabecera especialidad */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, display: 'inline-block' }} />
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700 }}>
                    {ESP_LABEL[esp]}
                  </span>
                  {disponibles.length === 0 && (
                    <span style={{ fontSize: '0.68rem', color: '#f87171', background: 'rgba(220,38,38,0.1)',
                      border: '1px solid rgba(220,38,38,0.25)', borderRadius: 20, padding: '2px 10px' }}>
                      Sin administradores con esta especialidad
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  {TIPOS.map(tipo => {
                    const celda = getCelda(esp, tipo)
                    const key   = `${esp}:${tipo}`
                    const isSav = saving === key
                    const isDone = saved  === key

                    return (
                      <div key={tipo} style={{ background: 'rgba(231,223,202,0.04)',
                        border: `1px solid ${isDone ? 'rgba(22,163,74,0.5)' : 'rgba(150,134,34,0.2)'}`,
                        borderRadius: 14, padding: '1.25rem 1.5rem',
                        transition: 'border-color 0.3s' }}>

                        {/* Cabecera tipo */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1rem' }}>{TIPO_ICON[tipo]}</span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em',
                              textTransform: 'uppercase', color: C.olivo }}>
                              {TIPO_LABEL[tipo]}
                            </span>
                          </div>
                          <button
                            onClick={() => guardar(esp, tipo)}
                            disabled={isSav}
                            style={{
                              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
                              textTransform: 'uppercase', border: 'none', borderRadius: 8,
                              padding: '0.4rem 0.9rem', cursor: isSav ? 'wait' : 'pointer',
                              fontFamily: 'inherit',
                              background: isDone ? 'rgba(22,163,74,0.2)' : 'rgba(150,134,34,0.15)',
                              color:      isDone ? '#16a34a'              : C.olivo,
                            }}>
                            {isSav ? 'Guardando…' : isDone ? '✓ Guardado' : 'Guardar'}
                          </button>
                        </div>

                        {/* Selector de modo */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                          {(['consecutivo', 'unico'] as const).map(m => (
                            <button key={m} onClick={() => setCelda(esp, tipo, { modo: m })}
                              style={{
                                flex: 1, padding: '0.55rem 0.5rem',
                                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em',
                                textTransform: 'uppercase', border: '1px solid',
                                borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                                borderColor:  celda.modo === m ? color : 'rgba(150,134,34,0.2)',
                                background:   celda.modo === m ? `${color}20` : 'transparent',
                                color:        celda.modo === m ? color : 'rgba(231,223,202,0.4)',
                              }}>
                              {m === 'consecutivo' ? 'Turno rotativo' : 'Una persona'}
                            </button>
                          ))}
                        </div>

                        {/* Descripción del modo */}
                        <p style={{ fontSize: '0.72rem', color: 'rgba(231,223,202,0.4)', marginBottom: '1rem', lineHeight: 1.6 }}>
                          {celda.modo === 'consecutivo'
                            ? `Cada nuevo ${TIPO_LABEL[tipo].toLowerCase().replace('s','')} se asigna al siguiente admin en la lista, rotando en orden.`
                            : `Todos van al primer admin de la lista; él los redistribuye manualmente.`}
                        </p>

                        {/* Lista de admins disponibles */}
                        {disponibles.length === 0 ? (
                          <p style={{ fontSize: '0.75rem', color: 'rgba(231,223,202,0.25)', fontStyle: 'italic' }}>
                            Asigna la especialidad {ESP_LABEL[esp]} a algún administrador desde el panel de Administradores.
                          </p>
                        ) : (
                          <div>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em',
                              textTransform: 'uppercase', color: 'rgba(231,223,202,0.35)', marginBottom: '0.5rem' }}>
                              {celda.modo === 'consecutivo' ? 'Orden de rotación' : 'Responsable principal (1°)'}
                            </div>

                            {/* Admins en el orden configurado */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {/* Primero los que están en la lista, en orden */}
                              {celda.adminIds
                                .filter(id => disponibles.some(a => a.id === id))
                                .map((adminId, idx) => {
                                  const admin = disponibles.find(a => a.id === adminId)!
                                  return (
                                    <div key={adminId} style={{
                                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                                      background: 'rgba(231,223,202,0.06)', borderRadius: 8,
                                      padding: '0.5rem 0.75rem',
                                      border: `1px solid ${color}35`,
                                    }}>
                                      {/* Número de turno */}
                                      {celda.modo === 'consecutivo' && (
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color,
                                          minWidth: 20, textAlign: 'center' }}>
                                          {idx + 1}
                                        </span>
                                      )}
                                      {celda.modo === 'unico' && idx === 0 && (
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: C.olivo,
                                          minWidth: 20, textAlign: 'center' }}>★</span>
                                      )}

                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{admin.nombre}</div>
                                        <div style={{ fontSize: '0.65rem', color: 'rgba(231,223,202,0.4)',
                                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {admin.email}
                                        </div>
                                      </div>

                                      {/* Mover arriba/abajo */}
                                      {celda.modo === 'consecutivo' && (
                                        <div style={{ display: 'flex', gap: '2px' }}>
                                          <button onClick={() => moverAdmin(esp, tipo, idx, -1)}
                                            disabled={idx === 0}
                                            style={{ background: 'transparent', border: '1px solid rgba(150,134,34,0.2)',
                                              borderRadius: 6, color: idx === 0 ? 'rgba(231,223,202,0.2)' : C.olivo,
                                              cursor: idx === 0 ? 'default' : 'pointer', fontSize: '0.75rem',
                                              padding: '1px 6px', fontFamily: 'inherit', lineHeight: 1 }}>↑</button>
                                          <button onClick={() => moverAdmin(esp, tipo, idx,  1)}
                                            disabled={idx === celda.adminIds.filter(id => disponibles.some(a => a.id === id)).length - 1}
                                            style={{ background: 'transparent', border: '1px solid rgba(150,134,34,0.2)',
                                              borderRadius: 6,
                                              color: idx === celda.adminIds.filter(id => disponibles.some(a => a.id === id)).length - 1
                                                ? 'rgba(231,223,202,0.2)' : C.olivo,
                                              cursor: idx === celda.adminIds.filter(id => disponibles.some(a => a.id === id)).length - 1
                                                ? 'default' : 'pointer',
                                              fontSize: '0.75rem', padding: '1px 6px', fontFamily: 'inherit', lineHeight: 1 }}>↓</button>
                                        </div>
                                      )}

                                      {/* Quitar */}
                                      <button onClick={() => toggleAdmin(esp, tipo, adminId)}
                                        style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
                                          borderRadius: 6, color: '#f87171', cursor: 'pointer', fontSize: '0.7rem',
                                          padding: '2px 8px', fontFamily: 'inherit' }}>
                                        Quitar
                                      </button>
                                    </div>
                                  )
                                })}

                              {/* Admins disponibles que NO están en la lista */}
                              {disponibles.filter(a => !celda.adminIds.includes(a.id)).map(admin => (
                                <div key={admin.id} style={{
                                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                                  background: 'rgba(231,223,202,0.02)', borderRadius: 8,
                                  padding: '0.5rem 0.75rem',
                                  border: '1px solid rgba(150,134,34,0.1)',
                                  opacity: 0.55,
                                }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.82rem' }}>{admin.nombre}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'rgba(231,223,202,0.35)' }}>{admin.email}</div>
                                  </div>
                                  <button onClick={() => toggleAdmin(esp, tipo, admin.id)}
                                    style={{ background: `${color}15`, border: `1px solid ${color}35`,
                                      borderRadius: 6, color, cursor: 'pointer', fontSize: '0.7rem',
                                      padding: '2px 10px', fontFamily: 'inherit', fontWeight: 700 }}>
                                    + Agregar
                                  </button>
                                </div>
                              ))}

                              {/* Indicador de contador (modo consecutivo) */}
                              {celda.modo === 'consecutivo' && celda.adminIds.length > 0 && (
                                <div style={{ fontSize: '0.65rem', color: 'rgba(231,223,202,0.3)',
                                  marginTop: '0.25rem', paddingLeft: '0.25rem' }}>
                                  Próximo turno: posición {(celda.contador % celda.adminIds.length) + 1}
                                  {' '}· {celda.contador} asignaciones realizadas
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}

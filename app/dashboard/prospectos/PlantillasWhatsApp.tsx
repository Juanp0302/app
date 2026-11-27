'use client'

import { useCallback, useEffect, useState } from 'react'

const C = { vino: '#270205', bordo: '#712529' }
const COLOR: Record<string, string> = { APPROVED: '#16a34a', PENDING: '#b45309', REJECTED: '#dc2626', 'SIN REGISTRAR': '#6b7280' }
const ESTADO: Record<string, string> = { APPROVED: 'Aprobada', PENDING: 'En revisión de Meta', REJECTED: 'Rechazada', PAUSED: 'Pausada', DISABLED: 'Desactivada', 'SIN REGISTRAR': 'Sin registrar' }

/**
 * Plantillas de WhatsApp (lib/plantillas-whatsapp.ts), solo superadmin: su texto, su estado en Meta y el botón para
 * registrarlas. Meta tiene que aprobarlas antes de que el sistema pueda escribirle primero a alguien por WhatsApp.
 */
export default function PlantillasWhatsApp({ onCerrar }: { onCerrar: () => void }) {
  const [d, setD] = useState<any>(null)
  const [registrando, setRegistrando] = useState(false)
  const [resultado, setResultado] = useState<any[] | null>(null)
  const [telefono, setTelefono] = useState('')
  const [prueba, setPrueba] = useState<Record<string, string>>({})

  async function probar(nombre: string) {
    setPrueba(p => ({ ...p, [nombre]: 'Enviando…' }))
    const r = await fetch('/api/superadmin/whatsapp-plantillas', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'probar', nombre, telefono }) })
    const j = await r.json().catch(() => ({}))
    setPrueba(p => ({ ...p, [nombre]: r.ok ? `✓ Enviada a ${j.para}` : `⚠ ${j.error ?? 'No se pudo enviar'}` }))
  }
  const cargar = useCallback(() => {
    fetch('/api/superadmin/whatsapp-plantillas').then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar', plantillas: [] }))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function registrar() {
    if (!window.confirm('¿Registrar en Meta las plantillas que faltan? Meta las revisa (puede tardar de minutos a un día). Revisa antes que los textos estén aprobados.')) return
    setRegistrando(true)
    const r = await fetch('/api/superadmin/whatsapp-plantillas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const j = await r.json().catch(() => ({}))
    setRegistrando(false)
    setResultado(j.resultados ?? [{ nombre: '—', resultado: j.error ?? 'error' }])
    cargar()
  }

  const faltan = (d?.plantillas ?? []).filter((p: any) => p.estado === 'SIN REGISTRAR').length
  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 720, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.4rem 1.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: C.vino }}>Plantillas de WhatsApp</div>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ fontSize: 12.5, color: '#555', margin: '0 0 1rem' }}>
          Para escribirle primero a alguien (o después de 24 horas sin que escriba), Meta exige plantillas aprobadas. Cada una entregada
          se cobra: ~US$0,0125 las de marketing y ~US$0,0008 las de utilidad. Mientras una plantilla no esté aprobada, los pasos que la usan esperan.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 10px', marginBottom: 12 }}>
          <span>Celular de prueba:</span>
          <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="3001234567"
            style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 12.5, width: 140 }} />
          <span style={{ color: '#666' }}>Con "Enviar prueba" le llega la plantilla con los datos de ejemplo. No toca ningún prospecto.</span>
        </div>
        {!d && <div style={{ color: '#aaa', fontSize: 13 }}>Cargando…</div>}
        {d?.error && <div style={{ fontSize: 12, color: '#b45309', background: '#fef3c7', padding: '6px 10px', borderRadius: 6, marginBottom: 10 }}>Meta: {d.error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(d?.plantillas ?? []).map((p: any) => (
            <div key={p.nombre} style={{ border: '1px solid #eee', borderRadius: 8, padding: '0.7rem 0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}>
                <strong>{p.titulo}</strong>
                <span style={{ color: COLOR[p.estado] ?? '#6b7280', fontWeight: 700 }}>{ESTADO[p.estado] ?? p.estado}</span>
              </div>
              <div style={{ fontSize: 11, color: '#999', margin: '2px 0 6px' }}>{p.nombre} · {p.categoria === 'UTILITY' ? 'utilidad' : 'marketing'}{p.motivo ? ` · motivo del rechazo: ${p.motivo}` : ''}</div>
              <div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap', background: '#f9fafb', borderRadius: 6, padding: '0.5rem 0.7rem' }}>{p.ejemplo}</div>
              {p.boton && <div style={{ fontSize: 11.5, color: '#0e7490', marginTop: 4 }}>Botón: {p.boton}</div>}
              {p.estado === 'APPROVED' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <button onClick={() => probar(p.nombre)} disabled={!telefono.trim() || prueba[p.nombre] === 'Enviando…'}
                    style={{ background: '#fff', border: '1px solid #16a34a', color: '#16a34a', borderRadius: 6, padding: '3px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', opacity: telefono.trim() ? 1 : 0.5 }}>
                    Enviar prueba
                  </button>
                  {prueba[p.nombre] && <span style={{ fontSize: 11.5, color: prueba[p.nombre].startsWith('✓') ? '#16a34a' : '#b45309' }}>{prueba[p.nombre]}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
        {resultado && (
          <div style={{ fontSize: 12, marginTop: 12, background: '#f3f4f6', borderRadius: 6, padding: '6px 10px' }}>
            {resultado.map((r: any) => <div key={r.nombre}>{r.nombre}: {r.resultado}</div>)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
          <button onClick={registrar} disabled={registrando || !d || !faltan}
            style={{ background: C.bordo, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: registrando || !faltan ? 0.5 : 1 }}>
            {registrando ? 'Registrando…' : `Registrar en Meta (${faltan})`}
          </button>
          <button onClick={cargar} style={{ background: 'none', border: '1px solid #ccc', borderRadius: 6, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>Actualizar estado</button>
        </div>
      </div>
    </div>
  )
}

/**
 * setup-db.mjs
 *
 * Crea la base de datos SQLite local con todas las tablas y
 * carga las obligaciones desde data/obligaciones.json
 *
 * Uso: node scripts/setup-db.mjs
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH   = path.join(__dirname, '../data/owl.db')
const OBL_PATH  = path.join(__dirname, '../data/obligaciones.json')

// ─── Abrir / crear base de datos ─────────────────────────────────────────────

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

console.log('Creando tablas...')

// ─── TABLAS ───────────────────────────────────────────────────────────────────

db.exec(`

-- Usuarios del sistema (admin y clientes)
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,         -- hash bcrypt
  nombre      TEXT NOT NULL,
  rol         TEXT NOT NULL CHECK(rol IN ('admin','cliente')),
  activo      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Empresas clientes
CREATE TABLE IF NOT EXISTS clientes (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  razon_social  TEXT NOT NULL,
  nit           TEXT,
  contacto      TEXT,             -- nombre persona de contacto
  email         TEXT,
  telefono      TEXT,
  activo        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Servicios que presta cada cliente (ISP, IPTV, etc.)
CREATE TABLE IF NOT EXISTS cliente_servicios (
  id          TEXT PRIMARY KEY,
  cliente_id  TEXT NOT NULL REFERENCES clientes(id),
  servicio    TEXT NOT NULL,      -- slug del servicio: isp_sva, iptv_sva, etc.
  activo      INTEGER NOT NULL DEFAULT 1,
  added_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Catálogo maestro de obligaciones (cargado desde obligaciones.json)
CREATE TABLE IF NOT EXISTS obligaciones_catalogo (
  id              INTEGER,         -- id de la obligación padre (puede repetirse entre subobligaciones)
  categoria       TEXT NOT NULL,   -- SVA, Telefonía Móvil, etc.
  servicio        TEXT NOT NULL,   -- ISP (SVA), IPTV, etc.
  servicio_slug   TEXT NOT NULL,
  aspecto         TEXT NOT NULL,   -- FINANCIERO, JURÍDICO, TÉCNICO, TRANSVERSAL, ADMINISTRATIVO
  grupo           TEXT NOT NULL,
  obligacion      TEXT NOT NULL,
  descripcion     TEXT,
  sub_id          INTEGER NOT NULL PRIMARY KEY,
  sub_titulo      TEXT NOT NULL,
  periodicidad    TEXT NOT NULL,   -- PERMANENTE, TRIMESTRAL, SEMESTRAL, ANUAL, EVENTUAL
  normatividad    TEXT             -- JSON array de textos normativos
);

-- Obligaciones asignadas a cada cliente (se generan al crear/actualizar servicios)
CREATE TABLE IF NOT EXISTS cliente_obligaciones (
  id              TEXT PRIMARY KEY,
  cliente_id      TEXT NOT NULL REFERENCES clientes(id),
  catalogo_id     INTEGER NOT NULL REFERENCES obligaciones_catalogo(sub_id),
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK(estado IN ('pendiente','en_progreso','cumplida','vencida','no_aplica')),
  fecha_limite    TEXT,            -- fecha concreta de vencimiento (si aplica)
  updated_by      TEXT,            -- user_id de quien hizo el último cambio
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Documentos de acreditación de cumplimiento
CREATE TABLE IF NOT EXISTS documentos (
  id                  TEXT PRIMARY KEY,
  cliente_id          TEXT NOT NULL REFERENCES clientes(id),
  cliente_obl_id      TEXT REFERENCES cliente_obligaciones(id),
  nombre_archivo      TEXT NOT NULL,
  ruta                TEXT NOT NULL,    -- ruta relativa en almacenamiento
  anio                INTEGER NOT NULL,
  trimestre           INTEGER,          -- 1-4, NULL si no aplica
  uploaded_by         TEXT NOT NULL REFERENCES users(id),
  uploaded_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Bitácora de cambios (auditoría)
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  user_email  TEXT NOT NULL,
  accion      TEXT NOT NULL,     -- 'estado_cambiado', 'documento_subido', 'documento_eliminado', etc.
  entidad     TEXT NOT NULL,     -- 'obligacion', 'documento', 'cliente', etc.
  entidad_id  TEXT NOT NULL,
  detalle     TEXT,              -- JSON con datos antes/después
  ip          TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Recordatorios configurados por obligación
CREATE TABLE IF NOT EXISTS recordatorios (
  id              TEXT PRIMARY KEY,
  cliente_id      TEXT NOT NULL REFERENCES clientes(id),
  cliente_obl_id  TEXT NOT NULL REFERENCES cliente_obligaciones(id),
  dias_antes      INTEGER NOT NULL DEFAULT 7,
  email_destino   TEXT NOT NULL,
  activo          INTEGER NOT NULL DEFAULT 1,
  ultimo_envio    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

`)

console.log('✓ Tablas creadas')

// ─── CARGAR CATÁLOGO DE OBLIGACIONES ─────────────────────────────────────────

const oblData = JSON.parse(fs.readFileSync(OBL_PATH, 'utf-8'))

const existing = db.prepare('SELECT COUNT(*) as n FROM obligaciones_catalogo').get()
if (existing.n > 0) {
  console.log(`✓ Catálogo ya cargado (${existing.n} subobligaciones). Saltando.`)
} else {
  const insert = db.prepare(`
    INSERT INTO obligaciones_catalogo
      (id, categoria, servicio, servicio_slug, aspecto, grupo, obligacion, descripcion,
       sub_id, sub_titulo, periodicidad, normatividad)
    VALUES
      (@id, @categoria, @servicio, @servicio_slug, @aspecto, @grupo, @obligacion, @descripcion,
       @sub_id, @sub_titulo, @periodicidad, @normatividad)
  `)

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row)
  })

  const rows = []
  for (const cat of oblData.categorias) {
    for (const serv of cat.servicios) {
      for (const asp of serv.aspectos) {
        for (const grp of asp.grupos) {
          for (const obl of grp.obligaciones) {
            for (const sub of obl.subobligaciones) {
              rows.push({
                id:            obl.id,
                categoria:     cat.nombre.replace(/^[^\w]+/, '').trim(),
                servicio:      serv.nombre,
                servicio_slug: serv.slug,
                aspecto:       asp.nombre,
                grupo:         grp.nombre,
                obligacion:    obl.nombre,
                descripcion:   obl.descripcion || null,
                sub_id:        sub.id,
                sub_titulo:    sub.titulo,
                periodicidad:  sub.periodicidad,
                normatividad:  JSON.stringify(sub.normatividad),
              })
            }
          }
        }
      }
    }
  }

  insertMany(rows)
  console.log(`✓ Catálogo cargado: ${rows.length} subobligaciones`)
}

// ─── CREAR USUARIO ADMIN POR DEFECTO ─────────────────────────────────────────

// Usamos un hash fijo para la contraseña "admin123" (SHA-256 simple para dev local)
// En producción esto se reemplaza por bcrypt real
function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd + 'owl_salt_2026').digest('hex')
}

const adminExists = db.prepare("SELECT id FROM users WHERE email = 'admin@owlcompliance.co'").get()
if (!adminExists) {
  const adminId = crypto.randomUUID()
  db.prepare(`
    INSERT INTO users (id, email, password, nombre, rol)
    VALUES (?, ?, ?, ?, ?)
  `).run(adminId, 'admin@owlcompliance.co', hashPassword('admin123'), 'Administrador Owl', 'admin')
  console.log('✓ Usuario admin creado:')
  console.log('    Email:      admin@owlcompliance.co')
  console.log('    Contraseña: admin123')
} else {
  console.log('✓ Usuario admin ya existe')
}

// ─── RESUMEN ─────────────────────────────────────────────────────────────────

const stats = {
  catalogoTotal:  db.prepare('SELECT COUNT(*) as n FROM obligaciones_catalogo').get().n,
  servicios:      db.prepare('SELECT COUNT(DISTINCT servicio) as n FROM obligaciones_catalogo').get().n,
  usuarios:       db.prepare('SELECT COUNT(*) as n FROM users').get().n,
}

console.log('\n─── Base de datos lista ───────────────────────────────')
console.log(`  Subobligaciones en catálogo: ${stats.catalogoTotal}`)
console.log(`  Servicios TIC disponibles:   ${stats.servicios}`)
console.log(`  Usuarios:                    ${stats.usuarios}`)
console.log(`  Archivo:                     ${DB_PATH}`)
console.log('───────────────────────────────────────────────────────')

db.close()

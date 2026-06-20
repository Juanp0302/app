import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = new Database(path.join(__dirname, '../data/owl.db'))
const rows = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY name").all()
rows.forEach(r => console.log(r.sql + ';\n'))
db.close()

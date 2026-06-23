import Database from 'better-sqlite3'
import { existsSync } from 'fs'

const DB_FILE = './database-alunos.sqlite'

const db = new Database(DB_FILE)

// Ativar WAL mode para melhor performance
db.pragma('journal_mode = WAL')

// Criar tabela se não existir
db.exec(`
  CREATE TABLE IF NOT EXISTS alunos (
    ra TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    curso TEXT NOT NULL,
    senha_hash TEXT NOT NULL,
    did TEXT NOT NULL,
    vc TEXT NOT NULL
  )
`)

export interface Aluno {
  ra: string
  nome: string
  curso: string
  senha_hash: string
  did: string
  vc: any
}

export function getAluno(ra: string): Aluno | undefined {
  const row = db.prepare('SELECT * FROM alunos WHERE ra = ?').get(ra) as any
  if (!row) return undefined
  return { ...row, vc: JSON.parse(row.vc) }
}

export function getAllAlunos(): Aluno[] {
  const rows = db.prepare('SELECT * FROM alunos').all() as any[]
  return rows.map(row => ({ ...row, vc: JSON.parse(row.vc) }))
}

export function alunoExiste(ra: string): boolean {
  const row = db.prepare('SELECT 1 FROM alunos WHERE ra = ?').get(ra)
  return !!row
}

export function saveAluno(aluno: {
  ra: string
  nome: string
  curso: string
  senhaHash: string
  did: string
  vc: any
}): void {
  db.prepare(`
    INSERT OR REPLACE INTO alunos (ra, nome, curso, senha_hash, did, vc)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(aluno.ra, aluno.nome, aluno.curso, aluno.senhaHash, aluno.did, JSON.stringify(aluno.vc))
}

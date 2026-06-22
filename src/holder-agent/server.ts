import 'dotenv/config'
import express from 'express'
import bcrypt from 'bcrypt'
import QRCode from 'qrcode'
import { readFileSync, existsSync } from 'fs'
import { agent } from './veramo/setup.js'
import { randomUUID } from 'crypto'

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
const PORT = 3001

const DB_FILE = './credentials/alunos.json'

function loadDB(): Record<string, any> {
    if (!existsSync(DB_FILE)) return {}
    return JSON.parse(readFileSync(DB_FILE, 'utf-8'))
}

const vpStore: Record<string, { vp: any, expira: number }> = {}

const HTML = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Carteira RU - UNIFESP</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: sans-serif; background: #f0f4f8; margin: 0; padding: 20px; text-align: center; }
    .card { background: white; border-radius: 16px; padding: 24px; max-width: 380px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    h2 { color: #003580; }
    input { width: 100%; padding: 10px; margin: 6px 0 14px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; }
    button { padding: 10px 24px; background: #003580; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; width: 100%; }
    .alert-error { background: #fce8e8; color: #c0392b; padding: 10px; border-radius: 8px; margin-bottom: 12px; }
    p { color: #555; margin: 4px 0; }
    img { margin: 16px 0; border: 1px solid #ddd; border-radius: 8px; }
    .validade { font-size: 12px; color: #999; margin-top: 8px; }
  </style>
</head>
<body>
<div class="card">
  ${content}
</div>
</body>
</html>
`

// Página de login do aluno
app.get('/aluno/:ra', (req, res) => {
    const { ra } = req.params
    const db = loadDB()

    if (!db[ra]) {
        res.send(HTML('<h2>❌ Aluno não encontrado.</h2>'))
        return
    }

    const err = req.query.err ? `<div class="alert-error">${req.query.err}</div>` : ''

    res.send(HTML(`
    <h2>🎓 Carteira UNIFESP</h2>
    <p>RA: <strong>${ra}</strong></p>
    <p>${db[ra].nome}</p>
    ${err}
    <form action="/aluno/${ra}/login" method="POST">
      <input type="password" name="senha" placeholder="Senha" required />
      <button type="submit">Acessar carteira</button>
    </form>
  `))
})

// Login do aluno
app.post('/aluno/:ra/login', async (req, res) => {
    const { ra } = req.params
    const { senha } = req.body
    const db = loadDB()

    if (!db[ra]) {
        res.redirect(`/aluno/${ra}?err=Aluno não encontrado.`)
        return
    }

    const ok = await bcrypt.compare(senha, db[ra].senhaHash)
    if (!ok) {
        res.redirect(`/aluno/${ra}?err=Senha incorreta.`)
        return
    }

    res.redirect(`/aluno/${ra}/qr`)
})

// QR code do aluno
app.get('/aluno/:ra/qr', async (req, res) => {
    const { ra } = req.params
    const db = loadDB()

    if (!db[ra]) {
        res.send(HTML('<h2>❌ Aluno não encontrado.</h2>'))
        return
    }

    const aluno = db[ra]

    try {
        // Busca o DID do aluno pelo alias
        const holderIdentifier = await agent.didManagerGetByAlias({ alias: `aluno-${ra}` })

        // Gera VP
        const vp = await agent.createVerifiablePresentation({
            presentation: {
                holder: holderIdentifier.did,
                verifiableCredential: [aluno.vc],
            },
            proofFormat: 'jwt',
        })

        // Token de uso único, válido por 2 minutos
        const token = randomUUID()
        const expira = Date.now() + 2 * 60 * 1000
        vpStore[token] = { vp, expira }

        const qrUrl = `http://192.168.15.7:3001/vp/${token}`
        const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 280 })
        const expiraDate = new Date(expira)

        res.send(HTML(`
      <h2>🎓 Carteira UNIFESP</h2>
      <p><strong>${aluno.nome}</strong></p>
      <p>RA: ${ra} — ${aluno.curso}</p>
      <img src="${qrDataUrl}" alt="QR Code" />
      <p class="validade">⏱ Válido até ${expiraDate.toLocaleTimeString('pt-BR')}</p>
      <button onclick="location.reload()">🔄 Gerar novo QR</button>
    `))
    } catch (err: any) {
        console.error(err)
        res.send(HTML(`<h2>❌ Erro ao gerar QR</h2><p>${err.message}</p>`))
    }
})

// Endpoint de resgate da VP pelo token
app.get('/vp/:token', (req, res) => {
    const { token } = req.params
    const entry = vpStore[token]

    if (!entry) {
        res.status(404).json({ error: 'Token inválido ou expirado.' })
        return
    }

    if (Date.now() > entry.expira) {
        delete vpStore[token]
        res.status(410).json({ error: 'QR code expirado.' })
        return
    }

    delete vpStore[token]
    res.json({ vp: entry.vp })
})

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Carteira do aluno rodando em http://localhost:${PORT}`)
    console.log(`Acesse: http://192.168.15.7:${PORT}/aluno/[RA]`)
})
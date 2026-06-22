import 'dotenv/config'
import express from 'express'
import bcrypt from 'bcrypt'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { ethers } from 'ethers'
import { agent } from './veramo/setup.js'
import { agent as holderAgent } from '../holder-agent/veramo/setup.js'

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
const PORT = 3000

const DB_FILE = './credentials/alunos.json'
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
const UNIFESP_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const RPC_URL = 'http://127.0.0.1:8545'

const CONTRACT_ABI = [
    'function adicionarCreditos(string memory ra, uint256 quantidade) public',
    'function consultarSaldo(string memory ra) public view returns (uint256)',
]

// Banco simples em JSON
function loadDB(): Record<string, any> {
    if (!existsSync(DB_FILE)) return {}
    return JSON.parse(readFileSync(DB_FILE, 'utf-8'))
}

function saveDB(db: Record<string, any>) {
    writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
}

const HTML = (content: string, title = 'Portal UNIFESP') => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: sans-serif; background: #f0f4f8; margin: 0; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #003580; border-bottom: 2px solid #003580; padding-bottom: 10px; }
    h2 { color: #003580; margin-top: 32px; }
    .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    input, select { width: 100%; padding: 10px; margin: 6px 0 14px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; }
    button { padding: 10px 24px; background: #003580; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
    button:hover { background: #002060; }
    .btn-danger { background: #c0392b; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; font-size: 14px; }
    th { background: #f8f9fa; color: #003580; }
    .badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; background: #e6f4ea; color: #1a7f37; }
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
    .alert-success { background: #e6f4ea; color: #1a7f37; }
    .alert-error { background: #fce8e8; color: #c0392b; }
    nav a { margin-right: 16px; color: #003580; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
<div class="container">
  <h1>🎓 Portal UNIFESP — Sistema RU</h1>
  <nav>
    <a href="/">Alunos</a>
    <a href="/creditos">Créditos</a>
    <a href="/status">Status</a>
  </nav>
  ${content}
</div>
</body>
</html>
`

// Página principal — lista alunos + cadastro
app.get('/', async (req, res) => {
    const db = loadDB()
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const contrato = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)

    let rows = ''
    for (const ra in db) {
        const aluno = db[ra]
        let saldo = '—'
        try {
            saldo = (await contrato.consultarSaldo(ra)).toString()
        } catch { }
        rows += `<tr>
      <td>${aluno.nome}</td>
      <td>${ra}</td>
      <td>${aluno.curso}</td>
      <td><span class="badge">${saldo} créditos</span></td>
      <td><a href="/aluno/${ra}/credencial" target="_blank">🔗 Link</a></td>
    </tr>`
    }

    const msg = req.query.msg ? `<div class="alert alert-success">${req.query.msg}</div>` : ''
    const err = req.query.err ? `<div class="alert alert-error">${req.query.err}</div>` : ''

    res.send(HTML(`
    ${msg}${err}
    <div class="card">
      <h2>Cadastrar Novo Aluno</h2>
      <form action="/cadastrar" method="POST">
        <input name="nome" placeholder="Nome completo" required />
        <input name="ra" placeholder="RA (matrícula)" required />
        <input name="curso" placeholder="Curso" required />
        <input name="senha" type="password" placeholder="Senha do aluno" required />
        <button type="submit">Cadastrar e Emitir Credencial</button>
      </form>
    </div>
    <div class="card">
      <h2>Alunos Cadastrados</h2>
      <table>
        <thead><tr><th>Nome</th><th>RA</th><th>Curso</th><th>Saldo</th><th>Carteira</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">Nenhum aluno cadastrado.</td></tr>'}</tbody>
      </table>
    </div>
  `))
})

// Cadastrar aluno + emitir VC
app.post('/cadastrar', async (req, res) => {
    const { nome, ra, curso, senha } = req.body
    const db = loadDB()

    if (db[ra]) {
        res.redirect(`/?err=RA ${ra} já cadastrado.`)
        return
    }

    try {
        const issuer = await agent.didManagerGetByAlias({ alias: 'unifesp-issuer' })

        // Criar DID para o aluno no agente do holder
        const holderIdentifier = await holderAgent.didManagerCreate({ alias: `aluno-${ra}` })

        // Emitir credencial
        const vc = await agent.createVerifiableCredential({
            credential: {
                issuer: { id: issuer.did },
                type: ['VerifiableCredential', 'CredencialUniversitariaRU'],
                credentialSubject: {
                    id: holderIdentifier.did,
                    ra,
                    name: nome,
                    course: curso,
                    enrollmentStatus: 'active',
                },
            },
            proofFormat: 'jwt',
        })

        // Salvar no banco local
        const senhaHash = await bcrypt.hash(senha, 10)
        db[ra] = { nome, curso, senhaHash, did: holderIdentifier.did, vc }
        saveDB(db)

        res.redirect(`/?msg=Aluno ${nome} cadastrado com sucesso!`)
    } catch (err: any) {
        console.error(err)
        res.redirect(`/?err=Erro ao cadastrar: ${err.message}`)
    }
})

// Página de créditos
app.get('/creditos', async (req, res) => {
    const db = loadDB()
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const contrato = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)

    let options = ''
    for (const ra in db) {
        options += `<option value="${ra}">${db[ra].nome} (RA: ${ra})</option>`
    }

    const msg = req.query.msg ? `<div class="alert alert-success">${req.query.msg}</div>` : ''
    const err = req.query.err ? `<div class="alert alert-error">${req.query.err}</div>` : ''

    res.send(HTML(`
    ${msg}${err}
    <div class="card">
      <h2>Adicionar Créditos</h2>
      <form action="/creditos/adicionar" method="POST">
        <select name="ra" required>
          <option value="">Selecione o aluno</option>
          ${options}
        </select>
        <input name="quantidade" type="number" min="1" placeholder="Quantidade de créditos" required />
        <button type="submit">Adicionar Créditos</button>
      </form>
    </div>
  `))
})

// Adicionar créditos
app.post('/creditos/adicionar', async (req, res) => {
    const { ra, quantidade } = req.body
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const unifespWallet = new ethers.Wallet(UNIFESP_PRIVATE_KEY, provider)
        const contrato = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, unifespWallet)
        const tx = await contrato.adicionarCreditos(ra, parseInt(quantidade))
        await tx.wait()
        res.redirect(`/creditos?msg=${quantidade} créditos adicionados para RA ${ra}`)
    } catch (err: any) {
        res.redirect(`/creditos?err=Erro: ${err.message}`)
    }
})

// Status do sistema
app.get('/status', async (req, res) => {
    let blockchain = '❌ Offline'
    let veramo = '❌ Offline'

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        await provider.getBlockNumber()
        blockchain = '✅ Online'
    } catch { }

    try {
        await agent.didManagerFind()
        veramo = '✅ Online'
    } catch { }

    res.send(HTML(`
    <div class="card">
      <h2>Status dos Serviços</h2>
      <table>
        <tr><td><strong>Blockchain (Hardhat)</strong></td><td>${blockchain}</td></tr>
        <tr><td><strong>Agente Veramo (UNIFESP)</strong></td><td>${veramo}</td></tr>
        <tr><td><strong>Carteira do Aluno</strong></td><td>✅ <a href="http://192.168.15.7:3001" target="_blank">http://192.168.15.7:3001</a></td></tr>
        <tr><td><strong>Terminal RU</strong></td><td>✅ <a href="https://pending-unvarying-dash.ngrok-free.dev" target="_blank">ngrok ativo</a></td></tr>
      </table>
    </div>
  `))
})

// Link da carteira do aluno (redireciona para o servidor do holder)
app.get('/aluno/:ra/credencial', (req, res) => {
    res.redirect(`http://192.168.15.7:3001/aluno/${req.params.ra}`)
})

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Portal UNIFESP rodando em http://localhost:${PORT}`)
})
import 'dotenv/config'
import express from 'express'
import bcrypt from 'bcrypt'
import { ethers } from 'ethers'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'
import { agent } from './veramo/setup.js'
import { getLocalIP, getContractAddress, getNgrokUrl } from '../utils.js'
import { getAllAlunos, getAluno, alunoExiste, saveAluno } from '../database.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REGISTRY_ARTIFACT = JSON.parse(
  readFileSync(join(__dirname, '../../hardhat/artifacts/contracts/RevocationRegistry.sol/RevocationRegistry.json'), 'utf-8')
)
const REGISTRY_ABI = REGISTRY_ARTIFACT.abi

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
const PORT = process.env.PORT_UNIFESP ? parseInt(process.env.PORT_UNIFESP) : 3000
const HOLDER_PORT = process.env.PORT_HOLDER || '3001'

const UNIFESP_PRIVATE_KEY = process.env.UNIFESP_PRIVATE_KEY!
const RPC_URL = process.env.HARDHAT_RPC_URL!
const LOCAL_IP = getLocalIP()

const ADMIN_USER = process.env.ADMIN_USER || 'admin'
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123'
const adminSessions = new Set<string>()

// Helper para extrair o token de sessão do admin do cabeçalho de cookies com segurança
function getAdminToken(cookieHeader: string | string[] | undefined): string | undefined {
    if (!cookieHeader) return undefined
    const headerStr = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader
    const match = headerStr.match(/(?:^| )admin_token=([^;]*)/)
    return match ? match[1] : undefined
}

// Middleware para exigir autenticação de administrador
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = getAdminToken(req.headers.cookie)
    if (token && adminSessions.has(token)) {
        next()
        return
    }
    res.redirect('/login')
}

const CONTRACT_ABI = [
  'function adicionarCreditos(string memory ra, uint256 quantidade) public',
  'function consultarSaldo(string memory ra) public view returns (uint256)',
]

const HTML = (content: string, showLogout = true, title = 'Portal UNIFESP') => `
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
    ${showLogout ? '<a href="/logout" style="float: right; color: #c0392b; text-decoration: none; font-weight: bold;">🚪 Sair</a>' : ''}
  </nav>
  ${content}
</div>
</body>
</html>
`

// Página principal — lista alunos + cadastro
app.get('/', requireAdmin, async (req, res) => {
  const alunos = getAllAlunos()
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const contrato = new ethers.Contract(getContractAddress('creditoRU'), CONTRACT_ABI, provider)

  let contractRevocation: ethers.Contract | null = null
  try {
    const revocationAddress = getContractAddress('revocationRegistry')
    contractRevocation = new ethers.Contract(revocationAddress, REGISTRY_ABI, provider)
  } catch (e: any) {
    console.error('Erro ao instanciar contrato de revogação:', e.message)
  }

  let rows = ''
  for (const aluno of alunos) {
    let saldo = '—'
    try {
      saldo = (await contrato.consultarSaldo(aluno.ra)).toString()
    } catch { }

    let isRevoked = false
    if (contractRevocation && aluno.vc && aluno.vc.proof && aluno.vc.proof.jwt) {
      try {
        const jwt = aluno.vc.proof.jwt
        const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(jwt))
        isRevoked = await contractRevocation.isRevoked(credentialHash)
      } catch (e: any) {
        console.error('Erro ao verificar revogação do RA:', aluno.ra, e.message)
      }
    }

    let statusBadge = '<span class="badge">Ativa</span>'
    let acao = ''
    if (isRevoked) {
      statusBadge = '<span class="badge" style="background: #fce8e8; color: #c0392b;">Revogada</span>'
      acao = '<span style="color: #999;">—</span>'
    } else {
      statusBadge = '<span class="badge">Ativa</span>'
      acao = `<form action="/aluno/${aluno.ra}/revogar" method="POST" style="display:inline;" onsubmit="return confirm('Tem certeza que deseja revogar esta credencial?');"><button type="submit" class="btn-danger" style="padding: 4px 10px; font-size: 11px; margin-top: 0; display: inline; width: auto; background: #c0392b;">Revogar</button></form>`
    }

    rows += `<tr>
      <td>${aluno.nome}</td>
      <td>${aluno.ra}</td>
      <td>${aluno.curso}</td>
      <td><span class="badge">${saldo} créditos</span></td>
      <td>${statusBadge}</td>
      <td>${acao}</td>
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
        <input name="did" placeholder="DID do Aluno (did:ethr:...)" required />
        <button type="submit">Cadastrar e Emitir Credencial</button>
      </form>
    </div>
    <div class="card">
      <h2>Alunos Cadastrados</h2>
      <table>
        <thead><tr><th>Nome</th><th>RA</th><th>Curso</th><th>Saldo</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6">Nenhum aluno cadastrado.</td></tr>'}</tbody>
      </table>
    </div>
  `))
})

// Rota para revogar a credencial de um aluno
app.post('/aluno/:ra/revogar', requireAdmin, async (req, res) => {
  const ra = req.params.ra as string
  const aluno = getAluno(ra)
  if (!aluno) {
    res.redirect(`/?err=Aluno ${ra} não encontrado.`)
    return
  }

  try {
    const issuer = await agent.didManagerGetByAlias({ alias: 'unifesp-issuer' })
    const kid = issuer.keys[0].kid
    const issuerAddress = ethers.computeAddress('0x' + issuer.keys[0].publicKeyHex)

    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const contractInterface = new ethers.Interface(REGISTRY_ABI)
    const revocationAddress = getContractAddress('revocationRegistry')

    if (!aluno.vc || !aluno.vc.proof || !aluno.vc.proof.jwt) {
      throw new Error('Credencial do aluno não encontrada ou sem prova JWT.')
    }

    const jwt = aluno.vc.proof.jwt
    const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(jwt))

    const nonce = await provider.getTransactionCount(issuerAddress)
    const { chainId } = await provider.getNetwork()
    const feeData = await provider.getFeeData()

    const unsignedTx = {
      to: revocationAddress,
      data: contractInterface.encodeFunctionData('revoke', [credentialHash]),
      nonce,
      chainId,
      gasLimit: 120000n,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      value: 0n,
    }

    const signedTx = await agent.keyManagerSignEthTX({ kid, transaction: unsignedTx })
    const txResponse = await provider.broadcastTransaction(signedTx)
    const receipt = await txResponse.wait()

    console.log(`Credencial do RA ${ra} revogada na TX:`, receipt?.hash)
    res.redirect(`/?msg=Credencial do aluno ${aluno.nome} foi revogada com sucesso!`)
  } catch (err: any) {
    console.error(err)
    res.redirect(`/?err=Erro ao revogar credencial: ${err.message}`)
  }
})

// Cadastrar aluno + emitir VC
app.post('/cadastrar', requireAdmin, async (req, res) => {
  const { nome, ra, curso, senha, did } = req.body

  if (alunoExiste(ra)) {
    res.redirect(`/?err=RA ${ra} já cadastrado.`)
    return
  }

  try {
    const issuer = await agent.didManagerGetByAlias({ alias: 'unifesp-issuer' })

    // Emitir credencial associada ao DID do aluno fornecido por ele
    const vc = await agent.createVerifiableCredential({
      credential: {
        issuer: { id: issuer.did },
        type: ['VerifiableCredential', 'CredencialUniversitariaRU'],
        credentialSubject: {
          id: did,
          ra,
          name: nome,
          course: curso,
          enrollmentStatus: 'active',
        },
      },
      proofFormat: 'jwt',
    })

    // Salvar no banco de dados
    const senhaHash = await bcrypt.hash(senha, 10)
    saveAluno({ ra, nome, curso, senhaHash, did, vc })

    res.redirect(`/?msg=Aluno ${nome} cadastrado com sucesso!`)
  } catch (err: any) {
    console.error(err)
    res.redirect(`/?err=Erro ao cadastrar: ${err.message}`)
  }
})

// Página de créditos
app.get('/creditos', requireAdmin, async (req, res) => {
  const alunos = getAllAlunos()

  let options = ''
  for (const aluno of alunos) {
    options += `<option value="${aluno.ra}">${aluno.nome} (RA: ${aluno.ra})</option>`
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
app.post('/creditos/adicionar', requireAdmin, async (req, res) => {
  const { ra, quantidade } = req.body
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const unifespWallet = new ethers.Wallet(UNIFESP_PRIVATE_KEY, provider)
    const contrato = new ethers.Contract(getContractAddress('creditoRU'), CONTRACT_ABI, unifespWallet)
    const tx = await contrato.adicionarCreditos(ra, parseInt(quantidade))
    await tx.wait()
    res.redirect(`/creditos?msg=${quantidade} créditos adicionados para RA ${ra}`)
  } catch (err: any) {
    res.redirect(`/creditos?err=Erro: ${err.message}`)
  }
})

// Rota GET: login do administrador
app.get('/login', (req, res) => {
  const err = req.query.err ? `<div class="alert alert-error">${req.query.err}</div>` : ''
  res.send(HTML(`
    ${err}
    <div class="card" style="max-width: 400px; margin: 50px auto 0;">
      <h2>🔑 Login do Administrador</h2>
      <form action="/login" method="POST">
        <input name="usuario" placeholder="Usuário" required />
        <input name="senha" type="password" placeholder="Senha" required />
        <button type="submit" style="width: 100%;">Entrar</button>
      </form>
    </div>
  `, false, 'Login - Portal UNIFESP'))
})

// Rota POST: login do administrador
app.post('/login', (req, res) => {
  const { usuario, senha } = req.body
  if (usuario === ADMIN_USER && senha === ADMIN_PASS) {
    const token = randomUUID()
    adminSessions.add(token)
    res.cookie('admin_token', token, {
      httpOnly: true,
      maxAge: 30 * 60 * 1000, // 30 minutos
      sameSite: 'lax',
      secure: false
    })
    res.redirect('/')
  } else {
    res.redirect('/login?err=Usuário ou senha incorretos.')
  }
})

// Rota GET: logout do administrador
app.get('/logout', (req, res) => {
  const token = getAdminToken(req.headers.cookie)
  if (token) {
    adminSessions.delete(token)
  }
  res.clearCookie('admin_token')
  res.redirect('/login')
})

// Status do sistema
app.get('/status', requireAdmin, async (req, res) => {
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
        <tr><td><strong>Carteira do Aluno</strong></td><td>✅ <a href="http://${LOCAL_IP}:${HOLDER_PORT}" target="_blank">http://${LOCAL_IP}:${HOLDER_PORT}</a></td></tr>
        <tr><td><strong>Terminal RU</strong></td><td>✅ <a href="http://${LOCAL_IP}:${process.env.PORT_RU || '3002'}" target="_blank">http://${LOCAL_IP}:${process.env.PORT_RU || '3002'}</a></td></tr>
      </table>
    </div>
  `))
})

// Link da carteira do aluno (redireciona para o servidor do holder)
app.get('/aluno/:ra/credencial', (req, res) => {
  res.redirect(`http://${LOCAL_IP}:${HOLDER_PORT}/aluno/${req.params.ra}`)
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Portal UNIFESP rodando em http://localhost:${PORT}`)
  console.log(`Acesse: http://${LOCAL_IP}:${PORT}`)
})
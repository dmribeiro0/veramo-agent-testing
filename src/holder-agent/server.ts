import 'dotenv/config'
import express from 'express'
import bcrypt from 'bcrypt'
import QRCode from 'qrcode'
import { agent } from './veramo/setup.js'
import { randomUUID } from 'crypto'
import { getLocalIP, getContractAddress } from '../utils.js'
import { ethers } from 'ethers'
import { getAluno } from '../database.js'

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
const PORT = process.env.PORT_HOLDER ? parseInt(process.env.PORT_HOLDER) : 3001
const RPC_URL = process.env.HARDHAT_RPC_URL!
const CONTRACT_ABI = [
    'function consultarSaldo(string memory ra) public view returns (uint256)',
]

const vpStore: Record<string, { vp: any, expira: number }> = {}
const sessions: Record<string, string> = {} // sessionToken -> ra

const LOCAL_IP = getLocalIP()

// Helper para extrair o token de sessão do cabeçalho de cookies com segurança
function getSessionToken(cookieHeader: string | string[] | undefined): string | undefined {
    if (!cookieHeader) return undefined
    const headerStr = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader
    const match = headerStr.match(/(?:^|; )session_token=([^;]*)/)
    return match ? match[1] : undefined
}

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

// Rota GET: login geral do aluno
app.get('/aluno', (req, res) => {
    const err = req.query.err ? `<div class="alert-error">${req.query.err}</div>` : ''

    res.send(HTML(`
    <h2>🎓 Carteira UNIFESP</h2>
    <p>Insira seu RA e senha para acessar sua carteira digital.</p>
    ${err}
    <form action="/aluno/login" method="POST">
      <input type="text" name="ra" placeholder="RA (matrícula)" required />
      <input type="password" name="senha" placeholder="Senha" required />
      <button type="submit">Acessar carteira</button>
    </form>
    <p style="margin-top: 24px; font-size: 14px; color: #555;">
      Não tem cadastro ainda? <a href="/gerar-did" style="font-weight: bold; color: #003580; text-decoration: none;">🔑 Crie seu DID aqui</a>
    </p>
    `))
})

// Rota GET: aviso de não cadastrado
app.get('/aluno/nao-cadastrado', (req, res) => {
    const ra = req.query.ra as string
    res.send(HTML(`
    <h2>❌ Aluno não cadastrado</h2>
    <p>RA: <strong>${ra || '—'}</strong> não encontrado no banco de dados.</p>
    <div style="margin-top: 20px; padding: 16px; background: #e8f0fe; border-radius: 8px; font-size: 14px; text-align: left; line-height: 1.5;">
        <p style="margin-top:0; color:#003580;"><strong>💡 Como se cadastrar no RU?</strong></p>
        <ol style="padding-left: 20px; margin-bottom: 0; color:#555;">
            <li>Primeiro, <a href="/gerar-did" style="font-weight: bold; color: #003580;">gere o seu DID aqui</a>.</li>
            <li>Copie o DID gerado.</li>
            <li>Envie os dados e o DID para a UNIFESP efetuar o seu cadastro.</li>
        </ol>
    </div>
    <p style="margin-top: 24px;"><a href="/aluno" style="color: #003580; font-weight: bold; text-decoration: none;">⬅ Voltar para o Login</a></p>
    `))
})

// Mantém suporte para links antigos redirecionando para a rota de login geral
app.get('/aluno/:ra', (req, res) => {
    res.redirect('/aluno')
})

// Login do aluno
app.post('/aluno/login', async (req, res) => {
    const { ra, senha } = req.body
    if (!ra || !senha) {
        res.redirect('/aluno?err=Preencha todos os campos.')
        return
    }

    const aluno = getAluno(ra)
    if (!aluno) {
        res.redirect(`/aluno/nao-cadastrado?ra=${ra}`)
        return
    }

    const ok = await bcrypt.compare(senha, aluno.senha_hash)
    if (!ok) {
        res.redirect('/aluno?err=Senha incorreta.')
        return
    }

    const token = randomUUID()
    sessions[token] = ra
    
    // Cookie de sessão seguro com diretivas SameSite e HttpOnly
    res.cookie('session_token', token, {
        httpOnly: true,
        maxAge: 10 * 60 * 1000, // 10 minutos
        sameSite: 'lax',
        secure: false // Definir como true em produção (exige HTTPS)
    })
    res.redirect(`/aluno/${ra}/qr`)
})

// QR code do aluno
app.get('/aluno/:ra/qr', async (req, res) => {
    const { ra } = req.params
    const aluno = getAluno(ra)

    if (!aluno) {
        res.send(HTML('<h2>❌ Aluno não encontrado.</h2>'))
        return
    }

    // Verificar se a sessão é válida e pertence a este RA
    const token = getSessionToken(req.headers.cookie)
    if (!token || sessions[token] !== ra) {
        res.redirect(`/aluno/${ra}?err=Acesso negado. Por favor, faça login.`)
        return
    }

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
        const vpToken = randomUUID()
        const expira = Date.now() + 2 * 60 * 1000
        vpStore[vpToken] = { vp, expira }

        const qrUrl = `http://${LOCAL_IP}:${PORT}/vp/${vpToken}`
        const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 280 })
        const expiraDate = new Date(expira)

        // Consulta saldo no contrato
        let saldo = '—'
        try {
            const provider = new ethers.JsonRpcProvider(RPC_URL)
            const contrato = new ethers.Contract(getContractAddress(), CONTRACT_ABI, provider)
            saldo = (await contrato.consultarSaldo(ra)).toString()
        } catch { }

        res.send(HTML(`
        <h2>🎓 Carteira UNIFESP</h2>
        <p><strong>${aluno.nome}</strong></p>
        <p>RA: ${ra} — ${aluno.curso}</p>
        <p style="font-size:18px; color:#003580; font-weight:bold; margin-top:12px;">🍽️ Créditos: ${saldo}</p>
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

// Rota GET: exibir formulário de geração de DID
app.get('/gerar-did', (req, res) => {
    res.send(HTML(`
    <h2>🔑 Gerador de Identidade (DID)</h2>
    <p>Insira seu RA para gerar sua identidade descentralizada localmente na carteira.</p>
    <form action="/gerar-did" method="POST">
      <input type="text" name="ra" placeholder="Seu RA" required />
      <button type="submit">Gerar Chaves e DID</button>
    </form>
    `))
})

// Rota POST: gerar/obter o DID para o RA fornecido
app.post('/gerar-did', async (req, res) => {
    const { ra } = req.body
    if (!ra) {
        res.send(HTML('<h2>❌ Erro</h2><p>RA não fornecido.</p><p><a href="/gerar-did">Voltar</a></p>'))
        return
    }

    try {
        let holderIdentifier
        try {
            // Tenta obter o DID existente
            holderIdentifier = await agent.didManagerGetByAlias({ alias: `aluno-${ra}` })
        } catch {
            // Se não existe, cria um novo DID
            holderIdentifier = await agent.didManagerCreate({ alias: `aluno-${ra}` })
        }

        res.send(HTML(`
        <h2>✅ DID Gerado com Sucesso!</h2>
        <p><strong>RA:</strong> ${ra}</p>
        <p>Copie o DID abaixo e cole no formulário de cadastro no Portal UNIFESP:</p>
        <textarea style="width:100%; height:80px; padding:8px; font-family:monospace; font-size:12px; border:1px solid #ccc; border-radius:6px; resize:none;" readonly>${holderIdentifier.did}</textarea>
        <p style="margin-top:16px;">
            <a href="http://localhost:3000" style="display:block; padding:10px; background:#003580; color:white; text-decoration:none; border-radius:8px; font-weight:bold;">Ir para o Portal UNIFESP</a>
        </p>
        <p style="font-size:11px; margin-top:8px;">
            <a href="/gerar-did" style="color:#666;">Gerar outro DID</a>
        </p>
        `))
    } catch (err: any) {
        console.error(err)
        res.send(HTML(`<h2>❌ Erro ao gerar DID</h2><p>${err.message}</p><p><a href="/gerar-did">Voltar</a></p>`))
    }
})

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Carteira do aluno rodando em http://localhost:${PORT}`)
    console.log(`Acesse: http://${LOCAL_IP}:${PORT}/aluno/[RA]`)
})
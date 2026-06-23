import 'dotenv/config'
import express from 'express'
import { ethers } from 'ethers'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { agent } from './veramo/setup.js'
import { getLocalIP, getContractAddress } from '../utils.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REGISTRY_ARTIFACT = JSON.parse(
  readFileSync(join(__dirname, '../../hardhat/artifacts/contracts/RevocationRegistry.sol/RevocationRegistry.json'), 'utf-8')
)
const REGISTRY_ABI = REGISTRY_ARTIFACT.abi

const app = express()
app.use(express.json())
const PORT = 3002

const RU_PRIVATE_KEY = process.env.RU_PRIVATE_KEY!
const RPC_URL = process.env.HARDHAT_RPC_URL!
const LOCAL_IP = getLocalIP()

const CONTRACT_ABI = [
    'function consultarSaldo(string memory ra) public view returns (uint256)',
    'function consumirCredito(string memory ra) public returns (bytes32)',
]

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Terminal RU - UNIFESP</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js"></script>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 20px; background: #f0f0f0; }
        .card { background: white; border-radius: 16px; padding: 24px; max-width: 400px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        h2 { color: #003580; }
        #reader { margin: 20px auto; width: 280px; }
        #result { margin-top: 20px; padding: 16px; border-radius: 12px; display: none; }
        .success { background: #e6f4ea; color: #1a7f37; }
        .error { background: #fce8e8; color: #c0392b; }
        .info { font-size: 14px; color: #555; margin: 4px 0; }
        button { margin-top: 16px; padding: 10px 24px; background: #003580; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>🍽️ Terminal RU - UNIFESP</h2>
        <p>Aponte a câmera para o QR Code do aluno</p>
        <div id="reader"></div>
        <div id="result"></div>
      </div>
      <script>
        let scanning = true

        const html5QrCode = new Html5Qrcode("reader")
        html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          async (decodedText) => {
            if (!scanning) return
            scanning = false
            html5QrCode.stop()

            const resultDiv = document.getElementById('result')
            resultDiv.style.display = 'block'
            resultDiv.className = 'info'
            resultDiv.innerHTML = '⏳ Verificando credencial...'

            try {
              const response = await fetch('/verificar?url=' + encodeURIComponent(decodedText))
              const data = await response.json()

              if (data.success) {
                resultDiv.className = 'result success'
                resultDiv.innerHTML = \`
                  <h3>✅ ACESSO LIBERADO</h3>
                  <p class="info"><strong>\${data.name}</strong></p>
                  <p class="info">RA: \${data.ra}</p>
                  <p class="info">Saldo restante: \${data.saldo} créditos</p>
                  <p class="info" style="font-size:11px">TX: \${data.tx}</p>
                  <button onclick="location.reload()">Próximo aluno</button>
                \`
              } else {
                resultDiv.className = 'result error'
                resultDiv.innerHTML = \`
                  <h3>❌ ACESSO NEGADO</h3>
                  <p class="info">\${data.motivo}</p>
                  <button onclick="location.reload()">Tentar novamente</button>
                \`
              }
            } catch (err) {
              resultDiv.className = 'result error'
              resultDiv.innerHTML = '<h3>❌ Erro na verificação</h3><button onclick="location.reload()">Tentar novamente</button>'
            }
          }
        )
      </script>
    </body>
    </html>
  `)
})

app.get('/verificar', async (req, res) => {
    try {
        const vpUrl = req.query.url as string

        // 1. Buscar VP pelo token no servidor do aluno
        const vpResponse = await fetch(vpUrl)
        if (!vpResponse.ok) {
            res.json({ success: false, motivo: 'QR code inválido ou expirado.' })
            return
        }

        const { vp: presentation } = await vpResponse.json() as { vp: any }

        // 2. Verificar a apresentação
        const result = await agent.verifyPresentation({ presentation })
        if (!result.verified) {
            res.json({ success: false, motivo: 'Credencial inválida ou adulterada.' })
            return
        }

        // 3. Extrair dados
        const credential = presentation.verifiableCredential[0]
        const ra = credential.credentialSubject.ra
        const name = credential.credentialSubject.name

        // 3.5 Verificar se a credencial foi revogada on-chain
        if (credential.proof && credential.proof.jwt) {
            try {
                const jwt = credential.proof.jwt
                const credentialHash = ethers.keccak256(ethers.toUtf8Bytes(jwt))
                const provider = new ethers.JsonRpcProvider(RPC_URL)
                const revocationAddress = getContractAddress('revocationRegistry')
                const contractRevocation = new ethers.Contract(revocationAddress, REGISTRY_ABI, provider)
                
                const isRevoked = await contractRevocation.isRevoked(credentialHash)
                if (isRevoked) {
                    res.json({ success: false, motivo: 'Acesso negado: Credencial revogada.' })
                    return
                }
            } catch (e: any) {
                console.error('Erro ao verificar revogação no terminal:', e.message)
                res.json({ success: false, motivo: 'Erro ao verificar status de revogação.' })
                return
            }
        } else {
            res.json({ success: false, motivo: 'Formato de credencial inválido (sem JWT).' })
            return
        }

        // 4. Conectar ao contrato
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const ruWallet = new ethers.Wallet(RU_PRIVATE_KEY, provider)
        const contrato = new ethers.Contract(getContractAddress('creditoRU'), CONTRACT_ABI, ruWallet)

        // 5. Verificar saldo
        const saldoAntes = await contrato.consultarSaldo(ra)
        if (saldoAntes === 0n) {
            res.json({ success: false, motivo: 'Saldo insuficiente.' })
            return
        }

        // 6. Debitar crédito
        const tx = await contrato.consumirCredito(ra)
        const receipt = await tx.wait()
        const saldoDepois = await contrato.consultarSaldo(ra)

        res.json({
            success: true,
            name,
            ra,
            saldo: saldoDepois.toString(),
            tx: receipt.hash
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ success: false, motivo: 'Erro interno do servidor.' })
    }
})

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Terminal RU rodando em http://localhost:${PORT}`)
    console.log(`Acesse pelo celular: http://${LOCAL_IP}:${PORT}`)
})
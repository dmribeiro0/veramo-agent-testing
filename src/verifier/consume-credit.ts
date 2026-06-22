import 'dotenv/config'
import { readFileSync } from 'fs'
import { ethers } from 'ethers'
import { agent } from './veramo/setup.js'

const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
const RU_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const RPC_URL = 'http://127.0.0.1:8545'

const CONTRACT_ABI = [
    'function consultarSaldo(string memory ra) public view returns (uint256)',
    'function adicionarCreditos(string memory ra, uint256 quantidade) public',
    'function consumirCredito(string memory ra) public returns (bytes32)',
    'event CreditoConsumido(string ra, bytes32 indexed consumoId, uint256 timestamp, uint256 saldoRestante)',
]

async function main() {
    // 1. Verificar a apresentação do aluno
    const presentationJson = readFileSync('./credentials/student-presentation.json', 'utf-8')
    const presentation = JSON.parse(presentationJson)
    const result = await agent.verifyPresentation({ presentation })

    if (!result.verified) {
        console.error('❌ Apresentação inválida. Acesso negado.')
        console.error(JSON.stringify(result, null, 2))
        return
    }

    console.log('✅ Apresentação verificada com sucesso.')

    // 2. Extrair o RA da credencial
    const credential = presentation.verifiableCredential[0]
    const ra = credential.credentialSubject.ra
    console.log(`Aluno identificado: ${credential.credentialSubject.name} (RA: ${ra})`)

    // 3. Conectar ao contrato
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const ruWallet = new ethers.Wallet(RU_PRIVATE_KEY, provider)
    const contrato = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ruWallet)

    // 4. Consultar saldo atual
    const saldoAntes = await contrato.consultarSaldo(ra)
    console.log(`Saldo antes do consumo: ${saldoAntes} créditos`)

    if (saldoAntes === 0n) {
        console.error('❌ Saldo insuficiente. Acesso negado.')
        return
    }

    // 5. Debitar crédito
    const tx = await contrato.consumirCredito(ra)
    const receipt = await tx.wait()
    console.log(`✅ Crédito consumido. TX hash: ${receipt.hash}`)

    // 6. Confirmar saldo atualizado
    const saldoDepois = await contrato.consultarSaldo(ra)
    console.log(`Saldo após consumo: ${saldoDepois} créditos`)
}

main().catch(console.error)
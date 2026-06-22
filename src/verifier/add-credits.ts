import 'dotenv/config'
import { ethers } from 'ethers'

const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
const UNIFESP_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const RPC_URL = 'http://127.0.0.1:8545'

const CONTRACT_ABI = [
    'function adicionarCreditos(string memory ra, uint256 quantidade) public',
    'function consultarSaldo(string memory ra) public view returns (uint256)',
]

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const unifespWallet = new ethers.Wallet(UNIFESP_PRIVATE_KEY, provider)
    const contrato = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, unifespWallet)

    const ra = '123456'
    const quantidade = 10

    const tx = await contrato.adicionarCreditos(ra, quantidade)
    await tx.wait()
    console.log(`✅ ${quantidade} créditos adicionados para RA ${ra}`)

    const saldo = await contrato.consultarSaldo(ra)
    console.log(`Saldo atual: ${saldo} créditos`)
}

main().catch(console.error)
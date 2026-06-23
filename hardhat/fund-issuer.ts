// hardhat/fund-issuer.ts
import { ethers } from 'ethers'
import Database from 'better-sqlite3'

async function main() {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545')
  
  // Resolve o endereço do emissor dinamicamente a partir do banco do Veramo
  let issuerAddress = '0x4660B0CB81E3ffb6dca52A0d5F75fcF136307A39' // Fallback
  try {
    const db = new Database('../database-issuer.sqlite')
    const keyRow = db.prepare(`
        SELECT key.publicKeyHex 
        FROM identifier 
        INNER JOIN key ON identifier.did = key.identifierDid 
        WHERE identifier.alias = 'unifesp-issuer'
    `).get() as { publicKeyHex: string } | undefined

    if (keyRow?.publicKeyHex) {
        issuerAddress = ethers.computeAddress('0x' + keyRow.publicKeyHex)
        console.log('🔍 DID Emissor Detectado no Banco:', issuerAddress)
    }
  } catch (e: any) {
    console.warn('⚠️ Não foi possível ler o DID do banco de dados (usando fallback):', e.message)
  }

  // Hardhat's default first pre-funded test account's private key (well-known, safe for local-only use)
  const funderPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  const funder = new ethers.Wallet(funderPrivateKey, provider)

  const tx = await funder.sendTransaction({
    to: issuerAddress,
    value: ethers.parseEther('10.0'), // Fund with 10 ETH
  })
  await tx.wait()

  console.log(`Funded ${issuerAddress}. Tx hash:`, tx.hash)
}

main().catch(console.error)
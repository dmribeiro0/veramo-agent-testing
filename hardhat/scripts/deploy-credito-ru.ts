import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { network } from 'hardhat'
import Database from 'better-sqlite3'

async function main() {
    const connection = await network.create()
    const { ethers } = connection
    const [unifesp, ru] = await ethers.getSigners()
    console.log('Deployando contratos...')

    // 1. Deploy CreditoRU
    console.log('Deployando CreditoRU...')
    const CreditoRU = await ethers.getContractFactory('CreditoRU')
    const contratoRU = await CreditoRU.deploy(unifesp.address, ru.address)
    await contratoRU.waitForDeployment()
    const addressCreditoRU = await contratoRU.getAddress()
    console.log('✅ CreditoRU deployado em:', addressCreditoRU)

    // 2. Deploy RevocationRegistry
    console.log('Deployando RevocationRegistry...')
    
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

    const RevocationRegistry = await ethers.getContractFactory('RevocationRegistry')
    const contratoRevocation = await RevocationRegistry.deploy(issuerAddress)
    await contratoRevocation.waitForDeployment()
    const addressRevocationRegistry = await contratoRevocation.getAddress()
    console.log('✅ RevocationRegistry deployado em:', addressRevocationRegistry)

    // 3. Financiar o endereço do Issuer com ETH para pagar taxas de transação
    console.log('Financiando o Issuer (UNIFESP DID)...')
    const fundingTx = await unifesp.sendTransaction({
        to: issuerAddress,
        value: ethers.parseEther('10.0') // 10 ETH para pagar taxas de gás
    })
    await fundingTx.wait()
    console.log('✅ Issuer financiado com 10 ETH!')

    // Salva os endereços para os servidores lerem
    const outputDir = join('..', 'credentials')
    if (!existsSync(outputDir)) mkdirSync(outputDir)
    writeFileSync(
        join(outputDir, 'contract-address.json'),
        JSON.stringify({
            creditoRU: addressCreditoRU,
            revocationRegistry: addressRevocationRegistry,
            address: addressCreditoRU, // retrocompatibilidade
            deployedAt: new Date().toISOString()
        }, null, 2)
    )
    console.log('✅ Endereços salvos em credentials/contract-address.json')
}

main().catch(console.error)
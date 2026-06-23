import 'dotenv/config'
import { agent } from './issuer-agent/veramo/setup.js'
import { ethers } from 'ethers'

async function main() {
  try {
    const issuer = await agent.didManagerGetByAlias({ alias: 'unifesp-issuer' })
    const issuerAddress = ethers.computeAddress('0x' + issuer.keys[0].publicKeyHex)
    console.log('--- ISSUER DETECTED ---')
    console.log('ISSUER_DID:', issuer.did)
    console.log('ISSUER_ADDRESS:', issuerAddress)
    console.log('-----------------------')
  } catch (e: any) {
    console.error('Error:', e.message)
  }
}
main()

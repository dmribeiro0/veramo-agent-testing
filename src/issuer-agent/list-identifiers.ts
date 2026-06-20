import { ethers } from 'ethers'
import { agent } from './veramo/setup.js'

async function main() {
  const identifiers = await agent.didManagerFind()

  console.log(`There are ${identifiers.length} identifiers`)

  if (identifiers.length > 0) {
    identifiers.map((id) => {
      console.log(id)
      if (id.keys[0]?.publicKeyHex) {
        const address = ethers.computeAddress('0x' + id.keys[0].publicKeyHex)
        console.log('Ethereum address:', address)
      }
      console.log('..................')
    })
  }
}

main().catch(console.log)
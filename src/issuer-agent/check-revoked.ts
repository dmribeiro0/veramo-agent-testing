// src/issuer-agent/check-revoked.ts
import 'dotenv/config'
import { ethers } from 'ethers'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const artifact = JSON.parse(
  readFileSync(join(__dirname, '../../hardhat/artifacts/contracts/RevocationRegistry.sol/RevocationRegistry.json'), 'utf-8')
)

async function main() {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545')
  const contract = new ethers.Contract(process.env.REVOCATION_REGISTRY_ADDRESS!, artifact.abi, provider)

  const testHash = ethers.keccak256(ethers.toUtf8Bytes('test-credential-123'))
  const isRevoked = await contract.isRevoked(testHash)

  console.log('Is revoked:', isRevoked)
}

main().catch(console.error)
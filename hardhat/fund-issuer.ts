// hardhat/fund-issuer.ts
import { ethers } from 'ethers'

async function main() {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545')
  
  // Hardhat's default first pre-funded test account's private key (well-known, safe for local-only use)
  const funderPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  const funder = new ethers.Wallet(funderPrivateKey, provider)

  const tx = await funder.sendTransaction({
    to: '0x4660B0CB81E3ffb6dca52A0d5F75fcF136307A39', // UNIFESP's address
    value: ethers.parseEther('1.0'),
  })
  await tx.wait()

  console.log('Funded. Tx hash:', tx.hash)
}

main().catch(console.error)
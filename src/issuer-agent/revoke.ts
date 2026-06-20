import { ethers } from 'ethers'
import { agent } from './veramo/setup.js'
import { readFileSync } from 'fs'

async function revokeCredential(credentialHash: string) {
  const artifact = JSON.parse(
    readFileSync('./hardhat/artifacts/contracts/RevocationRegistry.sol/RevocationRegistry.json', 'utf-8')
  )
  const REGISTRY_ABI = artifact.abi
  const issuer = await agent.didManagerGetByAlias({alias: 'unifesp-issuer'})
  const kid = issuer.keys[0].kid
  const issuerAddress = ethers.computeAddress('0x' + issuer.keys[0].publicKeyHex)

  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545')
  const contractInterface = new ethers.Interface(REGISTRY_ABI)

  const nonce = await provider.getTransactionCount(issuerAddress)
  const { chainId } = await provider.getNetwork()
  const feeData = await provider.getFeeData()

  const unsignedTx = {
    to: process.env.REVOCATION_REGISTRY_ADDRESS,
    data: contractInterface.encodeFunctionData('revoke', [credentialHash]),
    nonce,
    chainId,
    gasLimit: 100000n,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    value: 0n,
  }

  const signedTx = await agent.keyManagerSignEthTX({ kid, transaction: unsignedTx })

  const txResponse = await provider.broadcastTransaction(signedTx)
  const receipt = await txResponse.wait()

  console.log('Revoked. Tx hash:', receipt?.hash)
}

const testHash = ethers.keccak256(ethers.toUtf8Bytes('test-credential-123'))
revokeCredential(testHash).catch(console.error)
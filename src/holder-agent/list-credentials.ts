import { agent } from './veramo/setup.js'

async function main() {
  const credentials = await agent.dataStoreORMGetVerifiableCredentials()

  console.log(`There are ${credentials.length} credential(s) in this wallet:\n`)

  for (const entry of credentials) {
    console.log('Hash:', entry.hash)
    console.log('Issuer:', entry.verifiableCredential.issuer)
    console.log('Subject:', entry.verifiableCredential.credentialSubject)
    console.log('---')
  }
}

main().catch(console.error)
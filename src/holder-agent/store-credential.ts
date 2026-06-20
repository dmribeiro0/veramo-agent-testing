import { readFileSync } from 'fs'
import { agent } from './veramo/setup.js'

async function main() {
  const credentialJson = readFileSync('./credentials/student-credential.json', 'utf-8')
  const credential = JSON.parse(credentialJson)

  // Verify before accepting into the wallet — a real wallet should never blindly trust incoming data
  const result = await agent.verifyCredential({ credential })

  if (!result.verified) {
    console.error('Credential failed verification, refusing to store it:')
    console.error(JSON.stringify(result, null, 2))
    return
  }

  console.log('Credential verified, storing in wallet.')
  // Veramo's data-store can save it via agent.dataStoreSaveVerifiableCredential if you want it queryable later
  const hash = await agent.dataStoreSaveVerifiableCredential({ verifiableCredential: credential })
  console.log('Stored with hash:', hash)
}

main().catch(console.error)
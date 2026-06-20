import { readFileSync } from 'fs'
import { agent } from './veramo/setup.js'

async function main() {
  const presentationJson = readFileSync('./credentials/student-presentation.json', 'utf-8')
  const presentation = JSON.parse(presentationJson)

  const result = await agent.verifyPresentation({ presentation })

  console.log('Verified:', result.verified)
  if (!result.verified) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    const credential = presentation.verifiableCredential[0]
    console.log('Accepted. Student claims:', credential.credentialSubject)
  }
}

main().catch(console.error)
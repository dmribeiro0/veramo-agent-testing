import { writeFileSync } from 'fs'
import { agent } from './veramo/setup.js'

const HOLDER_DID = 'did:ethr:sepolia:0x026f899780f44cbb5edc5b52e2e508b6dac0a0c065bf52939166a089c10017806b'

async function main() {
    const issuer = await agent.didManagerGetByAlias({ alias: 'unifesp-issuer' })

    const verifiableCredential = await agent.createVerifiableCredential({
        credential: {
            issuer: { id: issuer.did },
            credentialSubject: {
                id: HOLDER_DID,
                ra: '123456',
                name: 'John Doe',
                course: 'Computer Science',
                enrollmentStatus: 'active',
            },
        },
        proofFormat: 'jwt',
    })

    console.log(`Credential issued to holder with DID: ${HOLDER_DID}`)
    console.log(JSON.stringify(verifiableCredential, null, 2))

    // Save the credential to a file
    writeFileSync('./credentials/student-credential.json', JSON.stringify(verifiableCredential, null, 2))
    console.log('Credential saved to credentials/student-credential.json')
}

main().catch(console.error)
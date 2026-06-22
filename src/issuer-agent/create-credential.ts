import { writeFileSync } from 'fs'
import { agent } from './veramo/setup.js'

const HOLDER_DID = 'did:ethr:sepolia:0x0376d9e910f54a27789b3011b6f952aaa12a6c828056ef733147f91f54ade50273'

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
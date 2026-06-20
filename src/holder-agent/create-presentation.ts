import { writeFileSync, readFileSync } from 'fs'
import { agent } from './veramo/setup.js'

async function main() {
    const holder = await agent.didManagerGetByAlias({ alias: 'holder' })

    const credentialJson = readFileSync('./credentials/student-credential.json', 'utf-8')
    const verifiableCredential = JSON.parse(credentialJson)

    const veriablePresentation = await agent.createVerifiablePresentation({
        presentation: {
            holder: holder.did,
            verifiableCredential: [verifiableCredential],
        },
        proofFormat: 'jwt',
    })

    console.log(`Presentation created`)
    console.log(JSON.stringify(veriablePresentation, null, 2))

    // Save the presentation to a file
    writeFileSync('./credentials/student-presentation.json', JSON.stringify(veriablePresentation, null, 2))
    console.log('Presentation saved to credentials/student-presentation.json')
}

main().catch(console.error)
// filename: src/verify-credential.ts
import { agent } from './veramo/setup.js'

async function main() {
  const result = await agent.verifyCredential({
    credential: {
      credentialSubject: {
        you: 'Rock',
        id: 'did:web:example.com',
      },
      issuer: {
        id: 'did:ethr:sepolia:0x032828685c13958b76b5d352c4b9bb82626ce11f613f46975ca3d60d671bf9a9c0',
      },
      type: ['VerifiableCredential'],
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      issuanceDate: '2026-06-16T14:59:36.000Z',
      proof: {
        type: 'JwtProof2020',
        jwt: 'eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIl0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7InlvdSI6IlJvY2sifX0sInN1YiI6ImRpZDp3ZWI6ZXhhbXBsZS5jb20iLCJuYmYiOjE3ODE2MjE5NzYsImlzcyI6ImRpZDpldGhyOnNlcG9saWE6MHgwMzI4Mjg2ODVjMTM5NThiNzZiNWQzNTJjNGI5YmI4MjYyNmNlMTFmNjEzZjQ2OTc1Y2EzZDYwZDY3MWJmOWE5YzAifQ.dY3NrNJNoFysl9TCHwuEgyiPRL4yDQB_38mDLyRqDYVA_asL4V6-iJ4voPkoQE8WwXpdSebX-fxNyTbIFiCebQ',
      },
    },
  })
  console.log(`Credential verified`, result.verified)
}

main().catch(console.log)
import 'dotenv/config'

import { createAgent } from '@veramo/core'
import { IResolver, ICredentialPlugin } from '@veramo/core-types'

import { CredentialPlugin } from '@veramo/credential-w3c'
import { CredentialProviderJWT } from '@veramo/credential-jwt'
import { DIDResolverPlugin } from '@veramo/did-resolver'
import { getResolver as ethrDidResolver } from 'ethr-did-resolver'

export const agent = createAgent<IResolver & ICredentialPlugin>({
    plugins: [
        new DIDResolverPlugin({
            ...ethrDidResolver({
                networks: [{
                    name: 'sepolia',
                    rpcUrl: process.env.RPC_URL!,
                }],
            }),
        }),
        new CredentialPlugin([new CredentialProviderJWT()]),
    ]
})
import type { TAgent, IDIDManager, IKeyManager, IResolver, IDataStore, IDataStoreORM } from '@veramo/core'
import type { ICredentialPlugin } from '@veramo/core-types'

type Agent = TAgent<IDIDManager & IKeyManager & IDataStore & IDataStoreORM & IResolver & ICredentialPlugin>

export async function createIdentifier(agent: Agent, alias: string) {
    const identifier = await agent.didManagerCreate({
        alias: alias,
    })
    console.log(`New identifier created with DID: ${identifier.did} for ${alias}`)
    return identifier
}
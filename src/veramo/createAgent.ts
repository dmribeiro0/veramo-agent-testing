import 'dotenv/config'

import {createAgent} from '@veramo/core'
import type {
    IKeyManager,
    IDataStore,
    IDataStoreORM,
    IDIDManager,
    IResolver,
    ICredentialPlugin,
} from '@veramo/core-types'

import { DIDManager } from '@veramo/did-manager'
import { EthrDIDProvider } from '@veramo/did-provider-ethr'
import { KeyManager } from '@veramo/key-manager'
import { KeyManagementSystem, SecretBox } from '@veramo/kms-local'
import { CredentialPlugin } from '@veramo/credential-w3c'
import { CredentialProviderJWT } from '@veramo/credential-jwt'
import { DIDResolverPlugin } from '@veramo/did-resolver'
import { getResolver as ethrDidResolver } from 'ethr-did-resolver'
import { Entities, KeyStore, DIDStore, PrivateKeyStore, DataStore, DataStoreORM, migrations } from '@veramo/data-store'
import { DataSource } from 'typeorm'

export function createVeramoAgent(config: {
    databaseFile: string
    kmsSecretKey: string
    rpcUrl: string
}) {
    const dbConnection = new DataSource({
        type: 'sqlite',
        database: config.databaseFile,
        synchronize: false,
        migrations,
        migrationsRun: true,
        logging: ['error', 'info', 'warn'],
        entities: Entities,
    }).initialize()

    return createAgent<
        IDIDManager & IKeyManager & IDataStore & IDataStoreORM & IResolver & ICredentialPlugin
        >({
            plugins: [
                new KeyManager({
                    store: new KeyStore(dbConnection),
                    kms: {
                        'local': new KeyManagementSystem(new PrivateKeyStore(dbConnection, new SecretBox(config.kmsSecretKey))),
                    },
                }),
                new DIDManager({
                    store: new DIDStore(dbConnection),
                    defaultProvider: 'did:ethr:sepolia',
                    providers: {
                        'did:ethr:sepolia': new EthrDIDProvider({
                            defaultKms: 'local',
                            network: 'sepolia',
                            rpcUrl: config.rpcUrl,
                        }),
                    },
                }),
                new DIDResolverPlugin({
                    ...ethrDidResolver({
                        networks: [{
                            name: 'sepolia',
                            rpcUrl: config.rpcUrl,
                        }],
                    }),
                }),
                new CredentialPlugin([new CredentialProviderJWT()]),
                new DataStore(dbConnection),
                new DataStoreORM(dbConnection)
            ],
        })
}
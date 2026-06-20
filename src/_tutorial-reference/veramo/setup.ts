// filename: src/veramo/setup.ts
// Core interfaces
import {
  createAgent,
  IDIDManager,
  IResolver,
  IDataStore,
  IDataStoreORM,
  IKeyManager,
  ICredentialPlugin
} from '@veramo/core'

// Core identity manager plugin
import { DIDManager } from '@veramo/did-manager'

// Ethr did identity provider
import { EthrDIDProvider } from '@veramo/did-provider-ethr'

// Core key manager plugin
import { KeyManager } from '@veramo/key-manager'

// Custom key management system for RN
import { KeyManagementSystem, SecretBox } from '@veramo/kms-local'

// W3C Verifiable Credential plugin
import { CredentialPlugin } from '@veramo/credential-w3c'
// JWT proof format for W3C Verifiable Credential plugin
import { CredentialProviderJWT } from '@veramo/credential-jwt'

// Custom resolvers
import { DIDResolverPlugin } from '@veramo/did-resolver'
import { getResolver as ethrDidResolver } from 'ethr-did-resolver'
import { getResolver as webDidResolver } from 'web-did-resolver'

// Storage plugin using TypeOrm
import { Entities, KeyStore, DIDStore, PrivateKeyStore, migrations } from '@veramo/data-store'

// TypeORM is installed with `@veramo/data-store`
import { DataSource } from 'typeorm'

// filename: src/veramo/setup.ts
// This will be the name for the local sqlite database for demo purposes
const DATABASE_FILE = 'database.sqlite'

// You will need to get a project ID from infura https://www.infura.io
const INFURA_PROJECT_ID = 'WXI15dSHlW14tyMCCz2rv'

// This will be the secret key for the KMS (replace this with your secret key)
const KMS_SECRET_KEY =
  'a1d1bd6220b649d3ee19a0cfd3c5b97870b042c98dc49bdb89b0f217e662aa75'

// filename: src/veramo/setup.ts
const dbConnection = new DataSource({
  type: 'sqlite',
  database: DATABASE_FILE,
  synchronize: false,
  migrations,
  migrationsRun: true,
  logging: ['error', 'info', 'warn'],
  entities: Entities,
}).initialize()

// filename: src/veramo/setup.ts
export const agent = createAgent<
  IDIDManager & IKeyManager & IDataStore & IDataStoreORM & IResolver & ICredentialPlugin
>({
  plugins: [
    new KeyManager({
      store: new KeyStore(dbConnection),
      kms: {
        local: new KeyManagementSystem(new PrivateKeyStore(dbConnection, new SecretBox(KMS_SECRET_KEY))),
      },
    }),
    new DIDManager({
      store: new DIDStore(dbConnection),
      defaultProvider: 'did:ethr:sepolia',
      providers: {
        'did:ethr:sepolia': new EthrDIDProvider({
          defaultKms: 'local',
          network: 'sepolia',
          rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/' + INFURA_PROJECT_ID,
        }),
      },
    }),
    new DIDResolverPlugin({
      ...ethrDidResolver({
        networks: [
          {
            name: 'sepolia',
            rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/' + INFURA_PROJECT_ID,
          },
        ],
      }),
      ...webDidResolver(),
    }),
    new CredentialPlugin([new CredentialProviderJWT()]),
  ],
})
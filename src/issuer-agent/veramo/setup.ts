// Issuer Agent Setup - UNIFESP

import { createVeramoAgent } from '../../veramo/createAgent.js'

const DATABASE_FILE = 'database-issuer.sqlite';

const KMS_SECRET_KEY = process.env.ISSUER_KMS_SECRET_KEY!;

const RPC_URL = process.env.RPC_URL!;

export const agent = createVeramoAgent({
    databaseFile: DATABASE_FILE,
    kmsSecretKey: KMS_SECRET_KEY,
    rpcUrl: RPC_URL,
})
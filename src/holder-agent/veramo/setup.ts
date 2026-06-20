// Holder Agent Setup - Student Wallet

import { createVeramoAgent } from '../../veramo/createAgent.js'

const DATABASE_FILE = 'database-holder.sqlite';

const KMS_SECRET_KEY = process.env.HOLDER_KMS_SECRET_KEY!;

const RPC_URL = process.env.RPC_URL!;

export const agent = createVeramoAgent({
    databaseFile: DATABASE_FILE,
    kmsSecretKey: KMS_SECRET_KEY,
    rpcUrl: RPC_URL,
})
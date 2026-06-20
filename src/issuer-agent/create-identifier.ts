import { createIdentifier } from '../veramo/createIdentifier.js'
import { agent } from './veramo/setup.js'

createIdentifier(agent, 'unifesp-issuer').catch(console.error)
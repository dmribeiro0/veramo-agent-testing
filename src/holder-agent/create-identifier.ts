import { createIdentifier } from '../veramo/createIdentifier.js'
import { agent } from './veramo/setup.js'

createIdentifier(agent, 'holder').catch(console.error)
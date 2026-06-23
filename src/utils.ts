import { networkInterfaces } from 'os'
import { readFileSync, existsSync } from 'fs'

export function getLocalIP(): string {
    const nets = networkInterfaces()
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]!) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address
            }
        }
    }
    return '127.0.0.1'
}

export function getContractAddress(name: 'creditoRU' | 'revocationRegistry' = 'creditoRU'): string {
    const file = './credentials/contract-address.json'
    if (!existsSync(file)) {
        throw new Error('contract-address.json não encontrado. Rode o deploy primeiro.')
    }
    const data = JSON.parse(readFileSync(file, 'utf-8'))
    return data[name] || data.address
}

export async function getNgrokUrl(): Promise<string | null> {
    try {
        const res = await fetch('http://127.0.0.1:4040/api/tunnels')
        const data = await res.json() as any
        const tunnel = data.tunnels?.find((t: any) => t.proto === 'https')
        return tunnel?.public_url ?? null
    } catch {
        return null
    }
}
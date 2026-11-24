import { copyFile, mkdir } from 'node:fs/promises'

await mkdir('src', { recursive: true })
await copyFile(
  'node_modules/@oxidezap/whatsapp-rust-bridge/dist/whatsapp_rust_bridge_bg.wasm',
  'src/bridge.wasm'
)
console.log('SUKUNA: WASM module staged successfully')

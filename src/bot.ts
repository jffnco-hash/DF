import type { HostBaileysEventMap, HostWASocket } from '@oxidezap/baileyrs/host'

type Message = HostBaileysEventMap['messages.upsert']['messages'][number]
type Metadata = Awaited<ReturnType<HostWASocket['groupMetadata']>>
const PREFIX = '.'
const DEVELOPERS = new Set([
  '201114030189@s.whatsapp.net',
  '201019225118@s.whatsapp.net',
  '201038502146@s.whatsapp.net'
])
const ANIME_FACTS = [
  '「領域展開」 — Domain Expansion: Malevolent Shrine.',
  'سوكونا يُعرف بلقب ملك اللعنات.',
  'Gojo Satoru is known for the Six Eyes and Limitless.',
  'Jujutsu Kaisen يجمع بين اللعنات وتقنيات الجوجوتسو.'
]
const MENU = `👹 *SUKUNA BOT*
━━━━━━━━━━━━━━
.menu — القائمة
.ping — اختبار البوت
.info — معلومات
.owner — المطورون
.anime — معلومة أنمي
.groupinfo — معلومات الجروب
.tagall [رسالة] — منشن الجميع
.kick @user — طرد عضو
.add 201xxxxxxxxx — إضافة عضو
.promote @user — ترقية مشرف
.demote @user — إزالة مشرف
.link — رابط المجموعة
.revoke — تغيير الرابط
━━━━━━━━━━━━━━
Prefix: . | Arabic + English`

function getText(message: Message): string {
  const content = message.message
  if (!content) return ''
  const current = content.ephemeralMessage?.message ?? content
  return (current.conversation ?? current.extendedTextMessage?.text ??
    current.imageMessage?.caption ?? current.videoMessage?.caption ?? '').trim()
}
function senderOf(message: Message): string {
  return message.key.participant ?? message.key.remoteJid ?? ''
}
function mentionsOf(message: Message): string[] {
  const context = message.message?.extendedTextMessage?.contextInfo
  return [...new Set([...(context?.mentionedJid ?? []), ...(context?.participant ? [context.participant] : [])])]
}
function isAdmin(metadata: Metadata | undefined, jid: string): boolean {
  return Boolean(metadata?.participants.some(p =>
    p.id === jid && (p.admin === 'admin' || p.admin === 'superadmin')))
}
function isDeveloper(jid: string): boolean { return DEVELOPERS.has(jid) }
async function send(socket: HostWASocket, jid: string, text: string, mentions?: string[]) {
  await socket.sendMessage(jid, { text, ...(mentions?.length ? { mentions } : {}) })
}

export async function handleMessages(
  socket: HostWASocket,
  event: HostBaileysEventMap['messages.upsert']
): Promise<void> {
  if (event.type !== 'notify') return
  for (const message of event.messages) {
    const jid = message.key.remoteJid
    if (!jid || message.key.fromMe || jid === 'status@broadcast') continue
    const body = getText(message)
    if (!body.startsWith(PREFIX)) continue
    const [raw, ...args] = body.slice(PREFIX.length).trim().split(/\s+/)
    const command = (raw ?? '').toLowerCase()
    if (!command) continue
    const sender = senderOf(message)
    const group = jid.endsWith('@g.us')
    let metadata: Metadata | undefined
    if (group) {
      try { metadata = await socket.groupMetadata(jid) } catch { /* metadata unavailable */ }
    }
    const botJid = socket.user?.id ?? ''
    const admin = isAdmin(metadata, sender) || isDeveloper(sender)
    const botAdmin = isAdmin(metadata, botJid)

    const groupOnly = async () => {
      if (group) return true
      await send(socket, jid, 'هذا الأمر يعمل داخل الجروبات فقط.')
      return false
    }
    const adminOnly = async () => {
      if (!await groupOnly()) return false
      if (!admin) { await send(socket, jid, 'هذا الأمر للمشرفين فقط.'); return false }
      if (!botAdmin) { await send(socket, jid, 'يجب ترقية البوت إلى مشرف أولاً.'); return false }
      return true
    }

    try {
      switch (command) {
        case 'menu': case 'help': case 'اوامر':
          await send(socket, jid, MENU); break
        case 'ping':
          await send(socket, jid, '🏓 PONG — SUKUNA BOT ONLINE'); break
        case 'info':
          await send(socket, jid, '*SUKUNA BOT* 👹\nVersion: 1.0.0\nRuntime: Cloudflare Workers\nStorage: Durable Objects SQLite\nPrefix: .'); break
        case 'owner': {
          const devs = [...DEVELOPERS]
          await send(socket, jid, '👑 *SUKUNA DEVELOPERS*\n' + devs.map(x => '@' + x.split('@')[0]).join('\n'), devs)
          break
        }
        case 'anime':
          await send(socket, jid, '🎴 ' + ANIME_FACTS[Math.floor(Math.random() * ANIME_FACTS.length)]); break
        case 'groupinfo':
          if (!await groupOnly()) break
          await send(socket, jid, `👥 *${metadata?.subject ?? 'Group'}*\nMembers: ${metadata?.participants.length ?? '?'}\nDescription: ${metadata?.desc ?? '—'}`)
          break
        case 'tagall': case 'hidden':
          if (!await adminOnly()) break
          {
            const members = metadata?.participants.map(p => p.id) ?? []
            await send(socket, jid, `📢 ${args.join(' ') || 'Attention everyone'}\n` + members.map(x => '@' + x.split('@')[0]).join(' '), members)
          }
          break
        case 'kick': case 'promote': case 'demote':
          if (!await adminOnly()) break
          {
            const targets = mentionsOf(message)
            if (!targets.length) { await send(socket, jid, 'اعمل منشن للشخص المطلوب أولاً.'); break }
            if (targets.some(isDeveloper) && !isDeveloper(sender)) {
              await send(socket, jid, 'لا يمكن تنفيذ الأمر على مطور.'); break
            }
            const action = command === 'kick' ? 'remove' : command
            await socket.groupParticipantsUpdate(jid, targets, action as 'remove' | 'promote' | 'demote')
            await send(socket, jid, '✅ تم تنفيذ الأمر.')
          }
          break
        case 'add':
          if (!await adminOnly()) break
          {
            const number = (args[0] ?? '').replace(/\D/g, '')
            if (number.length < 8 || number.length > 15) { await send(socket, jid, 'استخدم: .add 201xxxxxxxxx'); break }
            await socket.groupParticipantsUpdate(jid, [number + '@s.whatsapp.net'], 'add')
            await send(socket, jid, 'تم إرسال طلب الإضافة.')
          }
          break
        case 'link':
          if (!await adminOnly()) break
          await send(socket, jid, 'https://chat.whatsapp.com/' + await socket.groupInviteCode(jid)); break
        case 'revoke':
          if (!await adminOnly()) break
          await send(socket, jid, 'تم تغيير الرابط:\nhttps://chat.whatsapp.com/' + await socket.groupRevokeInvite(jid)); break
      }
    } catch (error) {
      console.error('Command error', JSON.stringify({
        command, errorClass: error instanceof Error ? error.name : typeof error
      }))
      await send(socket, jid, '⚠️ تعذر تنفيذ الأمر. تأكد من صلاحيات البوت وحاول مجدداً.')
    }
  }
}

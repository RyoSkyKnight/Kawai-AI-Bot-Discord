// Kawaii AI - one-off server setup
// Usage:  node setup.js [--dry] [--update-permissions] [server.json]
// Env:    DISCORD_TOKEN (atau TOKEN), GUILD_ID
// Butuh:  discord.js v14, Node 18+

const fs = require('fs');
const path = require('path');

// Cari .env baik di direktori saat ini maupun di root project
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
} catch { }

const {
  Client, Events, GatewayIntentBits, ChannelType, OverwriteType,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  PermissionFlagsBits: P,
} = require('discord.js');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const CLEAN = args.includes('--clean');
const UPDATE_PERMS = args.includes('--update-permissions');
const serverJsonParam = args.find(a => !a.startsWith('--'));
const serverJsonPath = serverJsonParam
  ? path.resolve(process.cwd(), serverJsonParam)
  : path.resolve(__dirname, 'server.json');

const cfg = JSON.parse(fs.readFileSync(serverJsonPath, 'utf8'));

const TOKEN = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN || process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID || "894397077054951434";
if (!TOKEN || !GUILD_ID) {
  console.error('Isi BOT_TOKEN/DISCORD_TOKEN dan GUILD_ID di environment atau file .env');
  process.exit(1);
}

const REASON = 'Kawaii AI server setup';
const stats = { created: 0, reused: 0, failed: 0 };
const norm = s => (s ? String(s).trim().toLowerCase() : '');
const log = m => console.log(m);

async function safe(label, fn) {
  try { return await fn(); }
  catch (e) { stats.failed++; console.error(`  GAGAL   ${label}: ${e.message}`); return null; }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function run() {
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.roles.fetch();
  await guild.channels.fetch();
  const me = await guild.members.fetchMe();
  log(`Server: ${guild.name} | Bot: ${client.user.tag}${DRY ? ' | DRY RUN (tidak ada perubahan)' : ''}\n`);

  if (!me.permissions.has([P.ManageRoles, P.ManageChannels])) {
    throw new Error('Bot butuh izin Manage Roles dan Manage Channels (atau Administrator).');
  }

  // ---------- CLEAN OLD CHANNELS & CATEGORIES ----------
  if (CLEAN) {
    log('--- PEMBERSIHAN CHANNEL LAMA (--clean) ---');
    // Hapus text dan voice channel terlebih dahulu
    for (const [id, ch] of guild.channels.cache) {
      if (ch.type !== ChannelType.GuildCategory) {
        if (DRY) {
          log(`  [dry] hapus channel: ${ch.name}`);
        } else {
          await safe(`hapus channel ${ch.name}`, () => ch.delete(REASON));
          log(`  dihapus channel: ${ch.name}`);
        }
      }
    }
    // Hapus kategori setelah channel di dalamnya terhapus
    for (const [id, ch] of guild.channels.cache) {
      if (ch.type === ChannelType.GuildCategory) {
        if (DRY) {
          log(`  [dry] hapus kategori: ${ch.name}`);
        } else {
          await safe(`hapus kategori ${ch.name}`, () => ch.delete(REASON));
          log(`  dihapus kategori: ${ch.name}`);
        }
      }
    }
    // Refresh channels cache
    await guild.channels.fetch();
  }

  // ---------- ROLES ----------
  log('ROLES');
  const roleMap = new Map();
  const newRoles = [];
  for (const r of cfg.roles) {
    let role = guild.roles.cache.find(x => norm(x.name) === norm(r.name));
    if (role) {
      stats.reused++; log(`  ada     ${r.name}`);
    } else if (DRY) {
      stats.created++; log(`  [dry]   buat ${r.name}`);
    } else {
      role = await safe(`role ${r.name}`, () => guild.roles.create({
        name: r.name, color: r.color, hoist: !!r.hoist, mentionable: !!r.mentionable,
        permissions: r.permissions || [], reason: REASON,
      }));
      if (role) { stats.created++; newRoles.push(role); log(`  dibuat  ${r.name}`); }
    }
    if (role) roleMap.set(norm(r.name), role);
  }

  // Role baru ditaruh tepat di bawah role bot, urutan sesuai server.json
  if (newRoles.length && !DRY) {
    const top = me.roles.highest.position;
    await safe('urutan role', () => guild.roles.setPositions(
      newRoles.map((role, i) => ({ role, position: Math.max(1, top - 1 - i) })),
    ));
    if (top <= newRoles.length) {
      console.warn('  PERINGATAN: role bot terlalu rendah. Naikkan role bot di Server Settings > Roles, lalu rapikan urutan role manual.');
    }
  }

  // ---------- PERMISSION HELPERS ----------
  const gate = cfg.gateByVerification !== false;
  const key = k => (cfg.keyRoles && cfg.keyRoles[k] ? roleMap.get(norm(cfg.keyRoles[k])) : null);
  const staff = key('staff'), verified = key('verified'), unverified = key('unverified'), ageVerified = key('age_verified');
  if (gate && !DRY && !(staff && verified && unverified)) {
    throw new Error('Role kunci (staff/verified/unverified) tidak lengkap, channel tidak dibuat supaya tidak ada yang terkunci.');
  }
  const integrationRoles = (cfg.integrationRoles || [])
    .map(n => guild.roles.cache.find(r => norm(r.name) === norm(n)) || (log(`  catatan : role "${n}" belum ada di server`), null))
    .filter(Boolean);

  const READ = [P.ViewChannel, P.ReadMessageHistory];
  const WRITE = [P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.CreatePrivateThreads];
  const everyone = guild.roles.everyone;

  function buildOverwrites({ access, readonly, music }) {
    const ow = [];
    const add = (role, allow = [], deny = []) => role && ow.push({ id: role.id, type: OverwriteType.Role, allow, deny });

    if (access === 'public') {
      if (readonly) add(everyone, [], WRITE);
    } else if (access === 'staff') {
      add(everyone, [], [P.ViewChannel]);
    } else if (access === 'verified') {
      if (gate) { add(everyone, [], [P.ViewChannel]); add(verified, READ, readonly ? WRITE : []); }
      else if (readonly) add(everyone, [], WRITE);
    } else if (access === 'unverified') {
      if (gate) { add(everyone, [], [P.ViewChannel]); add(unverified, READ, WRITE); add(verified, [], [P.ViewChannel]); }
      else add(everyone, [], WRITE);
    } else if (access === 'age_verified') {
      add(everyone, [], [P.ViewChannel]);
      if (verified) add(verified, [], [P.ViewChannel]);
      if (unverified) add(unverified, [], [P.ViewChannel]);
      if (ageVerified) add(ageVerified, [...READ, ...WRITE], []);
    }

    const restricted = access !== 'public' || readonly;
    if (restricted) {
      add(staff, [...READ, P.SendMessages, P.ManageMessages]);
      ow.push({ id: me.id, type: OverwriteType.Member, allow: [...READ, P.SendMessages, P.EmbedLinks, P.AddReactions], deny: [] });
    }
    if (music) {
      for (const r of integrationRoles) {
        add(r, [...READ, P.SendMessages, P.EmbedLinks, P.Connect, P.Speak, P.UseVAD]);
      }
    }
    return ow;
  }

  // Gabungkan dengan overwrite lama yang tidak disentuh template
  async function applyOverwrites(channel, ow) {
    const ours = new Set(ow.map(o => o.id));
    const keep = channel.permissionOverwrites.cache
      .filter(o => !ours.has(o.id))
      .map(o => ({ id: o.id, type: o.type, allow: o.allow, deny: o.deny }));
    await channel.permissionOverwrites.set([...keep, ...ow], REASON);
  }

  async function upsert(existing, label, createFn, ow) {
    if (existing) {
      stats.reused++; log(`  ada     ${label}`);
      if (UPDATE_PERMS && !DRY) await safe(`izin ${label}`, () => applyOverwrites(existing, ow));
      return existing;
    }
    if (DRY) { stats.created++; log(`  [dry]   buat ${label}`); return null; }
    const made = await safe(label, createFn);
    if (made) { stats.created++; log(`  dibuat  ${label}`); }
    return made;
  }

  // ---------- CATEGORIES & CHANNELS ----------
  for (const cat of cfg.categories) {
    log(`\n${cat.name}`);
    const catOpts = { access: cat.access || 'public', readonly: !!cat.readonly, music: !!cat.music };
    const catOw = buildOverwrites(catOpts);
    const category = await upsert(
      guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && norm(c.name) === norm(cat.name)),
      `kategori ${cat.name}`,
      () => guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory, permissionOverwrites: catOw, reason: REASON }),
      catOw,
    );
    if (!category && !DRY) { console.warn('  dilewati: kategori gagal dibuat'); continue; }

    for (const ch of cat.channels) {
      const isVoice = ch.type === 'voice';
      const type = isVoice ? ChannelType.GuildVoice : ChannelType.GuildText;
      const ow = buildOverwrites({
        access: ch.access ?? catOpts.access,
        readonly: ch.readonly ?? catOpts.readonly,
        music: ch.music ?? catOpts.music,
      });
      await upsert(
        guild.channels.cache.find(c => c.type === type && norm(c.name) === norm(ch.name)),
        `${isVoice ? 'voice' : 'text '} ${ch.name}`,
        () => guild.channels.create({
          name: ch.name, type, parent: category?.id,
          topic: isVoice ? undefined : ch.topic,
          nsfw: isVoice ? undefined : !!ch.nsfw,
          permissionOverwrites: ow, reason: REASON,
        }),
        ow,
      );
    }
  }

  // ---------- OTOMATISASI: VERIFIKASI & PICK ROLES & SETTINGS ----------
  if (!DRY) {
    log('\n--- OTOMATISASI MENU & PENGATURAN ---');

    // 1. Post Rules Bilingual (ID & EN) di #rules
    const rulesChannel = guild.channels.cache.find(
      c => c.type === ChannelType.GuildText && norm(c.name) === 'rules'
    );
    if (rulesChannel) {
      await safe('kirim peraturan server', async () => {
        const rulesIdEmbed = new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('📜 TATA TERTIB SERVER • RYO AND THE GANK (ID)')
          .setDescription(
            'Selamat datang di **Ryo And The Gank**! Demi menjaga kenyamanan dan ketertiban bersama, semua member wajib mematuhi aturan berikut:\n\n' +
            '**1. 🤝 Saling Menghormati**\n' +
            'Dilarang melakukan bullying, pelecehan, ujaran kebencian, atau diskriminasi (SARA). Jaga etika obrolan baik di text maupun voice chat.\n\n' +
            '**2. 🚫 Dilarang Spamming**\n' +
            'Dilarang melakukan spam chat, emoji berlebih, soundboard mengganggu, atau tag massal (@everyone / @here) tanpa kepentingan penting.\n\n' +
            '**3. 📌 Gunakan Channel Sesuai Fungsinya**\n' +
            'Ngobrol santai di <#general>, cari tim mabar di <#gaming-lounge> / <#looking-for-group>, dan gunakan command di <#bot-commands>.\n\n' +
            '**4. 📢 Dilarang Promosi Liar (No Self-Promo)**\n' +
            'Dilarang membagikan link invite server lain, jualan, atau promosi di channel publik maupun melalui Direct Message (DM) tanpa izin staff.\n\n' +
            '**5. 🛡️ Keamanan & Privasi**\n' +
            'Dilarang menyebarkan data pribadi orang lain (doxxing), tautan phishing, malware, atau konten ilegal. Konten dewasa hanya di channel berlabel NSFW.\n\n' +
            '**6. ⚖️ Keputusan Staff**\n' +
            'Keputusan admin dan moderator bersifat mutlak. Jika kamu menemukan pelanggaran, segera laporkan ke tim staff.'
          )
          .setFooter({ text: 'Ryo And The Gank • Community Guidelines (ID)' });

        const rulesEnEmbed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('📜 SERVER RULES • RYO AND THE GANK (EN)')
          .setDescription(
            'Welcome to **Ryo And The Gank**! To ensure a friendly, safe, and enjoyable space for everyone, please respect the following guidelines:\n\n' +
            '**1. 🤝 Be Respectful**\n' +
            'Harassment, hate speech, bullying, toxicity, and discrimination of any kind are strictly prohibited. Treat all members with respect.\n\n' +
            '**2. 🚫 No Spamming**\n' +
            'Avoid spamming messages, excessive emojis, soundboard trolling, or unnecessary mass mentions (@everyone / @here).\n\n' +
            '**3. 📌 Use Appropriate Channels**\n' +
            'Keep discussions relevant to their channels: casual chat in <#general>, gaming in <#gaming-lounge>, and bot commands in <#bot-commands>.\n\n' +
            '**4. 📢 No Unauthorized Advertising**\n' +
            'Do not post invite links to other Discord servers, personal promotions, or commercial sales in public channels or member DMs without staff approval.\n\n' +
            '**5. 🛡️ Safety & Privacy**\n' +
            'Do not share malicious links, malware, illegal content, or personal data (doxxing). Mature topics are strictly restricted to designated NSFW channels.\n\n' +
            '**6. ⚖️ Follow Staff & Discord ToS**\n' +
            'Always adhere to the Discord Terms of Service. Staff decisions are final. Report any rule violations to the moderation team.'
          )
          .setFooter({ text: 'Ryo And The Gank • Community Guidelines (EN)' })
          .setTimestamp();

        await rulesChannel.send({ embeds: [rulesIdEmbed, rulesEnEmbed] });
        log('  ✅ Peraturan server (Bilingual ID & EN) berhasil dikirim ke #rules');
      });
    }

    // 2. Post Tombol Verifikasi di #verification
    const verificationChannel = guild.channels.cache.find(
      c => c.type === ChannelType.GuildText && norm(c.name) === 'verification'
    );
    if (verificationChannel) {
      await safe('kirim tombol verifikasi', async () => {
        const verifyEmbed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('Verification / Verifikasi • Ryo And The Gank')
          .setDescription(
            '**English:**\n' +
            'Welcome to **Ryo And The Gank**!\n' +
            'To access all community channels, please read our server rules in <#rules>.\n' +
            'Click the green **Verify / Verifikasi** button below to agree to the rules and unlock the server.\n\n' +
            '────────────────────────────\n\n' +
            '**Bahasa Indonesia:**\n' +
            'Selamat datang di server **Ryo And The Gank**!\n' +
            'Sebelum dapat melihat dan mengobrol di seluruh channel, silakan baca tata tertib di <#rules> terlebih dahulu.\n' +
            'Klik tombol hijau **Verify / Verifikasi** di bawah ini untuk menyetujui aturan dan membuka akses penuh ke seluruh channel komunitas!'
          )
          .setFooter({ text: 'Ryo And The Gank • Verification System' })
          .setTimestamp();

        const verifyRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('verify_member')
            .setLabel('Verify / Verifikasi')
            .setStyle(ButtonStyle.Success)
        );

        await verificationChannel.send({ embeds: [verifyEmbed], components: [verifyRow] });
        log('  ✅ Pesan verifikasi bilingual berhasil dikirim ke #verification');
      });
    }

    // 3. Post Tombol Pick Roles di #pick-roles
    const pickRolesChannel = guild.channels.cache.find(
      c => c.type === ChannelType.GuildText && norm(c.name) === 'pick-roles'
    );
    if (pickRolesChannel) {
      await safe('kirim menu pick-roles', async () => {
        const rolesEmbed = new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('Role Selection / Pilih Role')
          .setDescription(
            '**English:**\n' +
            'Click the buttons below to assign or remove your roles.\n' +
            '*Click once to get a role, click again to remove it.*\n\n' +
            '**Bahasa Indonesia:**\n' +
            'Klik tombol di bawah ini untuk mengambil atau melepas role pilihanmu.\n' +
            '*Klik sekali untuk mengambil role, klik lagi untuk melepasnya.*\n\n' +
            '**Games:** Mobile Legends, Minecraft, Roblox, Valorant, Other Games\n' +
            '**Style & Language:** Competitive Gamer, Casual Gamer, Indonesian, English'
          )
          .setFooter({ text: 'Ryo And The Gank • Self-Assignable Roles' })
          .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('role_toggle:Mobile Legends').setLabel('Mobile Legends').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('role_toggle:Minecraft').setLabel('Minecraft').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('role_toggle:Roblox').setLabel('Roblox').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('role_toggle:Valorant').setLabel('Valorant').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('role_toggle:Other Games').setLabel('Other Games').setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('role_toggle:Competitive Gamer').setLabel('Competitive Gamer').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('role_toggle:Casual Gamer').setLabel('Casual Gamer').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('role_toggle:Indonesian').setLabel('Indonesian').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('role_toggle:English').setLabel('English').setStyle(ButtonStyle.Secondary)
        );

        await pickRolesChannel.send({ embeds: [rolesEmbed], components: [row1, row2] });
        log('  ✅ Menu pick-roles interaktif berhasil dikirim ke #pick-roles');
      });
    }

    // 4. Konfigurasi Database Guild Settings (Welcome, Goodbye, Auto-role, Mod-logs)
    try {
      const { updateGuildSettings } = require('./services/guildSettings');
      const welcomeChannel = guild.channels.cache.find(c => norm(c.name) === 'welcome' && c.type === ChannelType.GuildText);
      const modLogChannel = guild.channels.cache.find(c => norm(c.name) === 'mod-logs' && c.type === ChannelType.GuildText);
      const unverifiedRole = cfg.keyRoles?.unverified ? roleMap.get(norm(cfg.keyRoles.unverified)) : null;

      const settingsUpdate = {};
      if (welcomeChannel) {
        settingsUpdate.welcome_channel = welcomeChannel.id;
        settingsUpdate.welcome_message = 'Welcome to **Ryo And The Gank**, {user}! Please read <#rules> and verify in <#verification> to get started.';
        settingsUpdate.goodbye_channel = welcomeChannel.id;
        settingsUpdate.goodbye_message = 'Goodbye **{username}**, take care!';
      }
      if (unverifiedRole) {
        settingsUpdate.auto_role = unverifiedRole.id;
      }
      if (modLogChannel) {
        settingsUpdate.log_channel = modLogChannel.id;
      }

      await updateGuildSettings(guild.id, settingsUpdate);
      log('  ✅ Konfigurasi Auto-Role, Welcome, Goodbye, dan Mod-Logs berhasil disimpan ke database!');
    } catch (e) {
      log(`  ⚠️ Catatan Database: Konfigurasi Supabase dilewati (${e.message})`);
    }
  }

  log(`\nSelesai. dibuat: ${stats.created} | sudah ada: ${stats.reused} | gagal: ${stats.failed}`);
  if (gate && !DRY) {
    log(`Catatan: member lama harus diberi role "${cfg.keyRoles.verified}" supaya bisa melihat channel selain INFORMATION dan VERIFICATION.`);
  }
}

client.once(Events.ClientReady, async () => {
  try { await run(); }
  catch (e) { console.error('Setup gagal:', e.message); process.exitCode = 1; }
  finally { await client.destroy(); }
});

client.login(TOKEN).catch(e => { console.error('Login gagal:', e.message); process.exit(1); });

# Kawai — Discord Bot

Bot Discord dengan fitur AI chat (Gemini), moderasi, auto-mute, welcome/goodbye system, dan kumpulan command umum/hiburan/utilitas. Total **76 slash command**, disimpan di Supabase untuk data per-server (pengaturan guild, warning, mod log, auto-mute, bad word).

## Daftar Isi

- [Struktur Proyek](#struktur-proyek)
- [Cara Kerja (Arsitektur)](#cara-kerja-arsitektur)
- [Setup & Menjalankan](#setup--menjalankan)
- [Mendaftarkan Slash Command ke Discord](#mendaftarkan-slash-command-ke-discord)
- [Menambah Command Baru](#menambah-command-baru)
- [Daftar Command per Kategori](#daftar-command-per-kategori)
- [Environment Variables](#environment-variables)
- [Deploy dengan Docker](#deploy-dengan-docker)
- [Catatan Migrasi Struktur](#catatan-migrasi-struktur)

## Struktur Proyek

```
├── src/
│   ├── index.js                 # Entry point: buat client, load semua command & event, login
│   ├── config.js                 # Baca & ekspor semua environment variable di satu tempat
│   ├── state.js                  # State in-memory yang dipakai lintas file (isProcessing, AFK, spam tracking, startTime)
│   ├── commands/                 # Satu file = satu slash command
│   │   ├── general/               # help, ask, ping, profile, avatar, serverinfo, botinfo, uptime
│   │   ├── fun/                   # roll, coinflip, 8ball, joke, fact, trivia, meme, quote, choose
│   │   ├── utility/                # translate, calculate, weather, wiki, urban, define, qr, shorten, reverse, ascii
│   │   ├── media/                  # movie, anime, gif, dog, cat, crypto
│   │   ├── user-info/              # userinfo, roleinfo, roles
│   │   ├── social/                 # poll, embed, afk, remind
│   │   ├── moderation/              # ban, unban, kick, timeout, untimeout, warn, warnings, clearwarnings, clear, lock, unlock, slowmode, nickname, announce, modstats, bans
│   │   ├── automute/                # setautomute, removeautomute, setbadwordmute, removebadwordmute, addbadword, removebadword, listbadwords
│   │   ├── roles/                   # addrole, removerole, createrole, deleterole
│   │   └── server-setup/            # setwelcome, removewelcome, testwelcome, setgoodbye, removegoodbye, autorole, removeautorole, setlog, removelog
│   ├── events/                    # Satu file = satu Discord event
│   │   ├── ready.js
│   │   ├── interactionCreate.js    # Menjalankan command sesuai commandName, menangani error
│   │   ├── guildMemberAdd.js       # Auto-role + welcome message
│   │   ├── guildMemberRemove.js    # Goodbye message
│   │   └── messageCreate.js        # Deteksi AFK + auto-mute (spam & bad word)
│   ├── services/                  # Akses Supabase & AI, dipakai oleh banyak command
│   │   ├── supabaseClient.js       # Instance Supabase (singleton)
│   │   ├── aiClient.js             # Instance Google Generative AI (singleton)
│   │   ├── guildSettings.js        # get/updateGuildSettings (welcome, goodbye, auto-role, log channel)
│   │   ├── moderation.js           # Warning & mod-log (addWarning, getWarnings, clearWarnings, logModAction, getModStats)
│   │   ├── autoMute.js             # Pengaturan auto-mute per guild (spam & bad word)
│   │   ├── badWords.js             # CRUD bad word list + pengecekan kata kasar dalam pesan
│   │   └── logChannel.js           # Kirim embed log moderasi ke channel log guild
│   └── utils/
│       ├── duration.js             # parseDuration ("10m" → ms) & formatDuration (ms → teks)
│       └── constants.js            # Quotes, respons 8ball, warna pastel
├── scripts/
│   ├── deploy-commands.js         # Daftarkan seluruh slash command ke Discord (baca otomatis dari src/commands/)
│   └── delete-commands.js         # Hapus seluruh slash command yang terdaftar di Discord
├── DockerFile
├── .env.example
└── package.json
```

## Cara Kerja (Arsitektur)

**1. Loading otomatis (`src/index.js`)**
Saat bot start, `index.js` membaca semua file di `src/commands/**/*.js` dan menaruhnya ke `client.commands` (sebuah `Collection`, key-nya `data.name`). Semua file di `src/events/*.js` juga dibaca dan didaftarkan ke `client.on`/`client.once` sesuai `event.name`. Artinya **menambah command atau event baru tidak perlu mengubah `index.js` sama sekali** — cukup taruh file baru di folder yang sesuai.

**2. Bentuk satu file command**
Setiap file command mengekspor dua hal:
```js
module.exports = {
  data: { name: 'ping', description: '...', options: [...] }, // definisi untuk Discord API
  async execute(interaction) { ... }                           // logic saat command dijalankan
};
```
`data` memakai format objek mentah (bukan `SlashCommandBuilder`) supaya identik dengan definisi lama dan langsung bisa dikirim ke Discord REST API oleh `scripts/deploy-commands.js`.

**3. Error handling terpusat**
`src/events/interactionCreate.js` membungkus setiap `command.execute()` dengan try/catch tunggal — command individual tidak perlu try/catch generik lagi untuk "❌ An error occurred", cukup untuk error yang butuh pesan spesifik (mis. "❌ Failed to ban user!").

**4. State bersama (`src/state.js`)**
Karena Node.js meng-cache module (`require`), `state.js` berfungsi sebagai singleton: `isProcessing` (mencegah 2 request AI bersamaan), `afkUsers`, `spamTracking`, dan `startTime` — semua diakses lewat referensi objek yang sama dari file manapun.

**5. Services**
Semua query Supabase dan pemanggilan Gemini AI dipusatkan di `src/services/`. Command tidak pernah memanggil Supabase langsung — selalu lewat fungsi service (`getGuildSettings`, `addWarning`, dst). Ini memudahkan kalau nanti struktur tabel database berubah: cukup ubah satu file service, semua command yang memakainya otomatis ikut.

## Setup & Menjalankan

```bash
npm install
cp .env.example .env   # lalu isi semua value di .env
npm start
```

## Mendaftarkan Slash Command ke Discord

Setiap kali kamu menambah, mengubah, atau menghapus command, jalankan:

```bash
npm run deploy-commands
```

Ini mendaftarkan command secara **global** (berlaku di semua server, butuh waktu propagasi hingga ~1 jam untuk perubahan pertama kali; setelahnya biasanya instan).

Untuk membersihkan semua command yang pernah terdaftar (mis. sebelum rename besar-besaran):
```bash
npm run delete-commands
```

## Menambah Command Baru

1. Pilih folder kategori yang sesuai di `src/commands/` (atau buat folder baru jika kategorinya belum ada — otomatis ke-load, tidak perlu didaftarkan manual).
2. Buat file baru, misal `src/commands/fun/rockpaperscissors.js`:
   ```js
   const { EmbedBuilder } = require('discord.js');

   module.exports = {
     data: {
       name: 'rockpaperscissors',
       description: 'Play rock-paper-scissors against the bot',
       options: [
         { name: 'choice', type: 3, description: 'rock, paper, or scissors', required: true }
       ]
     },
     async execute(interaction) {
       // logic di sini
     }
   };
   ```
3. Jalankan `npm run deploy-commands` supaya Discord tahu command baru ini ada.
4. Restart bot (`npm start`) supaya `client.commands` ikut memuat command baru.

Butuh akses ke database atau AI? `require` service yang relevan dari `../../services/...`, jangan panggil Supabase/Gemini langsung dari file command.

## Daftar Command per Kategori

| Kategori | Command |
|---|---|
| 🤖 General | `/help` `/ask` `/ping` `/profile` `/avatar` `/serverinfo` `/botinfo` `/uptime` |
| 🎮 Fun | `/roll` `/coinflip` `/8ball` `/joke` `/fact` `/trivia` `/meme` `/quote` `/choose` |
| 🛠️ Utility | `/translate` `/calculate` `/weather` `/wiki` `/urban` `/define` `/qr` `/shorten` `/reverse` `/ascii` |
| 🎬 Media | `/movie` `/anime` `/gif` `/dog` `/cat` `/crypto` |
| 👥 User Info | `/userinfo` `/roleinfo` `/roles` |
| 💬 Social | `/poll` `/embed` `/afk` `/remind` |
| 🛡️ Moderation | `/ban` `/unban` `/kick` `/timeout` `/untimeout` `/warn` `/warnings` `/clearwarnings` `/clear` `/lock` `/unlock` `/slowmode` `/nickname` `/announce` `/modstats` `/bans` |
| 🔇 Auto-Mute | `/setautomute` `/removeautomute` `/setbadwordmute` `/removebadwordmute` `/addbadword` `/removebadword` `/listbadwords` |
| 🎭 Roles | `/addrole` `/removerole` `/createrole` `/deleterole` |
| ⚙️ Server Setup | `/setwelcome` `/removewelcome` `/testwelcome` `/setgoodbye` `/removegoodbye` `/autorole` `/removeautorole` `/setlog` `/removelog` `/setpersonality` |

## Environment Variables

Lihat `.env.example` untuk template lengkap.

## Database Migration

```sql
CREATE TABLE IF NOT EXISTS user_personality (
  user_id VARCHAR PRIMARY KEY,
  personality VARCHAR
);
```

| Variable | Keterangan |
|---|---|
| `BOT_TOKEN` | Token bot dari Discord Developer Portal |
| `CLIENT_ID` | Application/Client ID, dipakai `scripts/deploy-commands.js` |
| `API_KEY` | API key Google Generative AI (Gemini), dipakai `/ask` dan `/translate` |
| `USE_SHORT_RESPONSE` | `"true"` = `/ask` menjawab singkat (2-4 kalimat); selain itu jawaban detail |
| `CREATOR_ID` | User ID yang disebut sebagai "creator" di `/ask` dan `/botinfo` |
| `SUPABASE_URL` / `SUPABASE_KEY` | Kredensial Supabase, dipakai semua fitur yang menyimpan data (guild settings, warning, mod log, auto-mute, bad word) |

## Deploy dengan Docker

```bash
docker build -t kawai-bot -f DockerFile .
docker run --env-file .env kawai-bot
```

`DockerFile` memakai restart-loop sederhana (kalau proses Node crash, otomatis restart setelah 1 detik) dan menjalankan `node src/index.js`.

## Catatan Migrasi Struktur

Proyek ini sebelumnya berbentuk satu file `index.cjs` (~2900 baris) berisi seluruh 76 command dalam satu rantai `if (commandName === '...')`, ditambah `command-deploy.cjs` yang menduplikasi definisi option-nya secara manual. Struktur di atas adalah hasil restrukturisasi ke pola command/event handler standar discord.js.

Selama migrasi, dua bug lama juga diperbaiki (bukan sekadar dipindah apa adanya):
- **`ban`, `unban`, `kick`, `timeout`, `warn`, `removerole`** sebelumnya selalu gagal dieksekusi (`ReferenceError`) karena kode membandingkan hierarki role memakai variabel `member` sebelum variabel itu di-fetch dari Discord. Urutan operasinya sekarang diperbaiki: fetch dulu, baru dibandingkan.
- Pengecekan permission bot yang salah tulis (`PermissionFlagsBits.ModerateMembers || PermissionFlagsBits.BanMembers`, yang secara JavaScript selalu jatuh ke operand pertama) diganti dengan pengecekan permission tunggal yang sesuai maksud command-nya.

Setiap command lain dipindah **1:1** tanpa perubahan logic — sudah diverifikasi otomatis bahwa nama dan opsi ke-76 command persis sama dengan definisi lama sebelum file lama (`index.cjs`, `command-deploy.cjs`, `delete-command.cjs`) dihapus.

**Belum ditindaklanjuti** (di luar scope restrukturisasi, perlu keputusan terpisah): command `/gif` masih memakai API key Tenor yang ter-hardcode langsung di kode, sebaiknya dipindah ke environment variable.

# Kawai (Cutie AI) — Discord Bot

Cutie (Kawai AI) adalah bot Discord multifungsi berbasis AI interaktif dengan persona pelayan (*maid companion*), sistem moderasi lengkap, proteksi server otomatis, auto-mute, sistem welcome/goodbye, to-do list & reminder persisten, serta **73+ tool AI Natural Language** yang memungkinkan seluruh perintah slash dijalankan langsung lewat obrolan santai.

Data konfigurasi server, riwayat peringatan, log moderasi, dan auto-mute tersimpan aman di Supabase dengan fallback penyimpanan lokal.

---

## 📑 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Struktur Proyek](#-struktur-proyek)
- [Cara Kerja & Arsitektur](#-cara-kerja--arsitektur)
- [Setup & Menjalankan](#-setup--menjalankan)
- [Mendaftarkan & Menghapus Slash Command](#-mendaftarkan--menghapus-slash-command)
- [Paritas Perintah Natural Language (Chat AI)](#-paritas-perintah-natural-language-chat-ai)
- [Daftar Slash Command per Kategori](#-daftar-slash-command-per-kategori)
- [Environment Variables](#-environment-variables)
- [Deploy dengan Docker](#-deploy-dengan-docker)

---

## 🌟 Fitur Utama

1. **🤖 Smart AI Companion & Multimodal Vision**
   - Didukung oleh model OpenRouter AI (default: `openai/gpt-4o-mini`).
   - Mampu menganalisis file gambar (Vision) baik melalui opsi `/ask [image]` maupun lampiran gambar langsung saat mention bot.
   - Respon rapi terbungkus dalam Discord Embed modern dengan paginasi interaktif jika jawaban panjang.
   - Kemampuan adaptasi bahasa otomatis (Indonesian, English, dsb.).

2. **🎭 On-the-Fly Personality Switching**
   - 5 mode kepribadian Cutie: `sweet` (Sweet Companion), `tsundere` (Tsundere), `cool` (Cool & Calm), `sarcastic` (Playful Witty), dan `assistant` (Maid Assistant).
   - Dapat diubah lewat slash command `/setpersonality` atau langsung lewat obrolan: *"Cutie, ganti mode ke tsundere dong!"*.

3. **🗣️ 100% Natural Language Tool Calling (73 AI Tools)**
   - Semua fungsi moderasi, manajemen role, pengaturan server, hingga utilitas dapat dipanggil melalui chat santai tanpa harus mengetik slash command eksplisit.
   - **Enforcement Keamanan Ketat**: Bot memverifikasi hak akses pengguna (`ModerateMembers`, `ManageRoles`, `ManageChannels`, `ManageGuild`, `MentionEveryone`, dll.) serta posisi hierarki role sebelum mengeksekusi aksi.

4. **⏰ Persistent Reminders & To-Do Lists**
   - Pengingat waktu/timer tersimpan permanen (`reminders_local.json`) sehingga tidak hilang saat bot restart atau redeploy.
   - To-do list pribadi permanen (`todos_local.json`) dengan aksi tambah, hapus, lihat, dan bersihkan.

5. **🛡️ Proteksi Server & Moderasi Otomatis**
   - **Anti-Spam Auto-Mute**: Otomatis mendeteksi spam pesan berulang dan memberikan timeout sementara.
   - **Bad Words Blacklist**: Filter kata-kata terlarang dengan opsi auto-mute otomatis.
   - **Anti-Invite & Phishing Link**: Mendeteksi dan menghapus link invite Discord dari non-staff, memberikan peringatan sementara, dan mencatat ke `#mod-logs`.
   - **Anti-Ghost Ping**: Mendeteksi mention yang langsung dihapus dalam 2 menit, lalu mencatatnya ke `#mod-logs` dan memberi alert di channel.
   - **Interactive Mod Log Buttons**: Tombol 1-klik di channel log untuk memudahkan staff melakukan `[Unmute / Remove Timeout]`, `[Clear Warnings]`, `[Timeout 10m]`, dan `[Kick]`.

6. **⚙️ Server Setup & Dashboard (`/serverconfig`)**
   - Dashboard status server visual yang merangkum status Welcome, Goodbye, Autorole, Mod Logs, Channel AI, kepribadian aktif, dan proteksi server.

---

## 📁 Struktur Proyek

```
├── src/
│   ├── index.js                     # Entry point: inisialisasi Client, load event & command, login
│   ├── config.js                    # Konfigurasi terpusat environment variable
│   ├── state.js                     # State in-memory (AFK users, active ask users, spam tracking)
│   ├── commands/                    # Modul slash command per kategori
│   │   ├── general/                 # help, ask, ping, profile, avatar, serverinfo, botinfo, uptime, reset, clearhistory
│   │   ├── fun/                     # roll, coinflip, 8ball, joke, fact, trivia, meme, quote, choose
│   │   ├── utility/                 # translate, calculate, weather, wiki, urban, define, qr, shorten, reverse, ascii
│   │   ├── media/                   # movie, anime, gif, dog, cat, crypto
│   │   ├── user-info/               # userinfo, roleinfo, roles
│   │   ├── social/                  # poll, embed, afk, remind
│   │   ├── moderation/              # ban, unban, kick, timeout, untimeout, warn, warnings, clearwarnings, clear, lock, unlock, slowmode, nickname, announce, announ, modstats, bans
│   │   ├── automute/                # setautomute, removeautomute, setbadwordmute, removebadwordmute, addbadword, removebadword, listbadwords
│   │   ├── roles/                   # addrole, removerole, createrole, deleterole, roles, sendrolemenu
│   │   └── server-setup/            # serverconfig, setwelcome, removewelcome, testwelcome, setgoodbye, removegoodbye, autorole, removeautorole, setlog, removelog, setaskchannel, removeaskchannel, setpersonality
│   ├── events/                      # Discord event handlers
│   │   ├── ready.js                 # Event ready: startup log, restore reminder persisten, dynamic rotating presence
│   │   ├── interactionCreate.js     # Menangani slash command dan klik tombol interaktif (verifikasi & mod log buttons)
│   │   ├── messageCreate.js         # Routing AI chat, penanganan vision, anti-spam, filter bad words, dan anti-invite
│   │   ├── messageDelete.js         # Proteksi Anti-Ghost Ping
│   │   ├── guildMemberAdd.js        # Auto-role & pesan selamat datang (Welcome)
│   │   └── guildMemberRemove.js     # Pesan perpisahan (Goodbye)
│   ├── services/                    # Business logic terpusat & integrasi database
│   │   ├── aiChatService.js         # Orkestrasi AI chat, penyusunan system prompt, multimodal vision, & tool round loop
│   │   ├── aiTools.js               # 73 definisi tool AI dan verifikasi permission Discord
│   │   ├── aiClient.js              # Klien OpenRouter API dengan proteksi CoT leak
│   │   ├── conversationHistory.js   # Pengelolaan riwayat chat AI per user (auto-rekap jika melebihi 50 riwayat)
│   │   ├── reminderManager.js       # Pengelola reminder & timer persisten dengan pemulihan saat startup
│   │   ├── todoManager.js           # Pengelola catatan to-do list pribadi persisten
│   │   ├── userPersonality.js       # Simpan & muat preferensi kepribadian per user
│   │   ├── guildSettings.js         # Pengaturan server di Supabase / file lokal
│   │   ├── moderation.js            # Riwayat warning & mod log
│   │   ├── autoMute.js              # Pengaturan auto-mute spam & bad word
│   │   ├── badWords.js              # CRUD blacklist kata-kata terlarang
│   │   ├── logChannel.js            # Pengirim embed log moderasi ber-action row
│   │   └── supabaseClient.js        # Singleton instance Supabase
│   └── utils/
│       ├── aiResponseHelper.js      # Pembuat embed AI respons, status thinking, dan pemecah halaman teks
│       ├── duration.js              # Parser & formatter durasi (ms <-> string)
│       └── constants.js             # Konstanta kepribadian Cutie, quotes, 8ball, warna pastel
├── scripts/
│   ├── deploy-commands.js           # Mendaftarkan seluruh slash command ke Discord API
│   └── delete-commands.js           # Menghapus seluruh slash command dari Discord API
├── DockerFile
├── .env.example
└── package.json
```

---

## ⚙️ Setup & Menjalankan

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Konfigurasi Environment
Salin `.env.example` menjadi `.env` dan isi token serta kredensial:
```bash
cp .env.example .env
```

Pastikan minimal variabel berikut sudah terisi:
```env
BOT_TOKEN=token_bot_discord_kamu
CLIENT_ID=application_id_bot_kamu
OPENROUTER_API_KEY=api_key_openrouter_kamu
SUPABASE_URL=url_supabase_kamu
SUPABASE_KEY=service_key_supabase_kamu
```

### 3. Jalankan Bot
```bash
npm start
```

---

## 🚀 Mendaftarkan & Menghapus Slash Command

Setiap kali ada penambahan atau perubahan command, daftarkan command secara global ke Discord API:
```bash
npm run deploy-commands
```

Jika ingin membersihkan seluruh slash command lama dari Discord:
```bash
npm run delete-commands
```

---

## 💬 Paritas Perintah Natural Language (Chat AI)

Kamu bisa menyuruh Cutie lewat obrolan natural (mention bot `@Cutie` atau di DM/channel AI) tanpa perlu mengetik slash command:

| Kategori | Contoh Perintah Lewat Chat Natural |
|---|---|
| **Moderasi Channel** | *"Cutie, tolong lock channel ini"* / *"unlock channel ini"* |
| **Sanksi Member** | *"Cutie, tolong kick @user"* / *"ban @user [alasan]"* / *"mute @user 10 menit"* / *"unmute @user"* |
| **Peringatan (Warn)** | *"Cutie, warn @user [alasan]"* / *"cek warning @user"* / *"hapus warning @user"* |
| **Pengumuman** | *"Cutie, tolong buat pengumuman tag everyone tentang maintenance malam ini"* |
| **Manajemen Role** | *"Cutie, kasih role Gamer ke @user"* / *"cabut role VIP dari @user"* / *"bikin role baru VIP #FFD700"* |
| **Pengaturan Server** | *"Cutie, pasang welcome di #welcome"* / *"set autorole Member"* / *"pasang mod log di #mod-logs"* |
| **Auto-Mute & Filter** | *"Cutie, pasang auto mute 5 pesan per 5 detik mute 10m"* / *"tambah badword [kata]"* |
| **Vision & Gambar** | Upload foto sambil tag Cutie: *"Apa pendapatmu tentang gambar ini?"* |
| **Ganti Kepribadian** | *"Cutie, ganti mode ke tsundere dong!"* / *"ubah sifat jadi cool"* |
| **To-Do & Pengingat** | *"Cutie, ingatkan aku dalam 15 menit untuk cek oven"* / *"catat to-do beli susu"* |
| **Utilitas & Fun** | *"Cutie, pendekin link ini https://..."* / *"aku afk dulu mau makan"* / *"tanya 8ball: apakah hari ini hoki?"* |

---

## 📖 Daftar Slash Command per Kategori

| Kategori | Daftar Command |
|---|---|
| 🤖 **General** | `/ask` `/reset` `/clearhistory` `/setpersonality` `/ping` `/profile` `/avatar` `/serverinfo` `/botinfo` `/uptime` `/help` |
| 🛡️ **Moderation** | `/announce` `/announ` `/ban` `/unban` `/kick` `/timeout` `/untimeout` `/warn` `/warnings` `/clearwarnings` `/clear` `/lock` `/unlock` `/slowmode` `/nickname` `/modstats` `/bans` |
| ⚙️ **Server Setup** | `/serverconfig` `/setwelcome` `/removewelcome` `/testwelcome` `/setgoodbye` `/removegoodbye` `/autorole` `/removeautorole` `/setlog` `/removelog` `/setaskchannel` `/removeaskchannel` |
| 🚫 **Auto-Mute** | `/setautomute` `/removeautomute` `/setbadwordmute` `/removebadwordmute` `/addbadword` `/removebadword` `/listbadwords` |
| 🎭 **Roles** | `/addrole` `/removerole` `/createrole` `/deleterole` `/roleinfo` `/roles` `/sendrolemenu` |
| 💬 **Social** | `/poll` `/remind` `/afk` `/embed` |
| 🛠️ **Utility** | `/translate` `/calculate` `/weather` `/wiki` `/urban` `/define` `/qr` `/shorten` `/reverse` `/ascii` |
| 🎮 **Fun** | `/roll` `/coinflip` `/8ball` `/joke` `/fact` `/trivia` `/meme` `/quote` `/choose` |
| 🎬 **Media** | `/anime` `/movie` `/crypto` `/gif` `/cat` `/dog` |
| 👥 **User Info** | `/userinfo` `/roleinfo` `/roles` |

---

## 🔑 Environment Variables

| Variable | Deskripsi |
|---|---|
| `BOT_TOKEN` | Token otentikasi bot dari Discord Developer Portal |
| `CLIENT_ID` | Application/Client ID bot untuk registrasi slash command |
| `OPENROUTER_API_KEY` | API Key OpenRouter untuk AI Chat & Multimodal Vision |
| `OPENROUTER_MODEL` | Model AI yang digunakan (default: `openai/gpt-4o-mini`) |
| `USE_SHORT_RESPONSE` | Jika `"true"`, Cutie merespon lebih ringkas (max 800 token) |
| `CREATOR_ID` | Discord User ID pemilik/pembuat bot (disebut Cutie saat ditanya penciptanya) |
| `SUPABASE_URL` | URL project Supabase untuk penyimpanan konfigurasi dan moderasi |
| `SUPABASE_KEY` | Service role / Anon key Supabase |

---

## 🐳 Deploy dengan Docker

```bash
docker build -t kawai-bot -f DockerFile .
docker run -d --restart unless-stopped --env-file .env kawai-bot
```

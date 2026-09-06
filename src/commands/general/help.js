const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
} = require('discord.js');

const CATEGORIES = {
  overview: {
    label: 'Menu Utama',
    emoji: '🏠',
    description: 'Kembali ke ringkasan semua kategori bantuan',
    color: '#FFB6E1',
    title: '🌸 Cutie Bot — Pusat Bantuan & Perintah',
    descriptionText:
      'Halo! Aku **Cutie**, asisten AI dan bot multifungsi untuk servermu. (◕‿◕)♡\n\n' +
      'Pilih salah satu kategori dari **menu pilihan di bawah** untuk melihat daftar perintah beserta fungsinya secara mendalam.\n\n' +
      '✨ **Fitur Utama:**\n' +
      '• **🤖 AI Pintar**: Ngobrol langsung cukup dengan me-mention bot atau lewat `/ask`\n' +
      '• **🛠️ Utilitas Lengkap**: Terjemahan, kalkulator, cuaca, QR Code, dan kamus\n' +
      '• **🛡️ Moderasi Tangguh**: Auto-mute spam, filter kata kasar, kick/ban/timeout\n' +
      '• **🎮 Fun & Hiburan**: Trivia, polling, anime info, tebak-tebakan, dan crypto',
    fields: [
      { name: '🤖 AI & General', value: '`/ask` `/personality` `/profile` `/ping` `/botinfo` `/uptime` `/clearhistory`', inline: true },
      { name: '🎮 Fun & Games', value: '`/roll` `/coinflip` `/8ball` `/joke` `/fact` `/trivia` `/meme` `/quote` `/choose`', inline: true },
      { name: '🛠️ Utilities', value: '`/translate` `/calculate` `/weather` `/wiki` `/urban` `/define` `/qr` `/shorten`', inline: true },
      { name: '🎬 Media', value: '`/anime` `/movie` `/crypto` `/gif` `/cat` `/dog`', inline: true },
      { name: '💬 Social', value: '`/poll` `/remind` `/afk` `/embed`', inline: true },
      { name: '🛡️ Moderation', value: '`/ban` `/kick` `/timeout` `/warn` `/clear` `/lock` `/slowmode` `/modstats`', inline: true },
      { name: '⚙️ Server Setup', value: '`/setwelcome` `/setgoodbye` `/autorole` `/setlog` `/setaskchannel` `/setautomute`', inline: true },
      { name: '🎭 Roles', value: '`/addrole` `/removerole` `/createrole` `/deleterole` `/roles`', inline: true },
    ],
  },
  ai_general: {
    label: 'AI & General',
    emoji: '🤖',
    description: 'Perintah kecerdasan buatan dan informasi umum bot',
    color: '#FFB6E1',
    title: '🤖 Kategori: AI & General',
    descriptionText: 'Fitur percakapan pintar bertenaga OpenRouter / Gemini beserta perintah umum bot:',
    fields: [
      { name: '`/ask [question]`', value: 'Ajukan pertanyaan apapun kepada AI dengan respon card modern.', inline: false },
      { name: '`/setpersonality [style]`', value: 'Ganti kepribadian AI (Sweet, Tsundere, Cool, Sarcastic, Assistant).', inline: false },
      { name: '`/clearhistory`', value: 'Hapus riwayat ingatan percakapan AI untuk memori baru yang segar.', inline: false },
      { name: '`/profile [user]`', value: 'Lihat profil Discord pengguna secara detail.', inline: false },
      { name: '`/avatar [user]`', value: 'Lihat dan dapatkan tautan avatar ukuran penuh.', inline: false },
      { name: '`/ping`', value: 'Cek latensi bot dan kecepatan koneksi WebSocket Discord.', inline: false },
      { name: '`/botinfo`', value: 'Dashboard statistik bot, penggunaan memori RAM, dan uptime.', inline: false },
      { name: '`/serverinfo`', value: 'Informasi lengkap mengenai server saat ini.', inline: false },
      { name: '`/uptime`', value: 'Waktu aktif bot sejak terakhir kali dihidupkan.', inline: false },
    ],
  },
  fun: {
    label: 'Fun & Games',
    emoji: '🎮',
    description: 'Permainan seru, tebakan, dan hiburan interaktif',
    color: '#FFD166',
    title: '🎮 Kategori: Fun & Games',
    descriptionText: 'Kumpulan permainan ringan untuk menghidupkan suasana obrolan server:',
    fields: [
      { name: '`/roll [sides]`', value: 'Lempar dadu dengan jumlah sisi yang bisa kamu atur.', inline: false },
      { name: '`/coinflip`', value: 'Lempar koin untuk menentukan Pilihan (Kepala vs Ekor).', inline: false },
      { name: '`/8ball [question]`', value: 'Tanyakan masa depanmu pada bola ramalan ajaib 8-Ball.', inline: false },
      { name: '`/trivia`', value: 'Uji wawasanmu dengan kuis trivia pilihan ganda interaktif.', inline: false },
      { name: '`/choose [choices]`', value: 'Bimbang? Biarkan bot memilihkan opsi terbaik untukmu.', inline: false },
      { name: '`/joke`', value: 'Kirim lelucon lucu untuk membuat harimu lebih ceria.', inline: false },
      { name: '`/fact`', value: 'Fakta unik dan menarik dari seluruh penjuru dunia.', inline: false },
      { name: '`/meme`', value: 'Ambil meme lucu secara acak langsung dari Reddit.', inline: false },
      { name: '`/quote`', value: 'Kutipan motivasi dan inspirasi dari tokoh-tokoh hebat.', inline: false },
    ],
  },
  utility: {
    label: 'Utilities',
    emoji: '🛠️',
    description: 'Alat bantu terjemahan, hitung, cuaca, dan info web',
    color: '#06D6A0',
    title: '🛠️ Kategori: Utilities',
    descriptionText: 'Kakas praktis sehari-hari untuk produktivitas di server:',
    fields: [
      { name: '`/translate [text] [to]`', value: 'Terjemahkan teks ke berbagai bahasa di dunia.', inline: false },
      { name: '`/calculate [expression]`', value: 'Kalkulator matematika akurat untuk hitungan rumit.', inline: false },
      { name: '`/weather [city]`', value: 'Cek prakiraan cuaca, suhu, dan kelembapan di kota mana pun.', inline: false },
      { name: '`/wiki [query]`', value: 'Cari ringkasan ensiklopedia langsung dari Wikipedia.', inline: false },
      { name: '`/urban [term]`', value: 'Cari arti istilah gaul dan slang di Urban Dictionary.', inline: false },
      { name: '`/define [word]`', value: 'Definisi resmi kata dari kamus bahasa Inggris.', inline: false },
      { name: '`/qr [text/link]`', value: 'Buat gambar QR code siap scan dari teks atau link.', inline: false },
      { name: '`/shorten [url]`', value: 'Persingkat link web yang panjang menjadi ringkas.', inline: false },
      { name: '`/ascii [text]`', value: 'Ubah teks biasa menjadi seni teks ASCII banner yang keren.', inline: false },
      { name: '`/reverse [text]`', value: 'Balik susunan huruf pada teksmu.', inline: false },
    ],
  },
  media: {
    label: 'Media & Pop Culture',
    emoji: '🎬',
    description: 'Informasi anime, film layar lebar, crypto, dan hewan lucu',
    color: '#118AB2',
    title: '🎬 Kategori: Media & Pop Culture',
    descriptionText: 'Pencarian media, informasi pasar crypto, dan hiburan visual:',
    fields: [
      { name: '`/anime [title]`', value: 'Informasi sinopsis, rating, dan episode anime dari MyAnimeList.', inline: false },
      { name: '`/movie [title]`', value: 'Detail informasi dan rating film layar lebar favoritmu.', inline: false },
      { name: '`/crypto [coin]`', value: 'Cek harga real-time mata uang kripto (Bitcoin, Ethereum, dll.).', inline: false },
      { name: '`/gif [search]`', value: 'Cari dan kirim GIF animasi lucu melalui Tenor.', inline: false },
      { name: '`/cat`', value: 'Tampilkan foto kucing lucu dan menggemaskan secara acak.', inline: false },
      { name: '`/dog`', value: 'Tampilkan foto anjing manis secara acak.', inline: false },
    ],
  },
  social: {
    label: 'Social & Community',
    emoji: '💬',
    description: 'Polling interaktif, pengingat jadwal, AFK status, dan embed',
    color: '#8338EC',
    title: '💬 Kategori: Social & Community',
    descriptionText: 'Fitur sosial untuk interaksi antar anggota komunitas server:',
    fields: [
      { name: '`/poll [question] [options]`', value: 'Buat polling voting interaktif dengan tombol reaksi otomatis.', inline: false },
      { name: '`/remind [time] [message]`', value: 'Pasang pengingat jadwal (contoh: 10m, 1h, 2d). Bot akan me-mentionmu!', inline: false },
      { name: '`/afk [reason]`', value: 'Atur status AFK (Away From Keyboard). Bot akan menginfokan bila di-mention.', inline: false },
      { name: '`/embed [title] [description]`', value: 'Buat pesan embed rapi dengan format warna kustom.', inline: false },
    ],
  },
  moderation: {
    label: 'Moderation',
    emoji: '🛡️',
    description: 'Pengelolaan keamanan, hukuman, dan sanksi anggota',
    color: '#EF476F',
    title: '🛡️ Kategori: Moderation',
    descriptionText: 'Perintah khusus staff/moderator untuk menjaga ketertiban server:',
    fields: [
      { name: '`/warn [user] [reason]`', value: 'Beri peringatan resmi kepada anggota yang melanggar aturan.', inline: false },
      { name: '`/warnings [user]`', value: 'Lihat daftar riwayat peringatan yang pernah diterima user.', inline: false },
      { name: '`/clearwarnings [user]`', value: 'Hapus seluruh catatan peringatan user.', inline: false },
      { name: '`/timeout [user] [duration]`', value: 'Bungkam sementara anggota (contoh: 10m, 1h, 1d).', inline: false },
      { name: '`/untimeout [user]`', value: 'Cabut status timeout sebelum durasi berakhir.', inline: false },
      { name: '`/kick [user] [reason]`', value: 'Keluarkan anggota dari server.', inline: false },
      { name: '`/ban [user] [reason]`', value: 'Blokir anggota secara permanen dari server.', inline: false },
      { name: '`/unban [user_id]`', value: 'Cabut sanksi blokir user menggunakan User ID.', inline: false },
      { name: '`/clear [amount]`', value: 'Hapus pesan massal dalam satu channel (maksimal 100 pesan).', inline: false },
      { name: '`/slowmode [seconds]`', value: 'Atur jeda waktu pengiriman pesan di channel.', inline: false },
      { name: '`/lock` & `/unlock`', value: 'Kunci atau buka kembali izin kirim pesan di channel.', inline: false },
      { name: '`/modstats`', value: 'Lihat statistik aktivitas sanksi yang telah diberikan moderator.', inline: false },
    ],
  },
  server: {
    label: 'Server Setup & Auto-Mute',
    emoji: '⚙️',
    description: 'Konfigurasi otomatisasi, welcome, log, dan filter kata',
    color: '#3A86FF',
    title: '⚙️ Kategori: Server Setup & Otomasi',
    descriptionText: 'Pengaturan otomatisasi sistem untuk kenyamanan server:',
    fields: [
      { name: '`/setwelcome` & `/removewelcome`', value: 'Atur pesan & channel sambutan otomatis bagi member baru.', inline: false },
      { name: '`/setgoodbye` & `/removegoodbye`', value: 'Atur pesan perpisahan bila ada member yang meninggalkan server.', inline: false },
      { name: '`/autorole` & `/removeautorole`', value: 'Berikan role otomatis kepada siapa saja yang baru bergabung.', inline: false },
      { name: '`/setlog` & `/removelog`', value: 'Tentukan channel pencatatan audit log moderasi server.', inline: false },
      { name: '`/setaskchannel` & `/removeaskchannel`', value: 'Tetapkan channel khusus ngobrol bebas dengan Cutie AI.', inline: false },
      { name: '`/setautomute` & `/removeautomute`', value: 'Aktifkan deteksi anti-spam otomatis (contoh: 5 pesan dalam 5 detik).', inline: false },
      { name: '`/addbadword` & `/removebadword`', value: 'Kelola daftar kata terlarang / kata kasar server.', inline: false },
      { name: '`/setbadwordmute`', value: 'Auto-mute otomatis bagi pengguna yang mengucapkan kata terlarang.', inline: false },
    ],
  },
  roles: {
    label: 'Role Management',
    emoji: '🎭',
    description: 'Pembuatan, penghapusan, dan pemberian peran anggota',
    color: '#9C27B0',
    title: '🎭 Kategori: Role Management',
    descriptionText: 'Pengelolaan peran (roles) server dengan cepat:',
    fields: [
      { name: '`/addrole [user] [role]`', value: 'Berikan sebuah role kepada anggota tertentu.', inline: false },
      { name: '`/removerole [user] [role]`', value: 'Lepaskan role dari seorang anggota.', inline: false },
      { name: '`/createrole [name] [color]`', value: 'Buat role baru dengan nama dan kode warna pilihanmu.', inline: false },
      { name: '`/deleterole [role]`', value: 'Hapus role yang sudah tidak digunakan lagi dari server.', inline: false },
      { name: '`/roleinfo [role]`', value: 'Cek rincian informasi dan anggota pemilik role tersebut.', inline: false },
      { name: '`/roles`', value: 'Tampilkan seluruh daftar role yang ada di server.', inline: false },
    ],
  },
};

function buildCategoryEmbed(categoryKey) {
  const cat = CATEGORIES[categoryKey] || CATEGORIES.overview;

  const embed = new EmbedBuilder()
    .setColor(cat.color)
    .setTitle(cat.title)
    .setDescription(cat.descriptionText)
    .setFooter({ text: 'Gunakan dropdown di bawah untuk berpindah kategori • Cutie Bot' })
    .setTimestamp();

  if (cat.fields && cat.fields.length > 0) {
    embed.addFields(cat.fields);
  }

  return embed;
}

function buildSelectMenu(selectedKey = 'overview') {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help_category_select')
    .setPlaceholder('📂 Pilih Kategori Bantuan...')
    .addOptions(
      Object.entries(CATEGORIES).map(([key, item]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(item.label)
          .setValue(key)
          .setDescription(item.description.substring(0, 100))
          .setEmoji(item.emoji)
          .setDefault(key === selectedKey)
      )
    );

  return new ActionRowBuilder().addComponents(selectMenu);
}

module.exports = {
  data: {
    name: 'help',
    description: 'Buka menu panduan dan daftar lengkap perintah bot Cutie',
  },
  async execute(interaction) {
    await interaction.deferReply();

    let currentCategory = 'overview';
    const initialEmbed = buildCategoryEmbed(currentCategory);
    const initialRow = buildSelectMenu(currentCategory);

    const message = await interaction.editReply({
      embeds: [initialEmbed],
      components: [initialRow],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 5 * 60 * 1000,
    });

    collector.on('collect', async (selectInteraction) => {
      // Allow everyone or command user to interact
      const selectedKey = selectInteraction.values[0];
      currentCategory = selectedKey;

      const newEmbed = buildCategoryEmbed(selectedKey);
      const newRow = buildSelectMenu(selectedKey);

      await selectInteraction.update({
        embeds: [newEmbed],
        components: [newRow],
      }).catch(() => {});
    });

    collector.on('end', async () => {
      try {
        const disabledSelect = new StringSelectMenuBuilder()
          .setCustomId('help_category_disabled')
          .setPlaceholder('⏳ Menu bantuan telah kedaluwarsa. Ketik /help kembali.')
          .setDisabled(true)
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('Kedaluwarsa')
              .setValue('expired')
          );

        await message.edit({
          components: [new ActionRowBuilder().addComponents(disabledSelect)],
        }).catch(() => {});
      } catch {
        // Message might have been deleted
      }
    });
  },
};

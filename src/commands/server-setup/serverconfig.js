const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildSettings } = require('../../services/guildSettings');
const { getAutoMuteSettings } = require('../../services/autoMute');
const { getBadWords } = require('../../services/badWords');
const { PERSONALITIES } = require('../../utils/constants');

module.exports = {
  data: {
    name: 'serverconfig',
    description: 'View the comprehensive automation and moderation configuration for this server',
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
  },
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You do not have permission to view server configuration (requires Manage Server).', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const guild = interaction.guild;
      const settings = (await getGuildSettings(guild.id)) || {};
      const autoMute = (await getAutoMuteSettings(guild.id)) || {};
      const badWords = (await getBadWords(guild.id)) || [];

      // Welcome & Goodbye
      const welcomeStatus = settings.welcome_channel
        ? `🟢 <#${settings.welcome_channel}>`
        : '⚪ Disabled';
      const goodbyeStatus = settings.goodbye_channel
        ? `🟢 <#${settings.goodbye_channel}>`
        : '⚪ Disabled';

      // Autorole
      const autoroleStatus = settings.autorole
        ? `🟢 <@&${settings.autorole}>`
        : '⚪ None';

      // Log channel
      const logStatus = settings.log_channel
        ? `🟢 <#${settings.log_channel}>`
        : '⚪ Not configured (`/setlog`)';

      // AI Ask channel
      const askStatus = settings.ask_channel_id
        ? `🟢 <#${settings.ask_channel_id}>`
        : '🌐 Everywhere (via bot mention / `/ask`)';

      // Personality
      const personalityKey = settings.personality || 'sweet';
      const pInfo = PERSONALITIES[personalityKey] || PERSONALITIES.sweet;
      const personalityStatus = `${pInfo.emoji} **${pInfo.name}** (\`${personalityKey}\`)`;

      // Anti-Spam
      const spamStatus = autoMute.spam_threshold && autoMute.spam_duration
        ? `🟢 ${autoMute.spam_threshold} msgs / 5s ➔ Mute ${autoMute.spam_duration}`
        : '⚪ Disabled (`/setautomute`)';

      // Bad Words Filter
      const badwordStatus = autoMute.badword_enabled && autoMute.badword_duration
        ? `🟢 ${badWords.length} words blacklisted ➔ Mute ${autoMute.badword_duration}`
        : (badWords.length > 0 ? `🟡 ${badWords.length} words listed (Auto-mute disabled)` : '⚪ Disabled (`/setbadwordmute`)');

      // Anti-Invite
      const antiInviteStatus = '🟢 Enabled (Auto-delete + Alert + Log)';

      const embed = new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle(`⚙️ Server Configuration — ${guild.name}`)
        .setThumbnail(guild.iconURL({ dynamic: true }) || null)
        .setDescription(
          `Overview of active automations, moderation filters, and AI settings for **${guild.name}**.\nUse the respective setup commands to modify any feature.`
        )
        .addFields(
          {
            name: '👋 Welcome & Goodbye',
            value: `• **Welcome:** ${welcomeStatus}\n• **Goodbye:** ${goodbyeStatus}`,
            inline: false,
          },
          {
            name: '🎭 Autorole',
            value: autoroleStatus,
            inline: true,
          },
          {
            name: '📜 Mod Log Channel',
            value: logStatus,
            inline: true,
          },
          {
            name: '🤖 AI Ask Channel',
            value: askStatus,
            inline: false,
          },
          {
            name: '🌸 Server AI Personality',
            value: personalityStatus,
            inline: true,
          },
          {
            name: '🛡️ Anti-Spam Auto-Mute',
            value: spamStatus,
            inline: true,
          },
          {
            name: '🤬 Bad Words Auto-Mute',
            value: badwordStatus,
            inline: false,
          },
          {
            name: '🔗 Anti-Invite Link Protection',
            value: antiInviteStatus,
            inline: false,
          }
        )
        .setFooter({ text: `Requested by ${interaction.user.tag} • Cutie Bot Management`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error generating server config:', err);
      await interaction.editReply({ content: `Failed to load server configuration: ${err.message}` });
    }
  },
};

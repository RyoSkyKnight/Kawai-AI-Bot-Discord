const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { setUserPersonality } = require('../../services/userPersonality');
const { PERSONALITIES } = require('../../utils/constants');

module.exports = {
  data: {
    name: 'setpersonality',
    description: "Set the bot's AI personality for this server",
    default_member_permissions: null,
    options: [
      {
        name: 'type',
        type: 3,
        description: 'Choose a personality type',
        required: true,
        choices: Object.entries(PERSONALITIES).map(([key, value]) => ({
          name: `${value.emoji} ${value.name}`,
          value: key
        }))
      },
      {
        name: 'target',
        type: 6,
        description: 'User to set personality for (optional). If omitted, sets for yourself.',
        required: false
      }
    ]
  },
  async execute(interaction) {
    await interaction.deferReply();

    const personalityType = interaction.options.getString('type');
    const target = interaction.options.getUser('target');
    const chosenPersonality = PERSONALITIES[personalityType];

    try {
      if (target) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return await interaction.editReply({ content: "❌ You don't have permission to change other users' personalities!", ephemeral: true });
        }
        const success = await setUserPersonality(target.id, personalityType);
        if (!success) {
          await interaction.editReply({ content: "❌ **Database Error!** Unable to save personality for the target user." });
          return;
        }
        await interaction.editReply({ content: `✅ Set ${target.username}'s personality to **${chosenPersonality.emoji} ${chosenPersonality.name}**!` });
      } else {
        const success = await setUserPersonality(interaction.user.id, personalityType);
        if (!success) {
          await interaction.editReply({
            content: `❌ **Database Error!** Unable to save personality preference.`
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('🎭 AI Personality Updated')
          .setDescription(`Your personality has been set to **${chosenPersonality.emoji} ${chosenPersonality.name}**!`)
          .addFields({ name: 'System Prompt Preview', value: chosenPersonality.instruction })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Set personality error:', error);
      await interaction.editReply({ content: '❌ An error occurred while setting personality!' });
    }
  }
};

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Handle Button Interactions (Verification & Role Toggle)
    if (interaction.isButton()) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const customId = interaction.customId;

      // 1. Member Verification
      if (customId === 'verify_member') {
        const verifiedRole = interaction.guild?.roles.cache.find(
          r => r.name.toLowerCase() === 'member kesayangan'
        );
        const unverifiedRole = interaction.guild?.roles.cache.find(
          r => r.name.toLowerCase() === 'member jelata'
        );

        if (!verifiedRole) {
          return interaction.editReply({
            content: 'The Member Kesayangan role was not found on this server. Please contact staff.',
          });
        }

        const member = interaction.member;
        if (member.roles.cache.has(verifiedRole.id)) {
          return interaction.editReply({
            content: 'You are already verified.',
          });
        }

        try {
          await member.roles.add(verifiedRole);
          if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
            await member.roles.remove(unverifiedRole);
          }
          return interaction.editReply({
            content: 'Verification successful! Welcome to Ryo And The Gank. All community channels are now unlocked.',
          });
        } catch (err) {
          console.error('Error in verification button:', err);
          return interaction.editReply({
            content: `Verification failed: ${err.message}. Please ensure the bot role is positioned above the member role.`,
          });
        }
      }

      // 2. Role Toggle (Games, Language, etc.)
      if (customId.startsWith('role_toggle:')) {
        const roleName = customId.replace('role_toggle:', '');
        const role = interaction.guild?.roles.cache.find(
          r => r.name.toLowerCase() === roleName.toLowerCase()
        );

        if (!role) {
          return interaction.editReply({
            content: `Role ${roleName} was not found on this server.`,
          });
        }

        const member = interaction.member;
        const hasRole = member.roles.cache.has(role.id);

        try {
          if (hasRole) {
            await member.roles.remove(role);
            return interaction.editReply({
              content: `Role ${role.name} has been removed.`,
            });
          } else {
            await member.roles.add(role);
            return interaction.editReply({
              content: `Role ${role.name} has been added.`,
            });
          }
        } catch (err) {
          console.error('Error toggling role:', err);
          return interaction.editReply({
            content: `Failed to update role. Please ensure the bot role is positioned above ${role.name} in Server Settings.`,
          });
        }
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error handling command ${interaction.commandName}:`, error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true }).catch(() => {});
      } else if (interaction.deferred) {
        await interaction.editReply({ content: 'An error occurred while executing this command.' }).catch(() => {});
      }
    }
  }
};

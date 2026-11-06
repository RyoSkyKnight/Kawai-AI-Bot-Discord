module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Handle Button Interactions (Verification & Role Toggle)
    if (interaction.isButton()) {
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
          return interaction.reply({
            content: 'The **Member Kesayangan** role was not found on this server. Please contact staff.',
            ephemeral: true,
          });
        }

        const member = interaction.member;
        if (member.roles.cache.has(verifiedRole.id)) {
          return interaction.reply({
            content: 'You are already verified.',
            ephemeral: true,
          });
        }

        try {
          await member.roles.add(verifiedRole);
          if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
            await member.roles.remove(unverifiedRole);
          }
          return interaction.reply({
            content: 'Verification successful! Welcome to **Ryo And The Gank**. All community channels are now unlocked.',
            ephemeral: true,
          });
        } catch (err) {
          console.error('Error in verification button:', err);
          return interaction.reply({
            content: `Verification failed: ${err.message}. Please ensure the bot role is positioned above the member role.`,
            ephemeral: true,
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
          return interaction.reply({
            content: `Role **${roleName}** was not found on this server.`,
            ephemeral: true,
          });
        }

        const member = interaction.member;
        const hasRole = member.roles.cache.has(role.id);

        try {
          if (hasRole) {
            await member.roles.remove(role);
            return interaction.reply({
              content: `Role **${role.name}** has been removed.`,
              ephemeral: true,
            });
          } else {
            await member.roles.add(role);
            return interaction.reply({
              content: `Role **${role.name}** has been added.`,
              ephemeral: true,
            });
          }
        } catch (err) {
          console.error('Error toggling role:', err);
          return interaction.reply({
            content: `Failed to update role. Please ensure the bot role is positioned above **${role.name}** in Server Settings.`,
            ephemeral: true,
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

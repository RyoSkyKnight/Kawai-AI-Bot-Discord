const { PermissionFlagsBits } = require('discord.js');
const { logModAction, clearWarnings } = require('../services/moderation');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Handle Button Interactions (Verification & Role Toggle)
    if (interaction.isButton()) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const customId = interaction.customId;

      // 1. Member Verification
      if (customId === 'verify_member') {
        const memberKesayanganRole = interaction.guild?.roles.cache.find(
          r => r.name.toLowerCase() === 'member kesayangan'
        );
        const verifiedRole = interaction.guild?.roles.cache.find(
          r => r.name.toLowerCase() === 'verified'
        );
        const unverifiedRole = interaction.guild?.roles.cache.find(
          r => r.name.toLowerCase() === 'member jelata'
        );

        if (!memberKesayanganRole && !verifiedRole) {
          return interaction.editReply({
            content: 'The verification role was not found on this server. Please contact staff.',
          });
        }

        const member = interaction.member;
        if (
          (memberKesayanganRole && member.roles.cache.has(memberKesayanganRole.id)) ||
          (verifiedRole && member.roles.cache.has(verifiedRole.id))
        ) {
          return interaction.editReply({
            content: 'You are already verified.',
          });
        }

        const rolesToAdd = [];
        if (memberKesayanganRole) rolesToAdd.push(memberKesayanganRole);
        if (verifiedRole) rolesToAdd.push(verifiedRole);

        try {
          if (rolesToAdd.length > 0) {
            await member.roles.add(rolesToAdd);
          }
          if (unverifiedRole && member.roles.cache.has(unverifiedRole.id)) {
            await member.roles.remove(unverifiedRole);
          }
          return interaction.editReply({
            content: 'Verification successful! Welcome to Ryo And The Gank. All community channels are now unlocked.',
          });
        } catch (err) {
          console.error('Error in verification button:', err);
          return interaction.editReply({
            content: `Verification failed: ${err.message}. Please ensure the bot role is positioned above the member roles.`,
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

      // 3. Interactive Mod Actions (from log channel embeds)
      if (customId.startsWith('mod_')) {
        const parts = customId.split(':');
        const action = parts[0];
        const targetUserId = parts[1];

        if (!interaction.guild) {
          return interaction.editReply({ content: 'This action can only be used within a server.' });
        }

        const botMember = interaction.guild.members.me;

        if (action === 'mod_untimeout') {
          if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.editReply({ content: 'Access denied: You need the Moderate Members permission.' });
          }
          if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.editReply({ content: 'Bot is missing Moderate Members permission.' });
          }

          const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
          if (!targetMember) {
            return interaction.editReply({ content: 'User is not currently in this server.' });
          }
          if (targetMember.roles.highest.position >= botMember.roles.highest.position ||
              targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.editReply({ content: 'Cannot unmute this user due to role hierarchy.' });
          }

          try {
            await targetMember.timeout(null, `Unmuted by ${interaction.user.tag} via mod button`);
            await logModAction(interaction.guild.id, 'untimeout', interaction.user.id, targetUserId, 'Untimed out via mod log button');
            return interaction.editReply({ content: `✅ Successfully removed timeout for <@${targetUserId}>.` });
          } catch (err) {
            return interaction.editReply({ content: `Failed to remove timeout: ${err.message}` });
          }
        }

        if (action === 'mod_clearwarn') {
          if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.editReply({ content: 'Access denied: You need the Moderate Members permission.' });
          }
          try {
            await clearWarnings(interaction.guild.id, targetUserId);
            await logModAction(interaction.guild.id, 'clearwarn', interaction.user.id, targetUserId, 'Warnings cleared via mod log button');
            return interaction.editReply({ content: `✅ Successfully cleared all warnings for <@${targetUserId}>.` });
          } catch (err) {
            return interaction.editReply({ content: `Failed to clear warnings: ${err.message}` });
          }
        }

        if (action === 'mod_timeout10m') {
          if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.editReply({ content: 'Access denied: You need the Moderate Members permission.' });
          }
          if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.editReply({ content: 'Bot is missing Moderate Members permission.' });
          }

          const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
          if (!targetMember) {
            return interaction.editReply({ content: 'User is not currently in this server.' });
          }
          if (targetMember.roles.highest.position >= botMember.roles.highest.position ||
              targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.editReply({ content: 'Cannot timeout this user due to role hierarchy.' });
          }

          try {
            await targetMember.timeout(10 * 60 * 1000, `Timed out by ${interaction.user.tag} via mod button`);
            await logModAction(interaction.guild.id, 'timeout', interaction.user.id, targetUserId, '10m timeout via mod log button');
            return interaction.editReply({ content: `✅ Successfully timed out <@${targetUserId}> for 10 minutes.` });
          } catch (err) {
            return interaction.editReply({ content: `Failed to timeout user: ${err.message}` });
          }
        }

        if (action === 'mod_kick') {
          if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return interaction.editReply({ content: 'Access denied: You need the Kick Members permission.' });
          }
          if (!botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
            return interaction.editReply({ content: 'Bot is missing Kick Members permission.' });
          }

          const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
          if (!targetMember) {
            return interaction.editReply({ content: 'User is not currently in this server.' });
          }
          if (targetMember.roles.highest.position >= botMember.roles.highest.position ||
              targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.editReply({ content: 'Cannot kick this user due to role hierarchy.' });
          }

          try {
            await targetMember.kick(`Kicked by ${interaction.user.tag} via mod button`);
            await logModAction(interaction.guild.id, 'kick', interaction.user.id, targetUserId, 'Kicked via mod log button');
            return interaction.editReply({ content: `✅ Successfully kicked <@${targetUserId}> from the server.` });
          } catch (err) {
            return interaction.editReply({ content: `Failed to kick user: ${err.message}` });
          }
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

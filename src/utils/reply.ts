import { MessageFlags, type RepliableInteraction } from 'discord.js';

export const ephemeral = MessageFlags.Ephemeral;

export async function safeErrorReply(interaction: RepliableInteraction, content: string): Promise<void> {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, flags: ephemeral });
    } else {
      await interaction.reply({ content, flags: ephemeral });
    }
  } catch (error) {
    console.error('Failed to send interaction error reply:', error);
  }
}

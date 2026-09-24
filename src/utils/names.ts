import { GuildMember, type ButtonInteraction, type ChatInputCommandInteraction, type ModalSubmitInteraction, type StringSelectMenuInteraction, type User } from 'discord.js';

export type NamedInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;

export function interactionDisplayName(interaction: NamedInteraction): string {
  if (interaction.member instanceof GuildMember) {
    return interaction.member.displayName;
  }
  const member = interaction.member as { nick?: string } | null;
  return member?.nick || interaction.user.displayName;
}

export async function displayNameForUser(interaction: NamedInteraction, user: User): Promise<string> {
  const cached = interaction.guild?.members.cache.get(user.id);
  if (cached) {
    return cached.displayName;
  }
  try {
    const fetched = await interaction.guild?.members.fetch(user.id);
    return fetched?.displayName ?? user.displayName;
  } catch {
    return user.displayName;
  }
}

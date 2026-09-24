import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { config } from '../config.js';

export function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.member as GuildMember | null;
  return Boolean(member?.roles.cache.has(config.adminRoleId));
}

export async function requireAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (isAdmin(interaction)) {
    return true;
  }
  await interaction.reply({ content: '운영자 권한이 필요한 명령어입니다.', ephemeral: true });
  return false;
}

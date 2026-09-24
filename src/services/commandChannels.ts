import { getRows } from './sheets.js';

const commandChannels = new Map<string, Set<string>>();

function normalizeCommandName(value: string): string {
  return value.trim().replace(/^\//, '').toLowerCase();
}

export async function refreshCommandChannelRules(): Promise<void> {
  const rows = await getRows('CommandChannels');
  const next = new Map<string, Set<string>>();

  for (const row of rows) {
    const commandName = normalizeCommandName(row.command_name ?? '');
    const channelId = (row.channel_id ?? '').trim();
    if (!commandName || !channelId) {
      continue;
    }
    const channels = next.get(commandName) ?? new Set<string>();
    channels.add(channelId);
    next.set(commandName, channels);
  }

  commandChannels.clear();
  for (const [commandName, channels] of next) {
    commandChannels.set(commandName, channels);
  }
}

export function isCommandAllowedInChannel(commandName: string, channelId: string): boolean {
  const channels = commandChannels.get(normalizeCommandName(commandName));
  if (!channels || channels.size === 0) {
    return true;
  }
  return channels.has(channelId);
}

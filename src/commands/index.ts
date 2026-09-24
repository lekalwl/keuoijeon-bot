import { adminCommand } from './admin.js';
import { characterCommand } from './character.js';
import { confirmCommand } from './confirm.js';
import { diceCommand } from './dice.js';
import { duelCommand } from './duel.js';
import { fishingCommand } from './fishing.js';
import { inventoryCommand } from './inventory.js';
import { rpsCommand } from './rps.js';
import { buyCommand, sellCommand } from './shop.js';
import { statusCommand } from './status.js';
import { theftCommand } from './theft.js';
import { transferCommand } from './transfer.js';
import type { BotCommand } from './types.js';

export const commands: BotCommand[] = [
  characterCommand,
  diceCommand,
  inventoryCommand,
  confirmCommand,
  transferCommand,
  adminCommand,
  buyCommand,
  sellCommand,
  statusCommand,
  theftCommand,
  fishingCommand,
  rpsCommand,
  duelCommand
];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));

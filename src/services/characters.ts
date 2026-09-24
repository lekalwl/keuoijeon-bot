import { randomUUID } from 'node:crypto';
import { withLock } from './locks.js';
import { getRows, replaceRows, type SheetRow } from './sheets.js';
import { clearStaticSheetCache, getCachedRows } from './staticSheetCache.js';

export const STARTING_POINTS = 1000;
export type StatKey = 'strength' | 'agility' | 'dexterity' | 'luck' | 'personal_trait';

export interface Character {
  characterId: string;
  ownerUserId: string;
  characterName: string;
  points: number;
  strength: number;
  agility: number;
  dexterity: number;
  luck: number;
  personalTraitValue: number;
  personalTraitName: string;
  personalTraitText: string;
  personalTraitBonus: number;
  sdImageUrl: string;
  memo: string;
}

const STAT_BONUSES: Record<number, number> = { 1: -10, 2: 0, 3: 10, 4: 20, 5: 25 };

function integer(value: string | undefined, fallback = 0): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function statValue(value: string | undefined): number {
  const parsed = integer(value, 2);
  return parsed >= 1 && parsed <= 5 ? parsed : 2;
}

function fromRow(row: SheetRow): Character {
  return {
    characterId: row.character_id,
    ownerUserId: row.owner_user_id,
    characterName: row.character_name || '이름 없는 캐릭터',
    points: Math.max(0, integer(row.points)),
    strength: statValue(row.strength),
    agility: statValue(row.agility),
    dexterity: statValue(row.dexterity),
    luck: statValue(row.luck),
    personalTraitValue: statValue(row.personal_trait_value),
    personalTraitName: row.personal_trait_name || '개인특기',
    personalTraitText: row.personal_trait_text || '아직 등록된 개인특기 설명이 없습니다.',
    personalTraitBonus: integer(row.personal_trait_bonus),
    sdImageUrl: row.sd_image_url || '',
    memo: row.memo || ''
  };
}

function newCharacterRow(
  ownerUserId: string,
  characterName: string,
  strength: number,
  agility: number,
  dexterity: number,
  luck: number,
  personalTraitName: string,
  personalTraitValue: number
): SheetRow {
  return {
    character_id: `char_${ownerUserId.slice(-6)}_${randomUUID().slice(0, 8)}`,
    owner_user_id: ownerUserId,
    character_name: characterName,
    points: String(STARTING_POINTS),
    strength: String(strength),
    agility: String(agility),
    dexterity: String(dexterity),
    luck: String(luck),
    personal_trait_value: String(personalTraitValue),
    personal_trait_name: personalTraitName,
    personal_trait_text: '',
    personal_trait_bonus: String(STAT_BONUSES[personalTraitValue] ?? 0),
    sd_image_url: '',
    memo: ''
  };
}

export function baseStatBonus(character: Character, stat: StatKey): number {
  if (stat === 'personal_trait') return STAT_BONUSES[character.personalTraitValue] ?? character.personalTraitBonus;
  return STAT_BONUSES[character[stat]] ?? 0;
}

export async function getCharacter(characterId: string): Promise<Character | undefined> {
  const rows = await getCachedRows('Characters');
  const row = rows.find((candidate) => candidate.character_id === characterId);
  return row ? fromRow(row) : undefined;
}

export async function getCharactersByOwner(ownerUserId: string): Promise<Character[]> {
  const rows = await getRows('Characters');
  return rows.filter((row) => row.owner_user_id === ownerUserId && row.character_id).map(fromRow);
}

export async function getActiveCharacter(ownerUserId: string): Promise<Character | undefined> {
  const users = await getCachedRows('Users');
  const activeId = users.find((row) => row.user_id === ownerUserId)?.active_character_id;
  if (!activeId) return undefined;
  const character = await getCharacter(activeId);
  return character?.ownerUserId === ownerUserId ? character : undefined;
}

export async function requireActiveCharacter(ownerUserId: string): Promise<Character> {
  const character = await getActiveCharacter(ownerUserId);
  if (!character) throw new Error('선택된 캐릭터가 없습니다. `/캐릭터 등록` 또는 `/캐릭터 선택`을 이용해주세요.');
  return character;
}

export async function registerCharacter(
  ownerUserId: string,
  displayName: string,
  characterName: string,
  strength: number,
  agility: number,
  dexterity: number,
  luck: number,
  personalTraitName: string,
  personalTraitValue: number
): Promise<Character> {
  const name = characterName.trim();
  if (name.length < 1 || name.length > 40) throw new Error('캐릭터 이름은 1~40자로 입력해주세요.');
  if (![strength, agility, dexterity, luck, personalTraitValue].every((value) => Number.isInteger(value) && value >= 1 && value <= 5)) {
    throw new Error('스탯은 1~5 사이의 정수로 입력해주세요.');
  }
  const traitName = personalTraitName.trim();
  if (traitName.length < 1 || traitName.length > 60) throw new Error('개인특기 이름은 1~60자로 입력해주세요.');
  return withLock('characters', async () => {
    const characters = await getRows('Characters');
    if (characters.filter((row) => row.owner_user_id === ownerUserId).length >= 25) {
      throw new Error('한 계정에는 캐릭터를 최대 25명까지 등록할 수 있습니다.');
    }
    if (characters.some((row) => row.owner_user_id === ownerUserId && row.character_name === name)) {
      throw new Error('같은 이름의 캐릭터가 이미 등록되어 있습니다.');
    }
    const created = newCharacterRow(ownerUserId, name, strength, agility, dexterity, luck, traitName, personalTraitValue);
    characters.push(created);
    await replaceRows('Characters', characters);
    clearStaticSheetCache('Characters');

    const users = await getRows('Users');
    let user = users.find((row) => row.user_id === ownerUserId);
    if (!user) {
      user = { user_id: ownerUserId, display_name: displayName, active_character_id: created.character_id };
      users.push(user);
    } else {
      user.display_name = displayName;
      user.active_character_id ||= created.character_id;
    }
    await replaceRows('Users', users);
    clearStaticSheetCache('Users');
    return fromRow(created);
  });
}

export async function selectCharacter(ownerUserId: string, displayName: string, characterId: string): Promise<Character> {
  return withLock('users', async () => {
    const characterRow = (await getRows('Characters')).find((row) => row.character_id === characterId);
    const character = characterRow ? fromRow(characterRow) : undefined;
    if (!character || character.ownerUserId !== ownerUserId) throw new Error('본인에게 등록된 캐릭터가 아닙니다.');
    const users = await getRows('Users');
    let user = users.find((row) => row.user_id === ownerUserId);
    if (!user) {
      user = { user_id: ownerUserId, display_name: displayName, active_character_id: characterId };
      users.push(user);
    } else {
      user.display_name = displayName;
      user.active_character_id = characterId;
    }
    await replaceRows('Users', users);
    clearStaticSheetCache('Users');
    return character;
  });
}

export async function setCharacterMemo(characterId: string, ownerUserId: string, memo: string): Promise<Character> {
  return withLock('characters', async () => {
    const rows = await getRows('Characters');
    const row = rows.find((candidate) => candidate.character_id === characterId && candidate.owner_user_id === ownerUserId);
    if (!row) throw new Error('캐릭터를 찾을 수 없습니다.');
    row.memo = memo.trim();
    await replaceRows('Characters', rows);
    clearStaticSheetCache('Characters');
    return fromRow(row);
  });
}

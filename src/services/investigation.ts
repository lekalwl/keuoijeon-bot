import { todayKey } from '../utils/format.js';
import { randomInt } from '../utils/random.js';
import { addItem } from './inventory.js';
import { getItemById } from './items.js';
import { withLock } from './locks.js';
import { getRows, replaceRows, type SheetRow } from './sheets.js';
import { getCachedRows } from './staticSheetCache.js';

const DEFAULT_GLOBAL_DAILY_LIMIT = 3;

export type InvestigationGrade = 'failure' | 'success' | 'great_success';

export interface InvestigationArea {
  channelId: string;
  title: string;
  description: string;
  channelDailyLimit: number;
}

export interface InvestigationChoice {
  channelId: string;
  choiceId: string;
  choiceLabel: string;
  resultText: string;
  requiredRoleIds: string[];
}

export interface InvestigationOutcome {
  grade: InvestigationGrade;
  label: string;
  resultText: string;
  itemId?: string;
  minQty: number;
  maxQty: number;
}

export interface InvestigationResult {
  choice: InvestigationChoice;
  outcome: InvestigationOutcome;
  rewards: string[];
  remainingGlobal: number;
  remainingChannel?: number;
}

function num(value: string | undefined, fallback = 0): number {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveInt(value: string | undefined, fallback = 0): number {
  return Math.max(0, Math.floor(num(value, fallback)));
}

function parseIdList(value: string | undefined): string[] {
  return (value ?? '')
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function hasAnyRequiredRole(requiredRoleIds: string[], userRoleIds: string[]): boolean {
  if (requiredRoleIds.length === 0) {
    return true;
  }
  const userRoleIdSet = new Set(userRoleIds);
  return requiredRoleIds.some((roleId) => userRoleIdSet.has(roleId));
}

function gradeLabel(grade: InvestigationGrade): string {
  if (grade === 'failure') return '실패';
  if (grade === 'great_success') return '대성공';
  return '성공';
}

function normalizeGrade(value: string | undefined): InvestigationGrade | undefined {
  const normalized = (value ?? '').trim().toLowerCase();
  if (['failure', 'fail', 'bad', '실패'].includes(normalized)) return 'failure';
  if (['success', 'good', '성공'].includes(normalized)) return 'success';
  if (['great_success', 'great', 'critical', 'crit', '대성공'].includes(normalized)) return 'great_success';
  return undefined;
}

function parseChannelCounts(value: string | undefined): Record<string, number> {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).map(([channelId, count]) => [channelId, Math.max(0, Math.floor(Number(count) || 0))])
    );
  } catch {
    return {};
  }
}

export async function getGlobalDailyLimit(): Promise<number> {
  const rows = await getCachedRows('InvestigationSettings');
  const row = rows.find((candidate) => candidate.key === 'global_daily_limit');
  return positiveInt(row?.value, DEFAULT_GLOBAL_DAILY_LIMIT);
}

async function getRoleBonus(roleIds: string[]): Promise<{ extraGlobal: number; extraChannel: number }> {
  if (roleIds.length === 0) {
    return { extraGlobal: 0, extraChannel: 0 };
  }
  const roleIdSet = new Set(roleIds);
  try {
    const rows = await getCachedRows('InvestigationRoleBonuses');
    return rows
      .filter((row) => roleIdSet.has(row.role_id))
      .reduce(
        (total, row) => ({
          extraGlobal: total.extraGlobal + positiveInt(row.extra_global_limit, 0),
          extraChannel: total.extraChannel + positiveInt(row.extra_channel_limit, 0)
        }),
        { extraGlobal: 0, extraChannel: 0 }
      );
  } catch {
    return { extraGlobal: 0, extraChannel: 0 };
  }
}

export async function getArea(channelId: string): Promise<InvestigationArea | undefined> {
  const row = (await getCachedRows('Investigations')).find((candidate) => candidate.channel_id === channelId);
  if (!row) {
    return undefined;
  }
  return {
    channelId,
    title: row.title || '조사',
    description: row.description ?? '',
    channelDailyLimit: positiveInt(row.daily_limit, 0)
  };
}

export async function getChoices(channelId: string, roleIds: string[] = []): Promise<InvestigationChoice[]> {
  return (await getCachedRows('InvestigationChoices'))
    .filter((row) => row.channel_id === channelId)
    .map((row) => ({
      channelId,
      choiceId: row.choice_id,
      choiceLabel: row.choice_label,
      resultText: row.result_text,
      requiredRoleIds: parseIdList(row.required_role_id)
    }))
    .filter((choice) => hasAnyRequiredRole(choice.requiredRoleIds, roleIds));
}

async function rollOutcome(choice: InvestigationChoice): Promise<InvestigationOutcome> {
  const rows = (await getCachedRows('InvestigationResults'))
    .filter((row) => row.choice_id === choice.choiceId)
    .map((row) => ({
      grade: normalizeGrade(row.result_grade),
      weight: Math.max(0, num(row.chance, 0)),
      resultText: row.result_text?.trim() ?? '',
      itemId: row.item_id?.trim(),
      minQty: positiveInt(row.min_qty, 1),
      maxQty: positiveInt(row.max_qty, positiveInt(row.min_qty, 1))
    }))
    .filter(
      (row): row is { grade: InvestigationGrade; weight: number; resultText: string; itemId: string; minQty: number; maxQty: number } =>
        Boolean(row.grade)
    );

  if (rows.length === 0) {
    return { grade: 'success', label: gradeLabel('success'), resultText: choice.resultText, minQty: 1, maxQty: 1 };
  }

  const totalWeight = rows.reduce((total, row) => total + row.weight, 0);
  if (totalWeight <= 0) {
    return { grade: 'success', label: gradeLabel('success'), resultText: choice.resultText, minQty: 1, maxQty: 1 };
  }

  let roll = Math.random() * totalWeight;
  for (const row of rows) {
    roll -= row.weight;
    if (roll <= 0) {
      return {
        grade: row.grade,
        label: gradeLabel(row.grade),
        resultText: row.resultText || choice.resultText,
        itemId: row.itemId,
        minQty: row.minQty,
        maxQty: row.maxQty
      };
    }
  }

  const fallback = rows[rows.length - 1];
  return {
    grade: fallback.grade,
    label: gradeLabel(fallback.grade),
    resultText: fallback.resultText || choice.resultText,
    itemId: fallback.itemId,
    minQty: fallback.minQty,
    maxQty: fallback.maxQty
  };
}

export async function resolveChoice(
  userId: string,
  displayName: string,
  channelId: string,
  choiceId: string,
  roleIds: string[] = []
): Promise<InvestigationResult> {
  return withLock(`investigation:${userId}`, async () => {
    const area = await getArea(channelId);
    if (!area) {
      throw new Error('딱히 특별한 것은 없어 보인다.');
    }

    const choice = (await getChoices(channelId, roleIds)).find((candidate) => candidate.choiceId === choiceId);
    if (!choice) {
      throw new Error('선택지를 찾을 수 없습니다.');
    }

    const date = todayKey();
    const roleBonus = await getRoleBonus(roleIds);
    const globalDailyLimit = (await getGlobalDailyLimit()) + roleBonus.extraGlobal;
    const users = await getRows('Users');
    let user = users.find((row) => row.user_id === userId);
    if (!user) {
      user = { user_id: userId, display_name: displayName, points: '0' };
      users.push(user);
    }
    user.display_name = displayName;

    if (user.investigation_date !== date) {
      user.investigation_date = date;
      user.investigation_total_count = '0';
      user.investigation_channel_counts = '{}';
    }

    const globalUsed = positiveInt(user.investigation_total_count, 0);
    if (globalUsed >= globalDailyLimit) {
      throw new Error('오늘은 더 조사할 수 없습니다.');
    }

    const channelCounts = parseChannelCounts(user.investigation_channel_counts);
    const channelUsed = channelCounts[channelId] ?? 0;
    const channelDailyLimit = area.channelDailyLimit > 0 ? area.channelDailyLimit + roleBonus.extraChannel : 0;
    if (channelDailyLimit > 0 && channelUsed >= channelDailyLimit) {
      throw new Error('오늘은 이 장소를 더 조사할 수 없습니다.');
    }

    const outcome = await rollOutcome(choice);
    const rewards: string[] = [];
    if (outcome.itemId) {
      const quantity = randomInt(Math.min(outcome.minQty, outcome.maxQty), Math.max(outcome.minQty, outcome.maxQty));
      const item = await getItemById(outcome.itemId);
      if (item && quantity > 0) {
        await addItem(userId, item.itemId, quantity);
        rewards.push(`${item.itemName} x${quantity}`);
      }
    }

    channelCounts[channelId] = channelUsed + 1;
    user.investigation_total_count = String(globalUsed + 1);
    user.investigation_channel_counts = JSON.stringify(channelCounts);
    await replaceRows('Users', users as SheetRow[]);

    return {
      choice,
      outcome,
      rewards,
      remainingGlobal: Math.max(0, globalDailyLimit - globalUsed - 1),
      remainingChannel: channelDailyLimit > 0 ? Math.max(0, channelDailyLimit - channelUsed - 1) : undefined
    };
  });
}

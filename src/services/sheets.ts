import type { sheets_v4 } from 'googleapis';
import { config } from '../config.js';

const { google } = await import('googleapis');

export const SHEET_HEADERS = {
  Users: ['user_id', 'display_name', 'active_character_id'],
  Characters: [
    'character_id',
    'owner_user_id',
    'character_name',
    'points',
    'strength',
    'agility',
    'dexterity',
    'luck',
    'personal_trait_value',
    'personal_trait_name',
    'personal_trait_text',
    'personal_trait_bonus',
    'sd_image_url',
    'memo'
  ],
  Items: ['item_id', 'item_name', 'usable', 'use_text', 'consume_on_use', 'description', 'shop_enabled', 'sell_enabled', 'price', 'bound'],
  ItemUseTexts: ['item_id', 'chance', 'use_text'],
  Inventory: ['character_id', 'item_id', 'quantity'],
  StatItemEffects: ['item_id', 'effect_name', 'stat', 'modifier', 'duration_minutes', 'stackable'],
  InventoryEffects: ['item_id', 'effect_name', 'stat', 'modifier', 'per_quantity', 'max_stacks'],
  ActiveEffects: ['effect_id', 'character_id', 'source_item_id', 'effect_name', 'stat', 'modifier', 'starts_at', 'expires_at'],
  SpecialItemEffects: ['item_id', 'effect_key', 'value', 'chance'],
  ActiveSpecialEffects: ['effect_id', 'character_id', 'source_item_id', 'effect_key', 'value', 'chance', 'charges', 'created_at'],
  FishingRewards: ['rarity', 'item_id', 'weight', 'min_qty', 'max_qty'],
  CommandChannels: ['command_name', 'channel_id', 'note'],
  TheftLogs: ['created_at', 'thief_character_id', 'target_character_id', 'kind', 'asset', 'quantity', 'thief_roll', 'target_roll', 'result']
} as const;

export type SheetName = keyof typeof SHEET_HEADERS;
export type SheetRow = Record<string, string>;

const auth = new google.auth.JWT({
  email: config.googleServiceAccountEmail,
  key: config.googlePrivateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

export async function getSpreadsheet(): Promise<sheets_v4.Schema$Spreadsheet> {
  const response = await sheets.spreadsheets.get({ spreadsheetId: config.googleSheetId });
  return response.data;
}

export async function ensureSheet(name: SheetName): Promise<void> {
  const spreadsheet = await getSpreadsheet();
  const exists = spreadsheet.sheets?.some((sheet) => sheet.properties?.title === name);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.googleSheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: name } } }]
      }
    });
  }
  await ensureHeaders(name);
}

export async function ensureHeaders(name: SheetName): Promise<void> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetId,
    range: `${name}!A:Z`
  });
  const values = response.data.values ?? [];
  const hasData = values.slice(1).some((row) => row.some((cell) => String(cell ?? '').trim().length > 0));
  const headers = hasData
    ? (values[0] ?? []).map(String).filter((header) => header.trim().length > 0)
    : [...SHEET_HEADERS[name]];
  if (hasData) {
    for (const required of SHEET_HEADERS[name]) {
      if (!headers.includes(required)) headers.push(required);
    }
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetId,
    range: `${name}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers] }
  });
}

export async function getRows(name: SheetName): Promise<SheetRow[]> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetId,
    range: `${name}!A:Z`
  });
  const values = response.data.values ?? [];
  if (values.length <= 1) {
    return [];
  }
  const headers = values[0].map(String);
  if (name === 'Users' && !headers.includes('user_id')) {
    throw new Error('Users sheet header is missing required columns. Refusing to read user data.');
  }
  return values.slice(1).map((row) => {
    const record: SheetRow = {};
    headers.forEach((header, index) => {
      record[header] = row[index] === undefined ? '' : String(row[index]);
    });
    return record;
  });
}

async function countExistingRows(name: SheetName): Promise<number> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetId,
    range: `${name}!A2:A`
  });
  return (response.data.values ?? []).filter((row) => row[0] !== undefined && String(row[0]).trim().length > 0).length;
}

export async function replaceRows(name: SheetName, rows: SheetRow[]): Promise<void> {
  const headers = [...SHEET_HEADERS[name]];
  const values = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))];
  if (name !== 'Users') {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: config.googleSheetId,
      range: `${name}!A:Z`
    });
  } else {
    const existingRowCount = await countExistingRows(name);
    if (existingRowCount > 0 && rows.length < existingRowCount) {
      throw new Error(`Refusing to shrink Users sheet from ${existingRowCount} rows to ${rows.length} rows.`);
    }
    await sheets.spreadsheets.values.clear({
      spreadsheetId: config.googleSheetId,
      range: `${name}!A:Z`
    });
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetId,
    range: `${name}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values }
  });
}

export async function appendRow(name: SheetName, row: SheetRow): Promise<void> {
  const headers = [...SHEET_HEADERS[name]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheetId,
    range: `${name}!A:Z`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [headers.map((header) => row[header] ?? '')] }
  });
}

export async function setupAllSheets(reset: boolean, seed: boolean): Promise<string[]> {
  const touched: string[] = [];
  for (const name of Object.keys(SHEET_HEADERS) as SheetName[]) {
    await ensureSheet(name);
    touched.push(name);
    if (reset) {
      await replaceRows(name, []);
    }
  }
  if (seed) {
    await seedSampleData(reset);
  }
  return touched;
}

async function seedSampleData(reset: boolean): Promise<void> {
  if (reset || (await getRows('Items')).length === 0) {
    await replaceRows('Items', [
      {
        item_id: 'potion',
        item_name: '응급 키트',
        usable: 'TRUE',
        use_text: '응급 키트를 사용했다. 상처가 조금 나아진 것 같다.',
        consume_on_use: 'TRUE',
        description: '간단한 처치 도구가 들어 있는 작은 키트.'
      },
      {
        item_id: 'candy',
        item_name: '수상한 사탕',
        usable: 'TRUE',
        use_text: '수상한 사탕을 먹었다. 이상하게 기분이 좋아진다.',
        consume_on_use: 'TRUE',
        description: '포장지는 귀엽지만 출처는 알 수 없는 사탕.'
      },
      {
        item_id: 'old_key',
        item_name: '낡은 열쇠',
        usable: 'FALSE',
        use_text: '',
        consume_on_use: 'FALSE',
        description: '오래된 문에나 맞을 법한 녹슨 열쇠.'
      },
      {
        item_id: 'torn_memo',
        item_name: '찢어진 메모',
        usable: 'FALSE',
        use_text: '',
        consume_on_use: 'FALSE',
        description: '문장 일부만 남아 있어 더 신경 쓰이는 메모.'
      }
    ]);
  }
}

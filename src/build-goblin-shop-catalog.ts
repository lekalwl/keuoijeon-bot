import { config } from './config.js';

const { google } = await import('googleapis');
const auth = new google.auth.JWT({
  email: config.googleServiceAccountEmail,
  key: config.googlePrivateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = config.googleSheetId;
const title = '도깨비상점';

const metadata = await sheets.spreadsheets.get({ spreadsheetId });
const source = metadata.data.sheets?.find((sheet) => sheet.properties?.title === 'Items');
if (!source?.properties?.sheetId) throw new Error('Items 탭을 찾을 수 없습니다.');

const itemResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Items!A:I' });
const sourceValues = itemResponse.data.values ?? [];
const headers = (sourceValues[0] ?? []).map(String);
const records = sourceValues.slice(1).map((values) =>
  Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? '')]))
);

const sections = [
  {
    name: '평범한 잡화',
    note: '일상에서 편하게 사용할 수 있는 소품입니다.',
    color: '#607D6A',
    ids: [
      'shop_handkerchief', 'shop_glass_marble', 'shop_hair_tie', 'shop_small_comb', 'shop_letter_set',
      'shop_flower_teacup', 'shop_scented_candle', 'shop_blanket', 'shop_water_bottle', 'shop_rabbit_plush'
    ],
    badge: 'RP용'
  },
  {
    name: '도깨비 잡화',
    note: '조금 수상하지만 제법 근사한 도깨비 물건입니다.',
    color: '#7C3F2C',
    ids: [
      'goblin_blue_lantern', 'goblin_horn_mask', 'goblin_broken_club', 'goblin_cloud_fan', 'goblin_shadow_pouch',
      'goblin_rain_straw_shoes', 'goblin_moon_coin', 'goblin_foxrain_hairpin', 'goblin_nameless_scroll', 'goblin_laughter_bell'
    ],
    badge: 'RP용'
  },
  {
    name: '기능성 물건',
    note: '사용하면 다음 행동이나 게임에 특별한 효과가 적용됩니다.',
    color: '#314B47',
    ids: [
      'special_premium_bait', 'special_lucky_hook', 'special_golden_net', 'special_glitter_float', 'special_magic_pouch',
      'special_theft_insurance', 'special_thief_gloves', 'special_alarm_bell', 'special_victory_charm', 'special_lucky_die'
    ],
    badge: '소모품 · 재판매 불가'
  },
  {
    name: '도깨비 먹거리',
    note: '먹으면 60분 동안 스탯 보너스를 얻는 특별 메뉴입니다.',
    color: '#8A6D2F',
    ids: ['buff_meat_gukbap', 'buff_wind_ricecake', 'buff_honey_candy', 'buff_clover_cracker', 'buff_goblin_feast'],
    badge: '버프 음식 · 재판매 불가'
  },
  {
    name: '낚시 용품',
    note: '낚시를 시작할 때 필요한 기본 소모품입니다.',
    color: '#5D4A73',
    ids: ['bait'],
    badge: '낚시 1회당 1개'
  }
] as const;

const itemMap = new Map(records.map((record) => [record.item_id, record]));
const missing = sections.flatMap((section) => section.ids).filter((id) => !itemMap.has(id));
if (missing.length) throw new Error(`Items 탭에서 찾지 못한 상품: ${missing.join(', ')}`);

const existing = metadata.data.sheets?.find((sheet) => sheet.properties?.title === title);
if (existing?.properties?.sheetId !== undefined) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ deleteSheet: { sheetId: existing.properties.sheetId } }] }
  });
}

const added = await sheets.spreadsheets.batchUpdate({
  spreadsheetId,
  requestBody: {
    requests: [
      {
        addSheet: {
          properties: {
            title,
            index: Math.min(2, metadata.data.sheets?.length ?? 0),
            gridProperties: { rowCount: 80, columnCount: 5, frozenRowCount: 2, hideGridlines: true },
            tabColorStyle: { rgbColor: { red: 0.49, green: 0.25, blue: 0.17 } }
          }
        }
      }
    ]
  }
});
const sheetId = added.data.replies?.[0]?.addSheet?.properties?.sheetId;
if (sheetId === undefined) throw new Error('도깨비상점 탭 생성에 실패했습니다.');

const values: (string | number)[][] = [
  ['도깨비상점', '', '', '', ''],
  ['기묘한 물건부터 든든한 먹거리까지. 마음에 드는 물건은 /구매 명령어로 주문하세요.', '', '', '', ''],
  ['', '', '', '', '']
];
const sectionRows: { start: number; header: number; end: number; color: string }[] = [];

for (const section of sections) {
  const start = values.length;
  values.push([`${section.name}  |  ${section.note}`, '', '', '', '']);
  const header = values.length;
  values.push(['상품명', '분류', '가격', '설명 및 효과', '비고']);
  for (const id of section.ids) {
    const item = itemMap.get(id)!;
    const rowNumber = values.length + 1;
    values.push([
      item.item_name,
      section.name,
      `=IFERROR(VALUE(XLOOKUP(A${rowNumber},Items!B:B,Items!I:I)),"")`,
      `=IFERROR(XLOOKUP(A${rowNumber},Items!B:B,Items!F:F),"")`,
      section.badge
    ]);
  }
  sectionRows.push({ start, header, end: values.length, color: section.color });
  values.push(['', '', '', '', '']);
}

await sheets.spreadsheets.values.update({
  spreadsheetId,
  range: `'${title}'!A1:E${values.length}`,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values }
});

function rgb(hex: string): { red: number; green: number; blue: number } {
  const value = hex.replace('#', '');
  return {
    red: Number.parseInt(value.slice(0, 2), 16) / 255,
    green: Number.parseInt(value.slice(2, 4), 16) / 255,
    blue: Number.parseInt(value.slice(4, 6), 16) / 255
  };
}

const requests: object[] = [
  { mergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 5 }, mergeType: 'MERGE_ALL' } },
  { mergeCells: { range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 5 }, mergeType: 'MERGE_ALL' } },
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 5 },
      cell: {
        userEnteredFormat: {
          backgroundColorStyle: { rgbColor: rgb('#321B17') },
          horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
          textFormat: { bold: true, fontSize: 20, foregroundColorStyle: { rgbColor: rgb('#F5D77A') } }
        }
      },
      fields: 'userEnteredFormat'
    }
  },
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 5 },
      cell: {
        userEnteredFormat: {
          backgroundColorStyle: { rgbColor: rgb('#68402E') },
          horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
          textFormat: { italic: true, fontSize: 10, foregroundColorStyle: { rgbColor: rgb('#FFF4D6') } }
        }
      },
      fields: 'userEnteredFormat'
    }
  },
  {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 180 }, fields: 'pixelSize'
    }
  },
  {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 110 }, fields: 'pixelSize'
    }
  },
  {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 80 }, fields: 'pixelSize'
    }
  },
  {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 500 }, fields: 'pixelSize'
    }
  },
  {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 }, properties: { pixelSize: 170 }, fields: 'pixelSize'
    }
  },
  {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 46 }, fields: 'pixelSize'
    }
  },
  {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 30 }, fields: 'pixelSize'
    }
  }
];

for (const section of sectionRows) {
  requests.push(
    { mergeCells: { range: { sheetId, startRowIndex: section.start, endRowIndex: section.start + 1, startColumnIndex: 0, endColumnIndex: 5 }, mergeType: 'MERGE_ALL' } },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: section.start, endRowIndex: section.start + 1, startColumnIndex: 0, endColumnIndex: 5 },
        cell: {
          userEnteredFormat: {
            backgroundColorStyle: { rgbColor: rgb(section.color) },
            verticalAlignment: 'MIDDLE',
            textFormat: { bold: true, fontSize: 12, foregroundColorStyle: { rgbColor: rgb('#FFFFFF') } },
            padding: { left: 10, right: 6, top: 4, bottom: 4 }
          }
        },
        fields: 'userEnteredFormat'
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: section.header, endRowIndex: section.header + 1, startColumnIndex: 0, endColumnIndex: 5 },
        cell: {
          userEnteredFormat: {
            backgroundColorStyle: { rgbColor: rgb('#2C2926') },
            horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
            textFormat: { bold: true, foregroundColorStyle: { rgbColor: rgb('#FFF7E6') } },
            borders: { bottom: { style: 'SOLID_MEDIUM', colorStyle: { rgbColor: rgb(section.color) } } }
          }
        },
        fields: 'userEnteredFormat'
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: section.header + 1, endRowIndex: section.end, startColumnIndex: 0, endColumnIndex: 5 },
        cell: {
          userEnteredFormat: {
            backgroundColorStyle: { rgbColor: rgb('#FFFDF7') },
            verticalAlignment: 'MIDDLE', wrapStrategy: 'WRAP',
            textFormat: { foregroundColorStyle: { rgbColor: rgb('#29231F') } },
            padding: { left: 8, right: 8, top: 5, bottom: 5 },
            borders: {
              bottom: { style: 'SOLID', colorStyle: { rgbColor: rgb('#DDD3C4') } },
              left: { style: 'SOLID', colorStyle: { rgbColor: rgb('#E9E1D5') } },
              right: { style: 'SOLID', colorStyle: { rgbColor: rgb('#E9E1D5') } }
            }
          }
        },
        fields: 'userEnteredFormat'
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: section.header + 1, endRowIndex: section.end, startColumnIndex: 2, endColumnIndex: 3 },
        cell: { userEnteredFormat: { horizontalAlignment: 'RIGHT', numberFormat: { type: 'NUMBER', pattern: '#,##0"P"' } } },
        fields: 'userEnteredFormat(horizontalAlignment,numberFormat)'
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: section.header + 1, endRowIndex: section.end, startColumnIndex: 4, endColumnIndex: 5 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', textFormat: { bold: true, foregroundColorStyle: { rgbColor: rgb(section.color) } } } },
        fields: 'userEnteredFormat(horizontalAlignment,textFormat)'
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: section.start, endIndex: section.start + 1 }, properties: { pixelSize: 34 }, fields: 'pixelSize'
      }
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: section.header + 1, endIndex: section.end }, properties: { pixelSize: 48 }, fields: 'pixelSize'
      }
    }
  );
}

await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

const verify = await sheets.spreadsheets.get({
  spreadsheetId,
  includeGridData: true,
  ranges: [`'${title}'!A1:E${values.length}`],
  fields: 'sheets(properties,data(rowData(values(formattedValue,effectiveValue,userEnteredValue,userEnteredFormat))))'
});
const verified = verify.data.sheets?.[0];
const rows = verified?.data?.[0]?.rowData ?? [];
if (verified?.properties?.title !== title || rows.length < values.length - 1) {
  throw new Error('도깨비상점 탭 검증에 실패했습니다.');
}
console.log(`Goblin shop catalog created: ${title}!A1:E${values.length}, ${sections.reduce((sum, section) => sum + section.ids.length, 0)} items`);

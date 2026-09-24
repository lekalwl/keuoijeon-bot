import { config } from './config.js';

const PUBLIC_SHOP_SPREADSHEET_ID = '1NIHTf2Yvsn2uUPepYCR8aEep2kr94I1XiHu9AH_AIUc';
const { google } = await import('googleapis');
const auth = new google.auth.JWT({
  email: config.googleServiceAccountEmail,
  key: config.googlePrivateKey,
  scopes: ['https://www.googleapis.com/auth/drive']
});
const drive = google.drive({ version: 'v3', auth });

const permissions = await drive.permissions.list({
  fileId: PUBLIC_SHOP_SPREADSHEET_ID,
  fields: 'permissions(id,type,role,allowFileDiscovery)'
});
const publicReader = permissions.data.permissions?.find(
  (permission) => permission.type === 'anyone' && permission.role === 'reader'
);

if (!publicReader) {
  await drive.permissions.create({
    fileId: PUBLIC_SHOP_SPREADSHEET_ID,
    requestBody: { type: 'anyone', role: 'reader', allowFileDiscovery: false }
  });
}

const verified = await drive.permissions.list({
  fileId: PUBLIC_SHOP_SPREADSHEET_ID,
  fields: 'permissions(id,type,role,allowFileDiscovery)'
});
if (!verified.data.permissions?.some((permission) => permission.type === 'anyone' && permission.role === 'reader')) {
  throw new Error('공개 읽기 권한 검증에 실패했습니다.');
}

console.log(`Public shop shared: https://docs.google.com/spreadsheets/d/${PUBLIC_SHOP_SPREADSHEET_ID}/edit`);

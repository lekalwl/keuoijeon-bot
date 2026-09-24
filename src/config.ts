import 'dotenv/config';

const deadProxyValues = new Set(['http://127.0.0.1:9', 'https://127.0.0.1:9']);
for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
  if (process.env[name] && deadProxyValues.has(process.env[name] ?? '')) {
    delete process.env[name];
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export const config = {
  discordToken: requireEnv('DISCORD_TOKEN'),
  discordClientId: requireEnv('DISCORD_CLIENT_ID'),
  discordGuildId: process.env.DISCORD_GUILD_ID?.trim(),
  googleSheetId: requireEnv('GOOGLE_SHEET_ID'),
  googleServiceAccountEmail: requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
  googlePrivateKey: requireEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  adminRoleId: requireEnv('ADMIN_ROLE_ID')
};

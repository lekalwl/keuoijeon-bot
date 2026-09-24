export function formatPoints(points: number): string {
  return `${points.toLocaleString('ko-KR')}P`;
}

export function hpBar(hp: number): string {
  const filled = Math.max(0, Math.min(4, Math.ceil(hp / 25)));
  return `${'█'.repeat(filled)}${'□'.repeat(4 - filled)} ${hp}%`;
}

export function todayKey(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
}

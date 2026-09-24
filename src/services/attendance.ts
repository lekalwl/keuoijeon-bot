import { todayKey } from '../utils/format.js';
import { withLock } from './locks.js';
import { getRows, replaceRows, type SheetRow } from './sheets.js';

export const ATTENDANCE_REWARD_POINTS = 100;

export interface AttendanceResult {
  alreadyChecked: boolean;
  date: string;
  awarded: number;
  balance?: number;
}

function parsePoints(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export async function checkAttendance(userId: string, displayName: string): Promise<AttendanceResult> {
  return withLock('users', async () => {
    const date = todayKey();
    const rows = await getRows('Users');
    let row = rows.find((candidate) => candidate.user_id === userId);
    if (!row) {
      row = { user_id: userId, display_name: displayName, points: '0', last_attendance_date: '' };
      rows.push(row);
    }

    if (row.last_attendance_date === date) {
      return {
        alreadyChecked: true,
        date,
        awarded: 0,
        balance: parsePoints(row.points)
      };
    }

    const nextPoints = parsePoints(row.points) + ATTENDANCE_REWARD_POINTS;
    row.display_name = displayName;
    row.points = String(nextPoints);
    row.last_attendance_date = date;

    await replaceRows('Users', rows as SheetRow[]);
    return {
      alreadyChecked: false,
      date,
      awarded: ATTENDANCE_REWARD_POINTS,
      balance: nextPoints
    };
  });
}

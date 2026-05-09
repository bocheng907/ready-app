import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'reading-records:v1';

export type Mood = '很好' | '普通' | '疲累' | '專注' | '有成就感';

export type ReadingRecord = {
  id: string;
  date: string;
  subject: string;
  minutes: number;
  completedItems: string;
  reflection: string;
  mood: Mood;
  startPage?: number;
  endPage?: number;
  pagesRead?: number;
  createdAt: string;
};

export type ReadingStats = {
  todayMinutes: number;
  weekMinutes: number;
  streakDays: number;
};

export const moods: Mood[] = ['很好', '普通', '疲累', '專注', '有成就感'];

export function formatDateKey(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getWeekStart(date: Date = new Date()) {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() + diff);

  return formatDateKey(weekStart);
}

export function getWeekEnd(weekStart: string) {
  const date = new Date(`${weekStart}T12:00:00`);
  date.setDate(date.getDate() + 6);

  return formatDateKey(date);
}

export function calculatePagesRead(startPage?: number, endPage?: number) {
  if (
    typeof startPage !== 'number' ||
    typeof endPage !== 'number' ||
    !Number.isFinite(startPage) ||
    !Number.isFinite(endPage) ||
    endPage < startPage
  ) {
    return 0;
  }

  return endPage - startPage + 1;
}

function normalizeRecord(record: ReadingRecord): ReadingRecord {
  const startPage = Number.isFinite(record.startPage) ? record.startPage : undefined;
  const endPage = Number.isFinite(record.endPage) ? record.endPage : undefined;
  const pagesRead = record.pagesRead ?? calculatePagesRead(startPage, endPage);

  return {
    ...record,
    startPage,
    endPage,
    pagesRead,
  };
}

export async function getReadingRecords() {
  const rawRecords = await AsyncStorage.getItem(STORAGE_KEY);

  if (!rawRecords) {
    return [];
  }

  try {
    const records = JSON.parse(rawRecords) as ReadingRecord[];
    return records
      .map(normalizeRecord)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function saveReadingRecord(record: Omit<ReadingRecord, 'id' | 'createdAt' | 'pagesRead'>) {
  const records = await getReadingRecords();
  const nextRecord: ReadingRecord = {
    ...record,
    pagesRead: calculatePagesRead(record.startPage, record.endPage),
    id: `${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([nextRecord, ...records]));

  return nextRecord;
}

export function calculateReadingStats(records: ReadingRecord[], today = formatDateKey()): ReadingStats {
  const weekStart = getWeekStart(new Date(`${today}T12:00:00`));
  const readDates = new Set(records.filter((record) => record.minutes > 0).map((record) => record.date));

  let streakDays = 0;
  const cursor = new Date(`${today}T12:00:00`);

  while (readDates.has(formatDateKey(cursor))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return records.reduce(
    (stats, record) => {
      if (record.date === today) {
        stats.todayMinutes += record.minutes;
      }

      if (record.date >= weekStart && record.date <= today) {
        stats.weekMinutes += record.minutes;
      }

      return stats;
    },
    { todayMinutes: 0, weekMinutes: 0, streakDays },
  );
}

export function getTodayRecords(records: ReadingRecord[], today = formatDateKey()) {
  return records.filter((record) => record.date === today);
}

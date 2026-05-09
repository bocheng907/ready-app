import AsyncStorage from '@react-native-async-storage/async-storage';

import { formatDateKey, getWeekEnd, getWeekStart, ReadingRecord } from '@/lib/reading-records';

const STORAGE_KEY = 'weekly-plans:v1';

export type WeeklyPlanItemType = 'pages' | 'task';

export type WeeklyPlanItem = {
  id: string;
  subject: string;
  type: WeeklyPlanItemType;
  startPage?: number;
  endPage?: number;
  task?: string;
  completed?: boolean;
  carryOver?: boolean;
  createdAt: string;
};

export type WeeklyPlan = {
  weekStart: string;
  items: WeeklyPlanItem[];
  createdAt: string;
  updatedAt: string;
};

export type WeeklyPlanItemProgress = {
  item: WeeklyPlanItem;
  completedPages: number;
  totalPages: number;
  percent: number;
  remainingStartPage?: number;
  remainingEndPage?: number;
  isComplete: boolean;
};

export type WeeklyPlanProgress = {
  weekStart: string;
  items: WeeklyPlanItemProgress[];
  percent: number;
};

function getPreviousWeekStart(weekStart: string) {
  const date = new Date(`${weekStart}T12:00:00`);
  date.setDate(date.getDate() - 7);

  return formatDateKey(date);
}

function normalizePercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function getPlannedTotalPages(item: WeeklyPlanItem) {
  if (item.type !== 'pages' || typeof item.startPage !== 'number' || typeof item.endPage !== 'number') {
    return 0;
  }

  return Math.max(0, item.endPage - item.startPage + 1);
}

function getCompletedPageSet(item: WeeklyPlanItem, records: ReadingRecord[], weekStart: string) {
  const completedPages = new Set<number>();
  const weekEnd = getWeekEnd(weekStart);

  if (item.type !== 'pages' || typeof item.startPage !== 'number' || typeof item.endPage !== 'number') {
    return completedPages;
  }

  records
    .filter((record) => record.date >= weekStart && record.date <= weekEnd && record.subject === item.subject)
    .forEach((record) => {
      if (typeof record.startPage !== 'number' || typeof record.endPage !== 'number') {
        return;
      }

      const start = Math.max(item.startPage ?? 0, record.startPage);
      const end = Math.min(item.endPage ?? 0, record.endPage);

      for (let page = start; page <= end; page += 1) {
        completedPages.add(page);
      }
    });

  return completedPages;
}

function getRemainingRange(item: WeeklyPlanItem, completedPages: Set<number>) {
  if (item.type !== 'pages' || typeof item.startPage !== 'number' || typeof item.endPage !== 'number') {
    return {};
  }

  for (let page = item.startPage; page <= item.endPage; page += 1) {
    if (!completedPages.has(page)) {
      return {
        remainingStartPage: page,
        remainingEndPage: item.endPage,
      };
    }
  }

  return {};
}

function normalizePlan(plan: WeeklyPlan): WeeklyPlan {
  return {
    ...plan,
    items: plan.items.map((item) => ({
      ...item,
      completed: item.type === 'task' ? Boolean(item.completed) : item.completed,
      carryOver: Boolean(item.carryOver),
    })),
  };
}

export async function getWeeklyPlans() {
  const rawPlans = await AsyncStorage.getItem(STORAGE_KEY);

  if (!rawPlans) {
    return [];
  }

  try {
    const plans = JSON.parse(rawPlans) as WeeklyPlan[];
    return plans.map(normalizePlan).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  } catch {
    return [];
  }
}

export async function saveWeeklyPlans(plans: WeeklyPlan[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plans.map(normalizePlan)));
}

export async function saveWeeklyPlan(plan: WeeklyPlan) {
  const plans = await getWeeklyPlans();
  const nextPlans = [normalizePlan(plan), ...plans.filter((item) => item.weekStart !== plan.weekStart)];
  await saveWeeklyPlans(nextPlans);

  return normalizePlan(plan);
}

export async function getWeeklyPlan(date: Date = new Date()) {
  const weekStart = getWeekStart(date);
  const plans = await getWeeklyPlans();

  return plans.find((plan) => plan.weekStart === weekStart) ?? null;
}

export function calculateWeeklyPlanProgress(
  plan: WeeklyPlan | null | undefined,
  records: ReadingRecord[],
): WeeklyPlanProgress {
  if (!plan) {
    return {
      weekStart: getWeekStart(),
      items: [],
      percent: 0,
    };
  }

  const items = plan.items.map((item) => {
    if (item.type === 'task') {
      const percent = item.completed ? 100 : 0;

      return {
        item,
        completedPages: 0,
        totalPages: 0,
        percent,
        isComplete: percent === 100,
      };
    }

    const totalPages = getPlannedTotalPages(item);
    const completedPageSet = getCompletedPageSet(item, records, plan.weekStart);
    const completedPages = Math.min(totalPages, completedPageSet.size);
    const percent = totalPages === 0 ? 0 : normalizePercent((completedPages / totalPages) * 100);

    return {
      item,
      completedPages,
      totalPages,
      percent,
      ...getRemainingRange(item, completedPageSet),
      isComplete: totalPages > 0 && completedPages >= totalPages,
    };
  });

  const percent =
    items.length === 0
      ? 0
      : normalizePercent(items.reduce((sum, progress) => sum + progress.percent, 0) / items.length);

  return {
    weekStart: plan.weekStart,
    items,
    percent,
  };
}

export function createEmptyWeeklyPlan(weekStart = getWeekStart()): WeeklyPlan {
  const now = new Date().toISOString();

  return {
    weekStart,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function ensureWeeklyPlan(date: Date = new Date(), records: ReadingRecord[] = []) {
  const weekStart = getWeekStart(date);
  const plans = await getWeeklyPlans();
  const existingPlan = plans.find((plan) => plan.weekStart === weekStart);

  if (existingPlan) {
    return existingPlan;
  }

  const previousPlan = plans.find((plan) => plan.weekStart === getPreviousWeekStart(weekStart));
  const progress = calculateWeeklyPlanProgress(previousPlan, records);
  const now = new Date().toISOString();
  const carryOverItems = progress.items
    .filter((itemProgress) => !itemProgress.isComplete)
    .map(({ item, remainingStartPage, remainingEndPage }) => {
      const nextItem: WeeklyPlanItem = {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        carryOver: true,
        completed: item.type === 'task' ? false : item.completed,
        createdAt: now,
      };

      if (item.type === 'pages') {
        nextItem.startPage = remainingStartPage ?? item.startPage;
        nextItem.endPage = remainingEndPage ?? item.endPage;
      }

      return nextItem;
    });

  const nextPlan: WeeklyPlan = {
    weekStart,
    items: carryOverItems,
    createdAt: now,
    updatedAt: now,
  };

  await saveWeeklyPlans([nextPlan, ...plans]);

  return nextPlan;
}

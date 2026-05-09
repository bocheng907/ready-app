import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  calculatePagesRead,
  calculateReadingStats,
  formatDateKey,
  getReadingRecords,
  Mood,
  moods,
  ReadingRecord,
  saveReadingRecord,
} from '@/lib/reading-records';
import { calculateWeeklyPlanProgress, ensureWeeklyPlan, WeeklyPlan } from '@/lib/weekly-plans';

export default function HomeScreen() {
  const [records, setRecords] = useState<ReadingRecord[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [date, setDate] = useState(formatDateKey());
  const [subject, setSubject] = useState('');
  const [minutes, setMinutes] = useState('');
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [completedItems, setCompletedItems] = useState('');
  const [reflection, setReflection] = useState('');
  const [mood, setMood] = useState<Mood>('很好');

  const stats = useMemo(() => calculateReadingStats(records), [records]);
  const weeklyProgress = useMemo(() => calculateWeeklyPlanProgress(weeklyPlan, records), [records, weeklyPlan]);
  const previewPages = useMemo(() => {
    if (!startPage.trim() || !endPage.trim()) {
      return 0;
    }

    return calculatePagesRead(Number(startPage), Number(endPage));
  }, [endPage, startPage]);
  const recentRecords = records.slice(0, 5);

  const loadData = useCallback(async () => {
    const nextRecords = await getReadingRecords();
    setRecords(nextRecords);
    setWeeklyPlan(await ensureWeeklyPlan(new Date(), nextRecords));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  async function handleSave() {
    const parsedMinutes = Number(minutes);
    const parsedStartPage = startPage.trim() ? Number(startPage) : undefined;
    const parsedEndPage = endPage.trim() ? Number(endPage) : undefined;

    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('日期格式錯誤', '請輸入 YYYY-MM-DD 格式。');
      return;
    }

    if (!subject.trim()) {
      Alert.alert('請輸入科目');
      return;
    }

    if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      Alert.alert('請輸入有效的讀書分鐘數');
      return;
    }

    if (
      (parsedStartPage !== undefined && (!Number.isFinite(parsedStartPage) || parsedStartPage <= 0)) ||
      (parsedEndPage !== undefined && (!Number.isFinite(parsedEndPage) || parsedEndPage <= 0))
    ) {
      Alert.alert('頁數格式錯誤', '頁數請輸入大於 0 的數字。');
      return;
    }

    if (
      parsedStartPage !== undefined &&
      parsedEndPage !== undefined &&
      Math.round(parsedEndPage) < Math.round(parsedStartPage)
    ) {
      Alert.alert('頁數範圍錯誤', '結束頁不能小於起始頁。');
      return;
    }

    await saveReadingRecord({
      date,
      subject: subject.trim(),
      minutes: Math.round(parsedMinutes),
      startPage: parsedStartPage === undefined ? undefined : Math.round(parsedStartPage),
      endPage: parsedEndPage === undefined ? undefined : Math.round(parsedEndPage),
      completedItems: completedItems.trim(),
      reflection: reflection.trim(),
      mood,
    });

    setSubject('');
    setMinutes('');
    setStartPage('');
    setEndPage('');
    setCompletedItems('');
    setReflection('');
    setMood('很好');
    setDate(formatDateKey());
    await loadData();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', default: undefined })}
      style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.kicker}>Reading Log</Text>
          <Text style={styles.title}>讀書紀錄</Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="今日" value={stats.todayMinutes} unit="分鐘" />
          <StatCard label="本週" value={stats.weekMinutes} unit="分鐘" />
          <StatCard label="規劃" value={weeklyProgress.percent} unit="%" />
        </View>

        <View style={styles.weekSummary}>
          <Text style={styles.sectionTitle}>本週規劃摘要</Text>
          {weeklyProgress.items.length === 0 ? (
            <Text style={styles.emptyText}>本週尚未建立規劃。</Text>
          ) : (
            <Text style={styles.summaryText}>
              {weeklyProgress.items.length} 個項目，完成率 {weeklyProgress.percent}%
            </Text>
          )}
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>新增紀錄</Text>
          <Field label="日期">
            <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={styles.input} />
          </Field>
          <Field label="科目">
            <TextInput value={subject} onChangeText={setSubject} placeholder="例如：化學" style={styles.input} />
          </Field>
          <Field label="讀書分鐘數">
            <TextInput
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="number-pad"
              placeholder="60"
              style={styles.input}
            />
          </Field>
          <View style={styles.pageRow}>
            <Field label="起始頁">
              <TextInput
                value={startPage}
                onChangeText={setStartPage}
                keyboardType="number-pad"
                placeholder="100"
                style={styles.input}
              />
            </Field>
            <Field label="結束頁">
              <TextInput
                value={endPage}
                onChangeText={setEndPage}
                keyboardType="number-pad"
                placeholder="150"
                style={styles.input}
              />
            </Field>
          </View>
          <Text style={styles.pageHint}>本次完成 {previewPages} 頁</Text>
          <Field label="完成內容">
            <TextInput
              value={completedItems}
              onChangeText={setCompletedItems}
              multiline
              placeholder="例如：完成第 3 章重點整理"
              style={[styles.input, styles.multilineInput]}
            />
          </Field>
          <Field label="心得">
            <TextInput
              value={reflection}
              onChangeText={setReflection}
              multiline
              placeholder="今天卡住或突破的地方"
              style={[styles.input, styles.multilineInput]}
            />
          </Field>

          <View style={styles.field}>
            <Text style={styles.label}>心情</Text>
            <View style={styles.moodRow}>
              {moods.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setMood(item)}
                  style={[styles.moodButton, mood === item && styles.moodButtonActive]}>
                  <Text style={[styles.moodText, mood === item && styles.moodTextActive]}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>儲存讀書紀錄</Text>
          </Pressable>
        </View>

        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>最近紀錄</Text>
          {recentRecords.length === 0 ? (
            <Text style={styles.emptyText}>還沒有讀書紀錄。</Text>
          ) : (
            recentRecords.map((record) => (
              <View key={record.id} style={styles.recordRow}>
                <View style={styles.recordInfo}>
                  <Text style={styles.recordTitle}>{record.subject}</Text>
                  <Text style={styles.recordMeta}>
                    {record.date} · {record.mood}
                  </Text>
                  {record.startPage && record.endPage ? (
                    <Text style={styles.recordMeta}>
                      {record.startPage} → {record.endPage} 頁，共 {record.pagesRead ?? 0} 頁
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.recordMinutes}>{record.minutes} 分</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StatCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F4EE',
  },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: 36,
    paddingTop: 68,
  },
  header: {
    gap: 4,
  },
  kicker: {
    color: '#58746E',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: '#17211F',
    fontSize: 32,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#E4DDD1',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  statLabel: {
    color: '#6D6A63',
    fontSize: 13,
    fontWeight: '700',
  },
  statValue: {
    color: '#17211F',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 6,
  },
  statUnit: {
    color: '#58746E',
    fontSize: 13,
    fontWeight: '700',
  },
  weekSummary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4DDD1',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  summaryText: {
    color: '#31534C',
    fontSize: 15,
    fontWeight: '800',
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4DDD1',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  sectionTitle: {
    color: '#17211F',
    fontSize: 20,
    fontWeight: '800',
  },
  field: {
    flex: 1,
    gap: 8,
  },
  pageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pageHint: {
    color: '#58746E',
    fontSize: 13,
    fontWeight: '700',
    marginTop: -6,
  },
  label: {
    color: '#373B37',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#FAFAF8',
    borderColor: '#D8D1C7',
    borderRadius: 8,
    borderWidth: 1,
    color: '#17211F',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multilineInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodButton: {
    borderColor: '#CBD8D3',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  moodButtonActive: {
    backgroundColor: '#1E5D52',
    borderColor: '#1E5D52',
  },
  moodText: {
    color: '#31534C',
    fontWeight: '700',
  },
  moodTextActive: {
    color: '#FFFFFF',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#17211F',
    borderRadius: 8,
    minHeight: 50,
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  recentSection: {
    gap: 10,
  },
  emptyText: {
    color: '#77736C',
  },
  recordRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E4DDD1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 14,
  },
  recordInfo: {
    flex: 1,
  },
  recordTitle: {
    color: '#17211F',
    fontSize: 16,
    fontWeight: '800',
  },
  recordMeta: {
    color: '#77736C',
    marginTop: 4,
  },
  recordMinutes: {
    color: '#1E5D52',
    fontSize: 18,
    fontWeight: '800',
  },
});

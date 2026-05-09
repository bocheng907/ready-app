import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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

import { getReadingRecords, ReadingRecord } from '@/lib/reading-records';
import {
  calculateWeeklyPlanProgress,
  ensureWeeklyPlan,
  saveWeeklyPlan,
  WeeklyPlan,
  WeeklyPlanItem,
  WeeklyPlanItemType,
} from '@/lib/weekly-plans';

export default function WeeklyPlanScreen() {
  const [records, setRecords] = useState<ReadingRecord[]>([]);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [type, setType] = useState<WeeklyPlanItemType>('pages');
  const [subject, setSubject] = useState('');
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');
  const [task, setTask] = useState('');

  const progress = useMemo(() => calculateWeeklyPlanProgress(plan, records), [plan, records]);

  const loadData = useCallback(async () => {
    const nextRecords = await getReadingRecords();
    setRecords(nextRecords);
    setPlan(await ensureWeeklyPlan(new Date(), nextRecords));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  async function persistPlan(nextItems: WeeklyPlanItem[]) {
    if (!plan) {
      return;
    }

    const nextPlan = {
      ...plan,
      items: nextItems,
      updatedAt: new Date().toISOString(),
    };

    setPlan(await saveWeeklyPlan(nextPlan));
  }

  async function handleAddItem() {
    if (!plan) {
      return;
    }

    const trimmedSubject = subject.trim();
    const trimmedTask = task.trim();
    const parsedStartPage = Number(startPage);
    const parsedEndPage = Number(endPage);

    if (!trimmedSubject) {
      Alert.alert('請輸入科目');
      return;
    }

    if (type === 'pages') {
      if (
        !Number.isFinite(parsedStartPage) ||
        !Number.isFinite(parsedEndPage) ||
        parsedStartPage <= 0 ||
        parsedEndPage <= 0 ||
        parsedEndPage < parsedStartPage
      ) {
        Alert.alert('頁數範圍錯誤', '請輸入正確的起始頁與結束頁。');
        return;
      }
    }

    if (type === 'task' && !trimmedTask) {
      Alert.alert('請輸入任務內容');
      return;
    }

    const now = new Date().toISOString();
    const item: WeeklyPlanItem = {
      id: `${Date.now()}`,
      subject: trimmedSubject,
      type,
      startPage: type === 'pages' ? Math.round(parsedStartPage) : undefined,
      endPage: type === 'pages' ? Math.round(parsedEndPage) : undefined,
      task: type === 'task' ? trimmedTask : undefined,
      completed: false,
      carryOver: false,
      createdAt: now,
    };

    await persistPlan([...plan.items, item]);
    setSubject('');
    setStartPage('');
    setEndPage('');
    setTask('');
  }

  async function toggleTaskCompleted(item: WeeklyPlanItem) {
    if (item.type !== 'task' || !plan) {
      return;
    }

    await persistPlan(
      plan.items.map((planItem) =>
        planItem.id === item.id ? { ...planItem, completed: !planItem.completed } : planItem,
      ),
    );
  }

  async function deleteItem(item: WeeklyPlanItem) {
    if (!plan) {
      return;
    }

    await persistPlan(plan.items.filter((planItem) => planItem.id !== item.id));
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', default: undefined })}
      style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.kicker}>Weekly Plan</Text>
          <Text style={styles.title}>每週規劃</Text>
          <Text style={styles.subtitle}>
            {progress.weekStart} · 完成率 {progress.percent}%
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>新增規劃項目</Text>
          <View style={styles.segment}>
            <Pressable
              onPress={() => setType('pages')}
              style={[styles.segmentButton, type === 'pages' && styles.segmentButtonActive]}>
              <Text style={[styles.segmentText, type === 'pages' && styles.segmentTextActive]}>頁數型</Text>
            </Pressable>
            <Pressable
              onPress={() => setType('task')}
              style={[styles.segmentButton, type === 'task' && styles.segmentButtonActive]}>
              <Text style={[styles.segmentText, type === 'task' && styles.segmentTextActive]}>文字任務</Text>
            </Pressable>
          </View>

          <Field label="科目">
            <TextInput value={subject} onChangeText={setSubject} placeholder="例如：化學" style={styles.input} />
          </Field>

          {type === 'pages' ? (
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
          ) : (
            <Field label="任務內容">
              <TextInput
                value={task}
                onChangeText={setTask}
                placeholder="例如：Unit 3"
                style={styles.input}
              />
            </Field>
          )}

          <Pressable style={styles.saveButton} onPress={handleAddItem}>
            <Text style={styles.saveButtonText}>新增項目</Text>
          </Pressable>
        </View>

        <View style={styles.planList}>
          <Text style={styles.sectionTitle}>本週規劃</Text>
          {progress.items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>本週尚未建立規劃。</Text>
            </View>
          ) : (
            progress.items.map(({ item, percent, completedPages, totalPages }) => (
              <View key={item.id} style={styles.planRow}>
                <View style={styles.planMain}>
                  <View style={styles.planHeader}>
                    <Text style={styles.planSubject}>{item.subject}</Text>
                    {item.carryOver ? <Text style={styles.carryBadge}>延續</Text> : null}
                  </View>
                  <Text style={styles.planMeta}>
                    {item.type === 'pages'
                      ? `${item.startPage}–${item.endPage} 頁 · ${completedPages}/${totalPages} 頁`
                      : item.task}
                  </Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${percent}%` }]} />
                  </View>
                </View>
                <View style={styles.planActions}>
                  <Text style={styles.percentText}>{percent}%</Text>
                  {item.type === 'task' ? (
                    <Pressable style={styles.smallButton} onPress={() => toggleTaskCompleted(item)}>
                      <Text style={styles.smallButtonText}>{item.completed ? '取消' : '完成'}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.deleteButton} onPress={() => deleteItem(item)}>
                    <Text style={styles.deleteButtonText}>刪除</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F3F6F4',
    flex: 1,
  },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: 36,
    paddingTop: 68,
  },
  header: {
    gap: 5,
  },
  kicker: {
    color: '#596964',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: '#16211F',
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    color: '#596964',
    fontSize: 15,
    fontWeight: '700',
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE5E1',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  sectionTitle: {
    color: '#16211F',
    fontSize: 20,
    fontWeight: '900',
  },
  segment: {
    backgroundColor: '#EEF3F0',
    borderRadius: 8,
    flexDirection: 'row',
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#174D43',
  },
  segmentText: {
    color: '#31534C',
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  field: {
    flex: 1,
    gap: 8,
  },
  pageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  label: {
    color: '#37413E',
    fontSize: 14,
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#FAFAF8',
    borderColor: '#D2DAD6',
    borderRadius: 8,
    borderWidth: 1,
    color: '#16211F',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#16211F',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 50,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  planList: {
    gap: 10,
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE5E1',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  emptyText: {
    color: '#6B746F',
    fontSize: 15,
  },
  planRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE5E1',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  planMain: {
    flex: 1,
    gap: 8,
  },
  planHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  planSubject: {
    color: '#16211F',
    fontSize: 17,
    fontWeight: '900',
  },
  carryBadge: {
    backgroundColor: '#F0E5C8',
    borderRadius: 8,
    color: '#755B16',
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  planMeta: {
    color: '#596964',
    fontSize: 14,
    fontWeight: '700',
  },
  progressTrack: {
    backgroundColor: '#E6ECE9',
    borderRadius: 999,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#1E6A5C',
    height: 8,
  },
  planActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  percentText: {
    color: '#1E6A5C',
    fontSize: 18,
    fontWeight: '900',
  },
  smallButton: {
    borderColor: '#91AAA2',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  smallButtonText: {
    color: '#174D43',
    fontSize: 13,
    fontWeight: '900',
  },
  deleteButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  deleteButtonText: {
    color: '#9A3E3E',
    fontSize: 13,
    fontWeight: '800',
  },
});

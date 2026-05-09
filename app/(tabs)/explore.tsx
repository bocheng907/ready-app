import * as Linking from 'expo-linking';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import {
  calculateReadingStats,
  formatDateKey,
  getReadingRecords,
  getTodayRecords,
  ReadingRecord,
} from '@/lib/reading-records';
import { calculateWeeklyPlanProgress, ensureWeeklyPlan, WeeklyPlan } from '@/lib/weekly-plans';

const INSTAGRAM_URL = 'instagram://app';

async function openInstagramHome() {
  try {
    await Linking.openURL(INSTAGRAM_URL);
  } catch {
    Alert.alert('無法開啟 Instagram', '請確認裝置已安裝 Instagram。');
  }
}

export default function ShareScreen() {
  const [records, setRecords] = useState<ReadingRecord[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const cardRef = useRef<View>(null);
  const today = formatDateKey();
  const todayRecords = useMemo(() => getTodayRecords(records, today), [records, today]);
  const stats = useMemo(() => calculateReadingStats(records, today), [records, today]);
  const weeklyProgress = useMemo(() => calculateWeeklyPlanProgress(weeklyPlan, records), [records, weeklyPlan]);

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

  async function saveCardAndOpenInstagram() {
    if (!cardRef.current) {
      Alert.alert('找不到分享卡片', '請稍後再試。');
      return;
    }

    try {
      setIsSaving(true);

      const permission = await MediaLibrary.requestPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('需要相簿權限', '請允許儲存圖片到相簿。');
        return;
      }

      const uri = await captureRef(cardRef.current, {
        format: 'png',
        height: 1350,
        quality: 1,
        result: 'tmpfile',
        width: 1080,
      });

      await MediaLibrary.saveToLibraryAsync(uri);

      Alert.alert('圖片已儲存', '要開啟 Instagram 嗎？', [{ text: '開啟', onPress: openInstagramHome }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知錯誤';
      Alert.alert('儲存失敗', `無法儲存今日讀書分享圖：${message}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleSaveAndOpenInstagram() {
    if (isSaving) {
      return;
    }

    if (todayRecords.length === 0) {
      Alert.alert('今天尚無紀錄', '請先新增今日讀書紀錄。');
      return;
    }

    Alert.alert('儲存並開啟 Instagram', '圖片會先儲存到相簿，再開啟 Instagram。', [
      { text: '取消', style: 'cancel' },
      { text: '繼續', onPress: saveCardAndOpenInstagram },
    ]);
  }

  async function handleFallbackShare() {
    if (!cardRef.current) {
      Alert.alert('找不到分享卡片', '請稍後再試。');
      return;
    }

    const available = await Sharing.isAvailableAsync();

    if (!available) {
      Alert.alert('無法分享', '這台裝置目前不支援系統分享。');
      return;
    }

    const uri = await captureRef(cardRef.current, {
      format: 'png',
      height: 1350,
      quality: 1,
      result: 'tmpfile',
      width: 1080,
    });

    await Sharing.shareAsync(uri, {
      dialogTitle: '分享今日讀書紀錄',
      mimeType: 'image/png',
      UTI: 'public.png',
    });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Daily Share</Text>
        <Text style={styles.title}>今日分享圖</Text>
      </View>

      <View style={styles.cardFrame}>
        <View ref={cardRef} collapsable={false} style={styles.shareCard}>
          <View style={styles.cardTop}>
            <Text style={styles.cardDate}>{today}</Text>
            <Text style={styles.cardBadge}>READING LOG</Text>
          </View>

          <View style={styles.cardHero}>
            <Text style={styles.cardHeroNumber}>{stats.todayMinutes}</Text>
            <Text style={styles.cardHeroLabel}>今日讀書時間 / 分鐘</Text>
          </View>

          <View style={styles.cardStats}>
            <View style={styles.cardStatItem}>
              <Text style={styles.cardStatValue}>{stats.weekMinutes}</Text>
              <Text style={styles.cardStatLabel}>本週分鐘</Text>
            </View>
            <View style={styles.cardStatItem}>
              <Text style={styles.cardStatValue}>{weeklyProgress.percent}%</Text>
              <Text style={styles.cardStatLabel}>本週規劃</Text>
            </View>
          </View>

          <View style={styles.cardSection}>
            <Text style={styles.cardSectionTitle}>今日紀錄</Text>
            {todayRecords.length === 0 ? (
              <Text style={styles.cardMuted}>今天尚未新增紀錄。</Text>
            ) : (
              todayRecords.slice(0, 3).map((record) => (
                <View key={record.id} style={styles.recordLine}>
                  <View style={styles.recordLineTop}>
                    <Text numberOfLines={1} style={styles.recordSubject}>
                      {record.subject}
                    </Text>
                    <Text style={styles.recordMinutes}>{record.minutes} 分</Text>
                  </View>
                  <Text numberOfLines={1} style={styles.recordPages}>
                    {record.startPage && record.endPage
                      ? `${record.startPage} → ${record.endPage} 頁 · 本次 ${record.pagesRead ?? 0} 頁`
                      : `本次 ${record.pagesRead ?? 0} 頁`}
                  </Text>
                  <Text numberOfLines={2} style={styles.doneItem}>
                    {record.completedItems || '未填寫完成內容'}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.weekPlanSection}>
            <View style={styles.weekPlanHeader}>
              <Text style={styles.cardSectionTitle}>本週規劃</Text>
              <Text style={styles.weekPercent}>{weeklyProgress.percent}%</Text>
            </View>
            {weeklyProgress.items.length === 0 ? (
              <Text style={styles.cardMuted}>本週尚未建立規劃。</Text>
            ) : (
              weeklyProgress.items.slice(0, 4).map(({ item, percent, completedPages, totalPages }) => (
                <View key={item.id} style={styles.planLine}>
                  <View style={styles.planTextWrap}>
                    <Text numberOfLines={1} style={styles.planSubject}>
                      {item.subject}
                      {item.carryOver ? ' · 延續' : ''}
                    </Text>
                    <Text numberOfLines={1} style={styles.planMeta}>
                      {item.type === 'pages'
                        ? `${item.startPage}–${item.endPage} 頁 · ${completedPages}/${totalPages} 頁`
                        : item.task}
                    </Text>
                  </View>
                  <Text style={styles.planPercent}>{percent}%</Text>
                </View>
              ))
            )}
            {weeklyProgress.items.length > 4 ? (
              <Text style={styles.morePlans}>另有 {weeklyProgress.items.length - 4} 個規劃項目</Text>
            ) : null}
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.footerMood}>{todayRecords[0]?.mood ?? '穩定前進'}</Text>
            <Text style={styles.footerText}>Keep reading, keep building.</Text>
          </View>
        </View>
      </View>

      <Pressable
        disabled={isSaving}
        style={[styles.shareButton, isSaving && styles.shareButtonDisabled]}
        onPress={handleSaveAndOpenInstagram}>
        <Text style={styles.shareButtonText}>{isSaving ? '儲存中...' : '儲存圖片並開啟 Instagram'}</Text>
      </Pressable>

      <Pressable disabled={isSaving} style={styles.fallbackButton} onPress={handleFallbackShare}>
        <Text style={styles.fallbackButtonText}>使用系統分享</Text>
      </Pressable>

      <Text style={styles.note}>Instagram 會從相簿選取剛儲存的圖片；此功能不需要 Instagram API 或登入權杖。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#EFF4F2',
    flex: 1,
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
    color: '#6B6460',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: '#13201E',
    fontSize: 30,
    fontWeight: '900',
  },
  cardFrame: {
    alignItems: 'center',
  },
  shareCard: {
    aspectRatio: 4 / 5,
    backgroundColor: '#F8F1E6',
    borderRadius: 8,
    justifyContent: 'space-between',
    maxWidth: 430,
    overflow: 'hidden',
    padding: 22,
    width: '100%',
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardDate: {
    color: '#46504B',
    fontSize: 15,
    fontWeight: '800',
  },
  cardBadge: {
    backgroundColor: '#DDE8E3',
    borderRadius: 8,
    color: '#1F4F47',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cardHero: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  cardHeroNumber: {
    color: '#142522',
    fontSize: 72,
    fontWeight: '900',
    lineHeight: 80,
  },
  cardHeroLabel: {
    color: '#1F4F47',
    fontSize: 17,
    fontWeight: '900',
  },
  cardStats: {
    flexDirection: 'row',
    gap: 10,
  },
  cardStatItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flex: 1,
    padding: 11,
  },
  cardStatValue: {
    color: '#142522',
    fontSize: 25,
    fontWeight: '900',
  },
  cardStatLabel: {
    color: '#6B6460',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  cardSection: {
    gap: 7,
  },
  weekPlanSection: {
    borderTopColor: '#DED3C5',
    borderTopWidth: 1,
    gap: 6,
    paddingTop: 10,
  },
  weekPlanHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardSectionTitle: {
    color: '#142522',
    fontSize: 16,
    fontWeight: '900',
  },
  weekPercent: {
    color: '#1F4F47',
    fontSize: 16,
    fontWeight: '900',
  },
  recordLine: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    gap: 3,
    padding: 9,
  },
  recordLineTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  recordSubject: {
    color: '#25302D',
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
  },
  recordMinutes: {
    color: '#1F4F47',
    fontSize: 13,
    fontWeight: '900',
  },
  recordPages: {
    color: '#755B16',
    fontSize: 12,
    fontWeight: '800',
  },
  doneItem: {
    color: '#3C403C',
    fontSize: 12,
    lineHeight: 17,
  },
  planLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  planTextWrap: {
    flex: 1,
  },
  planSubject: {
    color: '#25302D',
    fontSize: 13,
    fontWeight: '900',
  },
  planMeta: {
    color: '#6B6460',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  planPercent: {
    color: '#1F4F47',
    fontSize: 13,
    fontWeight: '900',
  },
  morePlans: {
    color: '#6B6460',
    fontSize: 12,
    fontWeight: '800',
  },
  cardMuted: {
    color: '#7A746D',
    fontSize: 14,
    lineHeight: 20,
  },
  cardFooter: {
    alignItems: 'center',
    borderTopColor: '#DED3C5',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  footerMood: {
    color: '#142522',
    fontSize: 16,
    fontWeight: '900',
  },
  footerText: {
    color: '#6B6460',
    fontSize: 12,
    fontWeight: '800',
  },
  shareButton: {
    alignItems: 'center',
    backgroundColor: '#142522',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 52,
  },
  shareButtonDisabled: {
    opacity: 0.65,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  fallbackButton: {
    alignItems: 'center',
    borderColor: '#9AA7A1',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  fallbackButtonText: {
    color: '#25302D',
    fontSize: 15,
    fontWeight: '800',
  },
  note: {
    color: '#273330',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
});

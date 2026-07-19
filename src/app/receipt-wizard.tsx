import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/navigation/detail-header';
import { Button, Card, Input, Text } from '@/components/ui';
import { EXPENSE_CATEGORIES, extractReceipt, submitReceiptReview, type ExpenseCategory } from '@/services/receipts';
import { radius, spacing, useTheme } from '@/theme';

/**
 * Capture wizard — runs right after a receipt photo is uploaded.
 *  1. Kicks off server-side OCR extraction (PaddleOCR via the receipt-ocr
 *     edge function) and pre-fills what it found.
 *  2. The client confirms/corrects the fields.
 *  3. The client picks the expense category it relates to, which carries a
 *     suggested GL account.
 * Everything submitted here is a DRAFT SUGGESTION — the accountant reviews it
 * and nothing posts to the ledger without their approval (CLAUDE.md §7/§14).
 * The copy says so explicitly so the client isn't misled into thinking they've
 * booked anything.
 */
export default function ReceiptWizardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, manual } = useLocalSearchParams<{ id: string; manual?: string }>();
  const isManual = manual === '1';

  const [loading, setLoading] = useState(true);
  const [ocrConfigured, setOcrConfigured] = useState(true);
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState('');
  const [total, setTotal] = useState('');
  const [vat, setVat] = useState('');
  const [currency, setCurrency] = useState('AED');
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      // Manual entry has no photo — skip OCR entirely and start blank.
      if (isManual) {
        setOcrConfigured(false);
        setLoading(false);
        return;
      }
      const { extracted: e, ocrConfigured: configured } = await extractReceipt(id);
      if (cancelled) return;
      setOcrConfigured(configured);
      if (e) {
        if (e.vendor) setVendor(e.vendor);
        if (e.date) setDate(e.date);
        if (e.totalMinor != null) setTotal((e.totalMinor / 100).toFixed(2));
        if (e.vatMinor != null) setVat((e.vatMinor / 100).toFixed(2));
        if (e.currency) setCurrency(e.currency);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isManual]);

  function toMinor(v: string): number | null {
    const n = Number(v.replace(/,/g, ''));
    return Number.isFinite(n) && v.trim() !== '' ? Math.round(n * 100) : null;
  }

  async function submit() {
    if (!id || !category) return;
    setSaving(true);
    setError(null);
    const res = await submitReceiptReview({
      receiptId: id,
      category: category.label,
      glCode: category.glCode,
      glName: category.glName,
      vendor: vendor.trim() || null,
      date: date.trim() || null,
      totalMinor: toMinor(total),
      vatMinor: toMinor(vat),
      currency: currency.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not save. Please try again.');
      return;
    }
    router.replace('/(tabs)');
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
      <DetailHeader title="Review receipt" />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text variant="callout" color="mutedForeground">
            Reading your receipt…
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
          <Text variant="footnote" color="mutedForeground">
            {ocrConfigured
              ? 'We read what we could from your photo. Check it’s right, then tell us what it was for.'
              : 'Add the details from your receipt, then tell us what it was for.'}
          </Text>

          <Card style={{ gap: spacing.md }}>
            <Text variant="title">Details</Text>
            <View style={{ gap: 4 }}>
              <Text variant="caption" color="mutedForeground">
                Supplier
              </Text>
              <Input value={vendor} onChangeText={setVendor} placeholder="e.g. Carrefour" />
            </View>
            <View style={{ gap: 4 }}>
              <Text variant="caption" color="mutedForeground">
                Date
              </Text>
              <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="caption" color="mutedForeground">
                  Total
                </Text>
                <Input value={total} onChangeText={setTotal} placeholder="0.00" keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="caption" color="mutedForeground">
                  VAT
                </Text>
                <Input value={vat} onChangeText={setVat} placeholder="0.00" keyboardType="decimal-pad" />
              </View>
              <View style={{ width: 80, gap: 4 }}>
                <Text variant="caption" color="mutedForeground">
                  Currency
                </Text>
                <Input value={currency} onChangeText={setCurrency} autoCapitalize="characters" />
              </View>
            </View>
          </Card>

          <Card style={{ gap: spacing.md }}>
            <View style={{ gap: 4 }}>
              <Text variant="title">What was this for?</Text>
              <Text variant="footnote" color="mutedForeground">
                This helps your accountant book it to the right account.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {EXPENSE_CATEGORIES.map((c) => {
                const active = category?.key === c.key;
                return (
                  <Pressable
                    key={c.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={c.label}
                    onPress={() => setCategory(c)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.xs,
                      paddingHorizontal: spacing.base,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.full,
                      backgroundColor: active ? theme.colors.primary : theme.colors.secondary,
                    }}>
                    <Ionicons
                      name={c.icon as keyof typeof Ionicons.glyphMap}
                      size={14}
                      color={active ? theme.colors.primaryForeground : theme.colors.mutedForeground}
                    />
                    <Text
                      variant="caption"
                      weight="semibold"
                      style={{ color: active ? theme.colors.primaryForeground : theme.colors.foreground }}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <View
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
              alignItems: 'flex-start',
              backgroundColor: theme.colors.secondary,
              borderRadius: radius.md,
              padding: spacing.base,
            }}>
            <Ionicons name="information-circle-outline" size={16} color={theme.colors.mutedForeground} />
            <Text variant="caption" color="mutedForeground" style={{ flex: 1 }}>
              Your accountant reviews every receipt before anything is recorded in your books.
            </Text>
          </View>

          {error ? (
            <Text variant="footnote" style={{ color: theme.colors.destructive ?? '#BA1A1A' }}>
              {error}
            </Text>
          ) : null}

          <Button
            title={saving ? 'Sending…' : 'Send to my accountant'}
            fullWidth
            disabled={!category || saving}
            onPress={submit}
          />
        </ScrollView>
      )}
    </View>
  );
}

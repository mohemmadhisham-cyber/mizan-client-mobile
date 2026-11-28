import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AiConsent } from '@/components/ai-advisor/ai-consent';
import { Cta } from '@/components/horizon/cta';
import { BRIDGE_WIDTH, FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { ChoiceRow, SectionLabel } from '@/components/horizon/ruled';
import { Input, Text } from '@/components/ui';
import { aiDeclinedThisRun, hasAiConsent, noteAiDeclined } from '@/lib/ai-consent';
import { useAuth } from '@/lib/auth-context';
import { EXPENSE_CATEGORIES, extractReceipt, submitReceiptReview, type ExpenseCategory } from '@/services/receipts';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

/** Height of the field: the title and a quiet line that takes two lines. */
const WIZARD_FIELD = 200;
const CURRENCY_MIN_WIDTH = 92;
// On the ground a field is a line to write on, not a box.
const FIELD_STYLE = { backgroundColor: 'transparent', paddingHorizontal: 0 } as const;

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
type AiChoice = 'asking' | 'agreed' | 'declined';

export default function ReceiptWizardScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const colors = horizonColors(theme.colors);
  const { id, manual } = useLocalSearchParams<{ id: string; manual?: string }>();
  const isManual = manual === '1';
  const { user } = useAuth();
  const userId = user?.id;
  // Reading the photo sends it to an outside AI provider, so it waits for the
  // person's agreement. Without it the form starts blank and is filled by hand.
  const [aiChoice, setAiChoice] = useState<AiChoice>(() => {
    if (isManual || !userId || aiDeclinedThisRun(userId)) return 'declined';
    return hasAiConsent(userId) ? 'agreed' : 'asking';
  });

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
      if (aiChoice === 'asking') return;
      // Manual entry has no photo — skip OCR entirely and start blank. The same
      // when the person has not agreed to the photo being sent to be read.
      if (isManual || aiChoice === 'declined') {
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
  }, [id, isManual, aiChoice]);

  function toMinor(v: string): number | null {
    const n = Number(v.replace(/,/g, ''));
    return Number.isFinite(n) && v.trim() !== '' ? Math.round(n * 100) : null;
  }

  async function submit() {
    if (!id || !category || saving) return;
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
      setError(res.error ?? t('receiptWizard.saveFailed'));
      return;
    }
    router.replace('/(tabs)');
  }

  if (aiChoice === 'asking' && userId) {
    return (
      <AiConsent
        userId={userId}
        onAgreed={() => setAiChoice('agreed')}
        onDeclined={() => {
          noteAiDeclined(userId);
          setAiChoice('declined');
        }}
      />
    );
  }

  return (
    // The keyboard must not cover the fields lower down the form.
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ground }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <HorizonScreen
        field={WIZARD_FIELD}
        small
        lines={[{ text: t('receiptWizard.title') }]}
        sub={
          loading
            ? t('receiptWizard.reading')
            : ocrConfigured
              ? t('receiptWizard.introOcr')
              : t('receiptWizard.introManual')
        }
        top={<FieldBack colors={colors} />}
        // Checking the details and sending them is the person's to do.
        bridge={loading ? null : { start: HORIZON_GUTTER, width: BRIDGE_WIDTH }}>
        {loading ? (
          <View style={styles.reading} accessibilityLabel={t('receiptWizard.reading')} accessibilityRole="progressbar">
            <ActivityIndicator color={theme.colors.foreground} />
          </View>
        ) : (
          <>
            <SectionLabel>{t('receiptWizard.details')}</SectionLabel>
            <View style={styles.fields}>
              <Input
                label={t('receiptWizard.supplier')}
                accessibilityLabel={t('receiptWizard.supplier')}
                variant="underline"
                style={FIELD_STYLE}
                value={vendor}
                onChangeText={setVendor}
                placeholder={t('receiptWizard.supplierPlaceholder')}
              />
              <Input
                label={t('receiptWizard.date')}
                accessibilityLabel={t('receiptWizard.date')}
                variant="underline"
                style={FIELD_STYLE}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
              />
              <View style={styles.amounts}>
                <View style={{ flex: 1 }}>
                  <Input
                    label={t('receiptWizard.total')}
                    accessibilityLabel={t('receiptWizard.total')}
                    variant="underline"
                    style={FIELD_STYLE}
                    value={total}
                    onChangeText={setTotal}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label={t('receiptWizard.vat')}
                    accessibilityLabel={t('receiptWizard.vat')}
                    variant="underline"
                    style={FIELD_STYLE}
                    value={vat}
                    onChangeText={setVat}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ minWidth: CURRENCY_MIN_WIDTH }}>
                  <Input
                    label={t('receiptWizard.currency')}
                    accessibilityLabel={t('receiptWizard.currency')}
                    variant="underline"
                    style={FIELD_STYLE}
                    value={currency}
                    onChangeText={setCurrency}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            </View>

            <SectionLabel>{t('receiptWizard.whatFor')}</SectionLabel>
            <View style={styles.hint}>
              <Text variant="subhead" color="mutedForeground">
                {t('receiptWizard.whatForHint')}
              </Text>
            </View>
            {/* One is chosen: a list of choice rows, in place of a cloud of pills. */}
            <View accessibilityRole="radiogroup" accessibilityLabel={t('receiptWizard.whatFor')}>
              {EXPENSE_CATEGORIES.map((c) => (
                <ChoiceRow
                  key={c.key}
                  title={t(`expenseCategories.${c.key}`)}
                  selected={category?.key === c.key}
                  onPress={() => setCategory(c)}
                />
              ))}
            </View>

            <View style={styles.send}>
              <Text variant="footnote" color="mutedForeground">
                {t('receiptWizard.reviewNote')}
              </Text>
              {error ? (
                <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}
              {!category ? (
                // The list above is long and this button sits below it: say what it is waiting for.
                <Text variant="footnote" weight="semibold">
                  {t('receiptWizard.chooseFirst')}
                </Text>
              ) : null}
              <Cta title={t('receiptWizard.send')} busy={saving} disabled={!category} onPress={() => void submit()} />
            </View>
          </>
        )}
      </HorizonScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  reading: {
    paddingTop: 36,
    alignItems: 'center',
  },
  fields: {
    paddingHorizontal: HORIZON_GUTTER,
    gap: 16,
  },
  amounts: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  hint: {
    paddingHorizontal: HORIZON_GUTTER,
    paddingBottom: 6,
  },
  send: {
    paddingHorizontal: HORIZON_GUTTER,
    paddingTop: 22,
    gap: 12,
  },
});

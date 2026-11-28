import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Cta } from '@/components/horizon/cta';
import { HorizonList } from '@/components/horizon/horizon-list';
import { FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { Figure, RuledRow } from '@/components/horizon/ruled';
import { usePagedList } from '@/hooks/use-paged-list';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { type Currency, formatMoneyMinor, localeTag } from '@/lib/format';
import {
  expenseCategoryKey,
  listMyReceiptsPage,
  RECEIPTS_PAGE_SIZE,
  type MyReceipt,
  type ReceiptStatus,
} from '@/services/receipts';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

/** Height of the field: a one-line title and a quiet line that may take two lines. */
const DOCUMENTS_FIELD = 200;
const ACTION_SPACE_ABOVE = 20;
const ACTION_SPACE_BELOW = 6;

/** Client-facing status labels. Internal machine states
 * (uploaded/extracting) collapse into a calm "Processing" so the client sees a
 * meaningful lifecycle, not implementation detail. */
const STATUS_LABEL_KEY: Record<ReceiptStatus, string> = {
  uploaded: 'receipts.statusProcessing',
  extracting: 'receipts.statusProcessing',
  extracted: 'receipts.statusReadyToSend',
  needs_review: 'receipts.statusWithAccountant',
  approved: 'receipts.statusApproved',
  posted: 'receipts.statusBooked',
  rejected: 'receipts.statusRejected',
};

const receiptId = (r: MyReceipt): string => r.id;

export default function DocumentsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = horizonColors(theme.colors);
  const router = useRouter();
  const {
    items: receipts,
    isLoading,
    isError,
    isFetchingMore,
    loadMore,
    refetch,
  } = usePagedList(['my-receipts', 'pages'], listMyReceiptsPage, RECEIPTS_PAGE_SIZE, receiptId);
  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  return (
    <HorizonScreen
      field={DOCUMENTS_FIELD}
      small
      scroll={false}
      safeBottom={false}
      lines={[{ text: t('receipts.title') }]}
      sub={t('receipts.subtitle')}
      top={<FieldBack colors={colors} />}
      // Photographing a receipt is offered, not owed.
      bridge={null}>
      <HorizonList
        data={receipts}
        keyExtractor={receiptId}
        renderItem={(r) => <ReceiptRow receipt={r} />}
        onEndReached={loadMore}
        loadingMore={isFetchingMore}
        refreshing={refreshing}
        onRefresh={onRefresh}
        listHeader={
          <View
            style={{
              paddingHorizontal: HORIZON_GUTTER,
              paddingTop: ACTION_SPACE_ABOVE,
              paddingBottom: ACTION_SPACE_BELOW,
            }}>
            <Cta title={t('receipts.photograph')} onPress={() => router.push('/capture')} />
          </View>
        }
        listEmpty={
          isLoading ? (
            <RuledRow title={t('common.loading')} />
          ) : isError ? (
            <RuledRow title={t('common.listLoadFailed')} action={t('common.retry')} onPress={onRefresh} />
          ) : (
            <RuledRow title={t('receipts.emptyTitle')} meta={t('receipts.emptyBody')} plain />
          )
        }
      />
    </HorizonScreen>
  );
}

function ReceiptRow({ receipt }: { receipt: MyReceipt }) {
  const { t } = useTranslation();
  const categoryKey = receipt.category ? expenseCategoryKey(receipt.category) : null;
  const categoryLabel = categoryKey ? t(categoryKey) : receipt.category;
  const dateLabel = receipt.receiptDate
    ? new Date(receipt.receiptDate).toLocaleDateString(localeTag(), { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date(receipt.createdAt).toLocaleDateString(localeTag(), { day: 'numeric', month: 'short' });

  return (
    <RuledRow
      title={receipt.vendorName ?? t('common.receipt')}
      // The status is a word in the line, not a coloured badge. A returned receipt is the one that needs a look.
      meta={[dateLabel, categoryLabel, t(STATUS_LABEL_KEY[receipt.status])].filter(Boolean).join(' · ')}
      alert={receipt.status === 'rejected'}
      end={
        receipt.totalMinor != null ? (
          <Figure>
            {formatMoneyMinor(receipt.totalMinor, (receipt.currency as Currency) ?? 'AED', { fractionDigits: 2 })}
          </Figure>
        ) : undefined
      }
    />
  );
}

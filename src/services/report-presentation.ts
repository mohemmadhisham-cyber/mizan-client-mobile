import type { Ionicons } from '@expo/vector-icons';

import type { SoftTone } from '@/theme';

import type { ReportCategory } from './types';

/** Translation key of each category's name (see `reportDetail.*` in src/i18n). */
export const CATEGORY_LABEL_KEY: Record<ReportCategory, string> = {
  pl: 'reportDetail.categoryPl',
  balance_sheet: 'reportDetail.categoryBalanceSheet',
  tax: 'reportDetail.categoryTax',
  audit: 'reportDetail.categoryAudit',
};

export const CATEGORY_ICON: Record<ReportCategory, keyof typeof Ionicons.glyphMap> = {
  pl: 'bar-chart-outline',
  balance_sheet: 'scale-outline',
  tax: 'receipt-outline',
  audit: 'shield-checkmark-outline',
};

/** Tone of the category's icon tile. A category is not a status, so tax is not `danger`. */
export const CATEGORY_TONE: Record<ReportCategory, SoftTone> = {
  pl: 'info',
  balance_sheet: 'neutral',
  tax: 'warning',
  audit: 'success',
};

import type { Ionicons } from '@expo/vector-icons';

import type { ReportCategory } from './types';

export const CATEGORY_LABEL: Record<ReportCategory, string> = {
  pl: 'Profit & Loss',
  balance_sheet: 'Balance Sheet',
  tax: 'Tax',
  audit: 'Audit',
};

export const CATEGORY_ICON: Record<ReportCategory, keyof typeof Ionicons.glyphMap> = {
  pl: 'bar-chart-outline',
  balance_sheet: 'scale-outline',
  tax: 'receipt-outline',
  audit: 'shield-checkmark-outline',
};

export const CATEGORY_TINT: Record<ReportCategory, string> = {
  pl: '#D5E3FF',
  balance_sheet: '#E8E8ED',
  tax: '#FFDAD6',
  audit: '#D9F2E3',
};

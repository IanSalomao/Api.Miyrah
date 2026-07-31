export const DASHBOARD_PERIODS = [
  'currentMonth',
  'last3Months',
  'last6Months',
  'last12Months',
  'currentYear',
  'custom',
] as const;

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DASHBOARD_TRANSACTION_TYPE_FILTERS = [
  'all',
  'income',
  'expense',
] as const;

export type DashboardTransactionTypeFilter =
  (typeof DASHBOARD_TRANSACTION_TYPE_FILTERS)[number];

export const DASHBOARD_COMPARISON_GROUP_BY_OPTIONS = ['month', 'week'] as const;

export type DashboardComparisonGroupBy =
  (typeof DASHBOARD_COMPARISON_GROUP_BY_OPTIONS)[number];

export const DASHBOARD_LINE_GRANULARITY_OPTIONS = ['day', 'week'] as const;

export type DashboardLineGranularity =
  (typeof DASHBOARD_LINE_GRANULARITY_OPTIONS)[number];

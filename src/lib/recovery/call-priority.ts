/**
 * Call Priority definitions, configurations, and filters for Kamna Traders Recovery Queue.
 * Staff-managed manual prioritization of customer collection calls:
 * - Green (CALL_IMMEDIATELY): Staff should call the customer directly.
 * - Yellow/Amber (VERIFY_FIRST): Verify account or payment information before calling.
 * - Red (SENIOR_FOLLOWUP): A senior team member should handle the call.
 * - Neutral Grey (NO_CALL_NEEDED): No call is currently required (DEFAULT).
 */

export type CallPriorityKey =
  | 'CALL_IMMEDIATELY'
  | 'VERIFY_FIRST'
  | 'SENIOR_FOLLOWUP'
  | 'NO_CALL_NEEDED';

export type CallPriorityFilterKey = 'all' | 'call_required' | 'no_call';

export interface CallPriorityConfig {
  key: CallPriorityKey;
  label: string;
  badgeLabel: string;
  description: string;
  colorName: 'green' | 'yellow' | 'red' | 'grey';
  colorHex: string;
  dotClass: string;
  badgeClass: string;
  iconColor: string;
  borderClass: string;
}

export const CALL_PRIORITIES: Record<CallPriorityKey, CallPriorityConfig> = {
  CALL_IMMEDIATELY: {
    key: 'CALL_IMMEDIATELY',
    label: 'Call Immediately',
    badgeLabel: 'Call Immediately',
    description: 'Staff should call the customer directly.',
    colorName: 'green',
    colorHex: '#10b981',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconColor: 'text-emerald-600',
    borderClass: 'border-emerald-500',
  },
  VERIFY_FIRST: {
    key: 'VERIFY_FIRST',
    label: 'Verify First',
    badgeLabel: 'Verify First',
    description: 'Verify the account or payment information before calling.',
    colorName: 'yellow',
    colorHex: '#f59e0b',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    iconColor: 'text-amber-600',
    borderClass: 'border-amber-500',
  },
  SENIOR_FOLLOWUP: {
    key: 'SENIOR_FOLLOWUP',
    label: 'Senior Follow-up',
    badgeLabel: 'Senior Follow-up',
    description: 'A senior team member should handle the call.',
    colorName: 'red',
    colorHex: '#ef4444',
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    iconColor: 'text-rose-600',
    borderClass: 'border-rose-500',
  },
  NO_CALL_NEEDED: {
    key: 'NO_CALL_NEEDED',
    label: 'No Call Needed',
    badgeLabel: 'No Call Needed',
    description: 'No call is currently required.',
    colorName: 'grey',
    colorHex: '#64748b',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
    iconColor: 'text-slate-400',
    borderClass: 'border-slate-300',
  },
};

/** Default state for new and unassigned customers is Neutral Grey (No Call Needed) */
export const DEFAULT_CALL_PRIORITY: CallPriorityKey = 'NO_CALL_NEEDED';

/** All 4 ordered priority keys for the selector menu */
export const ORDERED_CALL_PRIORITIES: CallPriorityKey[] = [
  'CALL_IMMEDIATELY',
  'VERIFY_FIRST',
  'SENIOR_FOLLOWUP',
  'NO_CALL_NEEDED',
];

/** Normalizes legacy or variant priority strings */
export function normalizeCallPriority(val: any): CallPriorityKey {
  if (!val || typeof val !== 'string') return DEFAULT_CALL_PRIORITY;
  const upper = val.trim().toUpperCase();
  if (upper === 'CALL_IMMEDIATELY' || upper === 'CALL_NOW') return 'CALL_IMMEDIATELY';
  if (upper === 'VERIFY_FIRST') return 'VERIFY_FIRST';
  if (upper === 'SENIOR_FOLLOWUP' || upper === 'SENIOR_CALL') return 'SENIOR_FOLLOWUP';
  if (upper === 'NO_CALL_NEEDED') return 'NO_CALL_NEEDED';
  return DEFAULT_CALL_PRIORITY;
}

export function isValidCallPriority(val: any): val is CallPriorityKey {
  if (typeof val !== 'string') return false;
  const upper = val.trim().toUpperCase();
  return (
    upper === 'CALL_IMMEDIATELY' ||
    upper === 'VERIFY_FIRST' ||
    upper === 'SENIOR_FOLLOWUP' ||
    upper === 'NO_CALL_NEEDED' ||
    upper === 'CALL_NOW' ||
    upper === 'SENIOR_CALL'
  );
}

export function getCallPriorityConfig(val: string | null | undefined): CallPriorityConfig {
  const normalized = normalizeCallPriority(val);
  return CALL_PRIORITIES[normalized] || CALL_PRIORITIES[DEFAULT_CALL_PRIORITY];
}

/** Check if customer requires a call (Green, Yellow, or Red) */
export function isCallRequired(val: string | null | undefined): boolean {
  const norm = normalizeCallPriority(val);
  return norm === 'CALL_IMMEDIATELY' || norm === 'VERIFY_FIRST' || norm === 'SENIOR_FOLLOWUP';
}

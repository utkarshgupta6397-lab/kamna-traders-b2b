/**
 * Reusable utility for time-based greetings based on client local time.
 *
 * Thresholds:
 * - Morning:   05:00 - 11:59
 * - Afternoon: 12:00 - 16:59
 * - Evening:   17:00 - 20:59
 * - Night:     21:00 - 04:59
 */

export type GreetingPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export function getGreetingPeriod(date: Date = new Date()): GreetingPeriod {
  const hours = date.getHours();
  if (hours >= 5 && hours < 12) {
    return 'morning';
  }
  if (hours >= 12 && hours < 17) {
    return 'afternoon';
  }
  if (hours >= 17 && hours < 21) {
    return 'evening';
  }
  return 'night';
}

export function getTimeBasedGreeting(date: Date = new Date()): string {
  const period = getGreetingPeriod(date);
  switch (period) {
    case 'morning':
      return 'Good Morning';
    case 'afternoon':
      return 'Good Afternoon';
    case 'evening':
      return 'Good Evening';
    case 'night':
      return 'Good Night';
  }
}

export function getTimeBasedEyebrow(date: Date = new Date()): string {
  const period = getGreetingPeriod(date);
  switch (period) {
    case 'morning':
      return 'GOOD MORNING,';
    case 'afternoon':
      return 'GOOD AFTERNOON,';
    case 'evening':
      return 'GOOD EVENING,';
    case 'night':
      return 'GOOD NIGHT,';
  }
}

export function formatGreetingWithUser(userName?: string | null, date: Date = new Date()): string {
  const greeting = getTimeBasedGreeting(date);
  const name = userName?.trim();
  if (!name) {
    return `${greeting}!`;
  }
  return `${greeting}, ${name}!`;
}

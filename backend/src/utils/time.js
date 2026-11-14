const INDIA_OFFSET_MS = 330 * 60 * 1000;

export const INDIA_TIMEZONE = 'Asia/Kolkata';

/** "Today" means today in India, wherever the server happens to be hosted. */
export function startOfTodayInIndia(now = new Date()) {
  const shifted = new Date(now.getTime() + INDIA_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - INDIA_OFFSET_MS);
}

/** The date in India as YYMMDD, used in order numbers. */
export function indiaDateStamp(now = new Date()) {
  return new Date(now.getTime() + INDIA_OFFSET_MS).toISOString().slice(2, 10).replace(/-/g, '');
}

/** Turns a YYYY-MM-DD date into the start of that day in India. */
export function startOfIndiaDay(date) {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() - INDIA_OFFSET_MS);
}

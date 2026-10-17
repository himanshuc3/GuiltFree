// India has no DST, so IST is a fixed UTC+05:30 offset.
export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export interface IstParts {
  year: number;
  month: number; // 0-11
  day: number;
  weekday: number; // 0 = Sunday
}

export function istParts(d: Date): IstParts {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth(),
    day: ist.getUTCDate(),
    weekday: ist.getUTCDay(),
  };
}

/** The instant at which the given IST wall-clock time occurs. */
export function istToDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - IST_OFFSET_MS);
}

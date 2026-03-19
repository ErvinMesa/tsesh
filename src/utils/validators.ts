import * as z from 'zod';

export const SessionCount = z.coerce.number().int().min(1).max(10);
export const WindowCount = z.coerce.number().int().min(1).max(10);

export const validateSessionCount = (value: string | undefined) => {
  if (!value) return;

  const parsed = SessionCount.safeParse(value);

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Enter a valid session count';
  }
};

export const validateWindowCount = (value: string | undefined) => {
  if (!value) return;

  const parsed = WindowCount.safeParse(value);

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Enter a valid window count';
  }
};

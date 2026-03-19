export const normalizeSessionName = (value: string, fallback = 'session') => {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '');

  return sanitized || fallback;
};

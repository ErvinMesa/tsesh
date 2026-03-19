const SESSION_NAME_DEFAULTS = ['project', 'client', 'server', 'runners', 'miscellaneous'];

export const getDefaultSessionName = (index: number, sessionCount: number) => {
  if (sessionCount === 1) {
    return SESSION_NAME_DEFAULTS[0];
  }

  if (index < SESSION_NAME_DEFAULTS.length) {
    return SESSION_NAME_DEFAULTS[index];
  }

  return `session-${index + 1}`;
};

export const getDefaultSessionNames = (sessionCount: number) =>
  Array.from({ length: sessionCount }, (_, index) => getDefaultSessionName(index, sessionCount));

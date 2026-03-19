import chalk from 'chalk';

import type { WorkspaceWindow } from './tmux';
import { normalizeSessionName } from './session_name';
import { select, text } from './prompt_utils';
import { validateWindowCount, WindowCount } from './validators';

export type WindowPreferenceMode = 'ask' | 'yes' | 'no';

export type WindowPreferenceDecision = {
  createWindows: boolean;
  nextMode: WindowPreferenceMode;
};

const WINDOW_PREFERENCE_OPTIONS = [
  { label: 'Y - Yes', value: 'yes' },
  { label: 'A - Yes to all', value: 'yes_all' },
  { label: 'N - No', value: 'no' },
  { label: 'X - No to all', value: 'no_all' },
] as const;

const getDefaultWindowName = (index: number) => {
  if (index === 0) {
    return 'main';
  }

  return `window-${index + 1}`;
};

export const promptForWindowPreference = async (
  sessionName: string,
  mode: WindowPreferenceMode,
): Promise<WindowPreferenceDecision> => {
  if (mode === 'yes') {
    return { createWindows: true, nextMode: 'yes' };
  }

  if (mode === 'no') {
    return { createWindows: false, nextMode: 'no' };
  }

  const choice = await select({
    message: `Create custom windows for "${sessionName}"?`,
    options: WINDOW_PREFERENCE_OPTIONS.map((option) => ({
      label: option.label,
      value: option.value,
    })),
  });

  if (choice === 'yes_all') {
    console.log(chalk.dim('Custom windows enabled for the remaining sessions.'));
    return { createWindows: true, nextMode: 'yes' };
  }

  if (choice === 'no_all') {
    console.log(chalk.dim('Custom windows disabled for the remaining sessions.'));
    return { createWindows: false, nextMode: 'no' };
  }

  return { createWindows: choice === 'yes', nextMode: 'ask' };
};

export const promptForSessionWindows = async (sessionName: string): Promise<WorkspaceWindow[]> => {
  const windowCountInput = await text({
    message: `How many windows for "${sessionName}"?`,
    placeholder: '1',
    defaultValue: '1',
    validate: validateWindowCount,
  });

  const windowCount = WindowCount.parse(windowCountInput);
  const selectedWindowNames = new Set<string>();
  const windows: WorkspaceWindow[] = [];

  for (let index = 0; index < windowCount; index += 1) {
    const defaultName = getDefaultWindowName(index);
    const windowName = await text({
      message: `Name window ${index + 1}?`,
      placeholder: defaultName,
      defaultValue: defaultName,
      validate(value) {
        const normalizedValue = normalizeSessionName(value ?? '', defaultName);

        if (selectedWindowNames.has(normalizedValue)) {
          return 'Duplicate window name. tmux window names must be unique within a session.';
        }
      },
    });

    selectedWindowNames.add(normalizeSessionName(windowName, defaultName));

    const command = await text({
      message: `Default command for "${windowName}"?`,
      placeholder: 'Leave blank for the default shell',
      defaultValue: '',
    });

    windows.push({
      name: windowName,
      command: command.trim() || undefined,
    });
  }

  return windows;
};

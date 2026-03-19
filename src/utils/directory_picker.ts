import { readdir } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

import { cancel } from '@clack/prompts';
import chalk from 'chalk';

type DirectoryEntry = {
  value: string;
  label: string;
  isCommonDev: boolean;
};

const COMMON_DEV_DIRECTORIES = new Set([
  '.cache',
  '.git',
  '.next',
  '.nuxt',
  '.parcel-cache',
  '.pnpm-store',
  '.turbo',
  '.vscode',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'tmp',
  'vendor',
]);

const isCommonDevDirectory = (name: string) =>
  name.startsWith('.') || COMMON_DEV_DIRECTORIES.has(name);

const pickerPreferences = {
  hideCommonDevDirs: false,
};

const buildEntries = async (rootDir: string): Promise<DirectoryEntry[]> => {
  const entries = await readdir(rootDir, { withFileTypes: true });

  const subdirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return [
    { value: '.', label: 'Current directory', isCommonDev: false },
    ...subdirectories.map((name) => ({
      value: name,
      label: name,
      isCommonDev: isCommonDevDirectory(name),
    })),
  ];
};

const getVisibleEntries = (entries: DirectoryEntry[], hideCommonDevDirs: boolean) =>
  hideCommonDevDirs ? entries.filter((entry) => !entry.isCommonDev) : entries;

const matchesQuery = (candidate: string, query: string) => {
  if (!query) {
    return true;
  }

  const normalizedCandidate = candidate.toLowerCase();
  const normalizedQuery = query.toLowerCase();

  if (normalizedCandidate.includes(normalizedQuery)) {
    return true;
  }

  let candidateIndex = 0;
  for (const char of normalizedQuery) {
    candidateIndex = normalizedCandidate.indexOf(char, candidateIndex);
    if (candidateIndex === -1) {
      return false;
    }
    candidateIndex += 1;
  }

  return true;
};

const filterEntries = (entries: DirectoryEntry[], hideCommonDevDirs: boolean, search: string) =>
  getVisibleEntries(entries, hideCommonDevDirs).filter((entry) => {
    if (search && entry.value === '.') {
      return false;
    }

    const haystack = `${entry.label} ${entry.value}`;
    return matchesQuery(haystack, search);
  });

const clampCursor = (cursor: number, length: number) => {
  if (length <= 0) return -1;
  return Math.max(0, Math.min(cursor, length - 1));
};

const formatLabel = (entry: DirectoryEntry, isSelected: boolean) =>
  `${isSelected ? '>' : ' '} ${entry.label}`;

export type DirectoryPromptOptions = {
  message: string;
  rootDir: string;
  initialValue?: string;
};

export const promptForDirectory = async ({
  message,
  rootDir,
  initialValue = '.',
}: DirectoryPromptOptions): Promise<string> => {
  const entries = await buildEntries(rootDir);
  let hideCommonDevDirs = pickerPreferences.hideCommonDevDirs;
  let query = '';
  let cursor = Math.max(0, entries.findIndex((entry) => entry.value === initialValue));

  const stdin = process.stdin;
  const stdout = process.stdout;

  if (!stdin.isTTY || !stdout.isTTY) {
    return initialValue;
  }

  readline.emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  stdout.write('\x1B[?25l');
  stdout.write('\n');

  let cleanedUp = false;
  let renderedLineCount = 0;

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    stdout.write('\x1B[?25h');
    stdin.setRawMode(false);
    stdin.pause();
    stdin.removeAllListeners('keypress');
  };

  const syncCursor = () => {
    const visibleEntries = filterEntries(entries, hideCommonDevDirs, query);

    if (query === '') {
      const initialIndex = visibleEntries.findIndex((entry) => entry.value === initialValue);
      cursor = initialIndex >= 0 ? initialIndex : 0;
      return;
    }

    cursor = 0;
  };

  const render = () => {
    const visibleEntries = filterEntries(entries, hideCommonDevDirs, query);

    if (renderedLineCount > 0) {
      readline.moveCursor(stdout, 0, -renderedLineCount);
      readline.cursorTo(stdout, 0);
      readline.clearScreenDown(stdout);
    }

    cursor = clampCursor(cursor, visibleEntries.length);

    const start = Math.max(0, cursor - 4);
    const end = Math.min(visibleEntries.length, start + 8);
    const visibleSlice = visibleEntries.slice(start, end);

    const header = [chalk.cyan(message)];
    if (query) {
      header.push(`${chalk.cyan('Search:')} ${chalk.bold(query)}`);
    }

    const lines: string[] = [];
    lines.push(`${chalk.gray('┌')} ${chalk.bold('Select a directory')}`);
    for (const line of header) {
      lines.push(`${chalk.gray('│')} ${line}`);
    }
    lines.push(`${chalk.gray('├')} ${chalk.gray('Directories')}`);

    if (visibleEntries.length === 0) {
      lines.push(`${chalk.gray('│')} ${chalk.yellow('No matching directories.')}`);
    } else {
      if (start > 0) {
        lines.push(`${chalk.gray('│')} ${chalk.dim('...')}`);
      }

      for (let index = 0; index < visibleSlice.length; index += 1) {
        const entry = visibleSlice[index];
        const selected = start + index === cursor;
        const line = formatLabel(entry, selected);
        if (selected) {
          lines.push(`${chalk.gray('│')} ${chalk.green.bold.inverse(line)}`);
        } else {
          lines.push(`${chalk.gray('│')} ${chalk.dim(line)}`);
        }
      }

      if (end < visibleEntries.length) {
        lines.push(`${chalk.gray('│')} ${chalk.dim('...')}`);
      }
    }

    lines.push(`${chalk.gray('├')} ${chalk.gray('[↑↓] move  [enter] select  [Shift+H] hide dev dirs')}`);
    lines.push(`${chalk.gray('└')}`);

    stdout.write(`${lines.join('\n')}\n`);
    renderedLineCount = lines.length;
  };

  return new Promise<string>((resolve) => {
    const finish = (value: string) => {
      cleanup();
      stdout.write('\n');
      resolve(value);
    };

    const fail = () => {
      cleanup();
      cancel('Setup cancelled.');
      process.exit(0);
    };

    const onKeypress = (_chunk: string, key: readline.Key) => {
      if (key.ctrl && key.name === 'c') {
        fail();
        return;
      }

      if (key.name === 'escape') {
        fail();
        return;
      }

      const isToggleHotkey = (key.name === 'h' && key.shift) || key.sequence === 'H';

      if (isToggleHotkey) {
        hideCommonDevDirs = !hideCommonDevDirs;
        pickerPreferences.hideCommonDevDirs = hideCommonDevDirs;
        syncCursor();
        render();
        return;
      }

      if (key.name === 'up') {
        cursor -= 1;
        render();
        return;
      }

      if (key.name === 'down') {
        cursor += 1;
        render();
        return;
      }

      if (key.name === 'backspace') {
        query = query.slice(0, -1);
        syncCursor();
        render();
        return;
      }

      if (key.name === 'return') {
        const visibleEntries = filterEntries(entries, hideCommonDevDirs, query);

        const selected = visibleEntries[clampCursor(cursor, visibleEntries.length)] ?? visibleEntries[0];

        if (!selected) {
          return;
        }

        finish(selected.value);
        return;
      }

      if (typeof key.sequence === 'string' && key.sequence.length === 1 && !key.ctrl && !key.meta) {
        query += key.sequence;
        syncCursor();
        render();
      }
    };

    stdin.on('keypress', onKeypress);
    syncCursor();
    render();
  });
};

export const resolveDirectoryChoice = (rootDir: string, choice: string) =>
  choice === '.' ? rootDir : path.resolve(rootDir, choice);

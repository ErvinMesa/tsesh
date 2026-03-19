import { chmod, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { WorkspaceSession } from './tmux';

const SCRIPT_NAME = 'setup-workspace.sh';

const escapeSingleQuoted = (value: string) => `'${value.replace(/'/g, `'\"'\"'`)}'`;

const toRelativeDirectory = (rootDir: string, directory: string) => {
  const relativePath = path.relative(rootDir, directory);
  return relativePath === '' ? '.' : relativePath;
};

const buildShellWindowInvocation = (
  functionName: 'create_session' | 'create_window',
  sessionName: string,
  directory: string,
  windowName: string,
  command?: string,
) => {
  const quotedSessionName = escapeSingleQuoted(sessionName);
  const quotedDirectory = escapeSingleQuoted(directory);
  const quotedWindowName = escapeSingleQuoted(windowName);
  const commandSuffix = command?.trim() ? ` ${escapeSingleQuoted(command.trim())}` : '';

  return `${functionName} ${quotedSessionName} ${quotedDirectory} ${quotedWindowName}${commandSuffix}`;
};

const buildShellSessionCommands = (rootDir: string, session: WorkspaceSession) => {
  const relativeDirectory = toRelativeDirectory(rootDir, session.directory);
  const windows = session.windows.length > 0 ? session.windows : [{ name: 'main' }];

  return windows.map((window, index) =>
    buildShellWindowInvocation(
      index === 0 ? 'create_session' : 'create_window',
      session.name,
      relativeDirectory,
      window.name,
      window.command,
    ),
  );
};

export const buildSessionMakerScript = (rootDir: string, sessions: WorkspaceSession[]) => {
  const lines = [
    '#!/bin/bash',
    'set -euo pipefail',
    '',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    '',
    'if ! command -v tmux &>/dev/null; then',
    '  echo "Error: tmux is not installed." >&2',
    '  exit 1',
    'fi',
    '',
    'resolve_dir() {',
    '  local relative="$1"',
    '  if [[ "$relative" == "." ]]; then',
    '    printf \'%s\\n\' "$SCRIPT_DIR"',
    '  else',
    '    printf \'%s/%s\\n\' "$SCRIPT_DIR" "$relative"',
    '  fi',
    '}',
    '',
    'create_session() {',
    '  local name="$1"',
    '  local relative_directory="$2"',
    '  local window_name="$3"',
    '  local command="${4:-}"',
    '  local directory="$(resolve_dir "$relative_directory")"',
    '',
    '  if tmux has-session -t "$name" 2>/dev/null; then',
    '    echo "Error: tmux session already exists: $name" >&2',
    '    exit 1',
    '  fi',
    '',
    '  if [[ -n "$command" ]]; then',
    '    tmux new-session -d -s "$name" -n "$window_name" -c "$directory" bash -lc "$command"',
    '  else',
    '    tmux new-session -d -s "$name" -n "$window_name" -c "$directory"',
    '  fi',
    '}',
    '',
    'create_window() {',
    '  local name="$1"',
    '  local relative_directory="$2"',
    '  local window_name="$3"',
    '  local command="${4:-}"',
    '  local directory="$(resolve_dir "$relative_directory")"',
    '',
    '  if [[ -n "$command" ]]; then',
    '    tmux new-window -t "$name" -n "$window_name" -c "$directory" bash -lc "$command"',
    '  else',
    '    tmux new-window -t "$name" -n "$window_name" -c "$directory"',
    '  fi',
    '}',
    '',
    ...sessions.flatMap((session) => buildShellSessionCommands(rootDir, session)),
    '',
    `echo "Workspace ready. Attach with: tmux attach -t ${sessions[0]?.name ?? 'session'}"`,
    '',
  ];

  return lines.join('\n');
};

export const writeSessionMakerScript = async (rootDir: string, sessions: WorkspaceSession[]) => {
  const scriptPath = path.join(rootDir, SCRIPT_NAME);
  const scriptContents = buildSessionMakerScript(rootDir, sessions);

  await writeFile(scriptPath, scriptContents, { mode: 0o755 });
  await chmod(scriptPath, 0o755);

  return scriptPath;
};

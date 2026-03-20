import { spawn, execFile as execFileCallback } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import { normalizeSessionName } from './session_name';

const execFile = promisify(execFileCallback);

export type WorkspaceSession = {
  name: string;
  directory: string;
  windows: WorkspaceWindow[];
};

export type WorkspaceWindow = {
  name: string;
  command?: string;
};

type TmuxCommandOptions = {
  forceOutsideTmux?: boolean;
};

const buildTmuxEnv = (forceOutsideTmux = false) => {
  if (!forceOutsideTmux) {
    return process.env;
  }

  const env = { ...process.env };
  delete env.TMUX;
  delete env.TMUX_PANE;

  return env;
};

const runTmux = async (args: string[], options: TmuxCommandOptions = {}) => {
  await execFile('tmux', args, { env: buildTmuxEnv(options.forceOutsideTmux) });
};

export const getWorkspaceSessionName = (rootDir: string) => {
  const baseName = path.basename(rootDir).trim();

  return normalizeSessionName(baseName, 'project');
};

export const assertTmuxAvailable = async () => {
  try {
    await runTmux(['-V']);
  } catch {
    throw new Error('Error: tmux is not installed.');
  }
};

export const listExistingTmuxSessionNames = async (options: TmuxCommandOptions = {}) => {
  try {
    const { stdout } = await execFile('tmux', ['list-sessions', '-F', '#S'], {
      env: buildTmuxEnv(options.forceOutsideTmux),
    });
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

export const isTmuxServerRunning = async (options: TmuxCommandOptions = {}) =>
  (await listExistingTmuxSessionNames(options)).length > 0;

export const isInsideTmuxSession = () => Boolean(process.env.TMUX);

export const killTmuxServer = async (options: TmuxCommandOptions = {}) => {
  await runTmux(['kill-server'], options);
};

const buildUniqueSessionName = (name: string, index: number) =>
  normalizeSessionName(name, `session-${index + 1}`);

const buildWorkspaceWindow = (window: WorkspaceWindow, index: number): WorkspaceWindow => ({
  name: normalizeSessionName(window.name, index === 0 ? 'main' : `window-${index + 1}`),
  command: window.command?.trim() || undefined,
});

const createTmuxWindow = async (
  sessionName: string,
  directory: string,
  window: WorkspaceWindow,
  isFirstWindow: boolean,
  options: TmuxCommandOptions = {},
) => {
  const commandArgs = window.command ? ['bash', '-lc', window.command] : [];

  if (isFirstWindow) {
    await runTmux([
      'new-session',
      '-d',
      '-s',
      sessionName,
      '-n',
      window.name,
      '-c',
      directory,
      ...commandArgs,
    ], options);
    return;
  }

  await runTmux([
    'new-window',
    '-t',
    sessionName,
    '-n',
    window.name,
    '-c',
    directory,
    ...commandArgs,
  ], options);
};

export const createWorkspaceSessions = async (
  sessions: WorkspaceSession[],
  options: TmuxCommandOptions = {},
) => {
  if (sessions.length === 0) {
    throw new Error('At least one session is required.');
  }

  await runTmux(['start-server'], options);

  const normalizedSessions = sessions.map((session, index) => ({
    ...session,
    name: buildUniqueSessionName(session.name, index),
    windows:
      session.windows.length > 0
        ? session.windows.map((window, windowIndex) => buildWorkspaceWindow(window, windowIndex))
        : [buildWorkspaceWindow({ name: 'main' }, 0)],
  }));

  const existingSessions = new Set(
    (await listExistingTmuxSessionNames(options)).map((name) => normalizeSessionName(name, name)),
  );

  const seenNames = new Set<string>();
  for (const session of normalizedSessions) {
    if (seenNames.has(session.name)) {
      throw new Error(`Duplicate session name: ${session.name}`);
    }

    if (existingSessions.has(session.name)) {
      throw new Error(`Duplicate tmux session already exists: ${session.name}`);
    }

    seenNames.add(session.name);
  }

  for (const session of normalizedSessions) {
    const seenWindowNames = new Set<string>();
    const [firstWindow, ...restWindows] = session.windows;

    if (!firstWindow) {
      throw new Error(`Session ${session.name} is missing a window.`);
    }

    for (const window of session.windows) {
      if (seenWindowNames.has(window.name)) {
        throw new Error(`Duplicate window name in session ${session.name}: ${window.name}`);
      }

      seenWindowNames.add(window.name);
    }

    await createTmuxWindow(session.name, session.directory, firstWindow, true, options);

    for (const window of restWindows) {
      await createTmuxWindow(session.name, session.directory, window, false, options);
    }
  }

  return normalizedSessions;
};

export const attachToWorkspaceSession = (sessionName: string, options: TmuxCommandOptions = {}) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn('tmux', ['attach', '-t', sessionName], {
      stdio: 'inherit',
      env: buildTmuxEnv(options.forceOutsideTmux),
    });

    child.on('error', reject);
    child.on('exit', (exitCode, signal) => {
      if (exitCode === 0 || signal === 'SIGTERM') {
        resolve();
        return;
      }

      reject(new Error(`tmux attach failed with exit code ${exitCode ?? 'unknown'}`));
    });
  });

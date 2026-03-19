import path from 'node:path';
import chalk from 'chalk';
import { intro, outro } from '@clack/prompts';
import { clearScreen, confirm, text } from './utils/prompt_utils';
import { promptForDirectory, resolveDirectoryChoice } from './utils/directory_picker';
import { getDefaultSessionNames } from './utils/session_defaults';
import { normalizeSessionName } from './utils/session_name';
import {
  promptForSessionWindows,
  promptForWindowPreference,
  type WindowPreferenceMode,
} from './utils/window_wizard';
import { writeSessionMakerScript } from './utils/session_maker';
import {
  assertTmuxAvailable,
  attachToWorkspaceSession,
  createWorkspaceSessions,
  listExistingTmuxSessionNames,
  type WorkspaceSession,
} from './utils/tmux';
import { validateSessionCount, SessionCount } from './utils/validators';

async function main() {
  try {
    await assertTmuxAvailable();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Error: tmux is not installed.');
    process.exit(1);
  }

  intro('TSesh');

  const rootDir = path.resolve(process.cwd());
  clearScreen();
  const sessionCountInput = await text({
    message: 'How many sessions to make?',
    placeholder: '1',
    defaultValue: '1',
    validate: validateSessionCount,
  });

  const sessionCount = SessionCount.parse(sessionCountInput);
  const defaultSessionNames = getDefaultSessionNames(sessionCount);

  clearScreen();
  const sessions: WorkspaceSession[] = [];
  const selectedSessionNames: string[] = [];
  let windowPreferenceMode: WindowPreferenceMode = 'ask';

  for (let index = 0; index < sessionCount; index += 1) {
    const existingTmuxSessionNames = new Set(
      (await listExistingTmuxSessionNames()).map((name) => normalizeSessionName(name, name)),
    );
    const defaultName = defaultSessionNames[index];
    const sessionName = await text({
      message: `Name session ${index + 1}?`,
      placeholder: defaultName,
      defaultValue: defaultName,
      validate(value) {
        const normalizedValue = normalizeSessionName(value ?? '', defaultName);

        if (
          selectedSessionNames.some((existingName) => normalizeSessionName(existingName, defaultName) === normalizedValue) ||
          existingTmuxSessionNames.has(normalizedValue)
        ) {
          return 'Duplicate session name. tmux session names must be unique.';
        }
      },
    });

    selectedSessionNames.push(sessionName);

    const sessionRoute = await promptForDirectory({
      message: `Which route should "${sessionName}" open in?`,
      rootDir,
      initialValue: '.',
    });

    sessions.push({
      name: sessionName,
      directory: resolveDirectoryChoice(rootDir, sessionRoute),
      windows: [],
    });

    const windowPreference = await promptForWindowPreference(sessionName, windowPreferenceMode);
    windowPreferenceMode = windowPreference.nextMode;

    if (windowPreference.createWindows) {
      sessions[sessions.length - 1].windows = await promptForSessionWindows(sessionName);
    }

    clearScreen();
  }

  const createdSessions = await createWorkspaceSessions(sessions);

  const shouldCreateSessionMaker = await confirm({
    message: 'Create a setup-workspace.sh file?',
    initialValue: false,
  });

  if (shouldCreateSessionMaker) {
    const scriptPath = await writeSessionMakerScript(rootDir, createdSessions);
    console.log(chalk.green(`Session maker written to ${scriptPath}`));
  }

  await attachToWorkspaceSession(createdSessions[0].name);

  outro(`Workspace ready. Created ${createdSessions.length} session(s).`);
}

main().catch((error: unknown) => {
  console.error('CLI failed to start.');
  console.error(error);
  process.exit(1);
});

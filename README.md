# TSesh

TSesh is a small CLI for setting up tmux workspaces fast.

It helps you:

- create one or more tmux sessions
- choose a directory for each session
- optionally create custom windows inside each session
- optionally generate a reusable `setup-workspace.sh` file that recreates the workspace later

## Requirements

- Node.js 18 or newer
- `tmux` installed and available on your `PATH`
- A bash-compatible shell

TSesh is intended for Linux, macOS, and WSL. Native Windows is not supported.

## Install

From npm:

```bash
npm install -g @rayvenjm/tsesh
```

Or run it without installing globally:

```bash
npx @rayvenjm/tsesh
```

## Usage

Run the CLI:

```bash
tsesh
```

The flow is:

1. TSesh checks that `tmux` is installed.
2. It asks how many sessions you want to create.
3. It asks for each session name.
4. It asks which directory each session should open in.
5. It asks whether you want custom windows for that session.
6. If you choose custom windows, it asks:
   - how many windows to create
   - the name of each window
   - an optional default command for each window
7. It creates the tmux sessions.
8. It asks whether you want to generate `setup-workspace.sh`.
9. It attaches you to the first created session.

## Directory Picker

The directory picker:

- shows only directories, not files
- starts on the current directory
- lets you type to search
- supports `Shift+H` to hide or show common dev directories like `.git`, `dist`, and `node_modules`

## Generated Workspace Script

If you choose to create the shell file, TSesh writes `setup-workspace.sh` in the current working directory.

That file recreates the tmux sessions and windows you created during the interactive run.

## Notes

- Session names must be unique.
- Window names must be unique within a session.
- If a window command is left blank, TSesh opens the window without running a command.
- Commands are run through `bash -lc`, so multi-word commands like `npm run dev` work correctly.

## Development

Install dependencies and run the CLI locally:

```bash
pnpm install
pnpm start
```

Build the package:

```bash
pnpm build
```

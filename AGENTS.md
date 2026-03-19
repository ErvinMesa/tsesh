# Project Snapshot
TSesh is a minimal CLI tool to prepare a tmux session with customized windows. It can also create a setup-workspace.sh to be able to setup the workspace anytime

# Core Priorities
1. Reliability first.
2. Keep behavior predictable

# Maintainability
Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

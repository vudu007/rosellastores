# Claude Code Hooks: Quick Reference

## What Are Hooks?

Hooks are event-triggered scripts that run at specific points in Claude Code's workflow. The system supports **27 official hook events** ranging from tool execution to session management.

## Key Hook Events

The most commonly used hooks include:

- **PreToolUse** - Executes before tool calls (can block them)
- **PostToolUse** - Runs after successful tool execution
- **Stop** - Triggers when Claude finishes responding
- **SessionStart/SessionEnd** - Fire at session boundaries
- **PermissionRequest** - Runs when tools need user approval

## Setup Requirements

To use hooks, you need:
- **Python 3** (verify with `python3 --version`)
- Platform-specific audio players (auto-detected on macOS/Linux/Windows)

## Configuration

Hooks are managed through two JSON files:

1. **`.claude/hooks/config/hooks-config.json`** — shared team settings
2. **`.claude/hooks/config/hooks-config.local.json`** — personal overrides (git-ignored)

You can disable all hooks at once via `.claude/settings.local.json`:
```json
{ "disableAllHooks": true }
```

## Hook Types

Claude Code supports four handler types:

- **command** - Runs shell scripts (this project's approach)
- **prompt** - Sends decisions to Claude for evaluation
- **agent** - Spawns subagents for complex verification
- **http** - POSTs to external webhooks/services

## Agent-Specific Hooks

Agents support a subset of 6 hooks defined in frontmatter:
- PreToolUse, PostToolUse, PermissionRequest, PostToolUseFailure, Stop, SubagentStop

These enable lightweight automation within agent lifecycles without affecting global settings.

## Key Features

**Async execution** prevents hooks from blocking Claude Code — useful for notifications and logging.

**Matchers** filter hook triggers by tool name, notification type, or other criteria, reducing unnecessary processing.

The built-in **`/hooks`** command provides an interactive interface for managing hooks without editing JSON files directly.

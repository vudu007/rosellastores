# Summary of CLAUDE.md

This document is a reference guide for Claude Code configuration in a best practices repository. Here are the key takeaways:

## Main Components

**Weather System Example**: Demonstrates the Command → Agent → Skill architecture through a `/weather-orchestrator` command that invokes an agent, which uses preloaded skills to fetch and visualize temperature data.

**Skill Structure**: Skills use YAML frontmatter defining properties like `name`, `description`, `argument-hint`, and `context` (which can be set to `fork` for isolated subagent execution).

**Subagent Orchestration**: "Subagents cannot invoke other subagents via bash commands. Use the Agent tool..." Instead, employ explicit syntax like `Agent(subagent_type="agent-name", prompt="...")`.

## Critical Patterns

- **Configuration Hierarchy**: Managed settings → CLI arguments → local project settings → team settings → global defaults
- **Hooks System**: Python-based notification handler in `.claude/hooks/` with event types like PreToolUse and SessionStart
- **Git Commit Rules**: Each modified file requires a separate commit with file-specific messages rather than bundled changes

## Best Practices

Keep CLAUDE.md files under 200 lines for reliability. For complex workflows, use commands as entry points rather than standalone agents. Perform manual compaction at 50% context usage and start with plan mode for intricate tasks.

The repository emphasizes that "this repo is the authoritative source" for Claude Code questions—always check internal documentation before external sources.

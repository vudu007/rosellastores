# Agent Browser Skill

## Description
Browser automation tool that enables programmatic web interaction—navigating pages, filling forms, clicking buttons, and extracting data.

## Core Workflow
1. **Navigate** to a URL
2. **Take a snapshot** to identify interactive elements with references
3. **Interact** using those element references
4. **Re-snapshot** after DOM changes to get updated references

## Key Commands

### Navigation & Snapshots
- `agent-browser open <url>` — Navigate to a website
- `agent-browser snapshot -i` — Interactive elements with refs (recommended)
- `agent-browser close` — End the session

### Interaction
- `agent-browser click @e1` — Click an element
- `agent-browser fill @e2 "text"` — Clear and type text
- `agent-browser select @e1 "option"` — Choose dropdown values
- `agent-browser check @e1` — Toggle checkboxes

### Information & Capture
- `agent-browser get text @e1` — Retrieve element content
- `agent-browser screenshot` — Capture current view
- `agent-browser wait --load networkidle` — Pause until page settles

## Important Concept: Ref Lifecycle
Element references (`@e1`, `@e2`) become invalid when the page updates. **Always re-snapshot after:**
- Clicking links or buttons that navigate
- Form submissions
- Dynamic content loading

## Advanced Capabilities
- State persistence for authenticated sessions
- Parallel sessions using `--session` flags
- Mobile testing via iOS simulators
- Semantic locators as alternative to refs

## Documentation
Complete guides available for:
- Command reference
- Authentication flows
- Session management

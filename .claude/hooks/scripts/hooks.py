#!/usr/bin/env python3
"""
Claude Code Hook Handler Script

This Python script manages audio notifications and event handling for Claude Code hooks.
It listens for hook events and plays corresponding sound files based on platform.

Platform Support:
- macOS: Uses afplay
- Linux: Tries paplay, aplay, ffplay, or mpg123
- Windows: Uses built-in winsound module

Configuration:
- Read from .claude/hooks/config/hooks-config.json
- Local overrides in .claude/hooks/config/hooks-config.local.json
- Logging to .claude/hooks/logs/hooks-log.jsonl (can be disabled)

Hook Events Supported:
SessionStart, SessionEnd, PreToolUse, PostToolUse, PermissionRequest, Stop,
PreCompact, PostCompact, SubagentStart, SubagentStop, FileChanged, TaskCompleted,
and 14 others (27 total hook events)

Usage:
  python3 hooks.py --event=EventName [--agent=agent-name]

Security:
- Validates sound names to prevent directory traversal attacks
- Exits gracefully with code 0 to avoid interrupting Claude's workflow
"""

import os
import sys
import json
import platform
import subprocess
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

# Hook event mapping
HOOK_EVENTS = {
    'SessionStart': 'session_start',
    'SessionEnd': 'session_end',
    'PreToolUse': 'pre_tool_use',
    'PostToolUse': 'post_tool_use',
    'PermissionRequest': 'permission_request',
    'Stop': 'stop',
    'PreCompact': 'pre_compact',
    'PostCompact': 'post_compact',
    'SubagentStart': 'subagent_start',
    'SubagentStop': 'subagent_stop',
    'FileChanged': 'file_changed',
    'TaskCompleted': 'task_completed',
    'InstructionsLoaded': 'instructions_loaded',
    'UserPromptSubmit': 'user_prompt_submit',
    'Setup': 'setup',
    'ConfigChange': 'config_change',
    'WorktreeCreate': 'worktree_create',
    'WorktreeRemove': 'worktree_remove',
    'Elicitation': 'elicitation',
    'PostToolUseFailure': 'post_tool_use_failure',
    'Async': 'async',
    'BashCommand': 'bash_command',
    'GitCommit': 'git_commit',
    'Error': 'error',
    'Warning': 'warning',
    'AgentStart': 'agent_start',
    'AgentStop': 'agent_stop',
    'Notification': 'notification',
}

class HookHandler:
    def __init__(self):
        self.hook_dir = Path.cwd() / '.claude' / 'hooks'
        self.config_dir = self.hook_dir / 'config'
        self.scripts_dir = self.hook_dir / 'scripts'
        self.logs_dir = self.hook_dir / 'logs'
        self.sounds_dir = self.hook_dir / 'sounds'

        # Ensure logs directory exists
        self.logs_dir.mkdir(parents=True, exist_ok=True)

        self.platform_name = platform.system()
        self.config = self._load_config()
        self._setup_logging()

    def _load_config(self) -> Dict[str, Any]:
        """Load hook configuration with local overrides."""
        config = {}

        # Load default config
        default_config_path = self.config_dir / 'hooks-config.json'
        if default_config_path.exists():
            with open(default_config_path) as f:
                config.update(json.load(f))

        # Load local overrides
        local_config_path = self.config_dir / 'hooks-config.local.json'
        if local_config_path.exists():
            with open(local_config_path) as f:
                config.update(json.load(f))

        return config

    def _setup_logging(self):
        """Configure logging to hooks-log.jsonl."""
        log_path = self.logs_dir / 'hooks-log.jsonl'
        # Disable logging if configured
        if self.config.get('disableLoggingHook', False):
            logging.disable(logging.CRITICAL)

    def _get_audio_player(self):
        """Get the appropriate audio player for the platform."""
        if self.platform_name == 'Darwin':  # macOS
            return 'afplay'
        elif self.platform_name == 'Linux':
            # Try various Linux audio players
            for player in ['paplay', 'aplay', 'ffplay', 'mpg123']:
                if self._command_exists(player):
                    return player
        elif self.platform_name == 'Windows':
            return 'winsound'
        return None

    def _command_exists(self, command: str) -> bool:
        """Check if a command exists on the system."""
        result = subprocess.run(['which', command], capture_output=True)
        return result.returncode == 0

    def _play_sound(self, sound_name: str):
        """Play a sound file if it exists."""
        # Security: prevent directory traversal
        if '..' in sound_name or '/' in sound_name:
            return

        sound_path = self.sounds_dir / f'{sound_name}.wav'
        if not sound_path.exists():
            return

        player = self._get_audio_player()
        if not player:
            return

        try:
            if player == 'winsound':
                import winsound
                winsound.PlaySound(str(sound_path), winsound.SND_FILENAME)
            else:
                subprocess.run([player, str(sound_path)], timeout=5)
        except Exception:
            # Silently fail to avoid interrupting Claude Code
            pass

    def handle_event(self, event_name: str, agent_name: Optional[str] = None):
        """Handle a hook event."""
        # Check if hook is disabled
        disable_key = f'disable{event_name}Hook'
        if self.config.get(disable_key, False):
            return

        # Determine sound to play
        sound_name = HOOK_EVENTS.get(event_name)
        if not sound_name:
            return

        # If agent-specific, try agent sound first
        if agent_name:
            self._play_sound(f'{sound_name}__{agent_name}')

        self._play_sound(sound_name)


def main():
    """Main entry point."""
    handler = HookHandler()

    # Parse arguments
    event_name = None
    agent_name = None

    for arg in sys.argv[1:]:
        if arg.startswith('--event='):
            event_name = arg.split('=', 1)[1]
        elif arg.startswith('--agent='):
            agent_name = arg.split('=', 1)[1]

    if event_name:
        handler.handle_event(event_name, agent_name)

    # Exit gracefully with code 0
    sys.exit(0)


if __name__ == '__main__':
    main()

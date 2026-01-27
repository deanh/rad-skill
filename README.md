# Radicle Skill for Claude Code

A Claude Code plugin for working with [Radicle](https://radicle.xyz) - a peer-to-peer code collaboration protocol.

## Installation

Add to your settings file:

```json
{
  "extraKnownMarketplaces": {
    "deanh-rad-skill": {
      "source": {
        "source": "git",
        "url": "git@github.com:deanh/rad-skill.git"
      }
    }
  },
  "enabledPlugins": {
    "radicle@deanh-rad-skill": true
  }
}
```

**Global install:** Add to `~/.claude/settings.json` to make available in all projects.

**Project install:** Add to `.claude/settings.json` in your project root.

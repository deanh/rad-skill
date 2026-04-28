---
name: radicle
description: This skill should be used when the user asks to "initialize a radicle repo", "rad init", "create a patch", "open a patch", "rad patch", "clone from radicle", "rad clone", "work with radicle issues", "rad issue", "start radicle node", "rad node", "seed a repository", "sync with radicle", "push to radicle", "collaborate on radicle", or mentions RIDs, DIDs, patches, seeding, or peer-to-peer code collaboration.
---

# Radicle

Radicle is a decentralized, peer-to-peer code collaboration protocol built on Git. It enables sovereign code hosting using cryptographic identities and a gossip-based network.

## Core Concepts

- **RID** (Repository ID): Globally unique URN, e.g. `rad:z31hE1wco9132nedN3mm5qJjyotna`
- **NID** (Node ID): Device identifier on the network
- **DID** (Decentralized Identifier): Self-sovereign identity, e.g. `did:key:z6Mkhp7VU...`
- **Delegates**: Maintainers who can sign and manage repository metadata
- **Seeding**: Hosting/replicating a repository across the network
- **Patches**: Git-based collaborative objects (like pull requests) with revision history

## Quick Reference

| Task | Command |
|------|---------|
| Check identity | `rad self` |
| Current repo RID | `rad .` |
| Node status | `rad node status` |
| Initialize repo | `rad init --name "name" --description "desc" --public --no-confirm` |
| Clone | `rad clone rad:<RID>` |
| Create patch | `git push rad HEAD:refs/patches` |
| Update patch | `git push --force` (on patch branch) |
| List patches | `rad patch list` |
| Show patch | `rad patch show <PATCH_ID>` |
| Checkout patch | `rad patch checkout <PATCH_ID>` |
| Merge patch | `git checkout main && git merge <branch> && git push rad main` |
| List issues | `rad issue list` |
| Open issue | `rad issue open --title "title"` |
| Show issue | `rad issue show <ISSUE_ID>` |
| Comment on issue | `rad issue comment <ISSUE_ID>` |
| Close issue | `rad issue state <ISSUE_ID> --closed` |
| Label issue | `rad issue label <ISSUE_ID> --add <label>` / `--remove <label>` |
| Start node | `rad node start` |
| Sync | `rad sync --announce` |
| Fetch updates | `rad sync --fetch` |
| Add remote | `rad remote add <NID> --name <alias>` |
| Seed repo | `rad seed rad:<RID>` |

## Key Workflows

### Contribute to a Project
1. `rad clone rad:<RID>`
2. `git checkout -b feature-branch`
3. Make changes, commit
4. `git push rad HEAD:refs/patches`
5. Address feedback: `git push --force`

### Review and Merge
1. `rad patch list` to see open patches
2. `rad patch show <ID>` or `rad patch checkout <ID>`
3. `git checkout main && git merge <branch>`
4. `git push rad main` (marks patch as merged)

### Private Repository
1. `rad init --private`
2. `rad id update --allow <DID>` to grant access
3. `rad id update --disallow <DID>` to revoke

### Mirror to GitHub
If the repo has a GitHub remote, push to both: `git push rad main && git push github main`. See `references/github-mirror.md` for automation setup.

## Troubleshooting

**Node not running**: Run `rad node start`, then `rad node status` to verify.

**Sync issues**: Run `rad sync --fetch` then `rad sync status`.

**Identity problems**: Run `rad self` to check, `rad auth` to re-authenticate.

**Node status symbols**: `✓` connected, `!` attempted, `✗` disconnected, `↗` outbound, `↘` inbound.

**NAT/firewall**: "Not configured to listen for inbound connections" is normal. The node still connects outbound and participates fully. Configure port forwarding for inbound.

## Prerequisites

```bash
rad --version          # Check installation
rad self               # Check identity
rad node status        # Check node
```

If `rad` is not installed: https://radicle.xyz/install or `curl -sSLf https://radicle.xyz/install | sh`

If no identity: `rad auth` (or non-interactive: `echo "" | rad auth --alias "name" --stdin`)

## Reference

For complete command reference with all flags and options, read `references/commands.md`.

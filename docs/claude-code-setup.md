# Setting up Claude Code on a new machine

These steps recreate the Claude Code setup used for this project on a new Mac. For Windows, see [claude-code-setup-windows.md](claude-code-setup-windows.md).

## 1. Prerequisites

```bash
brew install node python git gh
npm install -g @anthropic-ai/claude-code
npm install -g ruflo@latest
pip3 install numpy pandas scipy statsmodels requests jsonschema pyyaml pytest pillow opencv-python
```

## 2. Clone the skills repo

```bash
gh auth login --hostname github.com --git-protocol https --web
git clone https://github.com/Toshev2210/Claude-skills.git ~/.claude/skills
```

## 3. Copy the global instructions file

`~/.claude/CLAUDE.md` is not in the skills repo. It's personal, so decide what you want to share before you hand it over.

```bash
# on the source machine
cp ~/.claude/CLAUDE.md /path/to/share/

# on the new machine
cp /path/to/share/CLAUDE.md ~/.claude/CLAUDE.md
```

## 4. Add plugin marketplaces

```bash
claude plugin marketplace add obra/superpowers
claude plugin marketplace add thedotmack/claude-mem
claude plugin marketplace add bradautomates/claude-video
```

## 5. Install plugins

```bash
claude plugin install superpowers@superpowers-dev
claude plugin install code-review@claude-plugins-official
claude plugin install frontend-design@claude-plugins-official
claude plugin install security-guidance@claude-plugins-official
claude plugin install claude-mem@thedotmack
claude plugin install watch@claude-video
```

These commands write the `enabledPlugins` and `extraKnownMarketplaces` blocks in `~/.claude/settings.json`. For the same look, also set `"theme": "dark"` there.

## 6. Install the `/watch` plugin's dependencies

The `watch` plugin needs ffmpeg and yt-dlp, installed once. `$CLAUDE_PLUGIN_ROOT` is only set when Claude Code runs the plugin, so the easiest way is to ask Claude to run the setup script inside a session:

```bash
python3 $CLAUDE_PLUGIN_ROOT/skills/watch/scripts/setup.py
```

From a plain terminal, replace `$CLAUDE_PLUGIN_ROOT` with the plugin's install directory under `~/.claude/plugins/`.

## 7. MCP servers

Only one MCP server is in use. Ignore any instructions that say to add `nano-banana`; it isn't configured.

```bash
claude mcp add magic --scope user --env API_KEY="<21st-dev-magic-api-key>" -- npx -y @21st-dev/magic@latest
```

Get a new key at <https://21st.dev/magic/console>. If a key was ever shared in plain text, rotate it instead of reusing it. Never commit a real key to this repo.

## 8. Cowork scheduled tasks

The templates are in `~/.claude/skills/cowork-scheduled-tasks/`. In Cowork, go to **Scheduled Tasks** and recreate `daily-morning-briefing` and `weekly-briefing`, using their `SKILL.md` files as the task instructions.

## 9. Connectors

There's nothing to set up here. Google Calendar, Gmail, Drive and the other connectors belong to the Anthropic account, not the device, so they're available as soon as you sign in.

## 10. Verify

```bash
claude mcp list
claude plugin list
ls ~/.claude/skills | wc -l   # expect 164 (or however many the skills repo holds now)
```

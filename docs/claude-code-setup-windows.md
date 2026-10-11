# Setting up Claude Code on Windows

These steps recreate the Claude Code setup used for this project on a Windows PC. Run every command in **PowerShell**. For the Mac version, see [claude-code-setup.md](claude-code-setup.md).

## 1. Prerequisites

Install Node.js, Python, Git and the GitHub CLI with `winget`:

```powershell
winget install OpenJS.NodeJS.LTS Python.Python.3.12 Git.Git GitHub.cli
```

Close and reopen PowerShell so the new commands are on your `PATH`, then:

```powershell
npm install -g @anthropic-ai/claude-code
npm install -g ruflo@latest
py -m pip install numpy pandas scipy statsmodels requests jsonschema pyyaml pytest pillow opencv-python
```

If PowerShell refuses to run `npm` with a "running scripts is disabled" error, allow local scripts once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 2. Clone the skills repo

```powershell
gh auth login --hostname github.com --git-protocol https --web
git clone https://github.com/Toshev2210/Claude-skills.git "$env:USERPROFILE\.claude\skills"
```

## 3. Copy the global instructions file

`CLAUDE.md` is not in the skills repo. It's personal, so decide what you want to share before you hand it over. On Windows it lives at `%USERPROFILE%\.claude\CLAUDE.md`.

```powershell
# put the shared copy in place on this PC (adjust the source path)
Copy-Item "D:\path\to\share\CLAUDE.md" "$env:USERPROFILE\.claude\CLAUDE.md"
```

## 4. Add plugin marketplaces

```powershell
claude plugin marketplace add obra/superpowers
claude plugin marketplace add thedotmack/claude-mem
claude plugin marketplace add bradautomates/claude-video
```

## 5. Install plugins

```powershell
claude plugin install superpowers@superpowers-dev
claude plugin install code-review@claude-plugins-official
claude plugin install frontend-design@claude-plugins-official
claude plugin install security-guidance@claude-plugins-official
claude plugin install claude-mem@thedotmack
claude plugin install watch@claude-video
```

These commands write the `enabledPlugins` and `extraKnownMarketplaces` blocks in `%USERPROFILE%\.claude\settings.json`. For the same look, also set `"theme": "dark"` there.

## 6. Install the `/watch` plugin's dependencies

The `watch` plugin needs ffmpeg and yt-dlp. On Windows the simplest way is `winget`:

```powershell
winget install Gyan.FFmpeg yt-dlp.yt-dlp
```

Alternatively, ask Claude inside a session to run the plugin's setup script (`$CLAUDE_PLUGIN_ROOT` is only set while Claude Code runs the plugin, and on Windows the command is `python`, not `python3`):

```
python $CLAUDE_PLUGIN_ROOT/skills/watch/scripts/setup.py
```

## 7. MCP servers

Only one MCP server is in use. Ignore any instructions that say to add `nano-banana`; it isn't configured.

On Windows, `npx` has to be started through `cmd /c`, otherwise the server fails to launch:

```powershell
claude mcp add magic --scope user --env API_KEY="<21st-dev-magic-api-key>" -- cmd /c npx -y @21st-dev/magic@latest
```

Get a new key at <https://21st.dev/magic/console>. If a key was ever shared in plain text, rotate it instead of reusing it. Never commit a real key to this repo.

## 8. Cowork scheduled tasks

The templates are in `%USERPROFILE%\.claude\skills\cowork-scheduled-tasks\`. In Cowork, go to **Scheduled Tasks** and recreate `daily-morning-briefing` and `weekly-briefing`, using their `SKILL.md` files as the task instructions.

## 9. Connectors

There's nothing to set up here. Google Calendar, Gmail, Drive and the other connectors belong to the Anthropic account, not the device, so they're available as soon as you sign in.

## 10. Verify

```powershell
claude mcp list
claude plugin list
(Get-ChildItem "$env:USERPROFILE\.claude\skills").Count   # expect 164 (or however many the skills repo holds now)
```

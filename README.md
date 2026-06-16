# Chat Flow — Obsidian Plugin

Chat-like rapid capture panel for Obsidian. Append timestamped messages to `Chat.md`, move messages to notes, archive, record voice memos — all without leaving your vault.

Inspired by the [Files.md](https://app.files.md) web app's Chat feature.

## Features

- **Chat panel** — Right sidebar panel shows `Chat.md` as a styled message stream
- **Quick capture** — `Cmd+Shift+I` opens a floating input; type Enter to append without opening the panel
- **Timestamped messages** — Each message gets `\`HH:mm\`` backtick-wrapped timestamps (24h or 12h)
- **Move to note** — Hover a message → `↗` → fuzzy search a note → message is cut from Chat.md and appended to the target with a backlink
- **Move to journal** — Send a message ending with `jj` (or `жж`) to redirect it to today's journal; or hover a message → `📅` to move it manually
- **Archive** — Hover → `📦` to move a message to a configurable archive file instead of deleting it
- **Complete / Undo** — Click the circle icon to toggle `- [ ]` ↔ `- [x]`; completed messages show a filled checkmark badge + strikethrough
- **Voice recording** — Record voice memos right from the panel; saved to `media/` and linked as `![](media/file.webm)`
- **Wikilinks & links** — `[[wikilinks]]` and `[text](url)` are clickable; clicking opens the note in the main editor
- **Inline edit** — Double-click a message to edit its text
- **Full-text search** — Search box filters messages in real time
- **Completed message folding** — Optionally fold day groups where every message is done
- **Daily Notes integration** — Optionally route journal operations through the Obsidian Daily Notes core plugin

## Installation

### From source

```bash
cd /path/to/vault/.obsidian/plugins
git clone <repo-url> chat-flow
cd chat-flow
npm install
npm run build
```

Then enable "Chat Flow" in Obsidian → Settings → Community Plugins.

### Manual

Download `main.js`, `manifest.json`, and `styles.css` from the latest release and place them in:

```
<vault>/.obsidian/plugins/chat-flow/
```

## Usage

### Quick capture (floating input)

`Cmd+Shift+I` (configurable) to open a floating input. Type your thought and press Enter:

| Suffix | Behavior |
|--------|----------|
| (none) | Appended to `Chat.md` |
| ` jj` or ` жж` | Appended to today's journal |

### Chat panel

Open the panel via the ribbon icon (💬) or the "Toggle chat panel" command. The panel has:

- **Search box** — type to filter messages
- **Message stream** — date headings + timestamped messages
- **Input area** — textarea with mic and send buttons

Hovering a message reveals 3 action buttons floating over it:

| Button | Action |
|--------|--------|
| ↗ | Move message to another note (fuzzy search) |
| 📅 | Move message to today's journal |
| 📦 | Archive message to the archive file |

Click the ○/● circle icon to toggle a message's completed state.

Double-click message text to edit inline.

## Settings

### File paths

Settings with a path input provide inline autocomplete: start typing and matching vault files/folders appear in a dropdown.

| Setting | Default | Description |
|---------|---------|-------------|
| Chat file path | `Chat.md` | Where messages are appended |
| Journal directory | `journal` | Target directory for `jj` messages |
| Journal filename format | `YYYY.MM MMMM` | `2026.06 June.md` or `2026-06-15.md` |
| Archive file path | `archive/Chat Archive.md` | Where archived messages go |
| Media directory | `media` | Where voice recordings are saved |

### Message format

| Setting | Default | Description |
|---------|---------|-------------|
| Time format | 24h | `14:22` or `02:22 PM` |
| Backlink format | `→Chat` | Appended when moving/archiving messages |

### Behavior

| Setting | Default | Description |
|---------|---------|-------------|
| Enable voice recording | On | Show microphone button |
| Enable 'jj' journal shortcut | On | `jj`/`жж` suffix routes to journal |
| Use Daily Notes plugin | Off | Override journal path with Daily Notes |
| Panel message limit | 50 | Max messages shown (click "Load more") |

### Appearance

| Setting | Default | Description |
|---------|---------|-------------|
| Completed messages | Folded | Show all / fold completed groups / hide completed |
| Accent color | `#F97316` | Send button, complete icon, action hover highlight |

## Commands

| Command | Description |
|---------|-------------|
| Toggle chat panel | Open/close the chat sidebar |
| Quick capture | Floating input for rapid capture |
| Send selected text to Chat | Send editor selection to Chat.md |

## File Format

Messages follow the Files.md convention:

```markdown
#### 15 June, Monday

- [ ] \`10:30\` Suddenly thought of a great plugin idea
- [x] \`09:15\` Finished reading the documentation

#### 14 June, Sunday

- [ ] \`22:15\` Remember to deploy tomorrow
```

When a message is moved or archived, a backlink is appended to the target:

```markdown
- [ ] \`10:30\` Suddenly thought of a great plugin idea →Chat
```

## Development

```bash
npm install        # Install dependencies
npm run dev        # Watch mode for development
npm run build      # Production build
npm run lint       # Type check only
```

Copy or symlink `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/chat-flow/` for testing.

## License

MIT

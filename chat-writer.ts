import { Vault, TFile, normalizePath } from "obsidian";
import type { ChatFlowSettings } from "./settings";
import { parseChat, serializeChat, type ChatDayBlock, type ChatMessage } from "./chat-parser";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/**
 * All write operations on Chat.md, archive, journal, and target files.
 * Uses Obsidian Vault API for all file I/O.
 */
export class ChatWriter {
    constructor(
        private vault: Vault,
        private settings: ChatFlowSettings
    ) {}

    private todayHeading(): string {
        const now = new Date();
        return `#### ${now.getDate()} ${MONTHS[now.getMonth()]}, ${WEEKDAYS[now.getDay()]}`;
    }

    /** Format a timestamp string. */
    private nowTimestamp(): string {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        if (this.settings.timeFormat === "12h") {
            const h = now.getHours();
            const ampm = h >= 12 ? "PM" : "AM";
            const h12 = String(h % 12 || 12).padStart(2, "0");
            return `\`${h12}:${mm} ${ampm}\``;
        }
        return `\`${hh}:${mm}\``;
    }

    /** Build a message line from text. */
    buildMessageLine(text: string): string {
        const checkbox = "- [ ]";
        const ts = this.nowTimestamp();
        return `${checkbox} ${ts} ${text}`;
    }

    /** Ensure a heading for today exists in the blocks, prepend if not. */
    private ensureTodayBlock(blocks: ChatDayBlock[]): ChatDayBlock[] {
        const heading = this.todayHeading();
        if (blocks.length > 0 && blocks[0].heading === heading) {
            return blocks;
        }
        // Prepend today's block
        const todayBlock: ChatDayBlock = { heading, messages: [] };
        return [todayBlock, ...blocks];
    }

    /** Append a message to the Chat.md file. */
    async appendToChat(text: string): Promise<void> {
        const chatPath = this.settings.chatFilePath;
        const chatMsg = this.buildMessageLine(text);

        const file = this.vault.getAbstractFileByPath(normalizePath(chatPath));
        if (!(file instanceof TFile)) {
            // Create Chat.md if it doesn't exist
            const heading = this.todayHeading();
            await this.vault.create(
                normalizePath(chatPath),
                `${heading}\n\n${chatMsg}\n`
            );
            return;
        }

        const content = await this.vault.read(file);
        const blocks = this.ensureTodayBlock(parseChat(content));

        // Check if today's block is empty of messages — if blocks[0] is new
        const todayBlock = blocks[0];
        todayBlock.messages.push({
            raw: chatMsg,
            time: this.nowTimestamp().replace(/`/g, ""),
            content: text,
            completed: false,
        });

        await this.vault.modify(file, serializeChat(blocks));
    }

    /** Toggle a message's completed state. */
    async toggleMessage(
        blockIdx: number,
        msgIdx: number
    ): Promise<void> {
        const chatPath = this.settings.chatFilePath;
        const file = this.vault.getAbstractFileByPath(normalizePath(chatPath));
        if (!(file instanceof TFile)) return;

        const content = await this.vault.read(file);
        const blocks = parseChat(content);

        if (blockIdx < blocks.length && msgIdx < blocks[blockIdx].messages.length) {
            blocks[blockIdx].messages[msgIdx].completed = !blocks[blockIdx].messages[msgIdx].completed;
        }

        await this.vault.modify(file, serializeChat(blocks));
    }

    /** Remove a message from a block. Returns the removed message or null. */
    async removeMessage(
        filePath: string,
        blockIdx: number,
        msgIdx: number
    ): Promise<ChatMessage | null> {
        const file = this.vault.getAbstractFileByPath(normalizePath(filePath));
        if (!(file instanceof TFile)) return null;

        const content = await this.vault.read(file);
        const blocks = parseChat(content);

        if (blockIdx >= blocks.length || msgIdx >= blocks[blockIdx].messages.length) return null;

        const removed = blocks[blockIdx].messages.splice(msgIdx, 1)[0];
        const nonEmpty = blocks.filter((b) => b.messages.length > 0);
        await this.vault.modify(file, serializeChat(nonEmpty));
        return removed;
    }

    /** Write a message directly to the journal file (used by quick input jj). */
    async appendToJournal(text: string): Promise<void> {
        const journalPath = this.getJournalPath();
        const line = this.buildMessageLine(text);

        const file = this.vault.getAbstractFileByPath(normalizePath(journalPath));
        if (file instanceof TFile) {
            await this.vault.append(file, `\n${line}\n`);
        } else {
            const heading = this.todayHeading();
            await this.appendToFile(journalPath, `${heading}\n\n${line}\n`);
        }
    }

    /** Ensure parent directories exist, then create/append to a file. */
    private async appendToFile(path: string, content: string): Promise<void> {
        const normPath = normalizePath(path);
        const file = this.vault.getAbstractFileByPath(normPath);
        if (file instanceof TFile) {
            await this.vault.append(file, content);
            return;
        }

        // Create parent directories if needed
        const parentPath = normPath.replace(/\/[^/]+$/, "");
        if (parentPath && parentPath !== normPath) {
            const parent = this.vault.getAbstractFileByPath(parentPath);
            if (!parent) {
                await this.createDirs(parentPath);
            }
        }

        await this.vault.create(normPath, content.trimStart());
    }

    /** Recursively create directories. */
    private async createDirs(dirPath: string): Promise<void> {
        const segments = dirPath.split("/").filter(Boolean);
        let current = "";
        for (const seg of segments) {
            current += (current ? "/" : "") + seg;
            if (!this.vault.getAbstractFileByPath(current)) {
                await this.vault.createFolder(current);
            }
        }
    }

    /** Build the moved/archived line with backlink. */
    private buildMoveLine(msg: ChatMessage): string {
        const chatPath = this.settings.chatFilePath;
        const line = this.buildMessageLine(msg.content);
        const bl = ` [→${chatPath.replace(/\.md$/, "")}](${encodeURI(chatPath)})`;
        return `\n${line}${bl}\n`;
    }

    /** Peek at a message without removing it. */
    private async peekMessage(blockIdx: number, msgIdx: number): Promise<ChatMessage | null> {
        const file = this.vault.getAbstractFileByPath(normalizePath(this.settings.chatFilePath));
        if (!(file instanceof TFile)) return null;
        const blocks = parseChat(await this.vault.read(file));
        if (blockIdx >= blocks.length || msgIdx >= blocks[blockIdx].messages.length) return null;
        return blocks[blockIdx].messages[msgIdx];
    }

    /** Move a message: write to target first, then remove from Chat.md. */
    async moveToFile(blockIdx: number, msgIdx: number, targetPath: string): Promise<void> {
        const msg = await this.peekMessage(blockIdx, msgIdx);
        if (!msg) return;
        await this.appendToFile(targetPath, this.buildMoveLine(msg));
        await this.removeMessage(this.settings.chatFilePath, blockIdx, msgIdx);
    }

    /** Archive a message: write to archive first, then remove. */
    async archiveMessage(blockIdx: number, msgIdx: number): Promise<void> {
        const msg = await this.peekMessage(blockIdx, msgIdx);
        if (!msg) return;
        await this.appendToFile(this.settings.archiveFilePath, this.buildMoveLine(msg));
        await this.removeMessage(this.settings.chatFilePath, blockIdx, msgIdx);
    }

    /** Move to journal: write first, then remove. */
    async moveToJournal(blockIdx: number, msgIdx: number): Promise<void> {
        if (this.settings.useDailyNotesPlugin) return;
        const msg = await this.peekMessage(blockIdx, msgIdx);
        if (!msg) return;
        await this.appendToFile(this.getJournalPath(), this.buildMoveLine(msg));
        await this.removeMessage(this.settings.chatFilePath, blockIdx, msgIdx);
    }

    /** Move to journal with explicit path. */
    async moveToJournalWithPath(blockIdx: number, msgIdx: number, journalPath: string): Promise<void> {
        const msg = await this.peekMessage(blockIdx, msgIdx);
        if (!msg) return;
        await this.appendToFile(journalPath, this.buildMoveLine(msg));
        await this.removeMessage(this.settings.chatFilePath, blockIdx, msgIdx);
    }

    getJournalPath(): string {
        const now = new Date();
        const dir = this.settings.journalDir.replace(/\/$/, "");
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");

        if (this.settings.journalFormat === "YYYY-MM-DD") {
            const d = String(now.getDate()).padStart(2, "0");
            return `${dir}/${y}-${m}-${d}.md`;
        }
        return `${dir}/${y}.${m} ${MONTHS[now.getMonth()]}.md`;
    }

    /** Update a message's content in-place. */
    async editMessage(
        blockIdx: number,
        msgIdx: number,
        newContent: string
    ): Promise<void> {
        const chatPath = this.settings.chatFilePath;
        const file = this.vault.getAbstractFileByPath(normalizePath(chatPath));
        if (!(file instanceof TFile)) return;

        const content = await this.vault.read(file);
        const blocks = parseChat(content);

        if (blockIdx < blocks.length && msgIdx < blocks[blockIdx].messages.length) {
            blocks[blockIdx].messages[msgIdx].content = newContent;
        }

        await this.vault.modify(file, serializeChat(blocks));
    }
}

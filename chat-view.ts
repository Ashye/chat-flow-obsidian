import {
    ItemView,
    WorkspaceLeaf,
    TFile,
    normalizePath,
} from "obsidian";
import type ChatFlowPlugin from "./main";
import { parseChat, type ChatDayBlock, type ChatMessage } from "./chat-parser";
import { MoveSuggestModal } from "./move-suggest-modal";

export const CHAT_VIEW_TYPE = "chat-flow-view";

/**
 * Right sidebar panel that renders Chat.md messages with actions,
 * filters, search, and a quick input area.
 */
export class ChatView extends ItemView {
    plugin: ChatFlowPlugin;
    messagesEl!: HTMLElement;
    inputEl!: HTMLTextAreaElement;
    micBtn!: HTMLElement;
    sendBtn!: HTMLElement;
    private inputWrap!: HTMLElement;
    private blocks: ChatDayBlock[] = [];
    private searchQuery = "";
    visibleLimit: number;

    constructor(leaf: WorkspaceLeaf, plugin: ChatFlowPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.visibleLimit = plugin.settings.panelMessageLimit;
    }

    getViewType(): string {
        return CHAT_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Chat Flow";
    }

    getIcon(): string {
        return "message-square";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass("chat-flow-container");

        // ── Search ──
        const searchRow = container.createDiv("chat-flow-search-row");
        const searchInput = searchRow.createEl("input", {
            type: "text",
            placeholder: "Search messages...",
            cls: "chat-flow-search-input",
        });
        searchInput.addEventListener("input", (e) => {
            this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
            this.renderMessages();
        });

        // ── Message list ──
        this.messagesEl = container.createDiv("chat-flow-messages");

        // ── Input area ──
        this.buildInputArea(container);
        this.applyAccentColor();

        // Initial render
        await this.refresh();
    }

    /**
     * Build (or rebuild) the input area: textarea + mic/send buttons
     * all in a single row.
     */
    buildInputArea(parent: HTMLElement): void {
        // Remove old input wrap if rebuilding
        if (this.inputWrap) {
            this.inputWrap.remove();
        }

        this.inputWrap = parent.createDiv("chat-flow-input-wrap");

        this.inputEl = this.inputWrap.createEl("textarea", {
            cls: "chat-flow-input",
            placeholder: "Dump your thoughts...",
        });
        this.inputEl.rows = 1;

        // Mic button (conditionally rendered)
        if (this.plugin.settings.enableVoice) {
            this.micBtn = this.inputWrap.createEl("button", {
                cls: "chat-flow-mic-btn",
                attr: { "aria-label": "Record voice message", title: "Record voice message" },
            });
            this.micBtn.innerHTML =
                `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="3" width="8" height="13" rx="4"/><path d="M5 12a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>`;
            this.micBtn.addEventListener("click", () => this.toggleRecording());
        }

        this.sendBtn = this.inputWrap.createEl("button", {
            cls: "chat-flow-send-btn",
            attr: { "aria-label": "Send", title: "Send" },
        });
        this.sendBtn.innerHTML =
            `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
        this.sendBtn.addEventListener("click", () => this.sendMessage());

        this.updateSendBtnVisibility();

        // Event listeners
        this.inputEl.addEventListener("input", () => {
            this.autoResizeInput();
            this.updateSendBtnVisibility();
        });
        this.inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    /** Called after settings change to rebuild input area without full re-render. */
    rebuildInput(): void {
        const container = this.containerEl.children[1] as HTMLElement;
        this.buildInputArea(container);
    }

    /** Re-read Chat.md and re-render messages. */
    async refresh(): Promise<void> {
        const chatPath = this.plugin.settings.chatFilePath;
        const file = this.app.vault.getAbstractFileByPath(normalizePath(chatPath));
        if (file instanceof TFile) {
            const content = await this.app.vault.read(file);
            this.blocks = parseChat(content);
        } else {
            this.blocks = [];
        }
        this.renderMessages();
    }

    applyAccentColor(): void {
        const accent = this.plugin.settings.accentColor;
        // Remove previous style if any
        const old = this.containerEl.querySelector("#chat-flow-accent-style");
        if (old) old.remove();

        const style = document.createElement("style");
        style.id = "chat-flow-accent-style";
        style.textContent = `
            .chat-flow-container {
                --chat-flow-accent: ${accent} !important;
            }
        `;
        this.containerEl.appendChild(style);
    }

    /** Render the message list from parsed blocks. */
    private renderMessages(): void {
        this.messagesEl.empty();

        let msgCount = 0;
        const limit = this.plugin.settings.panelMessageLimit;
        const completedMode = this.plugin.settings.completedDisplay;

        for (let bi = 0; bi < this.blocks.length; bi++) {
            const block = this.blocks[bi];
            let visibleMsgs: { msg: ChatMessage; mi: number }[] = [];

            for (let mi = 0; mi < block.messages.length; mi++) {
                const msg = block.messages[mi];
                if (this.searchQuery && !msg.content.toLowerCase().includes(this.searchQuery)) {
                    continue;
                }
                if (completedMode === "hide" && msg.completed) continue;
                visibleMsgs.push({ msg, mi });
            }

            if (visibleMsgs.length === 0) continue;

            // Date heading
            const headingEl = this.messagesEl.createDiv("chat-flow-day-heading");
            headingEl.setText(block.heading);

            // Fold: show heading only if all messages in this block are completed
            const allCompleted = visibleMsgs.every((v) => v.msg.completed);
            if (completedMode === "fold" && allCompleted) {
                const foldToggle = this.messagesEl.createDiv("chat-flow-fold-toggle");
                foldToggle.setText(`+ ${visibleMsgs.length} completed`);
                const wrapper = this.messagesEl.createDiv("chat-flow-fold-wrapper");
                wrapper.style.display = "none";

                foldToggle.addEventListener("click", () => {
                    const isHidden = wrapper.style.display === "none";
                    wrapper.style.display = isHidden ? "block" : "none";
                    foldToggle.setText(
                        `${isHidden ? "−" : "+"} ${visibleMsgs.length} completed`
                    );
                });

                // Render messages into the wrapper
                for (const { msg, mi } of visibleMsgs) {
                    if (msgCount >= limit) break;
                    this.renderMessageRow(wrapper, msg, bi, mi);
                    msgCount++;
                }
                continue;
            }

            for (const { msg, mi } of visibleMsgs) {
                if (msgCount >= limit) {
                    const loadMore = this.messagesEl.createDiv("chat-flow-load-more");
                    loadMore.setText("Load more...");
                    loadMore.addEventListener("click", () => {
                        this.visibleLimit += this.plugin.settings.panelMessageLimit;
                        this.renderMessages();
                    });
                    return;
                }
                this.renderMessageRow(this.messagesEl, msg, bi, mi);
                msgCount++;
            }
        }

        // Empty state
        if (this.messagesEl.children.length === 0) {
            const empty = this.messagesEl.createDiv("chat-flow-empty");
            empty.createSpan({ text: "🗨️", cls: "chat-flow-empty-icon" });
            empty.createEl("p", {
                text: this.searchQuery
                    ? "No matching messages."
                    : "Chat is empty. Start typing below.",
            });
        }
    }

    /** Render a single message row into the given parent. */
    private renderMessageRow(
        parent: HTMLElement,
        msg: ChatMessage,
        bi: number,
        mi: number
    ): void {
        const msgRow = parent.createDiv(
            `chat-flow-message${msg.completed ? " completed" : ""}`
        );
        msgRow.setAttribute("data-block", String(bi));
        msgRow.setAttribute("data-msg", String(mi));

        // Status icon
        const iconEl = msgRow.createSpan("chat-flow-msg-icon");
        if (msg.completed) {
            iconEl.innerHTML =
                `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>`;
        } else {
            iconEl.innerHTML =
                `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;
        }
        iconEl.addEventListener("click", async (e) => {
            e.stopPropagation();
            await this.plugin.getWriter().toggleMessage(bi, mi);
            await this.refresh();
        });

        // Time
        if (msg.time) {
            const timeEl = msgRow.createSpan("chat-flow-msg-time");
            timeEl.setText(msg.time);
        }

        // Content
        const contentEl = msgRow.createSpan("chat-flow-msg-content");
        this.renderInlineMarkdown(contentEl, msg.content);

        // Action buttons (hidden by default, shown on hover)
        const actionsEl = msgRow.createDiv("chat-flow-msg-actions");

        // Move to file
        const moveBtn = actionsEl.createEl("button", {
            cls: "chat-flow-action-btn",
            attr: { title: "Move to file" },
        });
        moveBtn.innerHTML =
            `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l9.2-9.2"/><path d="M17 6.3V17H6.3"/></svg>`;
        moveBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            new MoveSuggestModal(this.app, async (item) => {
                await this.plugin.getWriter().moveToFile(bi, mi, item.path);
                await this.refresh();
            }).open();
        });

        // Move to journal
        const journalBtn = actionsEl.createEl("button", {
            cls: "chat-flow-action-btn",
            attr: { title: "Move to journal" },
        });
        journalBtn.innerHTML =
            `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="13" y2="11"/></svg>`;
        journalBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (this.plugin.settings.useDailyNotesPlugin) {
                const dailyPath = this.plugin.getDailyNotePath?.();
                if (dailyPath) {
                    await this.plugin.getWriter().moveToJournalWithPath(bi, mi, dailyPath);
                }
            } else {
                await this.plugin.getWriter().moveToJournal(bi, mi);
            }
            await this.refresh();
        });

        // Archive
        const archiveBtn = actionsEl.createEl("button", {
            cls: "chat-flow-action-btn",
            attr: { title: "Archive" },
        });
        archiveBtn.innerHTML =
            `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`;
        archiveBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            await this.plugin.getWriter().archiveMessage(bi, mi);
            await this.refresh();
        });

        // Double-click to edit
        contentEl.addEventListener("dblclick", () => {
            const currentText = msg.content;
            const editInput = document.createElement("input");
            editInput.type = "text";
            editInput.value = currentText;
            editInput.className = "chat-flow-edit-input";
            contentEl.empty();
            contentEl.appendChild(editInput);
            editInput.focus();
            editInput.select();

            let finished = false;
            const cleanup = () => {
                document.removeEventListener("click", onClickOutside, true);
                document.removeEventListener("keydown", onKey);
            };
            const finishEdit = async () => {
                if (finished) return;
                finished = true;
                cleanup();
                const newText = editInput.value.trim();
                if (newText && newText !== currentText) {
                    await this.plugin.getWriter().editMessage(bi, mi, newText);
                    await this.refresh();
                } else {
                    contentEl.empty();
                    this.renderInlineMarkdown(contentEl, currentText);
                }
            };
            const onClickOutside = (evt: MouseEvent) => {
                if (!editInput.contains(evt.target as Node)) {
                    finishEdit();
                }
            };
            const onKey = (evt: KeyboardEvent) => {
                if (evt.key === "Enter") { evt.preventDefault(); finishEdit(); }
                if (evt.key === "Escape") {
                    editInput.value = currentText;
                    evt.preventDefault();
                    finishEdit();
                }
            };
            document.addEventListener("click", onClickOutside, true);
            document.addEventListener("keydown", onKey);
        });
    }

    /** Render simple markdown inline with wikilink and link support. */
    private renderInlineMarkdown(container: HTMLElement, text: string): void {
        const processed = text.replace(
            /\[\[([^\]]+)\]\]/g,
            (_match, name: string) => {
                const file = this.app.vault
                    .getMarkdownFiles()
                    .find(
                        (f) =>
                            f.basename === name ||
                            f.path === `${name}.md` ||
                            f.basename === name.replace(/\.md$/, "")
                    );
                if (file) return `[${name}](${encodeURI(file.path)})`;
                return `[${name}](##)`;
            }
        );

        const temp = document.createElement("span");
        const linkRe = /\[([^\]]*)\]\(([^)]+)\)/g;
        let lastIdx = 0;
        let match: RegExpExecArray | null;
        const cleanText = this.escapeHtml(processed);

        while ((match = linkRe.exec(processed)) !== null) {
            temp.appendChild(
                document.createTextNode(cleanText.slice(lastIdx, match.index))
            );
            const linkEl = temp.createEl("a", {
                text: match[1],
                cls: "chat-flow-inline-link",
            });
            linkEl.addEventListener("click", (e) => {
                e.preventDefault();
                const target = this.app.vault.getAbstractFileByPath(
                    normalizePath(decodeURI(match![2]))
                );
                if (target instanceof TFile) {
                    this.app.workspace.getLeaf().openFile(target);
                }
            });
            lastIdx = match.index + match[0].length;
        }
        temp.appendChild(document.createTextNode(cleanText.slice(lastIdx)));
        container.appendChild(temp);
    }

    private escapeHtml(text: string): string {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    private autoResizeInput(): void {
        this.inputEl.style.height = "auto";
        // Cap at 2 lines: line-height 1.4 × font-size 14px × 2 + padding 20px ≈ 60px
        this.inputEl.style.height = `${Math.min(this.inputEl.scrollHeight, 60)}px`;
    }

    private updateSendBtnVisibility(): void {
        const hasText = this.inputEl.value.trim().length > 0;
        if (this.sendBtn) this.sendBtn.style.display = hasText ? "flex" : "none";
        if (this.micBtn) this.micBtn.style.display = hasText ? "none" : "flex";
    }

    private async sendMessage(): Promise<void> {
        const text = this.inputEl.value.trim();
        if (!text) return;

        const writer = this.plugin.getWriter();

        if (
            this.plugin.settings.enableJjJournal &&
            (text.toLowerCase().endsWith(" jj") ||
                text.toLowerCase().endsWith(" жж"))
        ) {
            const journalMsg = text.slice(0, -3).trim();
            await writer.appendToJournal(journalMsg);
        } else {
            await writer.appendToChat(text);
        }

        this.inputEl.value = "";
        this.autoResizeInput();
        this.updateSendBtnVisibility();
        await this.refresh();
    }

    private async toggleRecording(): Promise<void> {
        const recorder = this.plugin.getRecorder();
        if (recorder.isRecording) {
            recorder.stop();
        } else {
            try {
                await recorder.start();
                this.micBtn?.classList.add("recording");
            } catch (err) {
                console.error("Chat Flow:", err);
            }
        }
    }
}

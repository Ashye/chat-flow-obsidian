import { Modal, App, Setting } from "obsidian";
import type ChatFlowPlugin from "./main";

/**
 * Floating quick-input modal for rapid message capture without opening the chat panel.
 * Focuses an input field — type and press Enter to append to Chat.md.
 */
export class ChatInputModal extends Modal {
    private plugin: ChatFlowPlugin;
    private inputEl!: HTMLInputElement;

    constructor(app: App, plugin: ChatFlowPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("chat-flow-quick-input");

        this.titleEl.setText("Quick capture");

        new Setting(contentEl).addText((text) => {
            this.inputEl = text.inputEl;
            this.inputEl.placeholder = "Dump your thoughts... (Enter to send)";
            this.inputEl.classList.add("chat-flow-quick-input-field");
            text.setValue("");
        });

        // Focus after DOM paint
        requestAnimationFrame(() => this.inputEl.focus());

        this.inputEl.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter" && !evt.shiftKey) {
                evt.preventDefault();
                this.submit();
            }
            if (evt.key === "Escape") {
                this.close();
            }
        });

        // Style the modal
        this.containerEl.style.minWidth = "400px";
        this.containerEl.style.maxWidth = "600px";
    }

    private async submit(): Promise<void> {
        const text = this.inputEl.value.trim();
        if (!text) {
            this.close();
            return;
        }

        const writer = this.plugin.getWriter();

        // jj / жж suffix → journal
        if (
            this.plugin.settings.enableJjJournal &&
            (text.toLowerCase().endsWith(" jj") || text.toLowerCase().endsWith(" жж"))
        ) {
            const journalMsg = text.slice(0, -3).trim();
            if (this.plugin.settings.useDailyNotesPlugin) {
                const dailyPath = this.plugin.getDailyNotePath?.();
                if (dailyPath) {
                    await writer.moveToJournalWithPath(0, 0, dailyPath);
                    // Append journal message directly
                    await writer.appendToJournal(journalMsg);
                } else {
                    await writer.appendToChat(journalMsg + " jj");
                }
            } else {
                // Append to journal directly
                await writer.appendToJournal(journalMsg);
            }
        } else {
            await writer.appendToChat(text);
        }

        this.close();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

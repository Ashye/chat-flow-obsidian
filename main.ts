import { Plugin, WorkspaceLeaf, TFile } from "obsidian";
import { ChatView, CHAT_VIEW_TYPE } from "./chat-view";
import { ChatInputModal } from "./chat-input-modal";
import { ChatWriter } from "./chat-writer";
import { VoiceRecorder } from "./recorder";
import { ChatFlowSettings, ChatFlowSettingTab, DEFAULT_SETTINGS } from "./settings";

export default class ChatFlowPlugin extends Plugin {
    settings!: ChatFlowSettings;
    private writer!: ChatWriter;
    private recorder!: VoiceRecorder;

    async onload(): Promise<void> {
        await this.loadSettings();

        // Initialize writer and recorder
        this.writer = new ChatWriter(this.app.vault, this.settings);

        this.recorder = new VoiceRecorder(
            this.app.vault,
            this.settings.mediaDir,
            async (fileName: string) => {
                await this.writer.appendToChat(`![](media/${fileName})`);
                const view = this.getChatView();
                if (view) await view.refresh();
            }
        );
        this.recorder.setStateCallback((state) => {
            const view = this.getChatView();
            if (view && view.micBtn) {
                if (state === "recording") {
                    view.micBtn.classList.add("recording");
                } else {
                    view.micBtn.classList.remove("recording");
                }
            }
        });

        // Register the sidebar view
        this.registerView(CHAT_VIEW_TYPE, (leaf: WorkspaceLeaf) => {
            const view = new ChatView(leaf, this);
            return view;
        });

        // Register commands
        this.addCommand({
            id: "open-chat-panel",
            name: "Toggle chat panel",
            callback: () => this.toggleChatPanel(),
        });

        this.addCommand({
            id: "quick-capture",
            name: "Quick capture (floating input)",
            callback: () => {
                new ChatInputModal(this.app, this).open();
            },
        });

        this.addCommand({
            id: "send-to-chat",
            name: "Send selected text to Chat",
            editorCallback: async (editor) => {
                const selection = editor.getSelection();
                if (selection) {
                    await this.writer.appendToChat(selection);
                }
            },
        });

        // Settings tab
        this.addSettingTab(new ChatFlowSettingTab(this.app, this));

        // Ribbon icon
        this.addRibbonIcon("message-square", "Chat Flow", () => this.toggleChatPanel());

        // Open the panel on load
        this.app.workspace.onLayoutReady(() => {
            this.initChatView();
        });

        // Watch for Chat.md changes to refresh view
        this.registerEvent(
            this.app.vault.on("modify", async (file) => {
                if (file instanceof TFile && file.path === this.settings.chatFilePath) {
                    const view = this.getChatView();
                    if (view) await view.refresh();
                }
            })
        );
    }

    onunload(): void {
        // Detach the custom view
        this.app.workspace.detachLeavesOfType(CHAT_VIEW_TYPE);
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        this.writer = new ChatWriter(this.app.vault, this.settings);
        this.refreshView();
    }

    /** Refresh the ChatView panel to reflect settings changes. */
    refreshView(): void {
        const view = this.getChatView();
        if (view) {
            view.rebuildInput();
            view.applyAccentColor();
            view.visibleLimit = this.settings.panelMessageLimit;
            view.refresh();
        }
    }

    getWriter(): ChatWriter {
        return this.writer;
    }

    getRecorder(): VoiceRecorder {
        return this.recorder;
    }

    /** Get the path of today's Daily Note, if the core plugin is enabled. */
    getDailyNotePath(): string | null {
        // Try to get Daily Notes plugin's configured path
        // Access via internal API (stable since Obsidian 1.0)
        const dailyNotesPlugin = (
            this.app as any
        ).internalPlugins?.getPluginById?.("daily-notes");
        if (!dailyNotesPlugin?.instance) return null;

        const dailyNote = dailyNotesPlugin.instance.getDailyNote?.();
        if (dailyNote instanceof TFile) {
            return dailyNote.path;
        }
        // Create if auto-create is needed — just return the path pattern
        const now = new Date();
        return dailyNotesPlugin.instance.getDailyNotePath?.(now) || null;
    }

    private getChatView(): ChatView | null {
        for (const leaf of this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)) {
            if (leaf.view instanceof ChatView) {
                return leaf.view;
            }
        }
        return null;
    }

    private async toggleChatPanel(): Promise<void> {
        const existing = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE);
        if (existing.length > 0) {
            existing.forEach((leaf) => leaf.detach());
            return;
        }
        await this.initChatView();
    }

    private async initChatView(): Promise<void> {
        const existing = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE);
        if (existing.length > 0) return;

        const leaf = this.app.workspace.getRightLeaf(false);
        if (!leaf) return;

        await leaf.setViewState({
            type: CHAT_VIEW_TYPE,
            active: true,
        });

        this.app.workspace.revealLeaf(leaf);
    }
}

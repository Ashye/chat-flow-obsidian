import { PluginSettingTab, Setting, App, TFile, TFolder } from "obsidian";
import type ChatFlowPlugin from "./main";
import { FileInputSuggest } from "./file-suggest-modal";

export interface ChatFlowSettings {
    // File paths
    chatFilePath: string;
    journalDir: string;
    journalFormat: "YYYY.MM MMMM" | "YYYY-MM-DD";
    archiveFilePath: string;
    mediaDir: string;

    // Message format
    timeFormat: "24h" | "12h";
    backlinkFormat: string;

    // Behavior
    enableVoice: boolean;
    enableJjJournal: boolean;
    useDailyNotesPlugin: boolean;
    panelMessageLimit: number;

    // Appearance
    completedDisplay: "fold" | "show" | "hide";
    accentColor: string;
}

export const DEFAULT_SETTINGS: ChatFlowSettings = {
    chatFilePath: "Chat.md",
    journalDir: "journal",
    journalFormat: "YYYY.MM MMMM",
    archiveFilePath: "archive/Chat Archive.md",
    mediaDir: "media",

    timeFormat: "24h",
    backlinkFormat: " [→{{chat}}]({{chatPath}})",

    enableVoice: true,
    enableJjJournal: true,
    useDailyNotesPlugin: false,
    panelMessageLimit: 50,

    completedDisplay: "fold",
    accentColor: "#F97316",
};

export class ChatFlowSettingTab extends PluginSettingTab {
    plugin: ChatFlowPlugin;

    constructor(app: App, plugin: ChatFlowPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // ── File Paths ──
        containerEl.createEl("h3", { text: "File paths" });

        // Chat file path
        this.addFileSetting({
            name: "Chat file path",
            desc: "Where messages are appended. Relative to vault root.",
            placeholder: "Chat.md",
            currentValue: this.plugin.settings.chatFilePath,
            allowFiles: true,
            allowFolders: true,
            filter: "md",
            onUpdate: async (value) => {
                this.plugin.settings.chatFilePath = value || "Chat.md";
                await this.plugin.saveSettings();
            },
            onFolderPick: (folder) =>
                folder.path === "/" ? "Chat.md" : `${folder.path}/Chat.md`,
        });

        // Journal directory
        this.addFileSetting({
            name: "Journal directory",
            desc: "Directory for journal entries when using 'jj' suffix or 'Move to journal'.",
            placeholder: "journal",
            currentValue: this.plugin.settings.journalDir,
            allowFiles: false,
            allowFolders: true,
            onUpdate: async (value) => {
                this.plugin.settings.journalDir = value || "journal";
                await this.plugin.saveSettings();
            },
            onFolderPick: (folder) => folder.path,
        });

        // Journal filename format
        new Setting(containerEl)
            .setName("Journal filename format")
            .setDesc("YYYY.MM MMMM matches the original Files.md format; YYYY-MM-DD matches Obsidian Daily Notes.")
            .addDropdown((dd) =>
                dd
                    .addOption("YYYY.MM MMMM", "YYYY.MM MMMM (e.g. 2026.06 June)")
                    .addOption("YYYY-MM-DD", "YYYY-MM-DD (e.g. 2026-06-15)")
                    .setValue(this.plugin.settings.journalFormat)
                    .onChange(async (value) => {
                        this.plugin.settings.journalFormat =
                            value as ChatFlowSettings["journalFormat"];
                        await this.plugin.saveSettings();
                    })
            );

        // Archive file path
        this.addFileSetting({
            name: "Archive file path",
            desc: "Archived messages are moved here instead of being deleted.",
            placeholder: "archive/Chat Archive.md",
            currentValue: this.plugin.settings.archiveFilePath,
            allowFiles: true,
            allowFolders: true,
            filter: "md",
            onUpdate: async (value) => {
                this.plugin.settings.archiveFilePath = value || "archive/Chat Archive.md";
                await this.plugin.saveSettings();
            },
            onFolderPick: (folder) =>
                folder.path === "/" ? "Chat Archive.md" : `${folder.path}/Chat Archive.md`,
        });

        // Media directory
        this.addFileSetting({
            name: "Media directory",
            desc: "Voice recordings are saved here.",
            placeholder: "media",
            currentValue: this.plugin.settings.mediaDir,
            allowFiles: false,
            allowFolders: true,
            onUpdate: async (value) => {
                this.plugin.settings.mediaDir = value || "media";
                await this.plugin.saveSettings();
            },
            onFolderPick: (folder) => folder.path,
        });

        // ── Message Format ──
        containerEl.createEl("h3", { text: "Message format" });

        new Setting(containerEl)
            .setName("Time format")
            .setDesc("12h (AM/PM) or 24h display.")
            .addDropdown((dd) =>
                dd
                    .addOption("24h", "24-hour (14:22)")
                    .addOption("12h", "12-hour (02:22 PM)")
                    .setValue(this.plugin.settings.timeFormat)
                    .onChange(async (value) => {
                        this.plugin.settings.timeFormat =
                            value as ChatFlowSettings["timeFormat"];
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Backlink format")
            .setDesc(
                "Appended when moving/archiving a message. {{chat}} = filename, {{chatPath}} = full path."
            )
            .addText((text) =>
                text
                    .setPlaceholder("→Chat")
                    .setValue(this.plugin.settings.backlinkFormat)
                    .onChange(async (value) => {
                        this.plugin.settings.backlinkFormat = value;
                        await this.plugin.saveSettings();
                    })
            );

        // ── Behavior ──
        containerEl.createEl("h3", { text: "Behavior" });

        new Setting(containerEl)
            .setName("Enable voice recording")
            .setDesc("Show the microphone button in the input area.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.enableVoice)
                    .onChange(async (value) => {
                        this.plugin.settings.enableVoice = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Enable 'jj' journal shortcut")
            .setDesc(
                "Messages ending with 'jj' or 'жж' are sent to the journal instead of Chat.md."
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.enableJjJournal)
                    .onChange(async (value) => {
                        this.plugin.settings.enableJjJournal = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Use Obsidian Daily Notes plugin")
            .setDesc(
                "When enabled, journal operations use the Daily Notes plugin target instead of the journal directory above."
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.useDailyNotesPlugin)
                    .onChange(async (value) => {
                        this.plugin.settings.useDailyNotesPlugin = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Panel message limit")
            .setDesc(
                "Maximum number of recent messages shown in the panel. Older messages are loaded via 'Load more'."
            )
            .addSlider((slider) =>
                slider
                    .setLimits(10, 200, 10)
                    .setValue(this.plugin.settings.panelMessageLimit)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.panelMessageLimit = value;
                        await this.plugin.saveSettings();
                    })
            );

        // ── Appearance ──
        containerEl.createEl("h3", { text: "Appearance" });

        new Setting(containerEl)
            .setName("Completed messages")
            .setDesc("How to display completed messages in the panel.")
            .addDropdown((dd) =>
                dd
                    .addOption("fold", "Folded (show heading only)")
                    .addOption("show", "Show all")
                    .addOption("hide", "Hide completely")
                    .setValue(this.plugin.settings.completedDisplay)
                    .onChange(async (value) => {
                        this.plugin.settings.completedDisplay =
                            value as ChatFlowSettings["completedDisplay"];
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Accent color")
            .setDesc("Used for the send button, complete icon, and action highlights.")
            .addColorPicker((picker) =>
                picker
                    .setValue(this.plugin.settings.accentColor)
                    .onChange(async (value) => {
                        this.plugin.settings.accentColor = value;
                        await this.plugin.saveSettings();
                    })
            );
    }

    /**
     * Helper: add a path setting with inline autocomplete — the dropdown
     * appears as the user types, no extra browse button needed.
     */
    private addFileSetting(opts: {
        name: string;
        desc: string;
        placeholder: string;
        currentValue: string;
        allowFiles: boolean;
        allowFolders: boolean;
        filter?: string;
        onUpdate: (value: string) => Promise<void>;
        onFolderPick: (folder: TFolder) => string;
    }): void {
        const app = this.app;

        new Setting(this.containerEl)
            .setName(opts.name)
            .setDesc(opts.desc)
            .addText((text) => {
                text
                    .setPlaceholder(opts.placeholder)
                    .setValue(opts.currentValue)
                    .onChange(opts.onUpdate);

                new FileInputSuggest(
                    app,
                    text.inputEl,
                    (item) => {
                        const val =
                            item instanceof TFile ? item.path : opts.onFolderPick(item);
                        text.setValue(val);
                        opts.onUpdate(val);
                    },
                    {
                        allowFiles: opts.allowFiles,
                        allowFolders: opts.allowFolders,
                        filter: opts.filter,
                    }
                );
            });
    }
}

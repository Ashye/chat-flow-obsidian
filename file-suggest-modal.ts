import {
    FuzzySuggestModal,
    AbstractInputSuggest,
    TFile,
    TFolder,
} from "obsidian";

interface SuggestOptions {
    allowFiles?: boolean;
    allowFolders?: boolean;
    filter?: string;
}

/** Shared item source for both suggest UIs. */
function getSuggestItems(
    app: import("obsidian").App,
    opts: SuggestOptions
): (TFile | TFolder)[] {
    const items: (TFile | TFolder)[] = [];
    const allowFiles = opts.allowFiles ?? true;
    const allowFolders = opts.allowFolders ?? true;

    if (allowFolders) {
        for (const folder of app.vault.getAllLoadedFiles()) {
            if (folder instanceof TFolder) {
                items.push(folder);
            }
        }
    }

    if (allowFiles) {
        const files = opts.filter
            ? app.vault.getFiles().filter((f) => f.extension === opts.filter)
            : app.vault.getMarkdownFiles();
        items.push(...files);
    }

    return items;
}

/** Display text for a file or folder item. */
function suggestItemText(item: TFile | TFolder): string {
    if (item instanceof TFolder) {
        return item.path + "/";
    }
    if (item.parent && item.parent.path !== "/") {
        return `${item.basename}  (${item.parent.path}/)`;
    }
    return item.basename;
}

// ── Modal suggester (click-to-browse) ──

/**
 * FuzzySuggestModal for picking a file or folder via a dedicated search dialog.
 * Used by the "Browse" button in settings.
 */
export class FileSuggestModal extends FuzzySuggestModal<TFile | TFolder> {
    private onPick: (item: TFile | TFolder) => void;
    private opts: SuggestOptions;

    constructor(
        app: import("obsidian").App,
        onPick: (item: TFile | TFolder) => void,
        opts: SuggestOptions = {}
    ) {
        super(app);
        this.onPick = onPick;
        this.opts = opts;
        this.setPlaceholder("Search vault...");
    }

    getItems(): (TFile | TFolder)[] {
        return getSuggestItems(this.app, this.opts);
    }

    getItemText(item: TFile | TFolder): string {
        return suggestItemText(item);
    }

    onChooseItem(item: TFile | TFolder, _evt: MouseEvent | KeyboardEvent): void {
        this.onPick(item);
    }
}

// ── Inline autocomplete suggester (type → dropdown) ──

/**
 * AbstractInputSuggest bound to a text input.
 * As the user types, a popover appears below the input with matching
 * files/folders from the vault.
 */
export class FileInputSuggest extends AbstractInputSuggest<TFile | TFolder> {
    private inputEl: HTMLInputElement;
    private onSelected: (item: TFile | TFolder) => void;
    private opts: SuggestOptions;

    constructor(
        app: import("obsidian").App,
        inputEl: HTMLInputElement,
        onSelect: (item: TFile | TFolder) => void,
        opts: SuggestOptions = {}
    ) {
        super(app, inputEl);
        this.inputEl = inputEl;
        this.onSelected = onSelect;
        this.opts = opts;
    }

    getSuggestions(query: string): (TFile | TFolder)[] {
        const items = getSuggestItems(this.app, this.opts);
        const q = query.toLowerCase();

        return items.filter((item) => {
            const text = suggestItemText(item).toLowerCase();
            // Match against basename or full path — fuzzy-ish substring match
            if (text.includes(q)) return true;

            // Also match individual path segments for folder navigation
            const segments = item.path.toLowerCase().split("/");
            return segments.some((seg) => seg.includes(q));
        });
    }

    renderSuggestion(item: TFile | TFolder, el: HTMLElement): void {
        if (item instanceof TFolder) {
            el.createSpan({ text: "📁 ", cls: "chat-flow-suggest-icon" });
        } else {
            el.createSpan({ text: "📄 ", cls: "chat-flow-suggest-icon" });
        }
        el.createSpan({ text: suggestItemText(item) });
    }

    selectSuggestion(item: TFile | TFolder, _evt: MouseEvent | KeyboardEvent): void {
        this.inputEl.value = item instanceof TFolder ? item.path + "/" : item.path;
        this.inputEl.dispatchEvent(new Event("input"));
        this.onSelected(item);
        this.close();
    }
}

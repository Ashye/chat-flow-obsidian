import { FuzzySuggestModal, TFile } from "obsidian";

/**
 * Fuzzy file search modal for selecting a target file when moving a message.
 * Filters to markdown files only, excluding system list files.
 */
export class MoveSuggestModal extends FuzzySuggestModal<TFile> {
    private onChoose: (item: TFile) => void;

    constructor(
        app: import("obsidian").App,
        onChoose: (item: TFile) => void
    ) {
        super(app);
        this.onChoose = onChoose;
        this.setPlaceholder("Type file name to move message to...");
        this.setInstructions([
            { command: "↑↓", purpose: "to navigate" },
            { command: "↵", purpose: "to select" },
            { command: "esc", purpose: "to dismiss" },
        ]);
    }

    getItems(): TFile[] {
        const files: TFile[] = [];
        const exclude = ["Chat.md", "Later.md", "Read.md", "Watch.md", "Shop.md"];

        for (const file of this.app.vault.getMarkdownFiles()) {
            if (!exclude.includes(file.path)) {
                files.push(file);
            }
        }
        return files;
    }

    getItemText(item: TFile): string {
        return item.basename;
    }

    onChooseItem(item: TFile, _evt: MouseEvent | KeyboardEvent): void {
        this.onChoose(item);
    }
}

export interface ChatMessage {
    raw: string;
    time: string;
    content: string;
    completed: boolean;
}

export interface ChatDayBlock {
    heading: string;
    messages: ChatMessage[];
}

const HEADING_RE = /^####\s+/;
const CHECKLIST_RE = /^- \[([ xX])\] /;

export function parseChat(text: string): ChatDayBlock[] {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const blocks: ChatDayBlock[] = [];
    let current: ChatDayBlock | null = null;

    for (const line of lines) {
        if (HEADING_RE.test(line)) {
            if (current) blocks.push(current);
            current = { heading: line.trim(), messages: [] };
        } else if (CHECKLIST_RE.test(line) && current) {
            const msg = parseMessageLine(line);
            if (msg) current.messages.push(msg);
        }
    }
    if (current) blocks.push(current);
    return blocks;
}

function parseMessageLine(line: string): ChatMessage | null {
    const match = line.match(CHECKLIST_RE);
    if (!match) return null;

    const completed = match[1].toLowerCase() === "x";
    const afterCheckbox = line.slice(match[0].length);
    const timeMatch = afterCheckbox.match(/^`([^`]+)`\s*/);
    const time = timeMatch ? timeMatch[1] : "";
    const content = timeMatch ? afterCheckbox.slice(timeMatch[0].length) : afterCheckbox;

    return { raw: line, time, content: content.trim(), completed };
}

export function serializeChat(blocks: ChatDayBlock[]): string {
    const parts: string[] = [];
    for (const block of blocks) {
        parts.push(block.heading, "");
        for (const msg of block.messages) {
            const cb = msg.completed ? "- [x]" : "- [ ]";
            const ts = msg.time ? ` \`${msg.time}\`` : "";
            parts.push(`${cb}${ts} ${msg.content}`);
        }
        parts.push("");
    }
    return parts.join("\n").trim() + "\n";
}

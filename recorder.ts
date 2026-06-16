import { Vault, normalizePath, TFile } from "obsidian";

/**
 * Browser MediaRecorder wrapper for recording voice memos.
 * On stop, saves the audio blob to the configured media directory.
 */
export class VoiceRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private stream: MediaStream | null = null;
    private chunks: Blob[] = [];
    private onStateChange?: (state: "idle" | "recording") => void;

    constructor(
        private vault: Vault,
        private mediaDir: string,
        private onRecordingSaved: (fileName: string) => void
    ) {}

    setStateCallback(cb: (state: "idle" | "recording") => void): void {
        this.onStateChange = cb;
    }

    get isRecording(): boolean {
        return this.mediaRecorder?.state === "recording";
    }

    async start(): Promise<void> {
        if (this.isRecording) return;

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            console.error("Chat Flow: microphone access denied:", err);
            throw new Error("Microphone access denied or unavailable.");
        }

        this.stream = stream;
        this.chunks = [];

        let mimeType = "audio/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = "";
        }

        this.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.chunks.push(e.data);
        };
        this.mediaRecorder.onstop = () => this.handleStop();
        this.mediaRecorder.start();
        this.onStateChange?.("recording");
    }

    stop(): void {
        if (!this.mediaRecorder || this.mediaRecorder.state !== "recording") return;
        this.mediaRecorder.stop();
    }

    private async handleStop(): Promise<void> {
        // Release mic
        if (this.stream) {
            this.stream.getTracks().forEach((t) => t.stop());
            this.stream = null;
        }
        this.onStateChange?.("idle");

        if (this.chunks.length === 0) return;

        const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
        const ext = this.getExtension(mimeType);
        const blob = new Blob(this.chunks, { type: mimeType });
        this.chunks = [];

        const fileName = this.generateFileName(ext);
        const arrayBuf = await blob.arrayBuffer();

        // Ensure media directory exists
        const dir = this.mediaDir.replace(/\/$/, "");
        let dirFile = this.vault.getAbstractFileByPath(normalizePath(dir));
        if (!dirFile) {
            await this.vault.createFolder(normalizePath(dir));
        }

        const filePath = normalizePath(`${dir}/${fileName}`);
        await this.vault.createBinary(filePath, arrayBuf);

        this.onRecordingSaved(fileName);
    }

    private generateFileName(ext: string): string {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const yyyy = now.getFullYear();
        const hh = String(now.getHours()).padStart(2, "0");
        const mi = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        return `${dd}.${mm}.${yyyy} ${hh}h${mi}m${ss}s.${ext}`;
    }

    private getExtension(mimeType: string): string {
        const map: Record<string, string> = {
            "audio/webm": "webm",
            "audio/mp4": "mp4",
            "audio/mpeg": "mp3",
            "audio/ogg": "ogg",
            "audio/wav": "wav",
        };
        return map[mimeType.split(";")[0]] || "webm";
    }
}

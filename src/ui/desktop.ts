// The desktop app (Electron) exposes window.desktop: saves as files + updates. In a plain browser it is absent.

export interface UpdateEvent { kind: 'available' | 'progress' | 'ready'; version?: string; percent?: number; notes?: string }

export interface DesktopBridge {
  readSave(): string | null;
  writeSave(json: string): boolean;
  saveDir(): Promise<string>;
  openSaveDir(): Promise<string>;
  exportSave(json: string): Promise<string | null>;
  importSave(): Promise<string | null>;
  version(): Promise<string>;
  installUpdate(): Promise<void>;
  onUpdate(cb: (e: UpdateEvent) => void): () => void;
}

export const desktop: DesktopBridge | undefined = typeof window !== 'undefined' ? (window as unknown as { desktop?: DesktopBridge }).desktop : undefined;

// apps/web/src/lib/nfc/web-nfc.d.ts
// NDEFReader is a Chrome-only API not yet in @types/web.
// These minimal declarations let TypeScript compile without errors.

interface NDEFRecord {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: DataView;
  encoding?: string;
  lang?: string;
}

interface NDEFMessage {
  records: NDEFRecord[];
}

interface NDEFReadingEvent extends Event {
  serialNumber: string;
  message: NDEFMessage;
}

interface NDEFScanOptions {
  signal?: AbortSignal;
}

declare class NDEFReader extends EventTarget {
  scan(options?: NDEFScanOptions): Promise<void>;
  write(message: NDEFMessage | string, options?: NDEFScanOptions): Promise<void>;
  addEventListener(
    type: "reading",
    callback: (event: NDEFReadingEvent) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(
    type: "readingerror",
    callback: (event: Event) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
}
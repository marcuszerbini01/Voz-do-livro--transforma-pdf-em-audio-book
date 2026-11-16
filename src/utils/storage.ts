import type { Book, VoiceName } from "../types/book";

const DB_NAME = "vozlivro_db";
const DB_VERSION = 1;
const STORE_BOOKS = "books";
const STORE_AUDIO = "audio_cache";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        db.createObjectStore(STORE_BOOKS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        db.createObjectStore(STORE_AUDIO, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllBooks(): Promise<Book[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BOOKS, "readonly");
    const store = tx.objectStore(STORE_BOOKS);
    const req = store.getAll();
    req.onsuccess = () => {
      const list = (req.result as Book[]).sort(
        (a, b) => (b.lastPlayedAt ?? b.createdAt) - (a.lastPlayedAt ?? a.createdAt)
      );
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveBook(book: Book): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BOOKS, "readwrite");
    tx.objectStore(STORE_BOOKS).put(book);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteBook(bookId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_BOOKS, STORE_AUDIO], "readwrite");
    tx.objectStore(STORE_BOOKS).delete(bookId);

    const audioStore = tx.objectStore(STORE_AUDIO);
    const cursorReq = audioStore.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        if (typeof cursor.key === "string" && cursor.key.startsWith(`${bookId}::`)) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function makeAudioCacheKey(
  bookId: string,
  chapterId: string,
  segmentIndex: number,
  voiceName: VoiceName
): string {
  return `${bookId}::${chapterId}::${segmentIndex}::${voiceName}`;
}

export async function getCachedAudioBlob(key: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_AUDIO, "readonly");
      const req = tx.objectStore(STORE_AUDIO).get(key);
      req.onsuccess = () => {
        const record = req.result as { key: string; blob: Blob } | undefined;
        resolve(record?.blob ?? null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setCachedAudioBlob(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_AUDIO, "readwrite");
      tx.objectStore(STORE_AUDIO).put({ key, blob, savedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore storage quota errors cleanly
  }
}

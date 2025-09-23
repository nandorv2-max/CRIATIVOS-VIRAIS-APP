import { nanoid } from 'nanoid';

export interface Palette {
    id: string;
    name: string;
    colors: string[];
}

const DB_NAME = 'GenIAPalettesDB';
const STORE_NAME = 'palettes';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject('Error opening IndexedDB for palettes.');
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
    return dbPromise;
}

export async function getPalettes(): Promise<Palette[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result || []);
        };
        request.onerror = () => {
            console.error('Error getting palettes from IndexedDB:', request.error);
            reject(request.error);
        };
    });
}

export async function savePalette(palette: Palette): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(palette);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            console.error('Error saving palette to IndexedDB:', transaction.error);
            reject(transaction.error);
        };
    });
}

export async function deletePalette(id: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete(id);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            console.error('Error deleting palette from IndexedDB:', transaction.error);
            reject(transaction.error);
        };
    });
}


const DB_NAME = 'CreativeEditorDB';
const STORE_NAME = 'projects';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

function getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject('Error opening IndexedDB.');
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const dbInstance = (event.target as IDBOpenDBRequest).result;
            if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
                dbInstance.createObjectStore(STORE_NAME);
            }
        };
    });
}

export async function setItem<T>(key: IDBValidKey, value: T): Promise<void> {
    const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(value, key);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            console.error('Error setting item in IndexedDB:', transaction.error);
            reject(transaction.error);
        };
    });
}

export async function getItem<T>(key: IDBValidKey): Promise<T | null> {
    const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
            resolve(request.result || null);
        };
        request.onerror = () => {
            console.error('Error getting item from IndexedDB:', request.error);
            reject(request.error);
        };
    });
}

export async function keyExists(key: IDBValidKey): Promise<boolean> {
     const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
            resolve(request.result !== undefined);
        };

        request.onerror = () => {
            console.error('Error checking key existence in IndexedDB:', request.error);
            reject(request.error);
        };
    });
}

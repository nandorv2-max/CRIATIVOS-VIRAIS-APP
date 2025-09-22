import type { Creation, Project } from '../types.ts';

const DB_NAME = 'CreativeEditorDB';
const PROJECTS_STORE_NAME = 'projects';
const CREATIONS_STORE_NAME = 'creations';
const USER_PROJECTS_STORE_NAME = 'userProjects';
const DB_VERSION = 3;

let db: IDBDatabase | null = null;

function getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }
        
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

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
            if (!dbInstance.objectStoreNames.contains(PROJECTS_STORE_NAME)) {
                dbInstance.createObjectStore(PROJECTS_STORE_NAME);
            }
            if (!dbInstance.objectStoreNames.contains(CREATIONS_STORE_NAME)) {
                dbInstance.createObjectStore(CREATIONS_STORE_NAME, { keyPath: 'id' });
            }
            if (!dbInstance.objectStoreNames.contains(USER_PROJECTS_STORE_NAME)) {
                dbInstance.createObjectStore(USER_PROJECTS_STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

export async function setItem<T>(key: IDBValidKey, value: T): Promise<void> {
    const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(PROJECTS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(PROJECTS_STORE_NAME);
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
        const transaction = dbInstance.transaction(PROJECTS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(PROJECTS_STORE_NAME);
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

export async function removeItem(key: IDBValidKey): Promise<void> {
    const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(PROJECTS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(PROJECTS_STORE_NAME);
        store.delete(key);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
            console.error('Error removing item from IndexedDB:', transaction.error);
            reject(transaction.error);
        };
    });
}


export async function keyExists(key: IDBValidKey): Promise<boolean> {
     const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(PROJECTS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(PROJECTS_STORE_NAME);
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

export async function addCreation(creation: Creation): Promise<void> {
    const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(CREATIONS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(CREATIONS_STORE_NAME);
        const request = store.put(creation);

        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Error adding creation to IndexedDB:', request.error);
            reject(request.error);
        };
    });
}

export async function getCreations(): Promise<Creation[]> {
    const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(CREATIONS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(CREATIONS_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const sorted = request.result.sort((a, b) => b.timestamp - a.timestamp);
            resolve(sorted);
        };
        request.onerror = () => {
            console.error('Error getting creations from IndexedDB:', request.error);
            reject(request.error);
        };
    });
}

export async function deleteCreation(id: string): Promise<void> {
    const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(CREATIONS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(CREATIONS_STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => {
            console.error('Error deleting creation from IndexedDB:', request.error);
            reject(request.error);
        };
    });
}

// === User Projects ===
export async function saveProject(project: Project): Promise<void> {
    const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(USER_PROJECTS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(USER_PROJECTS_STORE_NAME);
        store.put(project);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

export async function getProjects(): Promise<Project[]> {
    const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(USER_PROJECTS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(USER_PROJECTS_STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
            const sorted = request.result.sort((a, b) => b.lastModified - a.lastModified);
            resolve(sorted);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function deleteProject(id: string): Promise<void> {
    const dbInstance = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(USER_PROJECTS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(USER_PROJECTS_STORE_NAME);
        store.delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}
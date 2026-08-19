/**
 * 編集中の画像(背景・アバター・OGP画像・アプリアイコン)を端末(IndexedDB)に保存し、
 * 保存ボタンを押す前にページを再読み込みしても編集内容が失われないようにするヘルパー。
 * 旧Cloudflare Worker版の操作画面(docs/index.html)で使っていた仕組みを移植したもの。
 */
const DB_NAME = 'profileSaasDraftDB';
const STORE = 'images';

function openImageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** userIdごとに名前空間を分けたキーを作る(同じ端末を複数アカウントで使う場合の混在を防ぐ) */
function draftKey(userId: string, name: string) {
  return `${userId}:${name}`;
}

export async function putDraftImage(userId: string, name: string, blob: Blob): Promise<void> {
  try {
    const db = await openImageDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, draftKey(userId, name));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IndexedDBが使えない環境では諦める(致命的ではない)
  }
}

export async function getDraftImage(userId: string, name: string): Promise<Blob | null> {
  try {
    const db = await openImageDB();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(draftKey(userId, name));
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearDraftImages(userId: string, names: string[]): Promise<void> {
  try {
    const db = await openImageDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      names.forEach((name) => store.delete(draftKey(userId, name)));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // noop
  }
}

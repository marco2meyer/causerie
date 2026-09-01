import { delCardImg, pullCardImg, pushCardImg } from './supa';

/** Card images (Fluent-Forever memory hooks) live OUTSIDE the profile memory: a data
 *  URL is 30-60 KB and the profile blob syncs on every save, so embedding images would
 *  multiply that traffic and strain the localStorage quota. They sit in IndexedDB
 *  locally and mirror to Supabase (own-row RLS) so other devices can fetch on demand;
 *  the card itself only carries a 1-byte flag (card.img). */

const DB = 'causerie-img';
const STORE = 'img';
let dbP: Promise<IDBDatabase | null> | null = null;

function db(): Promise<IDBDatabase | null> {
  if (dbP) return dbP;
  dbP = new Promise(resolve => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbP;
}

function tx(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<unknown> {
  return db().then(d => d ? new Promise(resolve => {
    try {
      const r = run(d.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  }) : undefined);
}

/** Local first, Supabase as the cross-device fallback (result is cached back). */
export async function imgLoad(cardId: string): Promise<string | null> {
  const local = (await tx('readonly', s => s.get(cardId))) as string | undefined;
  if (local) return local;
  const remote = await pullCardImg(cardId);
  if (remote) void tx('readwrite', s => s.put(remote, cardId));
  return remote;
}

/** Every card id this device holds a picture for. Local only on purpose: the reuse picker
 *  offers what can be shown instantly, and a grid of thumbnails is not worth a round trip
 *  per tile to the server. */
export async function imgKeys(): Promise<string[]> {
  const keys = (await tx('readonly', s => s.getAllKeys())) as IDBValidKey[] | undefined;
  return (keys ?? []).filter((k): k is string => typeof k === 'string');
}

export async function imgSave(cardId: string, dataUrl: string): Promise<void> {
  await tx('readwrite', s => s.put(dataUrl, cardId));
  void pushCardImg(cardId, dataUrl); // best-effort mirror
}

export async function imgRemove(cardId: string): Promise<void> {
  await tx('readwrite', s => s.delete(cardId));
  void delCardImg(cardId);
}

/** Shrinks any image source to a card-sized JPEG data URL (iOS canvas has no webp). */
export function downscale(src: Blob | string, max = 700, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    img.onload = () => {
      try {
        const f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * f));
        const h = Math.max(1, Math.round(img.naturalHeight * f));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d')!;
        g.fillStyle = '#fff'; // photos with alpha flatten onto white
        g.fillRect(0, 0, w, h);
        g.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      } catch (e) { reject(e as Error); } finally {
        if (typeof src !== 'string') URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { if (typeof src !== 'string') URL.revokeObjectURL(url); reject(new Error('image illisible')); };
    img.src = url;
  });
}

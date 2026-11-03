// The files attached to a move (the supporting document of an exit, the Charged Deduction documents). The history keeps
// only a file's name, type and size; the file itself is kept here, in the browser's own file storage (IndexedDB), under
// the id of the record it belongs to, so it still opens after a reload. In the real system these are stored files behind
// signed URLs. Storage can be unavailable (a private window, blocked site data): saving then quietly does nothing and
// the file opens only in the session that attached it.
const DB_NAME = 'ams-assets-files'
const STORE = 'files'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveFile(id: string, file: Blob): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(file, id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch { /* storage unavailable */ }
}

export async function loadFile(id: string): Promise<Blob | undefined> {
  try {
    const db = await open()
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id)
      req.onsuccess = () => resolve(req.result as Blob | undefined)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return blob
  } catch { return undefined }
}

export async function clearFiles(): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch { /* nothing to clear */ }
}

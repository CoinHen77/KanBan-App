import { db } from './firebase.js';
import { doc, setDoc, getDoc, updateDoc, onSnapshot, deleteDoc } from 'firebase/firestore';

export const ADOPTED_UID_KEY = 'kanban-adopted-uid';

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function genCode() {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

function codeRef(code) {
  return doc(db, 'pairing_codes', code);
}

// Host: create a pairing code in Firestore
export async function createPairingCode(hostAuthUid) {
  const code = genCode();
  await setDoc(codeRef(code), {
    hostUid: hostAuthUid,
    status: 'waiting',
    expires: Date.now() + 5 * 60 * 1000,
  });
  return code;
}

// Host: watch the code document — when guest accepts, create linkedDevices entry
export function watchPairingCode(code, hostAuthUid, onLinked, onError) {
  return onSnapshot(codeRef(code), async snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status !== 'accepted' || !data.guestUid) return;

    try {
      await setDoc(
        doc(db, 'users', hostAuthUid, 'linkedDevices', data.guestUid),
        { linkedAt: new Date().toISOString() }
      );
      await updateDoc(codeRef(code), { status: 'linked' });
      setTimeout(() => deleteDoc(codeRef(code)).catch(() => {}), 5000);
      onLinked(data.guestUid);
    } catch (e) {
      onError(e.message);
    }
  });
}

// Guest: submit code, wait for host to link
export async function submitPairingCode(code, guestAuthUid, onSuccess, onError) {
  try {
    const snap = await getDoc(codeRef(code));
    if (!snap.exists()) { onError('Code not found.'); return null; }
    const data = snap.data();
    if (data.expires < Date.now()) { onError('Code has expired.'); return null; }
    if (data.status !== 'waiting') { onError('Code already used.'); return null; }

    await updateDoc(codeRef(code), { status: 'accepted', guestUid: guestAuthUid });

    const timeout = setTimeout(() => {
      unsub();
      onError('Timed out — make sure the other device has the modal open.');
    }, 30000);

    const unsub = onSnapshot(codeRef(code), snap => {
      if (!snap.exists()) return;
      if (snap.data().status === 'linked') {
        clearTimeout(timeout);
        unsub();
        localStorage.setItem(ADOPTED_UID_KEY, snap.data().hostUid);
        onSuccess(snap.data().hostUid);
      }
    });

    return unsub;
  } catch (e) {
    onError(e.message);
    return null;
  }
}

export async function cancelPairingCode(code, hostAuthUid) {
  try {
    const snap = await getDoc(codeRef(code));
    if (snap.exists() && snap.data().hostUid === hostAuthUid) {
      await deleteDoc(codeRef(code));
    }
  } catch {}
}

export function getAdoptedUid() {
  try { return localStorage.getItem(ADOPTED_UID_KEY); } catch { return null; }
}

export function unlinkDevice() {
  try { localStorage.removeItem(ADOPTED_UID_KEY); } catch {}
}

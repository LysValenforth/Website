const galleryDB = firebase.firestore();

// ── Get all collections ───────────────────────────────────────────────────────
async function getAllGalleryCollections() {
  const snap = await galleryDB.collection('gallery').get();
  const result = {};
  snap.forEach(doc => { result[doc.id] = doc.data(); });
  return result;
}

// ── Get one collection ────────────────────────────────────────────────────────
async function getGalleryCollection(key) {
  const doc = await galleryDB.collection('gallery').doc(key).get();
  return doc.exists ? doc.data() : null;
}

// ── Save / overwrite a collection ─────────────────────────────────────────────
async function setGalleryCollection(key, data) {
  await galleryDB.collection('gallery').doc(key).set(data, { merge: true });
}

// ── Add a single photo to a collection ───────────────────────────────────────
async function addPhotoToCollection(key, photo) {
  const ref  = galleryDB.collection('gallery').doc(key);
  const doc  = await ref.get();
  const existing = doc.exists ? (doc.data().photos || []) : [];
  existing.push(photo);
  await ref.set({ photos: existing }, { merge: true });
}

// ── Remove a photo by index ───────────────────────────────────────────────────
async function removePhotoFromCollection(key, index) {
  const ref    = galleryDB.collection('gallery').doc(key);
  const doc    = await ref.get();
  if (!doc.exists) return;
  const photos = doc.data().photos || [];
  photos.splice(index, 1);
  await ref.set({ photos }, { merge: true });
}

// ── Update collection metadata (title, description, coverSrc) ─────────────────
async function updateCollectionMeta(key, meta) {
  await galleryDB.collection('gallery').doc(key).set(meta, { merge: true });
}
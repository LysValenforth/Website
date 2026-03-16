const firebaseConfig = {
  apiKey: "AIzaSyDSFBtet9xqOBAMqsKSB1fILQn909LUSrI",
  authDomain: "lines-by-lin.firebaseapp.com",
  projectId: "lines-by-lin",
  storageBucket: "lines-by-lin.firebasestorage.app",
  messagingSenderId: "219315667135",
  appId: "1:219315667135:web:956a6ec0c040f79f8a860a"
};

// ── Init ─────────────────────────────────────────────────────────────────────
firebase.initializeApp(firebaseConfig);

const db      = firebase.firestore();
const storage = firebase.storage();
console.log('Firebase Connected');

// ── Collection references ─────────────────────────────────────────────────────
const postsRef    = db.collection('posts');
const mediahubRef = db.collection('mediahub');

// ── Shared sort helper (avoids composite index requirement) ───────────────────
function byDateDesc(a, b) {
  return new Date(b.date || 0) - new Date(a.date || 0);
}

// ── Posts ─────────────────────────────────────────────────────────────────────

async function getAllPosts() {
  const snapshot = await postsRef.get();
  const results  = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  results.sort(byDateDesc);
  console.log('Data Loaded: posts', results.length);
  return results;
}

async function getPostsByCategory(category) {
  const snapshot = await postsRef.where('category', '==', category).get();
  const results  = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  results.sort(byDateDesc);
  console.log('Data Loaded: posts[' + category + ']', results.length);
  return results;
}

async function getPostById(id) {
  const snap = await postsRef.doc(id).get();
  if (snap.exists) return { id: snap.id, ...snap.data() };
  return null;
}

async function createPost(data) {
  const ref = await postsRef.add({
    title:    data.title    || 'Untitled',
    content:  data.content  || '',
    category: data.category || 'blog',
    date:     data.date     || new Date().toISOString(),
    sections: data.sections || [],
    imageURL: data.imageURL || ''
  });
  console.log('Data Saved: post created', ref.id);
  return ref.id;
}

async function updatePost(id, data) {
  await postsRef.doc(id).update(data);
  console.log('Data Saved: post updated', id);
}

async function deletePost(id) {
  await postsRef.doc(id).delete();
  console.log('Data Saved: post deleted', id);
}

// ── MediaHub ──────────────────────────────────────────────────────────────────

async function getAllMediaHub() {
  const snapshot = await mediahubRef.get();
  const results  = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  results.sort(byDateDesc);
  console.log('Data Loaded: mediahub', results.length);
  return results;
}

async function getMediaHubByCategory(category) {
  const snapshot = await mediahubRef.where('category', '==', category).get();
  const results  = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  results.sort(byDateDesc);
  console.log('Data Loaded: mediahub[' + category + ']', results.length);
  return results;
}

async function getMediaHubById(id) {
  const snap = await mediahubRef.doc(id).get();
  if (snap.exists) return { id: snap.id, ...snap.data() };
  return null;
}

async function createMediaHub(data) {
  const ref = await mediahubRef.add({
    title:       data.title       || 'Untitled',
    category:    data.category    || 'beats',
    genre:       data.genre       || '',
    description: data.description || '',
    creator:     data.creator     || '',
    stars:       data.stars       || '',
    imageURL:    data.imageURL    || '',
    videoURL:    data.videoURL    || '',
    songLink:    data.songLink    || '',
    artistLink:  data.artistLink  || '',
    infoLink:    data.infoLink    || '',
    audioURL:    data.audioURL    || '',
    date:        data.date        || new Date().toISOString()
  });
  console.log('Data Saved: mediahub created', ref.id);
  return ref.id;
}

async function updateMediaHub(id, data) {
  await mediahubRef.doc(id).update(data);
  console.log('Data Saved: mediahub updated', id);
}

async function deleteMediaHub(id) {
  await mediahubRef.doc(id).delete();
  console.log('Data Saved: mediahub deleted', id);
}

// ── Storage ───────────────────────────────────────────────────────────────────

async function uploadImage(file, onProgress) {
  const fileName   = `images/${Date.now()}_${file.name}`;
  const storageRef = storage.ref(fileName);
  const task       = storageRef.put(file);

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
        if (onProgress) onProgress(pct);
      },
      (err) => reject(err),
      async () => {
        const url = await task.snapshot.ref.getDownloadURL();
        console.log('Data Saved: image uploaded');
        resolve(url);
      }
    );
  });
}

console.log('Firestore Loaded');
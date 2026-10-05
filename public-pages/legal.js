import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  collection,
  getDocs,
  getFirestore,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAL5iE73tRc9YbY7jGWya65Q8Pl_Kd831M',
  authDomain: 'loane-code.firebaseapp.com',
  projectId: 'loane-code',
  storageBucket: 'loane-code.firebasestorage.app',
  messagingSenderId: '384488190763',
  appId: '1:384488190763:web:13e9baa2efd0b10815cb6e',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const kind = document.body.dataset.legalKind;
const title = document.querySelector('[data-title]');
const meta = document.querySelector('[data-meta]');
const content = document.querySelector('[data-content]');

render();

async function render() {
  try {
    const snap = await getDocs(collection(db, 'legalDocs'));
    const latest = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((doc) => doc.kind === kind)
      .sort((a, b) => b.version - a.version)[0];

    if (!latest) throw new Error('missing');
    document.title = `${latest.title} | Loane`;
    title.textContent = latest.title;
    meta.textContent = `Version ${latest.version} · Effective ${latest.effectiveDate}`;
    content.innerHTML = markdownToHtml(latest.text);
  } catch {
    title.textContent = 'Loane legal';
    meta.textContent = '';
    content.textContent = 'This document is not available right now.';
  }
}

function markdownToHtml(markdown) {
  return markdown
    .split('\n')
    .map((line) => {
      const text = escapeHtml(line.trimEnd())
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
      if (!text.trim()) return '<br />';
      if (text.startsWith('# ')) return `<h1>${text.replace(/^#\s+/, '')}</h1>`;
      if (text.startsWith('## ')) return `<h2>${text.replace(/^##\s+/, '')}</h2>`;
      if (text.startsWith('- ')) return `<p class="bullet">&bull; ${text.slice(2)}</p>`;
      if (text.startsWith('|')) return `<pre>${text}</pre>`;
      return `<p>${text}</p>`;
    })
    .join('');
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

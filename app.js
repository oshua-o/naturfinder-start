/* ---------- Fotos lokal auf dem Gerät ---------- */
const DB_NAME = 'tierlist';
const DB_VERSION = 2;
const STORE = 'photos';
const CUSTOM_STORE = 'customSpecies';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(CUSTOM_STORE)) {
        db.createObjectStore(CUSTOM_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(name);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetAllCustom() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CUSTOM_STORE, 'readonly');
    const req = tx.objectStore(CUSTOM_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbAddCustom(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CUSTOM_STORE, 'readwrite');
    const req = tx.objectStore(CUSTOM_STORE).add(record);
    req.onsuccess = () => resolve(req.result); // generierte id
    req.onerror = () => reject(req.error);
  });
}

async function dbDeleteCustom(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CUSTOM_STORE, 'readwrite');
    tx.objectStore(CUSTOM_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------- Kategorien ---------- */
const CATEGORIES = [
  { key: 'BAEUME',      list: BAEUME,      homeLabel: 'Bäume',                    pageTitle: 'Bäume',                   subtitle: 'Diese 22 Bäume kommen in Deutschland häufig vor und sind hier heimisch. Manche (wie Eibe und Hainbuche) bestehen nur aus einer Art, andere (wie Weide oder Pappel) aus sehr vielen verschiedenen, die auch sehr unterschiedlich aussehen können.' },
  { key: 'PFLANZEN',    list: PFLANZEN,    homeLabel: 'Pflanzen (ohne Bäume)',    pageTitle: 'Pflanzen (ohne Bäume)',   subtitle: 'Hier findest Du häufige Pflanzen, die keine Bäume sind. Viele davon erkennst gut an ihren Blüten, die sich deutlich von anderen Pflanze unterscheiden.' },
  { key: 'VOEGEL',      list: VOEGEL,      homeLabel: 'Vögel',                    pageTitle: 'Vögel',                   subtitle: 'Diese Vögel sind in Deutschland zuhause und Du kannst sie gut auseinander halten. Allerdings gibt es noch viel mehr Vögel. Diese kannst Du unten unter "Eigene Art hinzufügen" ergänzen.' },
  { key: 'SAEUGETIERE', list: SAEUGETIERE, homeLabel: 'Säugetiere',               pageTitle: 'Säugetiere',              subtitle: 'Diese 32 Säugetiere kommen in Deutschland heimisch vor. Von manchen gibt es nur eine Art (wie z.B. das Wildschwein), von anderen gibt es ganz viele (z.B. Mäuse, viele davon sind nicht einmal nah miteinander verwandt).' },
  { key: 'AMPHIBIEN',   list: AMPHIBIEN,   homeLabel: 'Amphibien',                pageTitle: 'Amphibien',               subtitle: 'Diese fünf Gruppen von Amphibien gibt es in Deutschland. Jede davon besteht aus mehreren Unterarten, die teilweise auch sehr unterschiedlich aussehen können.' },
  { key: 'REPTILIEN',   list: REPTILIEN,   homeLabel: 'Reptilien',                pageTitle: 'Reptilien',               subtitle: 'Es gibt nur vier Gruppen von Reptilien in Deutschland. Du kannst sie gut voneinander unterscheiden. Allerdings gibt es von fast allen mehrere Arten, die unterschiedlich aussehen können.' },
  { key: 'INSEKTEN',    list: INSEKTEN,    homeLabel: 'Insekten',                 pageTitle: 'Insekten',                subtitle: 'Diese 32 Insekten kannst Du leicht in Deutschland finden. Einige Gruppen (wie z.B. Schmetterlinge) sind aber sehr groß und sehr vielfältig.' },
  { key: 'WIRBELLOSE',  list: WIRBELLOSE,  homeLabel: 'Wirbellose',               pageTitle: 'Wirbellose',              subtitle: '"Wirbellose" ist ein sehr breiter Begriff, unter den sehr viele Tiere zählen. Diese zwölf sind bekannte Gruppen, die Du gut auseinanderhalten und bestimmen kannst.' },
];

let photos = {};          
let customSpecies = {};   
let activeCategory = null;
let activeSpecies = null;
let showOnlyOpen = false;
let searchTerm = '';

const homeView = document.getElementById('homeView');
const categoryView = document.getElementById('categoryView');
const categoryGrid = document.getElementById('categoryGrid');
const grid = document.getElementById('grid');
const statText = document.getElementById('statText');
const progressFill = document.getElementById('progressFill');
const toast = document.getElementById('toast');

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 1800);
}

function fmtDate(d) {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
}

/* ---------- Bildnachweise ---------- */
function renderCredits() {
  const container = document.getElementById('creditsContent');
  container.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const withPhoto = cat.list.filter(sp => sp.img);
    if (withPhoto.length === 0) return;
    const h3 = document.createElement('h3');
    h3.textContent = cat.homeLabel;
    container.appendChild(h3);
    withPhoto.forEach(sp => {
      const div = document.createElement('div');
      div.className = 'credits-item';
      div.innerHTML = `<div class="cn">${sp.n}</div><div class="ca">${sp.attribution || ''}</div>`;
      container.appendChild(div);
    });
  });
}

const creditsBackdrop = document.getElementById('creditsBackdrop');
document.getElementById('creditsBtn').addEventListener('click', () => {
  renderCredits();
  creditsBackdrop.classList.add('open');
});
document.getElementById('closeCredits').addEventListener('click', () => {
  creditsBackdrop.classList.remove('open');
});
creditsBackdrop.addEventListener('click', e => { if (e.target === creditsBackdrop) creditsBackdrop.classList.remove('open'); });

/* ---------- Fortschritt ---------- */
function categoryProgress(cat) {
  const customCount = (customSpecies[cat.key] || []).length;
  const total = cat.list.length + customCount;
  const done = cat.list.filter(sp => photos[sp.n]).length + customCount;
  return { done, total };
}

/* ---------- Startseite ---------- */
function renderHome() {
  categoryGrid.innerHTML = '';
  const frag = document.createDocumentFragment();

  CATEGORIES.forEach(cat => {
    const { done, total } = categoryProgress(cat);
    const pct = total ? Math.round((done / total) * 100) : 0;

    const tile = document.createElement('div');
    tile.className = 'category-tile';
    tile.innerHTML = `
      <div class="category-tile-label">${cat.homeLabel}</div>
      <div class="category-tile-progress">
        <div class="category-tile-track"><div class="category-tile-fill" style="width:${pct}%"></div></div>
        <div class="category-tile-frac">${done}/${total}</div>
      </div>
    `;
    tile.addEventListener('click', () => openCategory(cat));
    frag.appendChild(tile);
  });

  categoryGrid.appendChild(frag);
}

/* ---------- Kategorieseite ---------- */
function openCategory(cat) {
  activeCategory = cat;
  searchTerm = '';
  showOnlyOpen = false;
  document.getElementById('searchInput').value = '';
  filterBtn.setAttribute('aria-pressed', 'false');
  filterBtn.textContent = 'noch nicht gefunden';

  document.getElementById('categoryTitle').textContent = cat.pageTitle;
  document.getElementById('categorySubtitle').textContent = cat.subtitle;

  homeView.style.display = 'none';
  categoryView.style.display = 'block';
  window.scrollTo(0, 0);

  history.pushState({ category: cat.key }, '', '');  // <-- neu

  renderCategory();
}

document.getElementById('backBtn').addEventListener('click', () => {
  history.back();
});

window.addEventListener('popstate', () => {
  categoryView.style.display = 'none';
  homeView.style.display = 'block';
  renderHome();
});

/* ---------- PDF-Export ---------- */
function blobToJpegDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht geladen werden')); };
    img.src = url;
  });
}

async function exportCategoryPdf() {
  const withPhotos = activeCategory.list.filter(sp => photos[sp.n]);
  if (withPhotos.length === 0) {
    showToast('Noch keine Fotos in dieser Kategorie');
    return;
  }
  showToast('PDF wird erstellt…');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const imgSize = 70;
  const colsPerRow = 2;
  const colWidth = (pageWidth - margin * 2 - 10) / colsPerRow;

  doc.setFontSize(18);
  doc.text(activeCategory.pageTitle, margin, 20);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text('Naturfinder – ' + new Date().toLocaleDateString('de-DE'), margin, 27);
  doc.setTextColor(0);

  let x = margin;
  let y = 35;
  let col = 0;

  for (const sp of withPhotos) {
    const rec = photos[sp.n];

    if (y + imgSize + 30 > pageHeight - margin) {
      doc.addPage();
      y = 20;
      col = 0;
      x = margin;
    }

    try {
      const dataUrl = await blobToJpegDataUrl(rec.blob);
      doc.addImage(dataUrl, 'JPEG', x, y, imgSize, imgSize);
    } catch (e) {
      console.warn('Bild konnte nicht eingefügt werden:', sp.n, e);
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(sp.n, x, y + imgSize + 6);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text(sp.s, x, y + imgSize + 11);
    doc.setFont('helvetica', 'normal');

    let metaY = y + imgSize + 16;
    if (rec.location) { doc.text('Ort: ' + rec.location, x, metaY); metaY += 5; }
    if (rec.obsDate) { doc.text('Datum: ' + fmtDate(new Date(rec.obsDate)), x, metaY); metaY += 5; }
    if (rec.note) {
      const lines = doc.splitTextToSize(rec.note, colWidth);
      doc.text(lines, x, metaY);
    }

    if (col + 1 >= colsPerRow) {
      col = 0;
      x = margin;
      y += imgSize + 35;
    } else {
      col++;
      x += colWidth + 10;
    }
  }

  doc.save(`naturfinder-${activeCategory.key.toLowerCase()}.pdf`);
  showToast('PDF erstellt');
}

document.getElementById('pdfExportBtn').addEventListener('click', exportCategoryPdf);

/* ---------- Kacheln ---------- */
function renderCategory() {
  const term = searchTerm.trim().toLowerCase();
  grid.innerHTML = '';

  const list = activeCategory.list.filter(sp => {
    if (term && !sp.n.toLowerCase().includes(term) && !sp.s.toLowerCase().includes(term)) return false;
    if (showOnlyOpen && photos[sp.n]) return false;
    return true;
  });

  const customList = (customSpecies[activeCategory.key] || []).filter(c => {
    if (term && !c.name.toLowerCase().includes(term) && !(c.sci || '').toLowerCase().includes(term)) return false;
    if (showOnlyOpen) return false; // eigene Arten gelten immer als gefunden
    return true;
  });

  if (list.length === 0 && customList.length === 0) {
    grid.innerHTML = '<div class="empty-msg">nichts gefunden</div>';
  }

  const frag = document.createDocumentFragment();

  list.forEach(sp => {
    const rec = photos[sp.n];
    const card = document.createElement('div');
    card.className = 'card ' + (rec ? 'filled' : 'empty');

    if (rec) {
      const img = document.createElement('img');
      img.src = rec.objectUrl;
      img.alt = sp.n;
      card.appendChild(img);

      const cap = document.createElement('div');
      cap.className = 'caption';
      cap.textContent = sp.n;
      card.appendChild(cap);

      const stamp = document.createElement('div');
      stamp.className = 'stamp';
      stamp.textContent = '✓';
      card.appendChild(stamp);

      card.addEventListener('click', () => openZoom(sp));
    } else {
      card.innerHTML = `
        ${sp.img ? `<img class="hint-img" src="${sp.img}" alt="" loading="lazy" />` : ''}
        <svg class="cam" viewBox="0 0 24 24" fill="none"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" stroke="#4a3a72" stroke-width="1.6"/><circle cx="12" cy="13" r="3.4" stroke="#4a3a72" stroke-width="1.6"/></svg>
        <div class="name">${sp.n}</div>
        <div class="sci">${sp.s}</div>
      `;
      const hintImg = card.querySelector('.hint-img');
      if (hintImg) hintImg.addEventListener('error', () => hintImg.remove());
      card.addEventListener('click', () => openCapture(sp));
    }

    frag.appendChild(card);
  });

  customList.forEach(c => {
    const card = document.createElement('div');
    card.className = 'card custom';
    card.innerHTML = `
      <div class="custom-badge">eigene Art</div>
      <div class="name">${c.name}</div>
      ${c.sci ? `<div class="sci">${c.sci}</div>` : ''}
      <div class="delete-x" title="Löschen">×</div>
    `;
    card.querySelector('.delete-x').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`"${c.name}" wirklich löschen?`)) return;
      await dbDeleteCustom(c.id);
      customSpecies[activeCategory.key] = (customSpecies[activeCategory.key] || []).filter(x => x.id !== c.id);
      showToast(`${c.name} gelöscht`);
      renderCategory();
    });
    frag.appendChild(card);
  });

  // Eigene Art hinzufügen
  const addCard = document.createElement('div');
  addCard.className = 'card add-custom';
  addCard.innerHTML = `<div class="plus">+</div><div class="label">Eigene Art hinzufügen</div>`;
  addCard.addEventListener('click', openCustomForm);
  frag.appendChild(addCard);

  grid.appendChild(frag);
  updateCategoryStats();
}

function updateCategoryStats() {
  const { done, total } = categoryProgress(activeCategory);
  const pct = total ? Math.round((done / total) * 100) : 0;
  statText.textContent = `${done} / ${total} (${pct}%)`;
  progressFill.style.width = pct + '%';
}

/* ---------- Eigene Art hinzufügen ---------- */
const customBackdrop = document.getElementById('customBackdrop');
const customName = document.getElementById('customName');
const customSci = document.getElementById('customSci');

function openCustomForm() {
  customName.value = '';
  customSci.value = '';
  customBackdrop.classList.add('open');
  customName.focus();
}
function closeCustomForm() {
  customBackdrop.classList.remove('open');
}
document.getElementById('cancelCustom').addEventListener('click', closeCustomForm);
customBackdrop.addEventListener('click', e => { if (e.target === customBackdrop) closeCustomForm(); });

document.getElementById('customSubmitBtn').addEventListener('click', async () => {
  const name = customName.value.trim();
  const sci = customSci.value.trim();
  if (!name) { customName.focus(); return; }

  const record = { category: activeCategory.key, name, sci, date: Date.now() };
  const id = await dbAddCustom(record);
  record.id = id;
  if (!customSpecies[activeCategory.key]) customSpecies[activeCategory.key] = [];
  customSpecies[activeCategory.key].push(record);

  closeCustomForm();
  showToast(`${name} hinzugefügt`);
  renderCategory();
});


const captureBackdrop = document.getElementById('captureBackdrop');
const captureName = document.getElementById('captureName');
const captureSci = document.getElementById('captureSci');
const camInput = document.getElementById('camInput');
const libInput = document.getElementById('libInput');

function openCapture(sp) {
  activeSpecies = sp;
  const hintPhoto = document.getElementById('captureHintPhoto');
  if (sp.img) {
    hintPhoto.src = sp.img;
    hintPhoto.style.display = 'block';
  } else {
    hintPhoto.style.display = 'none';
  }
  captureName.textContent = sp.n;
  captureSci.textContent = sp.s;
  captureBackdrop.classList.add('open');
}
function closeCapture() {
  captureBackdrop.classList.remove('open');
}
document.getElementById('cancelCapture').addEventListener('click', closeCapture);
captureBackdrop.addEventListener('click', e => { if (e.target === captureBackdrop) closeCapture(); });

document.getElementById('btnCamera').addEventListener('click', () => { camInput.value = ''; camInput.click(); });
document.getElementById('btnLibrary').addEventListener('click', () => { libInput.value = ''; libInput.click(); });

/* ---------- Fotos verkleinern ---------- */
let webpSupportChecked = null;
function supportsWebpEncoding() {
  if (webpSupportChecked !== null) return Promise.resolve(webpSupportChecked);
  return new Promise(resolve => {
    const c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    c.toBlob(blob => {
      webpSupportChecked = !!(blob && blob.type === 'image/webp');
      resolve(webpSupportChecked);
    }, 'image/webp');
  });
}

function resizeImage(file, maxWidth, mimeType, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.naturalWidth);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Konnte Bild nicht verkleinern'));
      }, mimeType, quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht geladen werden')); };
    img.src = url;
  });
}

async function prepareForStorage(file) {
  const webp = await supportsWebpEncoding();
  const mimeType = webp ? 'image/webp' : 'image/jpeg';
  try {
    return await resizeImage(file, 800, mimeType, 0.82);
  } catch (e) {
    console.warn('Verkleinern fehlgeschlagen, speichere Original:', e);
    return file; // Fallback: lieber das Originalfoto als gar keins
  }
}

async function handleFile(file) {
  if (!file || !activeSpecies) return;
  const sp = activeSpecies;
  showToast('Foto wird verkleinert…');
  const resized = await prepareForStorage(file);
  const today = new Date().toISOString().slice(0, 10);
  const record = { name: sp.n, blob: resized, date: Date.now(), location: '', obsDate: today, note: '' };
  await dbPut(record);
  const objectUrl = URL.createObjectURL(resized);
  photos[sp.n] = { blob: resized, date: record.date, location: '', obsDate: today, note: '', objectUrl };
  closeCapture();
  showToast(`${sp.n} hinzugefügt`);
  renderCategory();
}

camInput.addEventListener('change', e => handleFile(e.target.files[0]));
libInput.addEventListener('change', e => handleFile(e.target.files[0]));

/* ---------- Notizen (Ort, Datum, Notiz) ---------- */
const noteDisplay = document.getElementById('noteDisplay');
const noteEditFields = document.getElementById('noteEditFields');
const noteLocation = document.getElementById('noteLocation');
const noteObsDate = document.getElementById('noteObsDate');
const noteText = document.getElementById('noteText');
const noteSaveBtn = document.getElementById('noteSaveBtn');

function showNoteDisplay(rec) {
  noteEditFields.style.display = 'none';
  noteSaveBtn.style.display = 'none';
  noteDisplay.style.display = 'block';

  const lines = [];
  if (rec.location) lines.push(`📍 ${rec.location}`);
  if (rec.obsDate) lines.push(`📅 ${fmtDate(new Date(rec.obsDate))}`);
  if (rec.note) lines.push(rec.note);

  if (lines.length) {
    noteDisplay.innerHTML = lines.join('<br>');
    noteDisplay.classList.remove('empty');
  } else {
    noteDisplay.textContent = 'Ort, Datum & Notiz hinzufügen…';
    noteDisplay.classList.add('empty');
  }
}

function showNoteEdit() {
  if (!activeSpecies) return;
  const rec = photos[activeSpecies.n];
  noteDisplay.style.display = 'none';
  noteEditFields.style.display = 'block';
  noteSaveBtn.style.display = 'inline-block';
  noteLocation.value = (rec && rec.location) ? rec.location : '';
  noteObsDate.value = (rec && rec.obsDate) ? rec.obsDate : '';
  noteText.value = (rec && rec.note) ? rec.note : '';
  noteLocation.focus();
}

async function saveNote() {
  if (!activeSpecies) return;
  const sp = activeSpecies;
  const rec = photos[sp.n];
  if (!rec) return;
  rec.location = noteLocation.value.trim();
  rec.obsDate = noteObsDate.value;
  rec.note = noteText.value.trim();
  await dbPut({ name: sp.n, blob: rec.blob, date: rec.date, location: rec.location, obsDate: rec.obsDate, note: rec.note });
  showNoteDisplay(rec);
  showToast('Gespeichert');
}

noteDisplay.addEventListener('click', showNoteEdit);
noteSaveBtn.addEventListener('click', saveNote);



const zoomBackdrop = document.getElementById('zoomBackdrop');
const zoomPhoto = document.getElementById('zoomPhoto');
const zoomName = document.getElementById('zoomName');
const zoomSci = document.getElementById('zoomSci');
const zoomDate = document.getElementById('zoomDate');

function openZoom(sp) {
  activeSpecies = sp;
  const rec = photos[sp.n];
  zoomPhoto.src = rec.objectUrl;
  zoomPhoto.alt = sp.n;
  zoomName.textContent = sp.n;
  zoomSci.textContent = sp.s;
  zoomDate.textContent = 'eingefügt am ' + fmtDate(new Date(rec.date));
  showNoteDisplay(rec);
  zoomBackdrop.classList.add('open');
}
function closeZoom() { zoomBackdrop.classList.remove('open'); }
document.getElementById('closeZoom').addEventListener('click', closeZoom);
zoomBackdrop.addEventListener('click', e => { if (e.target === zoomBackdrop) closeZoom(); });

document.getElementById('deleteBtn').addEventListener('click', async () => {
  if (!activeSpecies) return;
  const sp = activeSpecies;
  if (!confirm(`"${sp.n}" wirklich löschen?`)) return;
  await dbDelete(sp.n);
  if (photos[sp.n]) URL.revokeObjectURL(photos[sp.n].objectUrl);
  delete photos[sp.n];
  closeZoom();
  showToast(`${sp.n} gelöscht`);
  renderCategory();
});

/* ---------- Suche ---------- */
document.getElementById('searchInput').addEventListener('input', e => {
  searchTerm = e.target.value;
  renderCategory();
});
const filterBtn = document.getElementById('filterBtn');
filterBtn.addEventListener('click', () => {
  showOnlyOpen = !showOnlyOpen;
  filterBtn.setAttribute('aria-pressed', String(showOnlyOpen));
  filterBtn.textContent = showOnlyOpen ? 'alle' : 'noch nicht gefunden';
  renderCategory();
});



async function init() {
  const records = await dbGetAll();
  records.forEach(r => {
    photos[r.name] = { blob: r.blob, date: r.date, location: r.location || '', obsDate: r.obsDate || '', note: r.note || '', objectUrl: URL.createObjectURL(r.blob) };
  });

  const customRecords = await dbGetAllCustom();
  customRecords.forEach(r => {
    if (!customSpecies[r.category]) customSpecies[r.category] = [];
    customSpecies[r.category].push(r);
  });

  renderHome();
}
init();



if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
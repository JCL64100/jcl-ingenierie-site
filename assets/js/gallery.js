/* ════════════════════════════════════════════════════════════
   JCL INGÉNIERIE — galerie dynamique
   ════════════════════════════════════════════════════════════

   CONFIGURATION — À COMPLÉTER AVANT MISE EN LIGNE
   ------------------------------------------------
   1. cloudName    → ton "Cloud name" Cloudinary (tableau de bord)
   2. uploadPreset → le nom de ton upload preset "Unsigned"
                     (Settings → Upload → Upload presets)
   3. firebaseUrl  → l'URL de ta Realtime Database Firebase,
                     suivie de "/projets"
                     ex: https://mon-projet-default-rtdb.europe-west1.firebasedatabase.app/projets
   4. password     → le code d'accès au mode admin / à l'ajout de médias

   Tant que ces valeurs ne sont pas renseignées, la galerie
   affiche un message d'information à la place d'une erreur.
   ════════════════════════════════════════════════════════════ */

const CONFIG = {
  cloudName:    'guatvmam',
  uploadPreset: 'jcl_ingenierie',
  firebaseUrl:  'https://jcl-ingenierie-64c07-default-rtdb.europe-west1.firebasedatabase.app/projets',
  password:     '64100*',
};

const isConfigured = () =>
  CONFIG.cloudName !== 'TON_CLOUD_NAME' &&
  CONFIG.uploadPreset !== 'TON_UPLOAD_PRESET' &&
  !CONFIG.firebaseUrl.includes('TON_PROJET');

/* ── STATE ── */
let allMedia   = [];
let folders    = [];
let filtered   = [];
let selected   = new Set();
let curIndex   = 0;
let adminMode  = false;
let curFilter  = 'all';
let curFolder  = '__all__';
let deleteTarget = null;

/* ── FIREBASE HELPERS ── */
async function fetchDB() {
  const r = await fetch(CONFIG.firebaseUrl + '.json');
  if (!r.ok) throw new Error('Firebase lecture ' + r.status);
  const data = await r.json();
  return data || { media: [], folders: [] };
}

async function saveDB(record) {
  const r = await fetch(CONFIG.firebaseUrl + '.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!r.ok) throw new Error('Firebase écriture ' + r.status);
  return r;
}

/* ── INIT / LOAD ── */
async function initGallery() {
  if (!isConfigured()) {
    document.getElementById('gallery').innerHTML = `
      <div class="g-config-notice">
        <strong>Galerie pas encore connectée</strong>
        <p>Renseigne cloudName, uploadPreset, firebaseUrl et password dans
        assets/js/gallery.js pour activer l'ajout et la gestion des photos.</p>
      </div>`;
    document.getElementById('g-controls-row').style.display = 'none';
    return;
  }
  await load();
}

async function load() {
  try {
    const rec = await fetchDB();
    allMedia = (rec.media || []).map((m, i) => ({ ...m, _id: m._id || (Date.now() + i).toString() }));
    folders  = rec.folders || [];
    renderFolders();
    applyFilters();
  } catch (e) {
    document.getElementById('gallery').innerHTML =
      `<div class="g-empty">⚠️ Impossible de charger la galerie (vérifie l'URL Firebase et les règles de lecture).</div>`;
  }
}

/* ── FOLDERS BAR ── */
function renderFolders() {
  const bar = document.getElementById('folders-bar');
  bar.querySelectorAll('.g-folder-chip:not([data-folder="__all__"])').forEach(e => e.remove());
  const newBtn = document.getElementById('btn-new-folder');

  folders.forEach(f => {
    const count = allMedia.filter(m => m.folder === f).length;
    const chip = document.createElement('button');
    chip.className = 'g-folder-chip' + (curFolder === f ? ' is-active' : '');
    chip.dataset.folder = f;

    const del = document.createElement('span');
    del.className = 'g-chip-del';
    del.textContent = '✕';
    del.title = 'Supprimer ce dossier';
    del.addEventListener('click', (e) => { e.stopPropagation(); confirmDeleteFolder(f); });

    chip.appendChild(del);
    chip.appendChild(document.createTextNode(' ' + f + ' '));
    const countSpan = document.createElement('span');
    countSpan.className = 'g-chip-count';
    countSpan.textContent = `(${count})`;
    chip.appendChild(countSpan);

    chip.addEventListener('click', (e) => {
      if (!e.target.classList.contains('g-chip-del')) selectFolder(f, chip);
    });
    bar.insertBefore(chip, newBtn);
  });

  const noFolder = allMedia.filter(m => !m.folder).length;
  if (noFolder > 0) {
    const chip = document.createElement('button');
    chip.className = 'g-folder-chip' + (curFolder === '__none__' ? ' is-active' : '');
    chip.dataset.folder = '__none__';
    chip.innerHTML = `Sans dossier <span class="g-chip-count">(${noFolder})</span>`;
    chip.onclick = () => selectFolder('__none__', chip);
    bar.insertBefore(chip, newBtn);
  }

  newBtn.classList.toggle('g-visible', adminMode);
}

function selectFolder(name, el) {
  curFolder = name;
  document.querySelectorAll('.g-folder-chip').forEach(c => c.classList.remove('is-active'));
  el.classList.add('is-active');
  deselectAll();
  applyFilters();
}

/* ── FILTERS ── */
function setFilter(f, btn) {
  curFilter = f;
  document.querySelectorAll('.g-filter-btn').forEach(b => b.classList.remove('is-active'));
  btn.classList.add('is-active');
  deselectAll();
  applyFilters();
}

function applyFilters() {
  let list = [...allMedia].reverse();
  if (curFolder === '__none__') list = list.filter(m => !m.folder);
  else if (curFolder !== '__all__') list = list.filter(m => m.folder === curFolder);
  if (curFilter !== 'all') list = list.filter(m => m.type === curFilter);
  filtered = list;
  render();
}

/* ── RENDER GRID ── */
function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1).trim() + '…' : str;
}

function render() {
  const grid = document.getElementById('gallery');
  if (!filtered.length) {
    grid.innerHTML = `<div class="g-empty">
      ${curFolder === '__all__' && curFilter === 'all'
        ? "Aucune photo pour l'instant — clique sur « Ajouter des photos » pour commencer."
        : 'Aucun média dans cette sélection.'}
    </div>`;
    return;
  }
  const showFolderTag = curFolder === '__all__';

  grid.innerHTML = filtered.map((item, i) => {
    const sel = selected.has(item.url);
    const folderTag = item.folder && showFolderTag ? `<span class="g-item-folder-tag g-visible">${item.folder}</span>` : '';
    const checkMk = sel ? '✓' : '';
    const selCls = sel ? ' g-selected' : '';

    const media = item.type === 'video'
      ? (() => {
          const thumb = item.url.replace('/video/upload/', '/video/upload/so_0,w_500,h_500,c_fill/').replace(/\.[^./?]+(\?.*)?$/, '.jpg');
          return `<img src="${thumb}" loading="lazy" alt="Vidéo" onerror="this.style.display='none'">
            <div class="g-video-badge">Vidéo</div>`;
        })()
      : `<img src="${item.url.replace('/image/upload/', '/image/upload/w_500,h_500,c_fill/')}" loading="lazy" alt="${item.projet || 'Photo de chantier'}">`;

    const metaLine = [item.annee, item.lieu].filter(Boolean).join(' · ');
    const caption = (item.projet || metaLine || item.descriptifCourt) ? `
      <div class="g-item-caption">
        ${item.projet ? `<div class="g-cap-title">${item.projet}</div>` : ''}
        ${metaLine ? `<div class="g-cap-meta">${metaLine}</div>` : ''}
        ${item.descriptifCourt ? `<div class="g-cap-desc">${truncate(item.descriptifCourt, 110)}</div>` : ''}
      </div>` : '';

    return `<div class="g-item${selCls}" onclick="handleItemClick(${i})">
      <div class="g-item-media">
        ${media}
        <div class="g-item-check">${checkMk}</div>
        ${folderTag}
      </div>
      ${caption}
    </div>`;
  }).join('');
}

function handleItemClick(i) {
  if (adminMode) toggleSelect(filtered[i].url);
  else openLb(i);
}

/* ── SELECTION ── */
function toggleSelect(url) {
  selected.has(url) ? selected.delete(url) : selected.add(url);
  updateToolbar();
  render();
}
function selectAll() { filtered.forEach(m => selected.add(m.url)); updateToolbar(); render(); }
function deselectAll() { selected.clear(); updateToolbar(); render(); }
function updateToolbar() {
  const n = selected.size;
  document.getElementById('toolbar').classList.toggle('g-visible', n > 0 && adminMode);
  document.getElementById('toolbar-info').textContent = `${n} sélectionné${n > 1 ? 's' : ''}`;
}

/* ── ADMIN MODE ── */
function toggleAdminMode() {
  if (adminMode) {
    adminMode = false;
    deselectAll();
    document.getElementById('btn-admin-toggle').classList.remove('is-active');
    document.body.classList.remove('g-admin-mode');
    document.getElementById('admin-banner').hidden = true;
    renderFolders();
    render();
    showToast('Mode admin désactivé');
  } else {
    showModal('modal-admin');
    setTimeout(() => document.getElementById('admin-pwd').focus(), 100);
  }
}

function checkAdminPwd() {
  const val = document.getElementById('admin-pwd').value;
  if (val === CONFIG.password) {
    hideModal('modal-admin');
    adminMode = true;
    document.getElementById('btn-admin-toggle').classList.add('is-active');
    document.body.classList.add('g-admin-mode');
    document.getElementById('admin-banner').hidden = false;
    renderFolders();
    render();
    showToast('Mode admin activé');
  } else {
    flagError('admin-pwd', 'admin-error');
  }
}

function flagError(fieldId, errorId) {
  const f = document.getElementById(fieldId);
  document.getElementById(errorId).classList.add('g-visible');
  f.value = '';
  f.focus();
}

/* ── UPLOAD ── */
function handleAddClick() {
  const sel = document.getElementById('upload-folder-select');
  sel.innerHTML = `<option value="">Sans dossier</option>` + folders.map(f => `<option value="${f}">${f}</option>`).join('');
  if (curFolder !== '__all__' && curFolder !== '__none__') sel.value = curFolder;
  document.getElementById('upload-pwd').value = '';
  document.getElementById('upload-error').classList.remove('g-visible');
  ['meta-projet', 'meta-annee', 'meta-budget', 'meta-lieu', 'meta-duree', 'meta-court', 'meta-long']
    .forEach(id => { document.getElementById(id).value = ''; });
  showModal('modal-upload');
  setTimeout(() => document.getElementById('upload-pwd').focus(), 100);
}

function readMetaForm() {
  return {
    projet:  document.getElementById('meta-projet').value.trim(),
    annee:   document.getElementById('meta-annee').value.trim(),
    budget:  document.getElementById('meta-budget').value.trim(),
    lieu:    document.getElementById('meta-lieu').value.trim(),
    duree:   document.getElementById('meta-duree').value.trim(),
    descriptifCourt: document.getElementById('meta-court').value.trim(),
    descriptifLong:  document.getElementById('meta-long').value.trim(),
  };
}

function checkUploadPwd() {
  const val = document.getElementById('upload-pwd').value;
  if (val === CONFIG.password) {
    hideModal('modal-upload');
    const meta = readMetaForm();
    openUpload(document.getElementById('upload-folder-select').value, meta);
  } else {
    flagError('upload-pwd', 'upload-error');
  }
}

function openUpload(targetFolder, meta) {
  let newItems = 0;
  const widget = cloudinary.createUploadWidget({
    cloudName: CONFIG.cloudName, uploadPreset: CONFIG.uploadPreset,
    sources: ['local', 'camera'],
    resourceType: 'auto', multiple: true, maxFiles: 30, maxFileSize: 150000000,
    clientAllowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'mp4', 'mov', 'avi', 'mkv'],
    showPoweredBy: false,
    styles: {
      palette: {
        window: '#1E1811', windowBorder: '#4A3A24', tabIcon: '#7A2E20',
        menuIcons: '#ECE0C4', textLight: '#ECE0C4', link: '#B4854A', action: '#7A2E20',
        inProgress: '#B4854A', complete: '#7CBE8C', sourceBg: '#2C2216',
      },
    },
  }, async (err, result) => {
    if (err) { showToast('Erreur Cloudinary : ' + (err.statusText || err.message || 'échec de l\'envoi')); return; }
    if (result.event === 'success') {
      const info = result.info;
      try {
        await saveMedia({
          url: info.secure_url, type: info.resource_type === 'video' ? 'video' : 'image',
          date: new Date().toISOString(), public_id: info.public_id,
          folder: targetFolder || null,
          _id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
          ...meta,
        });
        newItems++;
      } catch (e) {
        showToast('Photo envoyée mais non enregistrée : ' + e.message);
      }
    }
    if (result.event === 'queues-end' && newItems > 0) {
      showToast(`${newItems} média${newItems > 1 ? 's' : ''} ajouté${newItems > 1 ? 's' : ''}`);
      await load();
      newItems = 0;
    }
  });
  widget.open();
}

async function saveMedia(item) {
  const rec = await fetchDB();
  rec.media = rec.media || [];
  rec.media.push(item);
  await saveDB(rec);
}

/* ── EDIT META (mode admin, depuis la visionneuse) ── */
function openEditMeta() {
  const item = filtered[curIndex];
  if (!item) return;
  document.getElementById('edit-meta-id').value = item._id || item.url;
  document.getElementById('edit-projet').value = item.projet || '';
  document.getElementById('edit-annee').value = item.annee || '';
  document.getElementById('edit-budget').value = item.budget || '';
  document.getElementById('edit-lieu').value = item.lieu || '';
  document.getElementById('edit-duree').value = item.duree || '';
  document.getElementById('edit-court').value = item.descriptifCourt || '';
  document.getElementById('edit-long').value = item.descriptifLong || '';
  showModal('modal-edit-meta');
}

async function saveEditMeta() {
  const idOrUrl = document.getElementById('edit-meta-id').value;
  const patch = {
    projet:  document.getElementById('edit-projet').value.trim(),
    annee:   document.getElementById('edit-annee').value.trim(),
    budget:  document.getElementById('edit-budget').value.trim(),
    lieu:    document.getElementById('edit-lieu').value.trim(),
    duree:   document.getElementById('edit-duree').value.trim(),
    descriptifCourt: document.getElementById('edit-court').value.trim(),
    descriptifLong:  document.getElementById('edit-long').value.trim(),
  };
  try {
    const rec = await fetchDB();
    rec.media = (rec.media || []).map(m => (m._id === idOrUrl || m.url === idOrUrl) ? { ...m, ...patch } : m);
    await saveDB(rec);
    hideModal('modal-edit-meta');
    showToast('Légende mise à jour');
    await load();
    if (document.getElementById('g-lightbox').classList.contains('g-open')) {
      const item = filtered.find(m => (m._id === idOrUrl || m.url === idOrUrl));
      if (item) { curIndex = filtered.indexOf(item); showLbItem(); }
    }
  } catch (e) {
    showToast('Erreur : ' + e.message);
  }
}

/* ── DELETE ── */
function confirmDeleteSelected() {
  if (!selected.size) return;
  deleteTarget = 'selected';
  document.getElementById('delete-confirm-text').textContent = `Supprimer ${selected.size} élément(s) ?`;
  showModal('modal-confirm-delete');
}
function confirmDeleteFromLightbox() {
  const item = filtered[curIndex];
  if (!item) return;
  deleteTarget = { url: item.url };
  document.getElementById('delete-confirm-text').textContent = 'Supprimer ce média ?';
  showModal('modal-confirm-delete');
}
function confirmDeleteFolder(name) {
  deleteTarget = { folder: name };
  document.getElementById('delete-confirm-text').textContent =
    `Supprimer le dossier "${name}" ? Les photos ne sont pas supprimées, elles passent en "Sans dossier".`;
  showModal('modal-confirm-delete');
}

async function executeDelete() {
  hideModal('modal-confirm-delete');
  try {
    const rec = await fetchDB();
    if (deleteTarget && deleteTarget.folder) {
      const fname = deleteTarget.folder;
      rec.folders = (rec.folders || []).filter(f => f !== fname);
      rec.media = (rec.media || []).map(m => m.folder === fname ? { ...m, folder: null } : m);
      await saveDB(rec);
      if (curFolder === fname) curFolder = '__all__';
      showToast(`Dossier "${fname}" supprimé`);
    } else {
      const urlsToDelete = deleteTarget === 'selected' ? new Set(selected) : new Set([deleteTarget.url]);
      const before = rec.media.length;
      rec.media = rec.media.filter(m => !urlsToDelete.has(m.url));
      await saveDB(rec);
      showToast(`${before - rec.media.length} média(s) supprimé(s)`);
    }
    selected.clear();
    deleteTarget = null;
    if (document.getElementById('g-lightbox').classList.contains('g-open')) closeLb();
    await load();
  } catch (e) {
    showToast('Erreur : ' + e.message);
  }
}

/* ── FOLDER CREATE / MOVE ── */
function showNewFolderModal() {
  document.getElementById('new-folder-name').value = '';
  document.getElementById('folder-error').classList.remove('g-visible');
  showModal('modal-new-folder');
  setTimeout(() => document.getElementById('new-folder-name').focus(), 100);
}

async function createFolder() {
  const name = document.getElementById('new-folder-name').value.trim();
  if (!name) return;
  if (folders.includes(name)) { document.getElementById('folder-error').classList.add('g-visible'); return; }
  try {
    const rec = await fetchDB();
    rec.folders = rec.folders || [];
    rec.folders.push(name);
    await saveDB(rec);
    hideModal('modal-new-folder');
    showToast(`Dossier "${name}" créé`);
    await load();
  } catch (e) {
    showToast('Erreur : ' + e.message);
  }
}

function showMoveModal() {
  if (!selected.size) return;
  document.getElementById('move-info').textContent = `Déplacer ${selected.size} élément(s) vers :`;
  const list = document.getElementById('move-folder-list');
  list.innerHTML = [{ value: '', label: 'Sans dossier' }, ...folders.map(f => ({ value: f, label: f }))]
    .map(opt => `<button class="g-move-folder-item" onclick="executeMove('${opt.value}')">${opt.label}</button>`).join('');
  showModal('modal-move');
}

async function executeMove(targetFolder) {
  hideModal('modal-move');
  try {
    const rec = await fetchDB();
    const urlsToMove = new Set(selected);
    rec.media = rec.media.map(m => urlsToMove.has(m.url) ? { ...m, folder: targetFolder || null } : m);
    await saveDB(rec);
    showToast(`Déplacé vers ${targetFolder || 'Sans dossier'}`);
    deselectAll();
    await load();
  } catch (e) {
    showToast('Erreur : ' + e.message);
  }
}

/* ── LIGHTBOX ── */
function openLb(i) {
  curIndex = i;
  showLbItem();
  document.getElementById('g-lightbox').classList.add('g-open');
  document.body.style.overflow = 'hidden';
}
function showLbItem() {
  const item = filtered[curIndex];
  const wrap = document.getElementById('g-lb-wrap');
  document.getElementById('g-lb-counter').textContent = `${curIndex + 1} / ${filtered.length}`;

  const fields = [
    ['Projet', item.projet], ['Année', item.annee], ['Lieu', item.lieu],
    ['Budget', item.budget], ['Durée', item.duree],
  ].filter(([, v]) => v);
  document.getElementById('g-lb-fields').innerHTML = fields
    .map(([k, v]) => `<div class="g-lb-field"><span class="g-lb-field-k">${k}</span><span class="g-lb-field-v">${v}</span></div>`)
    .join('');
  document.getElementById('g-lb-desc').textContent = item.descriptifLong || '';
  document.getElementById('g-lb-desc').style.display = item.descriptifLong ? '' : 'none';

  const badge = document.getElementById('g-lb-folder-badge');
  if (item.folder) { badge.textContent = item.folder; badge.style.display = ''; }
  else { badge.style.display = 'none'; }
  document.getElementById('g-lb-delete-btn').style.display = adminMode ? '' : 'none';
  document.getElementById('g-lb-edit-btn').style.display = adminMode ? '' : 'none';
  wrap.innerHTML = item.type === 'video'
    ? `<video src="${item.url}" controls autoplay playsinline></video>`
    : `<img src="${item.url}" alt="${item.projet || 'Photo de chantier'}">`;
}
function navigate(dir) {
  stopMedia();
  curIndex = (curIndex + dir + filtered.length) % filtered.length;
  showLbItem();
}
function closeLb() {
  stopMedia();
  document.getElementById('g-lightbox').classList.remove('g-open');
  document.getElementById('g-lb-wrap').innerHTML = '';
  document.body.style.overflow = '';
}
function stopMedia() { const v = document.querySelector('#g-lb-wrap video'); if (v) v.pause(); }
function handleLbBg(e) { if (e.target.id === 'g-lightbox') closeLb(); }

document.addEventListener('keydown', e => {
  const lb = document.getElementById('g-lightbox');
  if (!lb || !lb.classList.contains('g-open')) return;
  if (e.key === 'ArrowRight') navigate(1);
  else if (e.key === 'ArrowLeft') navigate(-1);
  else if (e.key === 'Escape') closeLb();
});

/* ── MODAL / TOAST HELPERS ── */
function showModal(id) { document.getElementById(id).classList.add('g-open'); }
function hideModal(id) { document.getElementById(id).classList.remove('g-open'); }
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('g-show');
  setTimeout(() => t.classList.remove('g-show'), 3200);
}

document.addEventListener('DOMContentLoaded', initGallery);

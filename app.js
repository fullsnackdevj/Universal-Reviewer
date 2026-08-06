/* =====================================================
   Universal Reviewer — Application Core Logic
   Firebase Auth (Google Sign-In) + Firestore Leaderboard
   OCR, Document Parsing, Quiz Engine, Scoring
   ===================================================== */

// ======================== FIREBASE CONFIG ========================
// Replace with your own Firebase project config.
// Get this from: https://console.firebase.google.com > Project Settings > General > Your apps > Web app > Config
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD9vpIEFZZ4f9vfnQQF1WgmPxeP1aHHGxk",
  authDomain: "universal-reviewer-app.firebaseapp.com",
  projectId: "universal-reviewer-app",
  storageBucket: "universal-reviewer-app.firebasestorage.app",
  messagingSenderId: "536708386513",
  appId: "1:536708386513:web:58c09f5e928e1fa5db3ff0"
};

// Check if Firebase is configured
const isFirebaseConfigured = () => FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId;

// ======================== FIREBASE INITIALIZATION ========================
let firebaseApp = null;
let auth = null;
let db = null;

const initFirebase = () => {
  if (!isFirebaseConfigured()) {
    console.log('[Universal Reviewer] Firebase not configured — running in local/guest mode.');
    return;
  }
  try {
    firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    console.log('[Universal Reviewer] Firebase initialized successfully.');
  } catch (e) {
    console.error('[Universal Reviewer] Firebase init error:', e);
  }
};

// ======================== APP STATE ========================
const appState = {
  user: null,              // { uid, displayName, email, photoURL }
  reviewers: [],           // Array of reviewer objects
  activeReviewerId: null,
  quiz: {
    isActive: false,
    score: { correct: 0, incorrect: 0, count: 0, points: 0 },
    consecutiveCorrect: 0,
    history: [],
    currentQuestion: null,
    isAnswered: false
  },
  leaderboard: []
};

// ======================== LOCAL STORAGE ========================
const STORAGE_KEYS = {
  reviewers: 'ur_reviewers_v2',
  theme: 'ur_theme',
  guestScore: 'ur_guest_score'
};

const saveReviewers = () => {
  try {
    // Save without file blob data to keep storage manageable
    const stripped = appState.reviewers.map(r => ({
      ...r,
      items: r.items,
      files: undefined  // Don't store raw file data
    }));
    localStorage.setItem(STORAGE_KEYS.reviewers, JSON.stringify(stripped));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
};

const loadReviewers = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.reviewers);
    if (data) {
      appState.reviewers = JSON.parse(data);
      if (appState.reviewers.length > 0 && !appState.activeReviewerId) {
        appState.activeReviewerId = appState.reviewers[0].id;
      }
    }
  } catch (e) {
    console.warn('LocalStorage load failed:', e);
    appState.reviewers = [];
  }
};

const getActiveReviewer = () => {
  if (!appState.activeReviewerId && appState.reviewers.length > 0) {
    appState.activeReviewerId = appState.reviewers[0].id;
  }
  return appState.reviewers.find(r => r.id === appState.activeReviewerId) || appState.reviewers[0] || null;
};

// ======================== DOM ELEMENT CACHE ========================
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// Lazy element access
const els = {};
const getEl = (id) => {
  if (!els[id]) els[id] = $(id);
  return els[id];
};

// ======================== UTILITY FUNCTIONS ========================
const getRandomInt = (max) => Math.floor(Math.random() * max);

const shuffleArray = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const generateId = () => `rv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const escapeHtml = (str) => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

// ======================== TOAST NOTIFICATION SYSTEM ========================
const showToast = ({ type = 'info', title = '', message = '', duration = 4500 }) => {
  const container = $('toast-container');
  if (!container) return;

  const iconMap = {
    success: { icon: 'fa-circle-check', class: 'toast-success' },
    error:   { icon: 'fa-circle-xmark',  class: 'toast-error' },
    warning: { icon: 'fa-triangle-exclamation', class: 'toast-warning' },
    info:    { icon: 'fa-circle-info',   class: 'toast-info' }
  };

  const style = iconMap[type] || iconMap.info;
  const toastTitle = title || (type.charAt(0).toUpperCase() + type.slice(1));

  const toast = document.createElement('div');
  toast.className = `toast ${style.class}`;
  toast.innerHTML = `
    <div class="toast-icon"><i class="fas ${style.icon}"></i></div>
    <div style="flex:1;min-width:0;padding-right:0.5rem">
      <div style="font-weight:700;font-size:0.8125rem;color:var(--text-primary)">${escapeHtml(toastTitle)}</div>
      <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.125rem;word-break:break-word">${message}</div>
    </div>
    <button class="btn-ghost btn-icon" style="width:28px;height:28px;flex-shrink:0" aria-label="Close"><i class="fas fa-xmark" style="font-size:0.75rem"></i></button>
    <div class="toast-progress" style="width:100%"></div>
  `;

  container.appendChild(toast);

  const progressBar = toast.querySelector('.toast-progress');
  const closeBtn = toast.querySelector('button');
  let start = Date.now();
  let remaining = duration;
  let frameId = null;

  const dismiss = () => {
    cancelAnimationFrame(frameId);
    toast.classList.add('exiting');
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
  };

  const tick = () => {
    const elapsed = Date.now() - start;
    const pct = Math.max(0, 100 - (elapsed / duration) * 100);
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (elapsed < duration) { frameId = requestAnimationFrame(tick); }
    else { dismiss(); }
  };

  frameId = requestAnimationFrame(tick);
  toast.addEventListener('mouseenter', () => { cancelAnimationFrame(frameId); remaining -= (Date.now() - start); });
  toast.addEventListener('mouseleave', () => { start = Date.now(); duration = Math.max(500, remaining); frameId = requestAnimationFrame(tick); });
  closeBtn.onclick = dismiss;
};

// ======================== CONFIRM MODAL ========================
const showConfirm = ({ title = 'Are you sure?', message = '', confirmText = 'Confirm', cancelText = 'Cancel', type = 'info' }) => {
  return new Promise(resolve => {
    const overlay = $('modal-confirm');
    const panel = $('modal-confirm-panel');
    const titleEl = $('confirm-title');
    const msgEl = $('confirm-message');
    const iconEl = $('confirm-icon');
    const btnOk = $('confirm-btn-ok');
    const btnCancel = $('confirm-btn-cancel');

    titleEl.textContent = title;
    msgEl.innerHTML = message;
    btnOk.textContent = confirmText;
    btnCancel.textContent = cancelText;

    const iconConfig = {
      info: { icon: 'fa-circle-question', color: 'var(--blue-500)', btnClass: 'btn-primary' },
      danger: { icon: 'fa-trash-can', color: 'var(--danger)', btnClass: 'btn-danger' },
      warning: { icon: 'fa-triangle-exclamation', color: 'var(--warning)', btnClass: 'btn-primary' }
    };
    const cfg = iconConfig[type] || iconConfig.info;
    iconEl.className = `fas ${cfg.icon}`;
    iconEl.parentElement.style.color = cfg.color;
    btnOk.className = `btn ${cfg.btnClass}`;
    btnOk.style.flex = '1';

    toggleModal(overlay, true);

    const cleanup = (result) => {
      toggleModal(overlay, false);
      btnOk.onclick = null;
      btnCancel.onclick = null;
      resolve(result);
    };

    btnOk.onclick = () => cleanup(true);
    btnCancel.onclick = () => cleanup(false);
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
  });
};

// ======================== MODAL HELPERS ========================
const toggleModal = (overlay, show) => {
  if (show) {
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => { overlay.classList.add('active'); });
  } else {
    overlay.classList.remove('active');
    setTimeout(() => overlay.classList.add('hidden'), 280);
  }
};

// ======================== SCREEN NAVIGATION ========================
const showScreen = (screenId) => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = $(screenId);
  if (target) target.classList.add('active');
};

// ======================== THEME MANAGEMENT ========================
const initTheme = () => {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
};

const toggleTheme = () => {
  document.documentElement.classList.toggle('dark');
  const isDark = document.documentElement.classList.contains('dark');
  localStorage.setItem(STORAGE_KEYS.theme, isDark ? 'dark' : 'light');
};

// ======================== AUTH: GOOGLE SIGN-IN ========================
const signInWithGoogle = async () => {
  if (!auth) {
    showToast({ type: 'warning', title: 'Firebase Not Configured', message: 'Please add your Firebase config to enable Google Sign-In.' });
    return;
  }
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    showToast({ type: 'success', title: 'Welcome!', message: `Signed in as ${result.user.displayName}` });
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      showToast({ type: 'error', title: 'Sign-In Failed', message: e.message });
    }
  }
};

const signOut = async () => {
  if (!auth) return;
  try {
    await auth.signOut();
    showToast({ type: 'info', title: 'Signed Out', message: 'You have been signed out.' });
  } catch (e) {
    showToast({ type: 'error', title: 'Sign Out Error', message: e.message });
  }
};

const onAuthStateChange = (user) => {
  if (user) {
    appState.user = {
      uid: user.uid,
      displayName: user.displayName || 'Student',
      email: user.email,
      photoURL: user.photoURL
    };
  } else {
    appState.user = null;
  }
  renderAuthUI();
};

const renderAuthUI = () => {
  const signInBtn = $('btn-sign-in');
  const userSection = $('user-section');
  const userAvatar = $('user-avatar-img');
  const userName = $('user-display-name');
  const guestLabel = $('guest-label');

  if (appState.user) {
    if (signInBtn) signInBtn.classList.add('hidden');
    if (userSection) userSection.classList.remove('hidden');
    if (userAvatar) {
      if (appState.user.photoURL) {
        userAvatar.src = appState.user.photoURL;
        userAvatar.classList.remove('hidden');
      } else {
        userAvatar.classList.add('hidden');
      }
    }
    if (userName) userName.textContent = appState.user.displayName;
    if (guestLabel) guestLabel.classList.add('hidden');
  } else {
    if (signInBtn) signInBtn.classList.remove('hidden');
    if (userSection) userSection.classList.add('hidden');
    if (guestLabel) guestLabel.classList.remove('hidden');
  }
};

// ======================== USER MENU ========================
let userMenuOpen = false;

const toggleUserMenu = () => {
  const menu = $('user-menu');
  if (!menu) return;
  userMenuOpen = !userMenuOpen;
  if (userMenuOpen) {
    menu.classList.add('active');
    document.addEventListener('click', closeUserMenuOnClickOutside);
  } else {
    menu.classList.remove('active');
    document.removeEventListener('click', closeUserMenuOnClickOutside);
  }
};

const closeUserMenuOnClickOutside = (e) => {
  const menu = $('user-menu');
  const trigger = $('user-menu-trigger');
  if (menu && !menu.contains(e.target) && trigger && !trigger.contains(e.target)) {
    userMenuOpen = false;
    menu.classList.remove('active');
    document.removeEventListener('click', closeUserMenuOnClickOutside);
  }
};

// ======================== REVIEWER MANAGEMENT ========================
const createReviewer = (name) => {
  const reviewer = {
    id: generateId(),
    name: name.trim() || 'Untitled Reviewer',
    description: '',
    items: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  appState.reviewers.push(reviewer);
  appState.activeReviewerId = reviewer.id;
  saveReviewers();
  return reviewer;
};

const deleteReviewer = async (reviewerId) => {
  const confirmed = await showConfirm({
    title: 'Delete Reviewer?',
    message: 'All terms and definitions in this reviewer will be permanently deleted.',
    confirmText: 'Delete',
    type: 'danger'
  });
  if (!confirmed) return;

  appState.reviewers = appState.reviewers.filter(r => r.id !== reviewerId);
  if (appState.activeReviewerId === reviewerId) {
    appState.activeReviewerId = appState.reviewers.length > 0 ? appState.reviewers[0].id : null;
  }
  saveReviewers();
  renderDashboard();
  renderManagerContent();
  showToast({ type: 'info', title: 'Reviewer Deleted', message: 'The reviewer has been removed.' });
};

const addItemToReviewer = (reviewerId, term, def) => {
  const reviewer = appState.reviewers.find(r => r.id === reviewerId);
  if (!reviewer) return;
  reviewer.items.push({ term, def });
  reviewer.updatedAt = Date.now();
  saveReviewers();
};

// ======================== DOCUMENT PARSERS ========================

// --- Text Extraction from Various Formats ---
const extractTextFromFile = async (file) => {
  const ext = file.name.split('.').pop().toLowerCase();

  // Image files — OCR via Tesseract.js
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext)) {
    return await extractTextFromImage(file);
  }

  // PDF via PDF.js
  if (ext === 'pdf') {
    return await extractTextFromPDF(file);
  }

  // Word (.docx) via Mammoth.js
  if (ext === 'docx') {
    return await extractTextFromDocx(file);
  }

  // Excel / CSV via SheetJS
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    return await extractTextFromSpreadsheet(file);
  }

  // PowerPoint via JSZip
  if (ext === 'pptx') {
    return await extractTextFromPptx(file);
  }

  // Plain text files
  if (['txt', 'md', 'text'].includes(ext)) {
    return await file.text();
  }

  showToast({ type: 'warning', title: 'Unsupported File', message: `"${file.name}" format is not supported.` });
  return '';
};

const extractTextFromImage = async (file) => {
  const progressContainer = $('ocr-progress');
  const progressBar = $('ocr-progress-bar');
  const progressStatus = $('ocr-progress-status');
  const progressPercent = $('ocr-progress-percent');

  if (progressContainer) progressContainer.classList.remove('hidden');

  try {
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text' && progressBar) {
          const pct = Math.round(m.progress * 100);
          progressBar.style.width = `${pct}%`;
          if (progressPercent) progressPercent.textContent = `${pct}%`;
          if (progressStatus) progressStatus.textContent = 'Scanning image...';
        }
      }
    });

    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();

    if (progressContainer) progressContainer.classList.add('hidden');
    return text || '';
  } catch (e) {
    if (progressContainer) progressContainer.classList.add('hidden');
    console.error('OCR Error:', e);
    showToast({ type: 'error', title: 'OCR Failed', message: `Could not scan "${file.name}".` });
    return '';
  }
};

const extractTextFromPDF = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  } catch (e) {
    console.error('PDF parse error:', e);
    showToast({ type: 'error', title: 'PDF Error', message: `Could not parse "${file.name}".` });
    return '';
  }
};

const extractTextFromDocx = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '';
  } catch (e) {
    console.error('DOCX parse error:', e);
    showToast({ type: 'error', title: 'DOCX Error', message: `Could not parse "${file.name}".` });
    return '';
  }
};

const extractTextFromSpreadsheet = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let fullText = '';
    workbook.SheetNames.forEach(name => {
      const sheet = workbook.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      fullText += csv + '\n';
    });
    return fullText;
  } catch (e) {
    console.error('Spreadsheet parse error:', e);
    return '';
  }
};

const extractTextFromPptx = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    let fullText = '';
    const slideFiles = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort();

    for (const slidePath of slideFiles) {
      const xml = await zip.files[slidePath].async('text');
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      const textNodes = doc.getElementsByTagName('a:t');
      for (let i = 0; i < textNodes.length; i++) {
        fullText += textNodes[i].textContent + ' ';
      }
      fullText += '\n';
    }
    return fullText;
  } catch (e) {
    console.error('PPTX parse error:', e);
    return '';
  }
};

// ======================== TERM EXTRACTION ENGINE ========================
const parseTermsFromText = (text) => {
  if (!text || !text.trim()) return [];

  const items = [];
  const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Helpers
  const cleanTerm = (t) => t.replace(/^[\d\.\)\-\•\*\#]+\s*/, '').replace(/[:\-–—]+$/, '').trim();

  const isJunkTerm = (t) => {
    if (!t || t.length < 2 || t.length > 80) return true;
    if (/^(page|table|figure|chapter|section|module|lesson|unit|note|reference|source|http|www|copyright|©)/i.test(t)) return true;
    if (/^\d+$/.test(t)) return true;
    return false;
  };

  const formatDefinition = (d) => {
    let formatted = d
      .replace(/\s+/g, ' ')
      .replace(/^[\-–—:\s]+/, '')
      .trim();
    if (formatted.length > 0) {
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
    return formatted;
  };

  const isNewItemStart = (line) => {
    if (!line) return true;
    return /^[\d]+[\.\)]/.test(line.trim()) ||
           /^[A-Z][A-Za-z\s\(\)\-\/]{2,50}\s*[:–—\-]\s/.test(line.trim()) ||
           /^#{1,6}\s/.test(line.trim()) ||
           /^[\•\*\-]\s/.test(line.trim());
  };

  const parseTermAndAliases = (raw) => {
    const aliasSeparators = /\s*(?:\/|\bor\b|\baka\b|\balso known as\b)\s*/i;
    if (aliasSeparators.test(raw)) {
      const parts = raw.split(aliasSeparators).map(s => s.trim()).filter(Boolean);
      return { primaryTerm: parts[0], aliases: parts.slice(1) };
    }
    return { primaryTerm: raw, aliases: [] };
  };

  let currentHeading = null;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Pattern: "Term: Definition" or "Term - Definition" or "Term – Definition"
    const inlineMatch = line.match(/^([A-Za-z0-9][A-Za-z0-9\s\(\)\-\/\,\'\"\.]{1,60})\s*[:–—\-]\s+(.+)$/);
    // Pattern: Q&A format
    const qaMatch = line.match(/^(?:Q|Question)\s*[:\.\-]\s*(.+?)\s*(?:A|Answer)\s*[:\.\-]\s*(.+)$/i);
    // Pattern: Heading (standalone capitalized line)
    const headingMatch = line.match(/^(?:\d+[\.\)]\s*|#{1,6}\s+)?([A-Z0-9][A-Za-z0-9\s\(\)\-\/\,]{2,60})$/);

    if (qaMatch && qaMatch[1] && qaMatch[2]) {
      const qText = qaMatch[1].replace(/^(what|who|which|how|why|is|are|define|explain)\s+(is|are|the|a|an)?\s*/i, '').replace(/\?$/, '').trim();
      const termCandidate = cleanTerm(qText);
      let rawDef = qaMatch[2].trim();

      while (i + 1 < rawLines.length && !isNewItemStart(rawLines[i + 1])) {
        i++;
        rawDef += ' ' + rawLines[i].trim();
      }

      const defCandidate = formatDefinition(rawDef);
      if (!isJunkTerm(termCandidate) && defCandidate.length >= 5) {
        const { primaryTerm, aliases } = parseTermAndAliases(termCandidate);
        items.push({ term: primaryTerm, def: defCandidate, alias: aliases.length ? aliases : undefined });
      }
    } else if (inlineMatch && inlineMatch[1] && inlineMatch[2]) {
      const rawTerm = inlineMatch[1].trim();
      let rawDef = inlineMatch[2].trim();

      while (i + 1 < rawLines.length && !isNewItemStart(rawLines[i + 1])) {
        i++;
        rawDef += ' ' + rawLines[i].trim();
      }

      const cleanedTerm = cleanTerm(rawTerm);
      if (!isJunkTerm(cleanedTerm) && rawDef.length >= 4) {
        const { primaryTerm, aliases } = parseTermAndAliases(cleanedTerm);
        const formattedDef = formatDefinition(rawDef);

        if (currentHeading && !primaryTerm.toLowerCase().includes(currentHeading.toLowerCase())) {
          aliases.push(`${currentHeading} - ${primaryTerm}`);
        }

        items.push({
          term: primaryTerm,
          def: formattedDef,
          alias: aliases.length > 0 ? Array.from(new Set(aliases)) : undefined
        });
      }
    } else if (headingMatch && i + 1 < rawLines.length) {
      const headingCandidate = cleanTerm(headingMatch[1]);
      const nextLine = rawLines[i + 1];

      if (!isJunkTerm(headingCandidate) && !isNewItemStart(nextLine)) {
        currentHeading = headingCandidate;
        let rawDef = nextLine.trim();
        i++;

        while (i + 1 < rawLines.length && !isNewItemStart(rawLines[i + 1])) {
          i++;
          rawDef += ' ' + rawLines[i].trim();
        }

        if (rawDef.length >= 10 && !isJunkTerm(rawDef)) {
          const { primaryTerm, aliases } = parseTermAndAliases(headingCandidate);
          const formattedDef = formatDefinition(rawDef);
          items.push({
            term: primaryTerm,
            def: formattedDef,
            alias: aliases.length > 0 ? aliases : undefined
          });
        }
      }
    }
  }

  // Fallback: parse "X is Y" sentence patterns
  if (items.length < 5) {
    const sentences = text.split(/(?<=[.?!])\s+/);
    sentences.forEach(s => {
      const match = s.match(/^([A-Z][A-Za-z0-9\s\(\)\-]{2,45})\s+(is|are|refers to|executes|provides|converts|acts as|serves as|is defined as)\s+(.+)$/i);
      if (match) {
        const termCandidate = cleanTerm(match[1]);
        const verb = match[2];
        const rest = match[3].trim();
        if (!isJunkTerm(termCandidate) && rest.length >= 8) {
          const { primaryTerm, aliases } = parseTermAndAliases(termCandidate);
          const def = formatDefinition(`${verb} ${rest}`);
          items.push({ term: primaryTerm, def, alias: aliases.length ? aliases : undefined });
        }
      }
    });
  }

  // Deduplicate
  const uniqueItems = [];
  const seen = new Set();
  items.forEach(item => {
    const clean = cleanTerm(item.term);
    if (clean && !isJunkTerm(clean) && item.def && item.def.length >= 4) {
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push({ ...item, term: clean });
      }
    }
  });

  return uniqueItems;
};

// ======================== FILE UPLOAD PROCESSOR ========================
const processUploadedFiles = async (files) => {
  const reviewerNameInput = $('reviewer-name-input');
  let reviewerName = reviewerNameInput ? reviewerNameInput.value.trim() : '';

  // Find or create the reviewer
  let reviewer = null;
  const targetSelect = $('upload-target-reviewer');

  if (targetSelect && targetSelect.value && targetSelect.value !== '__new__') {
    reviewer = appState.reviewers.find(r => r.id === targetSelect.value);
  }

  if (!reviewer) {
    if (!reviewerName) {
      reviewerName = `Reviewer ${appState.reviewers.length + 1}`;
    }
    reviewer = createReviewer(reviewerName);
  }

  let totalNewItems = 0;

  for (const file of files) {
    showToast({ type: 'info', title: 'Processing...', message: `Scanning "${file.name}"...`, duration: 2000 });

    const text = await extractTextFromFile(file);
    if (text && text.trim()) {
      const terms = parseTermsFromText(text);
      if (terms.length > 0) {
        // Merge without duplicates
        const existingTerms = new Set(reviewer.items.map(i => i.term.toLowerCase()));
        const newTerms = terms.filter(t => !existingTerms.has(t.term.toLowerCase()));
        reviewer.items.push(...newTerms);
        totalNewItems += newTerms.length;
      }
    }
  }

  reviewer.updatedAt = Date.now();
  appState.activeReviewerId = reviewer.id;
  saveReviewers();
  renderDashboard();
  renderManagerContent();

  if (totalNewItems > 0) {
    showToast({ type: 'success', title: 'Upload Complete!', message: `Added ${totalNewItems} terms to "${reviewer.name}".` });
  } else {
    showToast({ type: 'warning', title: 'No Terms Found', message: 'Could not extract study terms. Try uploading notes with clear Term: Definition format.' });
  }

  // Reset file input
  const fileInput = $('file-input');
  if (fileInput) fileInput.value = '';
};

// ======================== QUESTION GENERATOR ========================
const generateQuestion = () => {
  const state = appState.quiz;
  state.isAnswered = false;
  state.score.count++;

  const reviewer = getActiveReviewer();
  if (!reviewer || !reviewer.items || reviewer.items.length === 0) return;

  const targetItem = reviewer.items[getRandomInt(reviewer.items.length)];

  // Randomly select between MCQ (1pt) and Identification (2pt)
  const modes = ['mcq', 'ident'];
  const mode = modes[getRandomInt(modes.length)];

  state.currentQuestion = { targetItem, mode };

  renderQuestion();
};

const renderQuestion = () => {
  const state = appState.quiz;
  const { targetItem, mode } = state.currentQuestion;

  // Update counter
  const counter = $('question-counter');
  if (counter) counter.textContent = `Question #${state.score.count}`;

  // Hide feedback and action area
  const feedback = $('quiz-feedback');
  const actionArea = $('quiz-action-area');
  if (feedback) feedback.classList.add('hidden');
  if (actionArea) actionArea.classList.add('hidden');

  // Hide all answer containers
  const mcqContainer = $('mcq-container');
  const identContainer = $('ident-container');
  if (mcqContainer) mcqContainer.classList.add('hidden');
  if (identContainer) identContainer.classList.add('hidden');

  // Question text and badge
  const questionText = $('question-text');
  const typeBadge = $('question-type-badge');
  const pointsBadge = $('question-points-badge');

  if (mode === 'mcq') {
    if (typeBadge) { typeBadge.textContent = 'Multiple Choice'; typeBadge.className = 'badge badge-blue'; }
    if (pointsBadge) { pointsBadge.textContent = '+1 pt'; pointsBadge.className = 'point-indicator point-indicator-mcq'; }
    if (questionText) {
      questionText.innerHTML = `Which of the following best defines <strong style="color:var(--blue-600)">"${escapeHtml(targetItem.term)}"</strong>?`;
    }
    renderMCQChoices(targetItem);
  } else {
    if (typeBadge) { typeBadge.textContent = 'Identification'; typeBadge.className = 'badge badge-purple'; }
    if (pointsBadge) { pointsBadge.textContent = '+2 pts'; pointsBadge.className = 'point-indicator point-indicator-ident'; }
    if (questionText) {
      questionText.innerHTML = `Identify the term for: <strong style="color:var(--purple)">"${escapeHtml(targetItem.def)}"</strong>`;
    }
    renderIdentification(targetItem);
  }
};

// ======================== MCQ RENDERER ========================
const renderMCQChoices = (targetItem) => {
  const container = $('mcq-container');
  if (!container) return;
  container.classList.remove('hidden');
  container.innerHTML = '';

  const reviewer = getActiveReviewer();
  let choices = [targetItem];
  let others = reviewer.items.filter(i => i.term !== targetItem.term);

  while (choices.length < Math.min(4, reviewer.items.length) && others.length > 0) {
    const idx = getRandomInt(others.length);
    choices.push(others[idx]);
    others.splice(idx, 1);
  }

  // Fallback distractors
  const fallbacks = [
    "Any form of energy that moves through space.",
    "A physical state with fixed shape and volume.",
    "A process of energy conversion in closed systems.",
    "The force exerted by gravity on an object."
  ];
  let fIdx = 0;
  while (choices.length < 4) {
    const fd = fallbacks[fIdx % fallbacks.length];
    if (!choices.some(c => c.def === fd)) {
      choices.push({ term: '__distractor__', def: fd });
    }
    fIdx++;
  }

  choices = shuffleArray(choices);
  const letters = ['A', 'B', 'C', 'D'];

  choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `
      <span class="choice-letter">${letters[i]}</span>
      <span style="flex:1;min-width:0;word-break:break-word">${escapeHtml(choice.def)}</span>
      <i class="fas hidden" style="flex-shrink:0;margin-left:0.5rem"></i>
    `;
    btn.onclick = () => handleMCQAnswer(btn, choice.def, targetItem.def);
    container.appendChild(btn);
  });
};

const handleMCQAnswer = (selectedBtn, selectedDef, correctDef) => {
  const state = appState.quiz;
  if (state.isAnswered) return;
  state.isAnswered = true;

  const isCorrect = selectedDef === correctDef;
  const container = $('mcq-container');
  const buttons = container.querySelectorAll('.choice-btn');

  buttons.forEach(btn => {
    btn.disabled = true;
    const icon = btn.querySelector('.fas');

    if (btn === selectedBtn) {
      if (isCorrect) {
        btn.classList.add('correct');
        icon.classList.remove('hidden');
        icon.classList.add('fa-check-circle');
        icon.style.color = 'var(--success)';
      } else {
        btn.classList.add('incorrect');
        icon.classList.remove('hidden');
        icon.classList.add('fa-times-circle');
        icon.style.color = 'var(--danger)';
      }
    } else {
      const btnDefText = btn.querySelector('span:nth-child(2)').textContent;
      if (!isCorrect && btnDefText === correctDef) {
        btn.classList.add('correct');
      } else {
        btn.classList.add('dimmed');
      }
    }
  });

  const target = state.currentQuestion.targetItem;
  const points = 1; // MCQ = 1 point
  const feedbackMsg = isCorrect
    ? `🎉 <strong>Correct! (+${points} pt)</strong> "${escapeHtml(target.def)}" is indeed the definition of <em>"${escapeHtml(target.term)}"</em>.`
    : `❌ <strong>Incorrect!</strong> The correct definition of <strong>"${escapeHtml(target.term)}"</strong> is <strong>"${escapeHtml(target.def)}"</strong>.`;

  showQuizFeedback(isCorrect, feedbackMsg);
  processResult(isCorrect, selectedDef, correctDef, points);
};

// ======================== IDENTIFICATION RENDERER ========================
const renderIdentification = (targetItem) => {
  const container = $('ident-container');
  if (!container) return;
  container.classList.remove('hidden');

  const input = $('ident-input');
  const submitBtn = $('btn-submit-ident');
  const hintBox = $('ident-hint');

  if (input) { input.value = ''; input.disabled = false; setTimeout(() => input.focus(), 100); }
  if (submitBtn) submitBtn.disabled = false;

  // Generate smart hint with masked letters
  if (hintBox) {
    const term = targetItem.term;
    const firstChar = term.charAt(0).toUpperCase();
    const len = term.length;

    // Create masked preview: show first and last letter, mask the rest
    let masked = '';
    for (let i = 0; i < term.length; i++) {
      if (term[i] === ' ') {
        masked += '  ';
      } else if (i === 0) {
        masked += term[i].toUpperCase();
      } else if (i === term.length - 1 && term.length > 3) {
        masked += term[i].toLowerCase();
      } else {
        masked += ' _';
      }
    }

    // Count words
    const wordCount = term.split(/\s+/).length;
    const wordHint = wordCount > 1 ? ` • ${wordCount} words` : '';

    hintBox.innerHTML = `
      <i class="fas fa-lightbulb" style="color:var(--blue-500)"></i>
      <span>Starts with "<strong>${firstChar}</strong>" • ${len} letters${wordHint}</span>
      <span class="hint-mask">${masked}</span>
    `;
  }
};

const handleIdentAnswer = () => {
  const state = appState.quiz;
  if (state.isAnswered) return;

  const input = $('ident-input');
  const rawAnswer = input ? input.value.trim() : '';
  if (!rawAnswer) return;

  state.isAnswered = true;
  if (input) input.disabled = true;
  const submitBtn = $('btn-submit-ident');
  if (submitBtn) submitBtn.disabled = true;

  const targetItem = state.currentQuestion.targetItem;
  const isCorrect = checkIdentMatch(rawAnswer, targetItem);
  const points = 2; // Identification = 2 points

  const feedbackMsg = isCorrect
    ? `🎉 <strong>Spot on! (+${points} pts)</strong> "${escapeHtml(targetItem.term)}" is the correct term.`
    : `❌ <strong>Incorrect.</strong> The correct term is <strong>"${escapeHtml(targetItem.term)}"</strong>.`;

  showQuizFeedback(isCorrect, feedbackMsg);
  processResult(isCorrect, rawAnswer, targetItem.term, points);
};

const normalizeAnswer = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\b(a|an|the|dr|doctor|mr|mrs|ms)\b/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
};

const checkIdentMatch = (userAns, targetItem) => {
  const normUser = normalizeAnswer(userAns);
  if (!normUser) return false;

  const normTerm = normalizeAnswer(targetItem.term);
  if (normUser === normTerm) return true;

  // Check aliases
  if (targetItem.alias && Array.isArray(targetItem.alias)) {
    for (const alias of targetItem.alias) {
      if (normalizeAnswer(alias) === normUser) return true;
    }
  }

  // Substring match for terms >= 3 chars
  if (normUser.length >= 3 && normTerm.includes(normUser)) return true;

  return false;
};

// ======================== QUIZ FEEDBACK & SCORING ========================
const showQuizFeedback = (isCorrect, message) => {
  const feedback = $('quiz-feedback');
  const actionArea = $('quiz-action-area');

  if (feedback) {
    feedback.classList.remove('hidden', 'feedback-correct', 'feedback-incorrect');
    feedback.classList.add(isCorrect ? 'feedback-correct' : 'feedback-incorrect');
    feedback.innerHTML = `<div class="feedback-banner ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}">${message}</div>`;
  }

  if (actionArea) actionArea.classList.remove('hidden');
};

const processResult = (isCorrect, userAnswer, correctAnswer, points) => {
  const state = appState.quiz;

  if (isCorrect) {
    state.score.correct++;
    state.score.points += points;
    state.consecutiveCorrect++;
  } else {
    state.score.incorrect++;
    state.consecutiveCorrect = 0;
  }

  state.history.unshift({
    q: state.currentQuestion.targetItem.term,
    type: state.currentQuestion.mode === 'mcq' ? 'MCQ (+1pt)' : 'Identification (+2pts)',
    correct: isCorrect,
    userAns: userAnswer,
    actualAns: correctAnswer,
    points: isCorrect ? points : 0
  });

  updateScoreDisplay();
  syncScoreToLeaderboard();
};

const updateScoreDisplay = () => {
  const correctEl = $('score-correct');
  const incorrectEl = $('score-incorrect');
  const pointsEl = $('score-points');

  if (correctEl) { correctEl.textContent = appState.quiz.score.correct; correctEl.closest('.score-pill')?.classList.add('bump'); setTimeout(() => correctEl.closest('.score-pill')?.classList.remove('bump'), 400); }
  if (incorrectEl) incorrectEl.textContent = appState.quiz.score.incorrect;
  if (pointsEl) pointsEl.textContent = appState.quiz.score.points;
};

// ======================== LEADERBOARD ========================
const syncScoreToLeaderboard = async () => {
  if (!db || !appState.user) return;

  try {
    const userRef = db.collection('leaderboard').doc(appState.user.uid);
    const doc = await userRef.get();
    const existing = doc.exists ? doc.data() : { totalPoints: 0, totalCorrect: 0, totalAnswered: 0 };

    await userRef.set({
      uid: appState.user.uid,
      displayName: appState.user.displayName,
      photoURL: appState.user.photoURL || '',
      email: appState.user.email || '',
      totalPoints: existing.totalPoints + (appState.quiz.score.points - (existing.sessionPoints || 0)),
      totalCorrect: existing.totalCorrect + appState.quiz.score.correct - (existing.sessionCorrect || 0),
      totalAnswered: existing.totalAnswered + (appState.quiz.score.correct + appState.quiz.score.incorrect) - (existing.sessionAnswered || 0),
      sessionPoints: appState.quiz.score.points,
      sessionCorrect: appState.quiz.score.correct,
      sessionAnswered: appState.quiz.score.correct + appState.quiz.score.incorrect,
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn('Leaderboard sync failed:', e);
  }
};

const fetchLeaderboard = async () => {
  if (!db) {
    appState.leaderboard = [];
    return;
  }

  try {
    const snapshot = await db.collection('leaderboard')
      .orderBy('totalPoints', 'desc')
      .limit(20)
      .get();

    appState.leaderboard = snapshot.docs.map(doc => doc.data());
  } catch (e) {
    console.warn('Leaderboard fetch failed:', e);
    appState.leaderboard = [];
  }
};

// ======================== UI RENDERING ========================

// --- Dashboard ---
const renderDashboard = () => {
  const reviewer = getActiveReviewer();
  const dropdown = $('reviewer-select');
  const nameEl = $('dashboard-reviewer-name');
  const descEl = $('dashboard-reviewer-desc');
  const countEl = $('dashboard-term-count');
  const reviewBtn = $('btn-review-now');

  // Populate dropdown
  if (dropdown) {
    if (appState.reviewers.length === 0) {
      dropdown.innerHTML = '<option value="">No Reviewers Available</option>';
    } else {
      dropdown.innerHTML = appState.reviewers.map(r =>
        `<option value="${r.id}" ${r.id === appState.activeReviewerId ? 'selected' : ''}>${escapeHtml(r.name)} (${r.items.length})</option>`
      ).join('');
    }
  }

  if (!reviewer) {
    if (nameEl) nameEl.textContent = 'No Reviewer Selected';
    if (descEl) descEl.textContent = 'Create a new reviewer by uploading documents or adding terms manually.';
    if (countEl) countEl.textContent = '0 Terms';
    if (reviewBtn) { reviewBtn.disabled = true; reviewBtn.classList.add('btn-disabled'); }
    return;
  }

  if (nameEl) nameEl.textContent = reviewer.name;
  if (descEl) descEl.textContent = reviewer.description || 'Upload documents or add terms manually to build your reviewer.';
  if (countEl) countEl.textContent = `${reviewer.items.length} Terms`;

  const hasItems = reviewer.items.length > 0;
  if (reviewBtn) {
    reviewBtn.disabled = !hasItems;
    if (hasItems) {
      reviewBtn.className = 'btn btn-primary';
      reviewBtn.style.flex = '1';
    } else {
      reviewBtn.className = 'btn btn-secondary';
      reviewBtn.style.flex = '1';
      reviewBtn.style.opacity = '0.5';
      reviewBtn.style.cursor = 'not-allowed';
    }
  }
};

// --- Manager Modal Content ---
const renderManagerContent = () => {
  renderManagerReviewerList();
  renderManagerTermsEditor();
  updateUploadTargetDropdown();
};

const renderManagerReviewerList = () => {
  const list = $('manager-reviewer-list');
  if (!list) return;

  if (appState.reviewers.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-muted);font-size:0.8125rem">No reviewers created yet. Create one above!</div>';
    return;
  }

  list.innerHTML = appState.reviewers.map(r => `
    <div class="card" style="padding:0.875rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;${r.id === appState.activeReviewerId ? 'border-color:var(--blue-500);background:rgba(59,130,246,0.04)' : ''}">
      <div style="min-width:0;flex:1">
        <div style="font-weight:700;font-size:0.875rem;color:var(--text-primary)" class="truncate">${escapeHtml(r.name)}</div>
        <div style="font-size:0.6875rem;color:var(--text-muted)">${r.items.length} terms</div>
      </div>
      <div style="display:flex;align-items:center;gap:0.375rem;flex-shrink:0">
        <button class="btn btn-sm btn-primary" onclick="window._selectReviewer('${r.id}')">Select</button>
        <button class="btn btn-sm btn-ghost" style="color:var(--danger)" onclick="window._deleteReviewer('${r.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
};

const updateUploadTargetDropdown = () => {
  const select = $('upload-target-reviewer');
  if (!select) return;

  select.innerHTML = '<option value="__new__">➕ Create New Reviewer</option>' +
    appState.reviewers.map(r =>
      `<option value="${r.id}" ${r.id === appState.activeReviewerId ? 'selected' : ''}>${escapeHtml(r.name)}</option>`
    ).join('');
};

const renderManagerTermsEditor = () => {
  const editorSection = $('terms-editor-section');
  const editorContainer = $('terms-editor-container');
  const termCountEl = $('editor-term-count');

  if (!editorSection || !editorContainer) return;

  const reviewer = getActiveReviewer();
  if (!reviewer) {
    editorSection.classList.add('hidden');
    return;
  }

  editorSection.classList.remove('hidden');
  if (termCountEl) termCountEl.textContent = reviewer.items.length;

  editorContainer.innerHTML = reviewer.items.map((item, idx) => `
    <div class="card" style="padding:0.75rem;display:flex;gap:0.5rem;align-items:center">
      <input type="text" class="input" style="flex:1;font-weight:600;font-size:0.8125rem;padding:0.5rem 0.75rem;min-height:36px" value="${escapeHtml(item.term)}" onchange="window._updateTerm('${reviewer.id}',${idx},this.value)" placeholder="Term">
      <input type="text" class="input" style="flex:2;font-size:0.8125rem;padding:0.5rem 0.75rem;min-height:36px" value="${escapeHtml(item.def)}" onchange="window._updateDef('${reviewer.id}',${idx},this.value)" placeholder="Definition">
      <button class="btn btn-ghost btn-icon" style="width:32px;height:32px;color:var(--danger);flex-shrink:0" onclick="window._removeItem('${reviewer.id}',${idx})"><i class="fas fa-times"></i></button>
    </div>
  `).join('');
};

// --- Stats Modal ---
const renderStatsModal = () => {
  const state = appState.quiz;
  const correctEl = $('stat-correct');
  const incorrectEl = $('stat-incorrect');
  const pointsEl = $('stat-points');
  const accuracyEl = $('stat-accuracy');
  const accuracyBar = $('stat-accuracy-bar');
  const historyContainer = $('stat-history');
  const emptyMsg = $('stat-empty');

  const total = state.score.correct + state.score.incorrect;
  const accuracy = total === 0 ? 0 : Math.round((state.score.correct / total) * 100);

  if (correctEl) correctEl.textContent = state.score.correct;
  if (incorrectEl) incorrectEl.textContent = state.score.incorrect;
  if (pointsEl) pointsEl.textContent = state.score.points;
  if (accuracyEl) accuracyEl.textContent = `${accuracy}%`;
  if (accuracyBar) accuracyBar.style.width = `${accuracy}%`;

  if (state.history.length === 0) {
    if (emptyMsg) emptyMsg.classList.remove('hidden');
    if (historyContainer) historyContainer.innerHTML = '';
  } else {
    if (emptyMsg) emptyMsg.classList.add('hidden');
    if (historyContainer) {
      historyContainer.innerHTML = state.history.map(h => `
        <div style="padding:0.75rem;border-radius:var(--radius-lg);border-left:4px solid ${h.correct ? 'var(--success)' : 'var(--danger)'};background:${h.correct ? 'var(--success-light)' : 'var(--danger-light)'};font-size:0.8125rem">
          <div style="font-weight:600;color:var(--text-primary)">${escapeHtml(h.q)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.375rem;font-size:0.6875rem;flex-wrap:wrap;gap:0.25rem">
            <span style="text-transform:uppercase;font-weight:700;color:var(--text-muted)">${h.type}</span>
            <div>
              ${!h.correct ? `<span style="text-decoration:line-through;color:var(--danger);margin-right:0.375rem">${escapeHtml(h.userAns || 'No Answer')}</span>` : ''}
              <span style="font-weight:700;color:${h.correct ? 'var(--success)' : 'var(--text-primary)'}">${escapeHtml(h.actualAns)}</span>
            </div>
          </div>
        </div>
      `).join('');
    }
  }
};

// --- Leaderboard Modal ---
const renderLeaderboardModal = async () => {
  const container = $('leaderboard-list');
  const loadingEl = $('leaderboard-loading');
  const emptyEl = $('leaderboard-empty');

  if (!container) return;

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (emptyEl) emptyEl.classList.add('hidden');
  container.innerHTML = '';

  await fetchLeaderboard();

  if (loadingEl) loadingEl.classList.add('hidden');

  if (appState.leaderboard.length === 0) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (!db) {
      emptyEl.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)"><i class="fas fa-cloud-slash" style="font-size:2rem;margin-bottom:0.5rem;display:block;opacity:0.4"></i><p style="font-size:0.8125rem">Leaderboard requires Firebase configuration.</p><p style="font-size:0.75rem;margin-top:0.25rem">Add your Firebase config to app.js to enable.</p></div>';
    }
    return;
  }

  container.innerHTML = appState.leaderboard.map((entry, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? 'lb-rank-gold' : rank === 2 ? 'lb-rank-silver' : rank === 3 ? 'lb-rank-bronze' : 'lb-rank-default';
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const isSelf = appState.user && entry.uid === appState.user.uid;
    const total = entry.totalAnswered || 0;
    const accuracy = total > 0 ? Math.round((entry.totalCorrect / total) * 100) : 0;

    return `
      <div class="lb-row ${isSelf ? 'self' : ''}">
        <div class="lb-rank ${rankClass}">${medal}</div>
        ${entry.photoURL ? `<img src="${entry.photoURL}" alt="" style="width:2rem;height:2rem;border-radius:var(--radius-full);object-fit:cover;flex-shrink:0">` : `<div class="user-avatar-placeholder">${(entry.displayName || '?').charAt(0).toUpperCase()}</div>`}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:0.8125rem;color:var(--text-primary)" class="truncate">${escapeHtml(entry.displayName || 'Student')}</div>
          <div style="font-size:0.6875rem;color:var(--text-muted)">${accuracy}% accuracy • ${total} answers</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-weight:800;font-size:0.875rem;color:var(--blue-600)">${entry.totalPoints || 0}</div>
          <div style="font-size:0.625rem;color:var(--text-muted)">points</div>
        </div>
      </div>
    `;
  }).join('');
};

// ======================== GLOBAL WINDOW HANDLERS ========================
// These are called from inline onclick attributes in rendered HTML
window._selectReviewer = (id) => {
  appState.activeReviewerId = id;
  saveReviewers();
  renderDashboard();
  renderManagerContent();
};

window._deleteReviewer = (id) => deleteReviewer(id);

window._updateTerm = (reviewerId, idx, val) => {
  const r = appState.reviewers.find(r => r.id === reviewerId);
  if (r && r.items[idx]) { r.items[idx].term = val; saveReviewers(); renderDashboard(); }
};

window._updateDef = (reviewerId, idx, val) => {
  const r = appState.reviewers.find(r => r.id === reviewerId);
  if (r && r.items[idx]) { r.items[idx].def = val; saveReviewers(); }
};

window._removeItem = (reviewerId, idx) => {
  const r = appState.reviewers.find(r => r.id === reviewerId);
  if (r) { r.items.splice(idx, 1); saveReviewers(); renderDashboard(); renderManagerTermsEditor(); }
};

// ======================== EVENT WIRING ========================
const wireEvents = () => {
  // Theme toggle
  const themeBtn = $('btn-theme-toggle');
  if (themeBtn) themeBtn.onclick = toggleTheme;

  // Reviewer dropdown change
  const dropdown = $('reviewer-select');
  if (dropdown) dropdown.onchange = (e) => {
    appState.activeReviewerId = e.target.value;
    renderDashboard();
  };

  // Review Now button
  const reviewBtn = $('btn-review-now');
  if (reviewBtn) reviewBtn.onclick = () => {
    const reviewer = getActiveReviewer();
    if (!reviewer || reviewer.items.length === 0) {
      showToast({ type: 'warning', title: 'No Terms', message: 'Please add terms to your reviewer first!' });
      return;
    }
    appState.quiz.isActive = true;
    showScreen('screen-quiz');
    generateQuestion();
  };

  // Upload / Manage button
  const manageBtn = $('btn-manage-reviewers');
  if (manageBtn) manageBtn.onclick = () => {
    renderManagerContent();
    toggleModal($('modal-manager'), true);
  };

  // Close manager modal
  const closeManagerBtn = $('btn-close-manager');
  if (closeManagerBtn) closeManagerBtn.onclick = () => toggleModal($('modal-manager'), false);
  const doneManagerBtn = $('btn-done-manager');
  if (doneManagerBtn) doneManagerBtn.onclick = () => toggleModal($('modal-manager'), false);

  // Manager modal backdrop click
  const managerModal = $('modal-manager');
  if (managerModal) managerModal.onclick = (e) => { if (e.target === managerModal) toggleModal(managerModal, false); };

  // Create new reviewer button in manager
  const createBtn = $('btn-create-reviewer');
  if (createBtn) createBtn.onclick = () => {
    const nameInput = $('reviewer-name-input');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
      showToast({ type: 'warning', title: 'Name Required', message: 'Please enter a reviewer name.' });
      if (nameInput) nameInput.focus();
      return;
    }
    createReviewer(name);
    if (nameInput) nameInput.value = '';
    renderDashboard();
    renderManagerContent();
    showToast({ type: 'success', title: 'Reviewer Created!', message: `"${name}" is ready for terms.` });
  };

  // Add manual term
  const addTermBtn = $('btn-add-term');
  if (addTermBtn) addTermBtn.onclick = () => {
    const reviewer = getActiveReviewer();
    if (!reviewer) {
      showToast({ type: 'warning', title: 'No Reviewer', message: 'Please create or select a reviewer first.' });
      return;
    }
    reviewer.items.push({ term: 'New Term', def: 'New Definition' });
    reviewer.updatedAt = Date.now();
    saveReviewers();
    renderDashboard();
    renderManagerTermsEditor();
  };

  // File upload dropzone
  const dropzone = $('drop-zone');
  const fileInput = $('file-input');
  if (dropzone && fileInput) {
    dropzone.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files.length > 0) processUploadedFiles(e.target.files);
    };
    dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('active'); };
    dropzone.ondragleave = () => dropzone.classList.remove('active');
    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove('active');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processUploadedFiles(e.dataTransfer.files);
    };
  }

  // Quiz: Next question
  const nextBtn = $('btn-next-question');
  if (nextBtn) nextBtn.onclick = generateQuestion;

  // Quiz: Back to dashboard
  const backBtn = $('btn-back-dashboard');
  if (backBtn) backBtn.onclick = () => {
    appState.quiz.isActive = false;
    showScreen('screen-dashboard');
    renderDashboard();
  };

  // Identification submit
  const identSubmit = $('btn-submit-ident');
  if (identSubmit) identSubmit.onclick = handleIdentAnswer;

  const identInput = $('ident-input');
  if (identInput) identInput.onkeypress = (e) => { if (e.key === 'Enter') handleIdentAnswer(); };

  // Stats modal
  const statsBtn = $('btn-stats');
  if (statsBtn) statsBtn.onclick = () => {
    renderStatsModal();
    toggleModal($('modal-stats'), true);
  };

  const closeStatsBtn = $('btn-close-stats');
  if (closeStatsBtn) closeStatsBtn.onclick = () => toggleModal($('modal-stats'), false);

  const statsModal = $('modal-stats');
  if (statsModal) statsModal.onclick = (e) => { if (e.target === statsModal) toggleModal(statsModal, false); };

  // Reset stats
  const resetStatsBtn = $('btn-reset-stats');
  if (resetStatsBtn) resetStatsBtn.onclick = async () => {
    const confirmed = await showConfirm({
      title: 'Reset Session Stats?',
      message: 'This will reset your current score and review history.',
      confirmText: 'Reset',
      type: 'warning'
    });
    if (confirmed) {
      appState.quiz.score = { correct: 0, incorrect: 0, count: 0, points: 0 };
      appState.quiz.history = [];
      appState.quiz.consecutiveCorrect = 0;
      updateScoreDisplay();
      renderStatsModal();
      showToast({ type: 'info', title: 'Stats Reset', message: 'Your session stats have been cleared.' });
    }
  };

  // Leaderboard modal
  const lbBtn = $('btn-leaderboard');
  if (lbBtn) lbBtn.onclick = () => {
    renderLeaderboardModal();
    toggleModal($('modal-leaderboard'), true);
  };

  const closeLbBtn = $('btn-close-leaderboard');
  if (closeLbBtn) closeLbBtn.onclick = () => toggleModal($('modal-leaderboard'), false);

  const lbModal = $('modal-leaderboard');
  if (lbModal) lbModal.onclick = (e) => { if (e.target === lbModal) toggleModal(lbModal, false); };

  // Sign in button
  const signInBtn = $('btn-sign-in');
  if (signInBtn) signInBtn.onclick = signInWithGoogle;

  // Sign out from menu
  const signOutBtn = $('btn-sign-out');
  if (signOutBtn) signOutBtn.onclick = async () => {
    toggleUserMenu();
    await signOut();
  };

  // User menu trigger
  const userMenuTrigger = $('user-menu-trigger');
  if (userMenuTrigger) userMenuTrigger.onclick = (e) => {
    e.stopPropagation();
    toggleUserMenu();
  };

  // Brand home click
  const brandHome = $('brand-home');
  if (brandHome) brandHome.onclick = () => {
    appState.quiz.isActive = false;
    showScreen('screen-dashboard');
    renderDashboard();
  };
};

// ======================== APP INITIALIZATION ========================
const initApp = () => {
  initTheme();
  initFirebase();

  // Auth state listener
  if (auth) {
    auth.onAuthStateChanged(onAuthStateChange);
  } else {
    renderAuthUI();
  }

  loadReviewers();
  renderDashboard();
  updateScoreDisplay();
  wireEvents();

  // Show dashboard screen
  showScreen('screen-dashboard');
};

// Boot on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

'use strict';

// ---------------------------------------------------------------------------
// URL Hash State - shareable bookmarkable URLs
// ---------------------------------------------------------------------------

const HASH_DEFAULTS = {
  rs: 1, rf: 1, h: 75, cw: 0, cs: 50,
  d: 900, sp: 20, sh: 75, dh: 75, salt: 2, ft: 'bread'
};

const VALID_FLOUR_TYPES = ['ap', 'bread', 'ww', 'rye', 'spelt', 'mix'];

// Recommended dough hydration per flour type (Mixed has none - it is manual).
const FLOUR_HYDRATION = { ap: 70, bread: 75, ww: 80, rye: 90, spelt: 72 };
const FLOUR_LABELS = { ap: 'All-Purpose', bread: 'Bread Flour', ww: 'Whole Wheat', rye: 'Rye', spelt: 'Spelt', mix: 'Mixed' };
const DOUGH_PRESETS = [65, 75, 80, 90];

let suppressHashWrite = true;

// Cached references to frequently-read elements. This script runs at the end of
// <body>, so the DOM is already parsed and these all resolve.
const els = {
  tabStarter: document.getElementById('tab-starter'),
  feedingRatioStarter: document.getElementById('feedingRatioStarter'),
  feedingRatioFlour: document.getElementById('feedingRatioFlour'),
  hydration: document.getElementById('hydration'),
  starterPercentage: document.getElementById('starterPercentage'),
  starterHydration: document.getElementById('starterHydration'),
  doughHydration: document.getElementById('doughHydration'),
  defaultHydrationBtn: document.getElementById('defaultHydrationBtn'),
  mixedDoughHydration: document.getElementById('mixedDoughHydration'),
  saltPercent: document.getElementById('saltPercent'),
  starterContainerWarning: document.getElementById('starterContainerWarning'),
  saltWarning: document.getElementById('saltWarning'),
  breadInfeasibleWarning: document.getElementById('breadInfeasibleWarning'),
  breadInfeasibleWarningText: document.getElementById('breadInfeasibleWarningText')
};

function getActiveFlourType() {
  return document.querySelector('.flour-btn.active')?.dataset.flourType || HASH_DEFAULTS.ft;
}

function setIfNonDefault(params, key, value) {
  if (value === undefined || value === null) return;
  if (typeof value === 'number' && isNaN(value)) return;
  if (value !== HASH_DEFAULTS[key]) params.set(key, String(value));
}

function hasAnyCustomizations() {
  if (getInputValue('feedingRatioStarter', HASH_DEFAULTS.rs) !== HASH_DEFAULTS.rs) return true;
  if (getInputValue('feedingRatioFlour', HASH_DEFAULTS.rf) !== HASH_DEFAULTS.rf) return true;
  if (getInputValue('hydration', HASH_DEFAULTS.h) !== HASH_DEFAULTS.h) return true;
  if (getNonNegativeInputValue('containerWeightStarter', 0) !== HASH_DEFAULTS.cw) return true;
  if (getNonNegativeInputValue('currentStarter', 0) !== HASH_DEFAULTS.cs) return true;

  if (getNonNegativeInputValue('targetDoughWeight', 900) !== HASH_DEFAULTS.d) return true;
  if (getInputValue('starterPercentage', HASH_DEFAULTS.sp) !== HASH_DEFAULTS.sp) return true;
  if (getInputValue('starterHydration', HASH_DEFAULTS.sh) !== HASH_DEFAULTS.sh) return true;
  if (getInputValue('doughHydration', HASH_DEFAULTS.dh) !== HASH_DEFAULTS.dh) return true;
  if (getInputValue('saltPercent', HASH_DEFAULTS.salt) !== HASH_DEFAULTS.salt) return true;
  if (getActiveFlourType() !== HASH_DEFAULTS.ft) return true;

  return false;
}

function updateResetVisibility() {
  const btn = document.querySelector('.reset-btn');
  if (!btn) return;
  btn.classList.toggle('hidden', !hasAnyCustomizations());
}

function writeHashState() {
  updateResetVisibility();
  if (suppressHashWrite) return;

  const isStarterActive = els.tabStarter.classList.contains('active');
  const tab = isStarterActive ? 's' : 'b';
  const params = new URLSearchParams();

  if (isStarterActive) {
    setIfNonDefault(params, 'rs', parseFloat(els.feedingRatioStarter.value));
    setIfNonDefault(params, 'rf', parseFloat(els.feedingRatioFlour.value));
    setIfNonDefault(params, 'h', parseFloat(els.hydration.value));
    setIfNonDefault(params, 'cw', getNonNegativeInputValue('containerWeightStarter', 0));
    setIfNonDefault(params, 'cs', getNonNegativeInputValue('currentStarter', 0));
  } else {
    setIfNonDefault(params, 'd', getNonNegativeInputValue('targetDoughWeight', 900));
    setIfNonDefault(params, 'sp', parseFloat(els.starterPercentage.value));
    setIfNonDefault(params, 'sh', parseFloat(els.starterHydration.value));
    const ft = getActiveFlourType();
    const dh = parseFloat(els.doughHydration.value);
    const defaultHydrationActive = els.defaultHydrationBtn.classList.contains('active');
    // When "Default" tracks a named flour, hydration is derived from the flour on
    // load, so there is no need to store it. Otherwise (a preset opted out, or a
    // Mixed manual value) persist dh exactly so the state round-trips.
    if (!(defaultHydrationActive && ft !== 'mix') && !isNaN(dh)) {
      params.set('dh', String(dh));
    }
    setIfNonDefault(params, 'salt', parseFloat(els.saltPercent.value));
    setIfNonDefault(params, 'ft', ft);
  }

  const qs = params.toString();
  const hasParams = qs.length > 0;
  const allDefault = !hasParams && isStarterActive;

  let newUrl;
  if (allDefault) {
    newUrl = location.pathname + location.search;
  } else {
    const newHash = hasParams ? '#' + tab + '?' + qs : '#' + tab;
    newUrl = location.pathname + location.search + newHash;
  }

  if ((location.pathname + location.search + location.hash) !== newUrl) {
    history.replaceState(null, '', newUrl);
  }
}

function applyHashState() {
  const hash = location.hash.slice(1);
  if (!hash) return;

  try {
    const qIndex = hash.indexOf('?');
    const tab = qIndex === -1 ? hash : hash.slice(0, qIndex);
    const qs = qIndex === -1 ? '' : hash.slice(qIndex + 1);
    const params = new URLSearchParams(qs);

    suppressHashWrite = true;
    try {
      if (tab === 'b') {
        showTab('bread');

        if (params.has('ft')) {
          const ft = params.get('ft');
          if (VALID_FLOUR_TYPES.indexOf(ft) !== -1) {
            setFlourType(ft);
          }
        }
        if (params.has('d')) {
          const d = parseFloat(params.get('d'));
          if (!isNaN(d) && d > 0) setDoughWeight(d);
        }
        if (params.has('sp')) {
          const sp = parseFloat(params.get('sp'));
          if (!isNaN(sp)) setStarterPercentage(sp);
        }
        if (params.has('sh')) {
          const sh = parseFloat(params.get('sh'));
          if (!isNaN(sh)) setBreadStarterHydration(sh);
        }
        if (params.has('dh')) {
          const dh = parseFloat(params.get('dh'));
          if (!isNaN(dh)) {
            // A non-preset value under Mixed flour lives in the custom input;
            // anything else maps onto a preset (or sets the raw value).
            if (getActiveFlourType() === 'mix' && DOUGH_PRESETS.indexOf(dh) === -1) {
              els.mixedDoughHydration.value = dh;
              setDefaultHydration();
            } else {
              setDoughHydration(dh);
            }
          }
        }
        if (params.has('salt')) {
          const salt = parseFloat(params.get('salt'));
          if (!isNaN(salt)) document.getElementById('saltPercent').value = salt;
        }
        calculateBread();
      } else if (tab === 's') {
        showTab('starter');

        const hasRs = params.has('rs');
        const hasRf = params.has('rf');
        if (hasRs || hasRf) {
          const rs = hasRs ? parseFloat(params.get('rs')) : HASH_DEFAULTS.rs;
          const rf = hasRf ? parseFloat(params.get('rf')) : HASH_DEFAULTS.rf;
          if (!isNaN(rs) && !isNaN(rf)) setReadyTime(rs, rf);
        }
        if (params.has('h')) {
          const h = parseFloat(params.get('h'));
          if (!isNaN(h)) setStarterHydration(h);
        }
        if (params.has('cw')) {
          const cw = parseFloat(params.get('cw'));
          if (!isNaN(cw) && cw >= 0) document.getElementById('containerWeightStarter').value = cw;
        }
        if (params.has('cs')) {
          const cs = parseFloat(params.get('cs'));
          if (!isNaN(cs) && cs >= 0) document.getElementById('currentStarter').value = cs;
        }
        calculateStarter();
      }
    } finally {
      suppressHashWrite = false;
    }

    writeHashState();
  } catch (e) {
    suppressHashWrite = false;
    console.warn('Failed to apply hash state:', e);
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function setActiveButton(selector, dataAttr, value) {
  const buttons = document.querySelectorAll(selector);
  buttons.forEach(btn => {
    const isMatch = btn.dataset[dataAttr] === String(value);
    btn.classList.toggle('active', isMatch);
    btn.setAttribute('aria-pressed', String(isMatch));
  });
}

function getInputValue(id, fallback) {
  const v = parseFloat(document.getElementById(id).value);
  return isNaN(v) ? fallback : v;
}

function getNonNegativeInputValue(id, fallback) {
  return Math.max(0, getInputValue(id, fallback));
}

function clamp(value) {
  return Math.max(0, value);
}

function displayGrams(id, value) {
  document.getElementById(id).textContent = clamp(value).toFixed(1) + ' g';
}

function updatePrintTitle() {
  const titleEl = document.getElementById('printTitle');
  if (!titleEl) return;

  const isStarterActive = document.getElementById('tab-starter').classList.contains('active');

  if (isStarterActive) {
    const rs = getInputValue('feedingRatioStarter', 1);
    const rf = getInputValue('feedingRatioFlour', 1);
    const h = getInputValue('hydration', 75);
    const rw = rf * (h / 100);
    const rwText = Number(rw.toFixed(2)).toString();
    titleEl.textContent = 'Starter Feeding - ' + rs + ':' + rf + ':' + rwText + ' ratio, ' + h + '% hydration';
  } else {
    const d = getInputValue('targetDoughWeight', 900);
    const dh = getInputValue('doughHydration', 75);
    const flourLabel = document.querySelector('.flour-btn.active .flour-label');
    const flourText = flourLabel ? flourLabel.textContent : 'Bread Flour';
    titleEl.textContent = 'Sourdough Recipe - ' + d + ' g, ' + flourText + ', ' + dh + '% hydration';
  }
}

// ---------------------------------------------------------------------------
// Tab Navigation
// ---------------------------------------------------------------------------

function showTab(which) {
  const starterSection = document.getElementById('section-starter');
  const breadSection = document.getElementById('section-bread');
  const tabStarter = document.getElementById('tab-starter');
  const tabBread = document.getElementById('tab-bread');

  const isStarter = which === 'starter';

  starterSection.classList.toggle('hidden', !isStarter);
  breadSection.classList.toggle('hidden', isStarter);
  tabStarter.classList.toggle('active', isStarter);
  tabBread.classList.toggle('active', !isStarter);
  tabStarter.setAttribute('aria-selected', String(isStarter));
  tabBread.setAttribute('aria-selected', String(!isStarter));
  tabStarter.setAttribute('tabindex', isStarter ? '0' : '-1');
  tabBread.setAttribute('tabindex', isStarter ? '-1' : '0');

  writeHashState();
  updatePrintTitle();
}

function handleTablistKeydown(event) {
  const key = event.key;
  if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
  event.preventDefault();
  const tabs = ['starter', 'bread'];
  const current = document.activeElement && document.activeElement.id === 'tab-bread' ? 1 : 0;
  let next = current;
  if (key === 'ArrowRight') next = (current + 1) % tabs.length;
  else if (key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
  else if (key === 'Home') next = 0;
  else if (key === 'End') next = tabs.length - 1;
  showTab(tabs[next]);
  document.getElementById('tab-' + tabs[next]).focus();
}

// ---------------------------------------------------------------------------
// Starter Feeding - UI Controls
// ---------------------------------------------------------------------------

function setReadyTime(ratioStarter, ratioFlour) {
  document.getElementById('feedingRatioStarter').value = ratioStarter;
  document.getElementById('feedingRatioFlour').value = ratioFlour;

  document.querySelectorAll('.time-btn').forEach(btn => {
    const isMatch = parseFloat(btn.dataset.ratioStarter) === ratioStarter &&
                    parseFloat(btn.dataset.ratioFlour) === ratioFlour;
    btn.classList.toggle('active', isMatch);
    btn.setAttribute('aria-pressed', String(isMatch));
  });

  calculateStarter();
}

function updateRatioLabels() {
  const hydration = getInputValue('hydration', 75);
  document.querySelectorAll('.time-btn').forEach(btn => {
    const s = parseFloat(btn.dataset.ratioStarter);
    const f = parseFloat(btn.dataset.ratioFlour);
    const w = f * (hydration / 100);
    const wText = Number(w.toFixed(2)).toString();
    btn.querySelector('.time-ratio').textContent = s + ':' + f + ':' + wText + ' ratio';
  });
}

function setStarterHydration(value) {
  document.getElementById('hydration').value = value;
  setActiveButton('#section-starter .hydration-buttons .hydration-btn', 'value', value);
  updateRatioLabels();
  calculateStarter();
}

function useStarterInRecipe() {
  const hydration = getInputValue('hydration', 75);
  const presets = [50, 75, 100, 125];
  if (presets.indexOf(hydration) !== -1) {
    setBreadStarterHydration(hydration);
  } else {
    document.getElementById('starterHydration').value = hydration;
    calculateBread();
  }
  showTab('bread');
  const breadSection = document.getElementById('section-bread');
  if (breadSection) {
    breadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ---------------------------------------------------------------------------
// Bread Baking - UI Controls
// ---------------------------------------------------------------------------

// Refresh the "Default" hydration option's label to the active flour's recommendation.
function updateDefaultHydrationLabel() {
  const ft = getActiveFlourType();
  if (ft === 'mix') return; // Mixed shows the manual input, not the label.
  const pctEl = document.getElementById('defaultHydrationPct');
  const descEl = document.getElementById('defaultHydrationDesc');
  if (pctEl) pctEl.textContent = FLOUR_HYDRATION[ft] + '%';
  if (descEl) descEl.textContent = 'Best for ' + FLOUR_LABELS[ft];
}

function isDefaultHydrationActive() {
  return els.defaultHydrationBtn.classList.contains('active');
}

function setFlourType(type) {
  setActiveButton('.flour-btn', 'flourType', type);
  const isMixed = type === 'mix';
  els.defaultHydrationBtn.classList.toggle('is-mixed', isMixed);

  if (isMixed) {
    // Mixed has no recommended hydration, so the Default option becomes a manual
    // % input. While Default is the selected option, the typed value is used.
    if (isDefaultHydrationActive()) {
      els.doughHydration.value = getInputValue('mixedDoughHydration', 75);
      if (!suppressHashWrite) {
        els.mixedDoughHydration.focus();
        els.mixedDoughHydration.select();
      }
    }
  } else {
    updateDefaultHydrationLabel();
    // While "Default" is selected, dough hydration tracks the flour's recommendation.
    // Picking a specific preset opts out, and a live flour change leaves it alone.
    if (isDefaultHydrationActive()) {
      els.doughHydration.value = FLOUR_HYDRATION[type];
    }
  }
  calculateBread();
}

// "Default" hydration option: track the flour (named) or take the manual % (Mixed).
function setDefaultHydration() {
  setActiveButton('.dough-hydration-buttons .hydration-btn', 'value', 'default');
  if (getActiveFlourType() === 'mix') {
    els.doughHydration.value = getInputValue('mixedDoughHydration', 75);
    if (!suppressHashWrite) {
      els.mixedDoughHydration.focus();
      els.mixedDoughHydration.select();
    }
  } else {
    els.doughHydration.value = FLOUR_HYDRATION[getActiveFlourType()];
  }
  calculateBread();
}

function handleDefaultHydrationKeydown(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    setDefaultHydration();
  }
}

// Typing in the Mixed % input selects the Default option and applies the value.
function onMixedHydrationInput() {
  setActiveButton('.dough-hydration-buttons .hydration-btn', 'value', 'default');
  els.doughHydration.value = getInputValue('mixedDoughHydration', 75);
  calculateBread();
}

function setBreadStarterHydration(value) {
  document.getElementById('starterHydration').value = value;
  setActiveButton('.starter-hydration-buttons .hydration-btn', 'value', value);
  calculateBread();
}

function setDoughHydration(value) {
  els.doughHydration.value = value;
  setActiveButton('.dough-hydration-buttons .hydration-btn', 'value', value);
  // Keep the Mixed custom input in sync so it reflects the active value.
  if (getActiveFlourType() === 'mix') els.mixedDoughHydration.value = value;
  calculateBread();
}

function setDoughWeight(weight) {
  setActiveButton('.weight-btn', 'weight', weight);
  document.getElementById('targetDoughWeight').value = weight;
  calculateBread();
}

function toggleCustomWeight() {
  setActiveButton('.weight-btn', 'weight', 'custom');

  const input = document.getElementById('targetDoughWeight');
  input.focus();
  input.select();
}

function handleCustomWeightKeydown(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    toggleCustomWeight();
  }
}

function setStarterPercentage(percent) {
  document.getElementById('starterPercentage').value = percent;
  setActiveButton('.starter-pct-btn', 'value', percent);
  calculateBread();
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

function resetCalculator() {
  document.getElementById('containerWeightStarter').value = 0;
  document.getElementById('currentStarter').value = 50;
  document.getElementById('saltPercent').value = 2;

  setReadyTime(1, 1);
  setStarterHydration(75);

  const customBtn = document.getElementById('customWeightBtn');
  if (customBtn) customBtn.classList.remove('active');
  setDoughWeight(900);
  setStarterPercentage(20);
  els.mixedDoughHydration.value = 75;
  setFlourType('bread');
  setBreadStarterHydration(75);
  setDefaultHydration();

  ['saltWarning', 'starterContainerWarning',
   'breadInfeasibleWarning'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  calculateStarter();
  calculateBread();
}

// ---------------------------------------------------------------------------
// Starter Feeding - Calculation
// ---------------------------------------------------------------------------

function calculateStarter() {
  const containerWeight = getNonNegativeInputValue('containerWeightStarter', 0);
  const currentStarterTotal = getNonNegativeInputValue('currentStarter', 0);
  const hydration = getInputValue('hydration', 75);
  const ratioStarter = getInputValue('feedingRatioStarter', 1);
  const ratioFlour = getInputValue('feedingRatioFlour', 1);

  // Water ratio derived from flour ratio and target hydration
  const ratioWater = ratioFlour * (hydration / 100);

  const starterToUse = Math.max(0, currentStarterTotal - containerWeight);
  const flourToAdd = starterToUse * (ratioFlour / ratioStarter);
  const waterToAdd = starterToUse * (ratioWater / ratioStarter);

  const showWarning = containerWeight > 0 && currentStarterTotal > 0 && currentStarterTotal <= containerWeight;
  const totalWeight = showWarning ? 0 : clamp(starterToUse) + clamp(flourToAdd) + clamp(waterToAdd) + clamp(containerWeight);

  els.starterContainerWarning.classList.toggle('hidden', !showWarning);

  displayGrams('starterToUse', starterToUse);
  displayGrams('flourToAdd', flourToAdd);
  displayGrams('waterToAdd', waterToAdd);
  displayGrams('totalWeight', totalWeight);

  writeHashState();
  updatePrintTitle();
}

// ---------------------------------------------------------------------------
// Bread Baking - Calculation
// ---------------------------------------------------------------------------

function calculateBread() {
  const targetDoughWeight = getNonNegativeInputValue('targetDoughWeight', 0);
  const starterPercentage = getInputValue('starterPercentage', 20);
  const starterHydration = getInputValue('starterHydration', 75);
  const doughHydration = getInputValue('doughHydration', 75);
  const rawSaltPercent = getInputValue('saltPercent', 2);
  const saltPercent = Math.min(10, Math.max(0, rawSaltPercent));

  const saltInput = els.saltPercent;
  const saltWarning = els.saltWarning;
  const typedValue = parseFloat(saltInput.value);
  const outOfRange = !isNaN(typedValue) && (typedValue < 0 || typedValue > 10);
  saltWarning.classList.toggle('hidden', !outOfRange);

  // Total flour from Baker's Percentage:
  // Dough = Flour + Water + Salt = Flour * (1 + hydration% + salt%)
  const totalFlour = targetDoughWeight / (1 + (doughHydration / 100) + (saltPercent / 100));

  // Starter is a percentage of total flour
  const starterWeight = totalFlour * (starterPercentage / 100);

  // Break starter into its flour and water components
  const flourInStarter = starterWeight / (1 + starterHydration / 100);
  const waterInStarter = starterWeight - flourInStarter;

  // Remaining ingredients to add on top of what the starter contributes
  const flourToAdd = totalFlour - flourInStarter;
  const totalWater = totalFlour * (doughHydration / 100);
  const waterToAdd = totalWater - waterInStarter;
  const salt = totalFlour * (saltPercent / 100);

  const breadInfeasibleWarning = els.breadInfeasibleWarning;
  const breadInfeasibleWarningText = els.breadInfeasibleWarningText;
  const negativeFlour = flourToAdd < 0;
  const negativeWater = !negativeFlour && waterToAdd < 0;
  if (breadInfeasibleWarning && breadInfeasibleWarningText) {
    if (negativeFlour) {
      breadInfeasibleWarningText.textContent = 'That starter carries more flour than this recipe needs, so lower the Starter %.';
    } else if (negativeWater) {
      breadInfeasibleWarningText.textContent = 'That starter carries more water than your dough wants, so lower the Starter % or raise the Dough Hydration.';
    }
    breadInfeasibleWarning.classList.toggle('hidden', !(negativeFlour || negativeWater));
  }

  displayGrams('netStarter', starterWeight);
  displayGrams('additionalFlour', flourToAdd);
  displayGrams('additionalWater', waterToAdd);
  displayGrams('salt', salt);
  displayGrams('totalDough', clamp(starterWeight) + clamp(flourToAdd) + clamp(waterToAdd) + clamp(salt));

  writeHashState();
  updatePrintTitle();
}

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------

updateRatioLabels();
updateDefaultHydrationLabel();
calculateStarter();
calculateBread();
document.querySelector('.tabs').addEventListener('keydown', handleTablistKeydown);

suppressHashWrite = false;
applyHashState();

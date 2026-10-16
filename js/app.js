'use strict';

// ---------------------------------------------------------------------------
// URL Hash State - shareable bookmarkable URLs
// ---------------------------------------------------------------------------

const HASH_DEFAULTS = {
  rs: 1, rf: 1, h: 75, cw: 0, cs: 50,
  d: 900, sp: 20, sh: 75, dh: 75, salt: 2, mi: 0, ft: 'bread'
};

const VALID_FLOUR_TYPES = ['ap', 'bread', 'ww', 'rye', 'spelt', 'mix'];

// Recommended dough hydration per flour type (Mixed has none - it is manual).
const FLOUR_HYDRATION = { ap: 70, bread: 75, ww: 80, rye: 90, spelt: 72 };
const FLOUR_LABELS = { ap: 'All-Purpose', bread: 'Bread Flour', ww: 'Whole Wheat', rye: 'Rye', spelt: 'Spelt', mix: 'Mixed' };
const DOUGH_PRESETS = [65, 75, 80, 90];
const WEIGHT_PRESETS = [650, 900, 1800];
const STORAGE_KEY = 'loafbuddy-state';

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
  mixinsPercent: document.getElementById('mixinsPercent'),
  starterContainerWarning: document.getElementById('starterContainerWarning'),
  saltWarning: document.getElementById('saltWarning'),
  doughHydrationWarning: document.getElementById('doughHydrationWarning'),
  mixinsWarning: document.getElementById('mixinsWarning'),
  mixinsRow: document.getElementById('mixinsRow'),
  breadInfeasibleWarning: document.getElementById('breadInfeasibleWarning'),
  breadInfeasibleWarningText: document.getElementById('breadInfeasibleWarningText'),
  resetBtn: document.querySelector('.reset-btn')
};

function getActiveFlourType() {
  return document.querySelector('.flour-btn.active')?.dataset.flourType || HASH_DEFAULTS.ft;
}

function setIfNonDefault(params, key, value) {
  if (value === undefined || value === null) return;
  if (typeof value === 'number' && isNaN(value)) return;
  if (value !== HASH_DEFAULTS[key]) params.set(key, String(value));
}

// Persist the current state string so a returning visitor (with no shared hash)
// gets their last setup back. An empty string means all-default, so clear it.
// localStorage access is wrapped because Safari private mode throws on write.
function saveStoredState(stateStr) {
  try {
    if (stateStr) localStorage.setItem(STORAGE_KEY, stateStr);
    else localStorage.removeItem(STORAGE_KEY);
  } catch (e) { /* localStorage unavailable */ }
}

function readStoredState() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return null; // localStorage unavailable (e.g. Safari private mode)
  }
}

// Encode every non-default setting as URL params. Both tabs' params share one
// query string (the keys are disjoint), so an all-default calculator encodes to
// an empty string.
function buildStateParams() {
  const params = new URLSearchParams();
  setIfNonDefault(params, 'rs', parseFloat(els.feedingRatioStarter.value));
  setIfNonDefault(params, 'rf', parseFloat(els.feedingRatioFlour.value));
  setIfNonDefault(params, 'h', parseFloat(els.hydration.value));
  setIfNonDefault(params, 'cw', getNonNegativeInputValue('containerWeightStarter', 0));
  setIfNonDefault(params, 'cs', getNonNegativeInputValue('currentStarter', 0));

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
  setIfNonDefault(params, 'mi', parseFloat(els.mixinsPercent.value));
  setIfNonDefault(params, 'ft', ft);
  return params;
}

// Runs after every change: refresh the UI derived from the whole state, then
// mirror the state to the URL hash and localStorage.
function writeHashState() {
  const qs = buildStateParams().toString();
  els.resetBtn.classList.toggle('hidden', !qs);
  updatePrintTitle();
  if (suppressHashWrite) return;

  // The s/b prefix only records which tab to show.
  const isStarterActive = els.tabStarter.classList.contains('active');
  const stateStr = (isStarterActive ? 's' : 'b') + (qs ? '?' + qs : '');
  const allDefault = !qs && isStarterActive;

  saveStoredState(allDefault ? '' : stateStr);

  const newUrl = location.pathname + location.search + (allDefault ? '' : '#' + stateStr);
  if ((location.pathname + location.search + location.hash) !== newUrl) {
    history.replaceState(null, '', newUrl);
  }
}

// Apply a parsed (tab, params) pair to the UI. A missing or invalid key falls
// back to its default, so the result never depends on what was on screen before:
// a pasted link fully replaces the current setup, and reset is just empty params.
// The cascade of set* calls is wrapped in suppressHashWrite so nothing writes
// back mid-apply; the caller runs writeHashState() once afterward.
function applyState(tab, params) {
  const num = (key, isValid = () => true) => {
    const v = parseFloat(params.get(key));
    return Number.isFinite(v) && isValid(v) ? v : HASH_DEFAULTS[key];
  };

  suppressHashWrite = true;
  try {
    // The tab prefix only decides which tab to show; both groups of params are
    // applied regardless, so a shared URL restores both sections at once.
    showTab(tab === 'b' ? 'bread' : 'starter');

    // Starter params
    setReadyTime(num('rs', v => v > 0), num('rf', v => v > 0));
    setStarterHydration(num('h', v => v >= 0));
    document.getElementById('containerWeightStarter').value = num('cw', v => v >= 0);
    document.getElementById('currentStarter').value = num('cs', v => v >= 0);

    // Bread params (ft first so the dough hydration rule below sees it)
    const ft = VALID_FLOUR_TYPES.includes(params.get('ft')) ? params.get('ft') : HASH_DEFAULTS.ft;
    setFlourType(ft);
    setDoughWeight(num('d', v => v > 0));
    setStarterPercentage(num('sp', v => v >= 0));
    setBreadStarterHydration(num('sh', v => v >= 0));
    // No dh means the Default option. A non-preset value under Mixed flour lives
    // in its custom input; anything else maps onto a preset (or sets the raw value).
    const dh = parseFloat(params.get('dh'));
    const hasDh = Number.isFinite(dh) && dh > 0;
    if (hasDh && (ft !== 'mix' || DOUGH_PRESETS.includes(dh))) {
      setDoughHydration(dh);
    } else {
      els.mixedDoughHydration.value = hasDh ? dh : HASH_DEFAULTS.dh;
      setDefaultHydration();
    }
    document.getElementById('saltPercent').value = num('salt');
    document.getElementById('mixinsPercent').value = num('mi');

    calculateStarter();
    calculateBread();
  } finally {
    suppressHashWrite = false;
  }
}

// Split a stored "tab?qs" state string into its tab and URLSearchParams.
function parseStateString(stateStr) {
  const qIndex = stateStr.indexOf('?');
  const tab = qIndex === -1 ? stateStr : stateStr.slice(0, qIndex);
  const qs = qIndex === -1 ? '' : stateStr.slice(qIndex + 1);
  return { tab, params: new URLSearchParams(qs) };
}

// Apply a state string from the hash or localStorage, then write it back
// normalized.
function applyStateString(stateStr) {
  try {
    const { tab, params } = parseStateString(stateStr);
    applyState(tab, params);
    writeHashState();
  } catch (e) {
    console.warn('Failed to apply saved state:', e);
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

// Nested interactive controls: customWeightBtn and defaultHydrationBtn each wrap a
// focusable <input>. Exposing the wrapper as role="button" while its input shows
// nests two interactive elements, which screen readers announce as one confusing
// control. Expose exactly one at a time: the wrapper is the button only while its
// input is collapsed; when the input is visible (Custom weight active, or Mixed
// dough hydration) the wrapper drops role + tabindex so the input stands alone.
function setWrapperButtonRole(el, asButton) {
  if (!el) return;
  if (asButton) {
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
  } else {
    el.removeAttribute('role');
    el.removeAttribute('tabindex');
  }
}

function syncNestedControlRoles() {
  const customWrap = document.getElementById('customWeightBtn');
  if (customWrap) setWrapperButtonRole(customWrap, !customWrap.classList.contains('active'));
  setWrapperButtonRole(els.defaultHydrationBtn, !els.defaultHydrationBtn.classList.contains('is-mixed'));
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

// Baker's percentage label, trailing zeros dropped (75 -> "75%", 2.5 -> "2.5%").
function displayPct(id, value) {
  document.getElementById(id).textContent = Number(value.toFixed(1)).toString() + '%';
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
  setBreadStarterHydration(getInputValue('hydration', 75));
  showTab('bread');
  // The clicked button just got hidden with the starter tab, so hand focus to
  // the Bread tab and bring the recipe into view.
  document.getElementById('tab-bread').focus({ preventScroll: true });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelector('.tab-row').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

let copiedBtn = null;
let copiedResetTimer = null;

// The current URL already encodes the full recipe (hash state). Offer the native
// share sheet where available (mobile), otherwise copy the link and flash a brief
// confirmation on the button that was clicked. If both are blocked, show the
// link in a prompt so it can still be copied by hand.
async function shareRecipe(event) {
  const btn = event.currentTarget;
  const url = location.href;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'My Loaf Buddy recipe',
        text: "Here's my sourdough recipe from Loaf Buddy, with every weight worked out for you.",
        url: url
      });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // user dismissed the share sheet
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    flashCopied(btn);
  } catch (e) {
    window.prompt('Copy this link to share your recipe:', url);
  }
}

function flashCopied(btn) {
  // Revert any button still showing the confirmation before flashing this one.
  if (copiedResetTimer) {
    clearTimeout(copiedResetTimer);
    if (copiedBtn) copiedBtn.textContent = 'Share recipe';
  }
  btn.textContent = 'Link copied!';
  copiedBtn = btn;
  copiedResetTimer = setTimeout(() => {
    btn.textContent = 'Share recipe';
    copiedResetTimer = null;
    copiedBtn = null;
  }, 2000);
}

// The print stylesheet handles the layout; this just opens the browser dialog.
function printRecipe() {
  window.print();
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
  syncNestedControlRoles();

  if (isMixed) {
    // Mixed has no recommended hydration, so the Default option becomes a manual
    // % input. While Default is the selected option, the typed value is used;
    // seed it with the current hydration so switching flour keeps the dough as is.
    if (isDefaultHydrationActive()) {
      els.mixedDoughHydration.value = els.doughHydration.value;
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
  // Ignore keydowns bubbling up from the inner number input - re-running the
  // handler would refocus/select it and wipe what the user just typed.
  if (event.target.tagName === 'INPUT') return;
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
  // A non-preset weight (only reachable via a shared URL) belongs to the Custom
  // option, so activate that button to reveal the input with the value in it.
  const isPreset = WEIGHT_PRESETS.indexOf(weight) !== -1;
  setActiveButton('.weight-btn', 'weight', isPreset ? weight : 'custom');
  syncNestedControlRoles();
  document.getElementById('targetDoughWeight').value = weight;
  calculateBread();
}

function toggleCustomWeight() {
  setActiveButton('.weight-btn', 'weight', 'custom');
  syncNestedControlRoles();

  const input = document.getElementById('targetDoughWeight');
  input.focus();
  input.select();
}

function handleCustomWeightKeydown(event) {
  // Ignore keydowns bubbling up from the inner number input - re-running the
  // handler would refocus/select it and wipe what the user just typed.
  if (event.target.tagName === 'INPUT') return;
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

// Defaults are just an empty state, so reset reuses the same path as a shared link.
function resetCalculator() {
  applyState(els.tabStarter.classList.contains('active') ? 's' : 'b', new URLSearchParams());
  writeHashState();
  // Drop the remembered setup so a reload returns to defaults. This runs after
  // writeHashState, which would otherwise re-save the open tab.
  saveStoredState('');
  // The Reset button just hid itself, so move focus to the open tab.
  document.querySelector('.tab-btn.active').focus();
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
}

// ---------------------------------------------------------------------------
// Bread Baking - Calculation
// ---------------------------------------------------------------------------

function calculateBread() {
  const targetDoughWeight = getNonNegativeInputValue('targetDoughWeight', 0);
  const starterPercentage = getInputValue('starterPercentage', 20);
  const starterHydration = getInputValue('starterHydration', 75);
  const rawDoughHydration = getInputValue('doughHydration', 75);
  const doughHydration = Math.min(200, Math.max(1, rawDoughHydration));
  const rawSaltPercent = getInputValue('saltPercent', 2);
  const saltPercent = Math.min(10, Math.max(0, rawSaltPercent));
  const rawMixinsPercent = getInputValue('mixinsPercent', 0);
  const mixinsPercent = Math.min(50, Math.max(0, rawMixinsPercent));

  const saltInput = els.saltPercent;
  const saltWarning = els.saltWarning;
  const typedValue = parseFloat(saltInput.value);
  const outOfRange = !isNaN(typedValue) && (typedValue < 0 || typedValue > 10);
  saltWarning.classList.toggle('hidden', !outOfRange);

  // Mirror the salt clamp: typed dough hydration bypasses the input's min/max, so
  // clamp the consumed value to 1-200 and flag it when the typed value is outside.
  const typedDoughHydration = parseFloat(els.doughHydration.value);
  const doughHydrationOutOfRange = !isNaN(typedDoughHydration) && (typedDoughHydration < 1 || typedDoughHydration > 200);
  els.doughHydrationWarning.classList.toggle('hidden', !doughHydrationOutOfRange);

  // Mix-ins clamp to 0-50%, same warning pattern.
  const typedMixins = parseFloat(els.mixinsPercent.value);
  const mixinsOutOfRange = !isNaN(typedMixins) && (typedMixins < 0 || typedMixins > 50);
  els.mixinsWarning.classList.toggle('hidden', !mixinsOutOfRange);

  // Total flour from Baker's Percentage:
  // Dough = Flour + Water + Salt + Mix-ins = Flour * (1 + hydration% + salt% + mixins%)
  const totalFlour = targetDoughWeight / (1 + (doughHydration / 100) + (saltPercent / 100) + (mixinsPercent / 100));

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
  const mixinsWeight = totalFlour * (mixinsPercent / 100);

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
  displayGrams('mixins', mixinsWeight);
  els.mixinsRow.classList.toggle('hidden', mixinsPercent <= 0);
  displayGrams('totalDough', clamp(starterWeight) + clamp(flourToAdd) + clamp(waterToAdd) + clamp(salt) + clamp(mixinsWeight));

  // Baker's percentages alongside the grams (Flour is the fixed 100% basis in HTML).
  // They are relative to total flour, which includes the starter's share, so
  // name that basis or "Flour: 100%" reads as wrong next to the flour to add.
  displayPct('starterPct', starterPercentage);
  displayPct('waterPct', doughHydration);
  displayPct('saltPct', saltPercent);
  displayPct('mixinsPct', mixinsPercent);
  displayGrams('totalFlour', totalFlour);

  writeHashState();
}

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------

updateRatioLabels();
updateDefaultHydrationLabel();
syncNestedControlRoles();
calculateStarter();
calculateBread();
document.querySelector('.tabs').addEventListener('keydown', handleTablistKeydown);

// Re-apply state when the hash changes (manual address-bar edit, in-app link).
// applyState wraps itself in suppressHashWrite, and the replaceState that follows
// does not fire hashchange, so re-entry is safe.
window.addEventListener('hashchange', () => applyStateString(location.hash.slice(1)));

suppressHashWrite = false;
// A shared hash always wins; otherwise fall back to the remembered local state.
const savedState = location.hash.slice(1) || readStoredState();
if (savedState) applyStateString(savedState);

// Register the service worker for offline support (progressive enhancement).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline support unavailable */ });
  });
}

'use strict';

// ---------------------------------------------------------------------------
// URL Hash State - shareable bookmarkable URLs
// ---------------------------------------------------------------------------

const HASH_DEFAULTS = {
  rs: 1, rf: 1, h: 75, cw: 0, cs: 50,
  d: 900, sp: 20, sh: 75, dh: 75, salt: 2, mi: 0, ft: 'bread'
};

// Recommended dough hydration per flour type (Mixed has none - it is manual).
const FLOUR_HYDRATION = { ap: 70, bread: 75, ww: 80, rye: 90, spelt: 72 };
const FLOUR_LABELS = { ap: 'All-Purpose', bread: 'Bread Flour', ww: 'Whole Wheat', rye: 'Rye', spelt: 'Spelt', mix: 'Mixed' };
const DOUGH_PRESETS = [65, 75, 80, 90];
const WEIGHT_PRESETS = [650, 900, 1800];
const STORAGE_KEY = 'loafbuddy-state';

// True while applyState sets many controls at once. The setters it calls then
// skip the URL write and leave keyboard focus where it is.
let applyingState = false;

const byId = (id) => document.getElementById(id);

function isStarterTabActive() {
  return byId('tab-starter').classList.contains('active');
}

function getActiveFlourType() {
  return document.querySelector('.flour-btn.active')?.dataset.flourType || HASH_DEFAULTS.ft;
}

function isDefaultHydrationActive() {
  return byId('defaultHydrationBtn').classList.contains('active');
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

// An empty field parses to NaN and is left out, like a default value.
function setIfNonDefault(params, key, value) {
  if (Number.isNaN(value)) return;
  if (value !== HASH_DEFAULTS[key]) params.set(key, String(value));
}

// Encode every non-default setting as URL params. Both tabs' params share one
// query string (the keys are disjoint), so an all-default calculator encodes to
// an empty string.
function buildStateParams() {
  const params = new URLSearchParams();
  setIfNonDefault(params, 'rs', getInputValue('feedingRatioStarter', NaN));
  setIfNonDefault(params, 'rf', getInputValue('feedingRatioFlour', NaN));
  setIfNonDefault(params, 'h', getInputValue('hydration', NaN));
  setIfNonDefault(params, 'cw', getNonNegativeInputValue('containerWeightStarter', 0));
  setIfNonDefault(params, 'cs', getNonNegativeInputValue('currentStarter', 0));

  setIfNonDefault(params, 'd', getNonNegativeInputValue('targetDoughWeight', 900));
  setIfNonDefault(params, 'sp', getInputValue('starterPercentage', NaN));
  setIfNonDefault(params, 'sh', getInputValue('starterHydration', NaN));
  const ft = getActiveFlourType();
  // When "Default" tracks a named flour, hydration is derived from the flour on
  // load, so there is no need to store it. Otherwise (a preset opted out, or a
  // Mixed manual value) persist dh exactly so the state round-trips.
  if (!(isDefaultHydrationActive() && ft !== 'mix')) {
    params.set('dh', byId('doughHydration').value);
  }
  setIfNonDefault(params, 'salt', getInputValue('saltPercent', NaN));
  setIfNonDefault(params, 'mi', getInputValue('mixinsPercent', NaN));
  setIfNonDefault(params, 'ft', ft);
  return params;
}

// Runs after every change: refresh the UI derived from the whole state, then
// mirror the state to the URL hash and localStorage.
function writeHashState() {
  const qs = buildStateParams().toString();
  document.querySelector('.reset-btn').classList.toggle('hidden', !qs);
  updatePrintTitle();
  if (applyingState) return;

  // The s/b prefix only records which tab to show. An all-default calculator
  // on the starter tab is the empty state: no hash, nothing remembered.
  const onStarter = isStarterTabActive();
  const stateStr = !qs && onStarter ? '' : (onStarter ? 's' : 'b') + (qs ? '?' + qs : '');
  saveStoredState(stateStr);

  if (location.hash.slice(1) !== stateStr) {
    try {
      history.replaceState(null, '', location.pathname + location.search + (stateStr ? '#' + stateStr : ''));
    } catch (e) {
      // Browsers rate-limit replaceState (Safari throws past 100 calls in a few
      // seconds, e.g. while a stepper arrow is held). The next change catches up.
    }
  }
}

// Apply a "tab?params" state string (from the hash, localStorage, or a reset)
// to the UI. A missing or invalid key falls back to its default, so the result
// never depends on what was on screen before: a pasted link fully replaces the
// current setup, and an empty string is simply every default.
function applyState(stateStr) {
  const [tab, qs = ''] = stateStr.split('?');
  const params = new URLSearchParams(qs);
  const num = (key, isValid = () => true) => {
    const v = parseFloat(params.get(key));
    return Number.isFinite(v) && isValid(v) ? v : HASH_DEFAULTS[key];
  };

  applyingState = true;
  try {
    // The tab prefix only decides which tab to show; both groups of params are
    // applied regardless, so a shared URL restores both sections at once.
    showTab(tab === 'b' ? 'bread' : 'starter');

    // Starter params
    setReadyTime(num('rs', v => v > 0), num('rf', v => v > 0));
    setStarterHydration(num('h', v => v >= 0));
    byId('containerWeightStarter').value = num('cw', v => v >= 0);
    byId('currentStarter').value = num('cs', v => v >= 0);

    // Bread params (ft first so the dough hydration rule below sees it)
    const ft = Object.keys(FLOUR_LABELS).includes(params.get('ft')) ? params.get('ft') : HASH_DEFAULTS.ft;
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
      byId('mixedDoughHydration').value = hasDh ? dh : HASH_DEFAULTS.dh;
      setDefaultHydration();
    }
    byId('saltPercent').value = num('salt');
    byId('mixinsPercent').value = num('mi');

    calculateStarter();
    calculateBread();
  } finally {
    applyingState = false;
  }
  // Write the state back once, normalized.
  writeHashState();
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function setActiveButton(selector, dataAttr, value) {
  document.querySelectorAll(selector).forEach(btn => {
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
  if (asButton) {
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
  } else {
    el.removeAttribute('role');
    el.removeAttribute('tabindex');
  }
}

function syncNestedControlRoles() {
  const customWeight = byId('customWeightBtn');
  const defaultHydration = byId('defaultHydrationBtn');
  setWrapperButtonRole(customWeight, !customWeight.classList.contains('active'));
  setWrapperButtonRole(defaultHydration, !defaultHydration.classList.contains('is-mixed'));
}

// Enter/Space activate a role="button" wrapper. Keydowns bubbling up from its
// inner number input are ignored - re-running the action would refocus/select
// the input and wipe what the user just typed.
function activateOnKey(event, action) {
  if (event.target.tagName === 'INPUT') return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}

function focusAndSelect(id) {
  const input = byId(id);
  input.focus();
  input.select();
}

function getInputValue(id, fallback) {
  const v = parseFloat(byId(id).value);
  return isNaN(v) ? fallback : v;
}

function getNonNegativeInputValue(id, fallback) {
  return Math.max(0, getInputValue(id, fallback));
}

// Read a percentage, clamped to min-max, and show its warning while the typed
// value sits outside that range (typing bypasses an input's own min/max).
function readClampedPercent(id, warningId, min, max, fallback) {
  const typed = getInputValue(id, fallback);
  const clamped = Math.min(max, Math.max(min, typed));
  byId(warningId).classList.toggle('hidden', clamped === typed);
  return clamped;
}

// Round, then drop trailing zeros (75 -> "75", 2.50 -> "2.5").
function trimNumber(value, digits) {
  return String(Number(value.toFixed(digits)));
}

// Negative weights (an infeasible recipe) display as zero.
function displayGrams(id, value) {
  byId(id).textContent = Math.max(0, value).toFixed(1) + ' g';
}

function displayPct(id, value) {
  byId(id).textContent = trimNumber(value, 1) + '%';
}

// "1:2:1.5" - the water part follows from the flour part and the hydration.
function formatRatio(ratioStarter, ratioFlour, hydration) {
  return ratioStarter + ':' + ratioFlour + ':' + trimNumber(ratioFlour * (hydration / 100), 2);
}

function updatePrintTitle() {
  let title;
  if (isStarterTabActive()) {
    const hydration = getInputValue('hydration', 75);
    const ratio = formatRatio(getInputValue('feedingRatioStarter', 1), getInputValue('feedingRatioFlour', 1), hydration);
    title = 'Starter Feeding - ' + ratio + ' ratio, ' + hydration + '% hydration';
  } else {
    // Weight and hydration as the recipe below uses them, not as typed: the
    // Water row's percentage is the hydration after clamping.
    title = 'Sourdough Recipe - ' + getNonNegativeInputValue('targetDoughWeight', 0) + ' g, ' +
      FLOUR_LABELS[getActiveFlourType()] + ', ' + byId('waterPct').textContent + ' hydration';
  }
  byId('printTitle').textContent = title;
}

// ---------------------------------------------------------------------------
// Tab Navigation
// ---------------------------------------------------------------------------

function showTab(which) {
  const isStarter = which === 'starter';
  byId('section-starter').classList.toggle('hidden', !isStarter);
  byId('section-bread').classList.toggle('hidden', isStarter);

  [['tab-starter', isStarter], ['tab-bread', !isStarter]].forEach(([id, selected]) => {
    const tab = byId(id);
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.setAttribute('tabindex', selected ? '0' : '-1');
  });

  writeHashState();
}

function handleTablistKeydown(event) {
  const key = event.key;
  if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
  event.preventDefault();
  const tabs = ['starter', 'bread'];
  const current = document.activeElement.id === 'tab-bread' ? 1 : 0;
  let next = current;
  if (key === 'ArrowRight') next = (current + 1) % tabs.length;
  else if (key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
  else if (key === 'Home') next = 0;
  else if (key === 'End') next = tabs.length - 1;
  showTab(tabs[next]);
  byId('tab-' + tabs[next]).focus();
}

// ---------------------------------------------------------------------------
// Starter Feeding - UI Controls
// ---------------------------------------------------------------------------

function setReadyTime(ratioStarter, ratioFlour) {
  byId('feedingRatioStarter').value = ratioStarter;
  byId('feedingRatioFlour').value = ratioFlour;

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
    const ratio = formatRatio(parseFloat(btn.dataset.ratioStarter), parseFloat(btn.dataset.ratioFlour), hydration);
    btn.querySelector('.time-ratio').textContent = ratio + ' ratio';
  });
}

function setStarterHydration(value) {
  byId('hydration').value = value;
  setActiveButton('#section-starter .hydration-buttons .hydration-btn', 'value', value);
  updateRatioLabels();
  calculateStarter();
}

function useStarterInRecipe() {
  setBreadStarterHydration(getInputValue('hydration', 75));
  showTab('bread');
  // The clicked button just got hidden with the starter tab, so hand focus to
  // the Bread tab and bring the recipe into view.
  byId('tab-bread').focus({ preventScroll: true });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelector('.tab-row').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

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

// Each Share button keeps its own timer, so a second click just restarts it.
function flashCopied(btn) {
  btn.textContent = 'Link copied!';
  clearTimeout(btn.copiedTimer);
  btn.copiedTimer = setTimeout(() => { btn.textContent = 'Share recipe'; }, 2000);
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
  byId('defaultHydrationPct').textContent = FLOUR_HYDRATION[ft] + '%';
  byId('defaultHydrationDesc').textContent = 'Best for ' + FLOUR_LABELS[ft];
}

function setFlourType(type) {
  setActiveButton('.flour-btn', 'flourType', type);
  const isMixed = type === 'mix';
  byId('defaultHydrationBtn').classList.toggle('is-mixed', isMixed);
  syncNestedControlRoles();

  if (isMixed) {
    // Mixed has no recommended hydration, so the Default option becomes a manual
    // % input. Seed it with the current hydration so switching flour keeps the
    // dough as is, and so the field never shows a number that is not in use.
    byId('mixedDoughHydration').value = byId('doughHydration').value;
    if (isDefaultHydrationActive() && !applyingState) focusAndSelect('mixedDoughHydration');
  } else {
    updateDefaultHydrationLabel();
    // While "Default" is selected, dough hydration tracks the flour's recommendation.
    // Picking a specific preset opts out, and a live flour change leaves it alone.
    if (isDefaultHydrationActive()) byId('doughHydration').value = FLOUR_HYDRATION[type];
  }
  calculateBread();
}

// "Default" hydration option: track the flour (named) or take the manual % (Mixed).
function setDefaultHydration() {
  setActiveButton('.dough-hydration-buttons .hydration-btn', 'value', 'default');
  const ft = getActiveFlourType();
  if (ft === 'mix') {
    byId('doughHydration').value = getInputValue('mixedDoughHydration', 75);
    if (!applyingState) focusAndSelect('mixedDoughHydration');
  } else {
    byId('doughHydration').value = FLOUR_HYDRATION[ft];
  }
  calculateBread();
}

// Typing in the Mixed % input selects the Default option and applies the value.
function onMixedHydrationInput() {
  setActiveButton('.dough-hydration-buttons .hydration-btn', 'value', 'default');
  byId('doughHydration').value = getInputValue('mixedDoughHydration', 75);
  calculateBread();
}

function setBreadStarterHydration(value) {
  byId('starterHydration').value = value;
  setActiveButton('.starter-hydration-buttons .hydration-btn', 'value', value);
  calculateBread();
}

function setDoughHydration(value) {
  byId('doughHydration').value = value;
  setActiveButton('.dough-hydration-buttons .hydration-btn', 'value', value);
  // Keep the Mixed custom input in sync so it reflects the active value.
  if (getActiveFlourType() === 'mix') byId('mixedDoughHydration').value = value;
  calculateBread();
}

function setDoughWeight(weight) {
  // A non-preset weight (only reachable via a shared URL) belongs to the Custom
  // option, so activate that button to reveal the input with the value in it.
  setActiveButton('.weight-btn', 'weight', WEIGHT_PRESETS.includes(weight) ? weight : 'custom');
  syncNestedControlRoles();
  byId('targetDoughWeight').value = weight;
  calculateBread();
}

function toggleCustomWeight() {
  setActiveButton('.weight-btn', 'weight', 'custom');
  syncNestedControlRoles();
  focusAndSelect('targetDoughWeight');
}

function setStarterPercentage(percent) {
  byId('starterPercentage').value = percent;
  setActiveButton('.starter-pct-btn', 'value', percent);
  calculateBread();
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

// Defaults are just an empty state, so reset reuses the same path as a shared link.
function resetCalculator() {
  applyState(isStarterTabActive() ? 's' : 'b');
  // Drop the remembered setup so a reload returns to defaults. applyState just
  // re-saved the open tab, so this has to come after it.
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
  const totalWeight = showWarning ? 0 : starterToUse + flourToAdd + waterToAdd + containerWeight;

  byId('starterContainerWarning').classList.toggle('hidden', !showWarning);

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
  const doughHydration = readClampedPercent('doughHydration', 'doughHydrationWarning', 1, 200, 75);
  const saltPercent = readClampedPercent('saltPercent', 'saltWarning', 0, 10, 2);
  const mixinsPercent = readClampedPercent('mixinsPercent', 'mixinsWarning', 0, 50, 0);

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

  // A big, wet starter can bring more flour or water than the whole recipe needs.
  let infeasible = '';
  if (flourToAdd < 0) {
    infeasible = 'That starter carries more flour than this recipe needs, so lower the Starter %.';
  } else if (waterToAdd < 0) {
    infeasible = 'That starter carries more water than your dough wants, so lower the Starter % or raise the Dough Hydration.';
  }
  const infeasibleWarning = byId('breadInfeasibleWarning');
  if (infeasible) infeasibleWarning.textContent = infeasible;
  infeasibleWarning.classList.toggle('hidden', !infeasible);

  displayGrams('netStarter', starterWeight);
  displayGrams('additionalFlour', flourToAdd);
  displayGrams('additionalWater', waterToAdd);
  displayGrams('salt', salt);
  displayGrams('mixins', mixinsWeight);
  byId('mixinsRow').classList.toggle('hidden', mixinsPercent <= 0);
  displayGrams('totalDough', starterWeight + Math.max(0, flourToAdd) + Math.max(0, waterToAdd) + salt + mixinsWeight);

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

// A shared hash always wins; otherwise fall back to the remembered local state,
// and failing that the empty state, which is every default.
applyState(location.hash.slice(1) || readStoredState() || '');

// Re-apply state when the hash changes (manual address-bar edit, in-app link).
// The replaceState in writeHashState does not fire hashchange, so re-entry is safe.
window.addEventListener('hashchange', () => applyState(location.hash.slice(1)));

// Register the service worker for offline support (progressive enhancement).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline support unavailable */ });
  });
}

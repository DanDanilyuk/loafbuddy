'use strict';

// ---------------------------------------------------------------------------
// URL Hash State - shareable bookmarkable URLs
// ---------------------------------------------------------------------------

const HASH_DEFAULTS = {
  rs: 1, rf: 1, h: 75, cw: 0, cs: 50,
  d: 900, sp: 20, sh: 75, dh: 75, salt: 2, ft: 'bread'
};

const FLOUR_LABEL_TO_TYPE = {
  'All-Purpose': 'ap',
  'Bread Flour': 'bread',
  'Whole Wheat': 'ww',
  'Rye': 'rye',
  'Spelt': 'spelt',
  'Mixed': 'mix'
};

const VALID_FLOUR_TYPES = ['ap', 'bread', 'ww', 'rye', 'spelt', 'mix'];

let suppressHashWrite = true;

function getActiveFlourType() {
  const active = document.querySelector('.flour-btn.active .flour-label');
  if (!active) return HASH_DEFAULTS.ft;
  return FLOUR_LABEL_TO_TYPE[active.textContent] || HASH_DEFAULTS.ft;
}

function setIfNonDefault(params, key, value) {
  if (value === undefined || value === null) return;
  if (typeof value === 'number' && isNaN(value)) return;
  if (value !== HASH_DEFAULTS[key]) params.set(key, String(value));
}

function writeHashState() {
  if (suppressHashWrite) return;

  const isStarterActive = document.getElementById('tab-starter').classList.contains('active');
  const tab = isStarterActive ? 's' : 'b';
  const params = new URLSearchParams();

  if (isStarterActive) {
    setIfNonDefault(params, 'rs', parseFloat(document.getElementById('feedingRatioStarter').value));
    setIfNonDefault(params, 'rf', parseFloat(document.getElementById('feedingRatioFlour').value));
    setIfNonDefault(params, 'h', parseFloat(document.getElementById('hydration').value));
    setIfNonDefault(params, 'cw', getNonNegativeInputValue('containerWeightStarter', 0));
    setIfNonDefault(params, 'cs', getNonNegativeInputValue('currentStarter', 0));
  } else {
    setIfNonDefault(params, 'd', getNonNegativeInputValue('targetDoughWeight', 900));
    setIfNonDefault(params, 'sp', parseFloat(document.getElementById('starterPercentage').value));
    setIfNonDefault(params, 'sh', parseFloat(document.getElementById('starterHydration').value));
    setIfNonDefault(params, 'dh', parseFloat(document.getElementById('doughHydration').value));
    setIfNonDefault(params, 'salt', parseFloat(document.getElementById('saltPercent').value));
    setIfNonDefault(params, 'ft', getActiveFlourType());
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
            setFlourType(ft, null);
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
          if (!isNaN(dh)) setDoughHydration(dh);
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
          if (!isNaN(rs) && !isNaN(rf)) setReadyTime(rs, rf, rs);
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

function setActiveButton(selector, labelSelector, matchText) {
  const buttons = document.querySelectorAll(selector);
  buttons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.querySelector(labelSelector).textContent === matchText) {
      btn.classList.add('active');
    }
  });
}

function getInputValue(id, fallback) {
  return parseFloat(document.getElementById(id).value) || fallback;
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

function setReadyTime(ratioStarter, ratioFlour, ratioWater) {
  document.getElementById('feedingRatioStarter').value = ratioStarter;
  document.getElementById('feedingRatioFlour').value = ratioFlour;

  document.querySelectorAll('.time-btn').forEach(btn => {
    const isMatch = parseFloat(btn.dataset.ratioStarter) === ratioStarter &&
                    parseFloat(btn.dataset.ratioFlour) === ratioFlour;
    btn.classList.toggle('active', isMatch);
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
  setActiveButton('#section-starter .hydration-buttons .hydration-btn', '.hydration-label', value + '%');
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

function setFlourType(type, recommendedHydration) {
  const labels = { ap: 'All-Purpose', bread: 'Bread Flour', ww: 'Whole Wheat', rye: 'Rye', spelt: 'Spelt', mix: 'Mixed' };
  setActiveButton('.flour-btn', '.flour-label', labels[type]);

  const mixedHint = document.getElementById('mixedFlourHint');
  const doughHydrationGroup = document.getElementById('doughHydrationGroup');
  const isMixed = type === 'mix';
  if (mixedHint) mixedHint.classList.toggle('hidden', !isMixed);
  if (doughHydrationGroup) doughHydrationGroup.classList.toggle('needs-attention', isMixed);

  if (recommendedHydration !== null) {
    setDoughHydration(recommendedHydration);
  } else {
    calculateBread();
  }
}

function setBreadStarterHydration(value) {
  document.getElementById('starterHydration').value = value;
  setActiveButton('.starter-hydration-buttons .hydration-btn', '.hydration-label', value + '%');
  calculateBread();
}

function setDoughHydration(value) {
  document.getElementById('doughHydration').value = value;
  setActiveButton('.dough-hydration-buttons .hydration-btn', '.hydration-label', value + '%');
  const doughHydrationGroup = document.getElementById('doughHydrationGroup');
  if (doughHydrationGroup) doughHydrationGroup.classList.remove('needs-attention');
  calculateBread();
}

function setDoughWeight(weight) {
  setActiveButton('.weight-btn', '.hydration-desc', weight + 'g');
  document.getElementById('targetDoughWeight').value = weight;
  calculateBread();
}

function toggleCustomWeight() {
  setActiveButton('.weight-btn', '.hydration-label', 'Custom');

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
  setActiveButton('.starter-pct-btn', '.hydration-ratio', percent + '%');
  calculateBread();
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

function resetCalculator() {
  document.getElementById('containerWeightStarter').value = 0;
  document.getElementById('currentStarter').value = 50;
  document.getElementById('starterToFeed').value = '';
  document.getElementById('saltPercent').value = 2;

  setReadyTime(1, 1, 1);
  setStarterHydration(75);

  const customBtn = document.getElementById('customWeightBtn');
  if (customBtn) customBtn.classList.remove('active');
  setDoughWeight(900);
  setStarterPercentage(20);
  setFlourType('bread', 75);
  setBreadStarterHydration(75);
  setDoughHydration(75);

  ['saltWarning', 'starterContainerWarning', 'starterToFeedWarning',
   'breadInfeasibleWarning', 'mixedFlourHint'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  const doughHydrationGroup = document.getElementById('doughHydrationGroup');
  if (doughHydrationGroup) doughHydrationGroup.classList.remove('needs-attention');

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

  const available = Math.max(0, currentStarterTotal - containerWeight);

  const keepRaw = parseFloat(document.getElementById('starterToFeed').value);
  const keepTyped = !isNaN(keepRaw) && keepRaw > 0;
  const keepOverflow = keepTyped && keepRaw > available && available > 0;
  const keep = keepTyped && keepRaw < available ? keepRaw : available;
  const discard = available - keep;

  const starterToUse = keep;
  const flourToAdd = starterToUse * (ratioFlour / ratioStarter);
  const waterToAdd = starterToUse * (ratioWater / ratioStarter);

  const showWarning = containerWeight > 0 && currentStarterTotal > 0 && currentStarterTotal <= containerWeight;
  const totalWeight = showWarning ? 0 : clamp(starterToUse) + clamp(flourToAdd) + clamp(waterToAdd) + clamp(containerWeight);

  document.getElementById('starterContainerWarning').classList.toggle('hidden', !showWarning);
  document.getElementById('starterToFeedWarning').classList.toggle('hidden', showWarning || !keepOverflow);
  document.getElementById('discardRow').classList.toggle('hidden', showWarning || discard <= 0);

  displayGrams('starterToUse', starterToUse);
  displayGrams('discardAmount', discard);
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

  const saltInput = document.getElementById('saltPercent');
  const saltWarning = document.getElementById('saltWarning');
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

  const breadInfeasibleWarning = document.getElementById('breadInfeasibleWarning');
  const breadInfeasibleWarningText = document.getElementById('breadInfeasibleWarningText');
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
calculateStarter();
calculateBread();
document.querySelector('.tabs').addEventListener('keydown', handleTablistKeydown);

suppressHashWrite = false;
applyHashState();

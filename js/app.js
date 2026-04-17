'use strict';

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

function clamp(value) {
  return Math.max(0, value);
}

function displayGrams(id, value) {
  document.getElementById(id).textContent = clamp(value).toFixed(1) + ' g';
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
  const hydration = getInputValue('hydration', 100);
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

// ---------------------------------------------------------------------------
// Bread Baking - UI Controls
// ---------------------------------------------------------------------------

function setFlourType(type, recommendedHydration) {
  const labels = { ap: 'All-Purpose', bread: 'Bread Flour', ww: 'Whole Wheat', rye: 'Rye', spelt: 'Spelt', mix: 'Mixed' };
  setActiveButton('.flour-btn', '.flour-label', labels[type]);

  if (recommendedHydration !== null) {
    setDoughHydration(recommendedHydration);
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
  calculateBread();
}

function setDoughWeight(weight) {
  setActiveButton('.weight-btn', '.hydration-desc', weight + 'g');
  document.getElementById('customWeightContainer').classList.add('hidden');
  document.getElementById('targetDoughWeight').value = weight;
  calculateBread();
}

function toggleCustomWeight() {
  setActiveButton('.weight-btn', '.hydration-label', 'Custom');
  document.getElementById('customWeightContainer').classList.remove('hidden');

  const input = document.getElementById('targetDoughWeight');
  input.focus();
  input.select();
}

function setStarterPercentage(percent) {
  document.getElementById('starterPercentage').value = percent;
  setActiveButton('.starter-pct-btn', '.hydration-ratio', percent + '%');
  calculateBread();
}

// ---------------------------------------------------------------------------
// Starter Feeding - Calculation
// ---------------------------------------------------------------------------

function calculateStarter() {
  const containerWeight = getInputValue('containerWeightStarter', 0);
  const currentStarterTotal = getInputValue('currentStarter', 0);
  const hydration = getInputValue('hydration', 100);
  const ratioStarter = getInputValue('feedingRatioStarter', 1);
  const ratioFlour = getInputValue('feedingRatioFlour', 1);

  // Water ratio derived from flour ratio and target hydration
  const ratioWater = ratioFlour * (hydration / 100);

  // Net starter = what's in the jar minus the jar
  const starterToUse = Math.max(0, currentStarterTotal - containerWeight);
  const flourToAdd = starterToUse * (ratioFlour / ratioStarter);
  const waterToAdd = starterToUse * (ratioWater / ratioStarter);

  const showWarning = containerWeight > 0 && currentStarterTotal > 0 && currentStarterTotal <= containerWeight;
  const totalWeight = showWarning ? 0 : clamp(starterToUse) + clamp(flourToAdd) + clamp(waterToAdd) + clamp(containerWeight);

  document.getElementById('starterContainerWarning').classList.toggle('hidden', !showWarning);

  displayGrams('starterToUse', starterToUse);
  displayGrams('flourToAdd', flourToAdd);
  displayGrams('waterToAdd', waterToAdd);
  displayGrams('totalWeight', totalWeight);
}

// ---------------------------------------------------------------------------
// Bread Baking - Calculation
// ---------------------------------------------------------------------------

function calculateBread() {
  const targetDoughWeight = getInputValue('targetDoughWeight', 0);
  const starterPercentage = getInputValue('starterPercentage', 20);
  const starterHydration = getInputValue('starterHydration', 100);
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

  displayGrams('netStarter', starterWeight);
  displayGrams('additionalFlour', flourToAdd);
  displayGrams('additionalWater', waterToAdd);
  displayGrams('salt', salt);
  displayGrams('totalDough', clamp(starterWeight) + clamp(flourToAdd) + clamp(waterToAdd) + clamp(salt));
}

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------

updateRatioLabels();
calculateStarter();
calculateBread();

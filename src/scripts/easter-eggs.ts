const cat = document.querySelector<HTMLElement>("[data-clock-cat]");
const catButton = cat?.querySelector<HTMLButtonElement>("button");
const catNote = document.querySelector<HTMLElement>("[data-cat-note]");
const storageKey = "portfolio.easter-eggs.seen.v2";
let revealed = false;
let remaining = 10_000;
let viewingSince: number | undefined;
let revealTimer: ReturnType<typeof setTimeout> | undefined;
let sleepTimer: ReturnType<typeof setTimeout> | undefined;

function putCatToSleep() {
  if (cat) {
    cat.dataset.pose = "asleep";
    delete cat.dataset.entering;
  }
  if (catNote) catNote.hidden = true;
  catButton?.setAttribute("aria-label", "Wake the sleepy cat");
}

function pauseViewing() {
  clearTimeout(revealTimer);
  revealTimer = undefined;
  if (viewingSince !== undefined) remaining = Math.max(0, remaining - (performance.now() - viewingSince));
  viewingSince = undefined;
}

function revealSurprises(restored = false) {
  if (revealed || !cat) return;
  pauseViewing();
  revealed = true;
  cat.hidden = false;
  if (restored) putCatToSleep();
  else {
    cat.dataset.entering = "";
    sleepTimer = setTimeout(putCatToSleep, 20_000);
  }
  try { sessionStorage.setItem(storageKey, "yes"); }
  catch { /* The reveal still works when browser storage is unavailable. */ }
}

function resumeViewing() {
  if (revealed || viewingSince !== undefined || document.hidden) return;
  viewingSince = performance.now();
  revealTimer = setTimeout(() => revealSurprises(), remaining);
}

catButton?.addEventListener("click", () => {
  if (!cat || !catNote) return;
  clearTimeout(sleepTimer);
  delete cat.dataset.entering;
  cat.dataset.pose = "awake";
  catNote.hidden = false;
  catButton.setAttribute("aria-label", "The cat says hi, recruiter");
  sleepTimer = setTimeout(putCatToSleep, 3_500);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseViewing();
  } else resumeViewing();
});
window.addEventListener("pagehide", () => {
  pauseViewing();
  clearTimeout(sleepTimer);
  if (revealed) putCatToSleep();
});
window.addEventListener("pageshow", resumeViewing);
try { if (sessionStorage.getItem(storageKey) === "yes") revealSurprises(true); }
catch { /* Storage is optional for this decoration. */ }
resumeViewing();

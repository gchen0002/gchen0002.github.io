const cat = document.querySelector<HTMLElement>("[data-clock-cat]");
const catButton = cat?.querySelector<HTMLButtonElement>("button");
const catNote = document.querySelector<HTMLElement>("[data-cat-note]");
const paper = document.querySelector<HTMLElement>("[data-paper-surprise]");
const paperButton = paper?.querySelector<HTMLButtonElement>("button");
const paperNote = document.querySelector<HTMLElement>("[data-paper-note]");
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const storageKey = "portfolio.easter-eggs.seen.v2";
let revealed = false;
let remaining = 10_000;
let viewingSince: number | undefined;
let revealTimer: ReturnType<typeof setTimeout> | undefined;
let sleepTimer: ReturnType<typeof setTimeout> | undefined;
let noteTimer: ReturnType<typeof setTimeout> | undefined;
let flight: Animation | undefined;

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
  if (revealed || !cat || !paper) return;
  pauseViewing();
  revealed = true;
  cat.hidden = false;
  paper.hidden = false;
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

function showPaperNote(message: string) {
  clearTimeout(noteTimer);
  if (paperNote) paperNote.textContent = message;
  noteTimer = setTimeout(() => { if (paperNote) paperNote.textContent = ""; }, 2_400);
}

paperButton?.addEventListener("click", () => {
  const icon = paperButton.querySelector("svg");
  if (!icon || flight) return;
  if (motionPreference.matches) {
    showPaperNote("Delivered ✨");
    return;
  }
  const bounds = paperButton.getBoundingClientRect();
  const start = { x: bounds.x + bounds.width / 2 - 15, y: bounds.y + bounds.height / 2 - 15 };
  const controlA = { x: Math.max(25, start.x - 180), y: start.y * .45 };
  const controlB = { x: window.innerWidth * .85, y: window.innerHeight * .65 };
  const end = { x: window.innerWidth + 45, y: -45 };
  // Sample one Bézier curve up front; the browser animates transforms without a JS frame loop.
  const frames: Keyframe[] = Array.from({ length: 61 }, (_, step) => {
    const t = step / 60;
    const u = 1 - t;
    const x = u ** 3 * start.x + 3 * u ** 2 * t * controlA.x + 3 * u * t ** 2 * controlB.x + t ** 3 * end.x;
    const y = u ** 3 * start.y + 3 * u ** 2 * t * controlA.y + 3 * u * t ** 2 * controlB.y + t ** 3 * end.y;
    const dx = 3 * u ** 2 * (controlA.x - start.x) + 6 * u * t * (controlB.x - controlA.x) + 3 * t ** 2 * (end.x - controlB.x);
    const dy = 3 * u ** 2 * (controlA.y - start.y) + 6 * u * t * (controlB.y - controlA.y) + 3 * t ** 2 * (end.y - controlB.y);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI + 45;
    return { offset: t, transform: `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg)`, opacity: Math.min(1, (1 - t) * 8) };
  });
  const flyer = document.createElement("div");
  flyer.className = "paper-flight";
  flyer.setAttribute("aria-hidden", "true");
  const aircraft = document.createElement("span");
  aircraft.className = "paper-aircraft";
  aircraft.append(icon.cloneNode(true));
  flyer.append(aircraft);
  document.body.append(flyer);
  paperButton.disabled = true;
  showPaperNote("Off it goes!");
  flight = aircraft.animate(frames, { duration: 2_100, easing: "linear", fill: "both" });
  const cleanup = () => {
    flyer.remove();
    paperButton.disabled = false;
    flight = undefined;
  };
  void flight.finished.then(cleanup, cleanup);
});

motionPreference.addEventListener("change", () => {
  if (motionPreference.matches) flight?.cancel();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseViewing();
    flight?.cancel();
  } else resumeViewing();
});
window.addEventListener("pagehide", () => {
  pauseViewing();
  clearTimeout(sleepTimer);
  clearTimeout(noteTimer);
  if (paperNote) paperNote.textContent = "";
  flight?.cancel();
  if (revealed) putCatToSleep();
});
window.addEventListener("pageshow", resumeViewing);
try { if (sessionStorage.getItem(storageKey) === "yes") revealSurprises(true); }
catch { /* Storage is optional for this decoration. */ }
resumeViewing();

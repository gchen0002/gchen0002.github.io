import { createRollingNumber } from "@kitlangton/rolling-number";
import "@kitlangton/rolling-number/styles.css";

const deck = document.querySelector<HTMLElement>(".deck");
const panels = [...document.querySelectorAll<HTMLElement>("[data-panel]")];
const buttons = [
  ...document.querySelectorAll<HTMLButtonElement>(".panel-toggle"),
];
const contents = [...document.querySelectorAll<HTMLElement>(".panel-content")];
const hoverPointer = window.matchMedia("(hover: hover) and (pointer: fine)");
let active = -1;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const panelAnimations = new Set<Animation>();

function cancelPanelMotion() {
  panelAnimations.forEach((animation) => animation.cancel());
  panelAnimations.clear();
}

function panelFrames() {
  return panels.map((panel) => {
    const style = getComputedStyle(panel);
    return { transform: style.transform, clipPath: style.clipPath };
  });
}

reducedMotion.addEventListener("change", cancelPanelMotion);
if (deck) new ResizeObserver(cancelPanelMotion).observe(deck);

function openPanel(index: number) {
  if (index < 0 || index >= panels.length || index === active) return;
  const animate = active !== -1 && !reducedMotion.matches && deck !== null;
  // Capture every moving edge before cancelling. Retarget the entire strip from
  // one shared timestamp, so interrupted transitions cannot separate the cards.
  const before = animate ? panelFrames() : [];
  cancelPanelMotion();
  active = index;
  panels.forEach((panel, position) => {
    const expanded = position === index;
    panel.dataset.active = String(expanded);
    panel.style.setProperty("--after-active", position > index ? "1" : "0");
    buttons[position]?.setAttribute("aria-expanded", String(expanded));
    const content = contents[position];
    if (content) {
      content.inert = !expanded;
      content.setAttribute("aria-hidden", String(!expanded));
    }
  });
  if (!animate || !deck) return;
  const after = panelFrames();
  const deckStyle = getComputedStyle(deck);
  const duration = Number.parseFloat(deckStyle.getPropertyValue("--panel-duration"));
  const easing = deckStyle.getPropertyValue("--panel-ease").trim();
  const startTime = document.timeline.currentTime;
  panels.forEach((panel, position) => {
    const from = before[position];
    const to = after[position];
    if (!from || !to) return;
    const animation = panel.animate([from, to], { duration, easing });
    if (typeof startTime === "number") animation.startTime = startTime;
    panelAnimations.add(animation);
    animation.onfinish = () => panelAnimations.delete(animation);
  });
}

panels.forEach((panel, index) => {
  panel.addEventListener("pointerenter", (event) => {
    if (!hoverPointer.matches || event.pointerType === "touch") return;
    // A mouse-focused link must not retain focus inside a panel we are hiding.
    if (
      active !== index &&
      document.activeElement instanceof HTMLElement &&
      deck?.contains(document.activeElement)
    ) {
      document.activeElement.blur();
    }
    openPanel(index);
  });
  panel.addEventListener("focusin", () => openPanel(index));
  const button = buttons[index];
  button?.addEventListener("click", () => openPanel(index));
  button?.addEventListener("keydown", (event) => {
    let next: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (index + 1) % panels.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (index + panels.length - 1) % panels.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = panels.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    openPanel(next);
    buttons[next]?.focus({ preventScroll: true });
  });
});

openPanel(0);

// Always format in the owner's time zone, independently of the visitor's locale.
const clockFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
function clockParts() {
  const parts = clockFormat.formatToParts(new Date());
  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? 12),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0),
    period: parts.find((part) => part.type === "dayPeriod")?.value ?? "AM",
    readable: parts.map((part) => part.value).join(""),
  };
}
function clockDigits(value: ReturnType<typeof clockParts>) {
  return [Math.floor(value.hour / 10), value.hour % 10, Math.floor(value.minute / 10), value.minute % 10];
}
const periodHost = document.getElementById("clock-period");
const readableHost = document.getElementById("clock-readable");
const digits = clockDigits(clockParts()).map((value, index) => {
  const host = document.getElementById(`clock-digit-${index}`);
  return host ? createRollingNumber(host, { value, duration: 280, stagger: "none" }) : undefined;
});
function updateClock() {
  const value = clockParts();
  clockDigits(value).forEach((digit, index) => digits[index]?.update({ value: digit }));
  if (periodHost) periodHost.textContent = value.period;
  if (readableHost) readableHost.textContent = `${value.readable}, Los Angeles`;
}
let timer: ReturnType<typeof setInterval> | undefined;
function syncClock() {
  clearInterval(timer);
  if (document.hidden) return;
  updateClock();
  timer = setInterval(updateClock, 1000);
}
document.addEventListener("visibilitychange", syncClock);
window.addEventListener("pagehide", () => clearInterval(timer));
window.addEventListener("pageshow", syncClock);
syncClock();
document.fonts.ready
  .then(() => {
    digits.forEach((digit) => digit?.refresh());
  })
  .catch(() => {
    /* System fallback fonts keep the clock readable. */
  });

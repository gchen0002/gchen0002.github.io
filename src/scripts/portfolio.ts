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
let motionFrame: number | undefined;
let expansion = panels.map(() => 0);

function setContentReady(index: number | null) {
  panels.forEach((panel, position) => {
    const ready = position === index;
    panel.dataset.contentReady = String(ready);
    const content = contents[position];
    if (content) {
      content.inert = !ready;
      content.setAttribute("aria-hidden", String(!ready));
    }
  });
}

function clearMotionStyles() {
  panels.forEach((panel) => {
    panel.style.removeProperty("transform");
    panel.style.removeProperty("clip-path");
  });
}

function cancelPanelMotion() {
  if (motionFrame !== undefined) cancelAnimationFrame(motionFrame);
  motionFrame = undefined;
  expansion = panels.map((_, index) => index === active ? 1 : 0);
  clearMotionStyles();
  setContentReady(active);
}

reducedMotion.addEventListener("change", cancelPanelMotion);
if (deck) new ResizeObserver(cancelPanelMotion).observe(deck);

function openPanel(index: number) {
  if (index < 0 || index >= panels.length || index === active) return;
  const animate = active !== -1 && !reducedMotion.matches && deck !== null;
  const before = [...expansion];
  if (motionFrame !== undefined) cancelAnimationFrame(motionFrame);
  motionFrame = undefined;
  active = index;
  // Clear the previous details before moving the clip or changing selection.
  setContentReady(null);
  panels.forEach((panel, position) => {
    const expanded = position === index;
    panel.dataset.active = String(expanded);
    panel.style.setProperty("--after-active", position > index ? "1" : "0");
    buttons[position]?.setAttribute("aria-expanded", String(expanded));
  });
  const target = panels.map((_, position) => position === index ? 1 : 0);
  const firstPanel = panels[0];
  if (!animate || !deck || !firstPanel) {
    expansion = target;
    clearMotionStyles();
    setContentReady(index);
    return;
  }

  // Read geometry only when a selection changes, never inside the animation loop.
  const vertical = window.matchMedia("(max-width: 760px)").matches;
  const deckStyle = getComputedStyle(deck);
  const gap = Number.parseFloat(deckStyle.getPropertyValue("--panel-gap"));
  const radius = deckStyle.getPropertyValue("--panel-radius").trim();
  // Unitless milliseconds cannot be rewritten to seconds by the CSS minifier.
  const durationMs = Number(deckStyle.getPropertyValue("--panel-duration-ms"));
  const bounds = deck.getBoundingClientRect();
  const panelBounds = firstPanel.getBoundingClientRect();
  const expandedSize = vertical ? panelBounds.height : panelBounds.width;
  const extent = vertical ? bounds.height : bounds.width;
  const railSize = (extent - expandedSize - gap * (panels.length - 1)) / (panels.length - 1);
  const extra = expandedSize - railSize;
  const started = performance.now();
  let contentRevealed = false;

  function drawFrame(now: number) {
    const progress = Math.min(1, Math.max(0, (now - started) / durationMs));
    const eased = 1 - (1 - progress) ** 4;
    expansion = target.map((value, position) => {
      const from = before[position] ?? 0;
      return from + (value - from) * eased;
    });
    // Derive every edge from the same widths. Interrupted motion therefore keeps
    // the seam constant instead of letting independent transitions drift apart.
    let edge = 0;
    panels.forEach((panel, position) => {
      const visibleSize = railSize + (expansion[position] ?? 0) * extra;
      const hiddenSize = Math.max(0, expandedSize - visibleSize);
      panel.style.transform = vertical ? `translate3d(0, ${edge}px, 0)` : `translate3d(${edge}px, 0, 0)`;
      panel.style.clipPath = vertical
        ? `inset(0 0 ${hiddenSize}px 0 round ${radius})`
        : `inset(0 ${hiddenSize}px 0 0 round ${radius})`;
      edge += visibleSize + gap;
    });
    // Fade during the slide once there is room, using the actual expansion so
    // interrupted transitions stay in sync. The panel clip contains all details.
    if (!contentRevealed && (expansion[index] ?? 0) >= 0.8) {
      setContentReady(index);
      contentRevealed = true;
    }
    if (progress < 1) {
      motionFrame = requestAnimationFrame(drawFrame);
    } else {
      motionFrame = undefined;
      expansion = target;
      clearMotionStyles();
      setContentReady(index);
    }
  }
  drawFrame(started);

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

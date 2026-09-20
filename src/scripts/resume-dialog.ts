export {};
const trigger = document.querySelector<HTMLAnchorElement>("[data-resume-open]");
const dialog = document.querySelector<HTMLDialogElement>("[data-resume-dialog]");
const pages = dialog?.querySelector<HTMLElement>("[data-resume-pages]");
const scroller = dialog?.querySelector<HTMLElement>("[data-resume-scroller]");
const resumeStatus = dialog?.querySelector<HTMLElement>("[data-resume-status]");
const retry = dialog?.querySelector<HTMLButtonElement>("[data-resume-retry]");
const scaleLabel = dialog?.querySelector<HTMLOutputElement>("[data-resume-scale]");
const zoomButtons = [...(dialog?.querySelectorAll<HTMLButtonElement>("[data-resume-zoom]") ?? [])];
let zoom = 1;
let rendering: AbortController | undefined;
let resizeTimer: ReturnType<typeof setTimeout> | undefined;

async function draw() {
  const url = dialog?.dataset.pdfUrl;
  if (!dialog?.open || !pages || !scroller || !resumeStatus || !retry || !url) return;
  rendering?.abort();
  const request = new AbortController();
  rendering = request;
  retry.hidden = true;
  resumeStatus.textContent = "Loading résumé…";
  if (scaleLabel) scaleLabel.value = `${Math.round(zoom * 100)}%`;
  zoomButtons.forEach(button => { button.disabled = button.dataset.resumeZoom === "-1" ? zoom <= .75 : zoom >= 2; });
  try {
    // No PDF renderer, worker, or document is fetched before an explicit click.
    const { renderResume } = await import("./resume-viewer");
    if (request.signal.aborted) return;
    const styles = getComputedStyle(scroller);
    const available = scroller.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    await renderResume(pages, url, Math.min(800, available) * zoom, request.signal);
    if (!request.signal.aborted) resumeStatus.textContent = "";
  } catch {
    if (request.signal.aborted) return;
    resumeStatus.textContent = "The résumé couldn’t load. Check your connection and try again.";
    retry.hidden = false;
  }
}

trigger?.addEventListener("click", event => {
  if (!dialog || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  dialog.showModal();
  void draw();
});
dialog?.querySelector("[data-resume-close]")?.addEventListener("click", () => dialog.close());
dialog?.addEventListener("click", event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
dialog?.addEventListener("close", () => {
  rendering?.abort();
  clearTimeout(resizeTimer);
  trigger?.focus({ preventScroll: true });
});
retry?.addEventListener("click", () => { void draw(); });
zoomButtons.forEach(button => button.addEventListener("click", () => {
  zoom = Math.max(.75, Math.min(2, zoom + (button.dataset.resumeZoom === "1" ? .25 : -.25)));
  void draw();
}));
window.addEventListener("resize", () => {
  if (!dialog?.open) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { void draw(); }, 150);
});

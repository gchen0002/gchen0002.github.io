import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
const trigger = document.querySelector<HTMLAnchorElement>("[data-resume-open]");
const dialog = document.querySelector<HTMLDialogElement>("[data-resume-dialog]");
const pages = dialog?.querySelector<HTMLElement>("[data-resume-pages]");
const scroller = dialog?.querySelector<HTMLElement>("[data-resume-scroller]");
const resumeStatus = dialog?.querySelector<HTMLElement>("[data-resume-status]");
const retry = dialog?.querySelector<HTMLButtonElement>("[data-resume-retry]");
const scaleLabel = dialog?.querySelector<HTMLOutputElement>("[data-resume-scale]");
const zoomButtons = [...(dialog?.querySelectorAll<HTMLButtonElement>("[data-resume-zoom]") ?? [])];
// This cache belongs to the page, so closing the popup does not discard its download.
let prepared: ReturnType<typeof prepareResume> | undefined;
let warmTimer: ReturnType<typeof setTimeout> | undefined;
let renderedSize = "";
let zoom = 1;
let rendering: AbortController | undefined;
let resizeTimer: ReturnType<typeof setTimeout> | undefined;

async function prepareResume(url: string) {
  const controller = new AbortController();
  const worker = new Worker(workerUrl, { type: "module" });
  // Start the renderer, worker, and PDF together instead of three network round trips.
  const workerFailed = new Promise<never>((_, reject) => {
    worker.addEventListener("error", () => reject(new Error("Résumé worker could not load")), { once: true, signal: controller.signal });
  });
  const download = fetch(url, { signal: controller.signal }).then(response => {
    if (!response.ok) throw new Error("Résumé PDF could not load");
    return response.arrayBuffer();
  });
  try {
    return await Promise.race([
      Promise.all([import("./resume-viewer"), download]).then(async ([viewer, data]) => ({
        pdf: await viewer.openResume(data, worker), renderResume: viewer.renderResume,
      })),
      workerFailed,
    ]);
  } catch (error: unknown) {
    worker.terminate();
    throw error;
  } finally {
    controller.abort();
  }
}

function getResume(url: string) {
  return prepared ??= prepareResume(url).catch((error: unknown) => {
    prepared = undefined;
    throw error;
  });
}

function warmResume() {
  const url = dialog?.dataset.pdfUrl;
  const connection = "connection" in navigator ? navigator.connection : undefined;
  if (typeof connection === "object" && connection !== null && "saveData" in connection && connection.saveData === true) return;
  // Intent-only warming is owned by this page; failures stay quiet until an actual click.
  if (url) void getResume(url).catch(() => {});
}

trigger?.addEventListener("pointerenter", event => {
  if (event.pointerType === "mouse") warmTimer = setTimeout(warmResume, 120);
});
trigger?.addEventListener("pointerleave", () => clearTimeout(warmTimer));
trigger?.addEventListener("focus", warmResume);

async function draw() {
  const url = dialog?.dataset.pdfUrl;
  if (!dialog?.open || !pages || !scroller || !resumeStatus || !retry || !url) return;
  rendering?.abort();
  const request = new AbortController();
  rendering = request;
  retry.hidden = true;
  if (scaleLabel) scaleLabel.value = `${Math.round(zoom * 100)}%`;
  zoomButtons.forEach(button => { button.disabled = button.dataset.resumeZoom === "-1" ? zoom <= .75 : zoom >= 2; });
  const styles = getComputedStyle(scroller);
  const available = scroller.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
  const width = Math.min(800, available) * zoom;
  const size = `${width}:${Math.min(window.devicePixelRatio || 1, 2)}`;
  if (renderedSize === size) {
    resumeStatus.textContent = "";
    return;
  }
  resumeStatus.textContent = pages.childElementCount ? "" : "Loading résumé…";
  try {
    const { pdf, renderResume } = await getResume(url);
    if (request.signal.aborted) return;
    await renderResume(pages, pdf, width, request.signal);
    if (!request.signal.aborted) {
      renderedSize = size;
      resumeStatus.textContent = "";
    }
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

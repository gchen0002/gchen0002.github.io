import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;
let documentPromise: Promise<PDFDocumentProxy> | undefined;

function loadDocument(url: string) {
  if (!documentPromise) {
    documentPromise = getDocument({ url }).promise.catch((error: unknown) => {
      documentPromise = undefined;
      throw error;
    });
  }
  return documentPromise;
}

export async function renderResume(host: HTMLElement, url: string, width: number, signal: AbortSignal) {
  const pdf = await loadDocument(url);
  const fragment = document.createDocumentFragment();
  for (let number = 1; number <= pdf.numPages; number++) {
    if (signal.aborted) return;
    const page = await pdf.getPage(number);
    if (signal.aborted) return;
    const scale = width / page.getViewport({ scale: 1 }).width;
    const viewport = page.getViewport({ scale });
    const density = Math.min(window.devicePixelRatio || 1, 2);
    const sheet = document.createElement("section");
    sheet.className = "resume-page";
    sheet.setAttribute("aria-label", `Résumé page ${number} of ${pdf.numPages}`);
    sheet.style.width = `${viewport.width}px`;
    sheet.style.height = `${viewport.height}px`;
    sheet.style.setProperty("--total-scale-factor", String(scale));
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.width = Math.ceil(viewport.width * density);
    canvas.height = Math.ceil(viewport.height * density);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const text = document.createElement("div");
    text.className = "resume-text";
    sheet.append(canvas, text);
    const drawing = page.render({ canvas, viewport, transform: density === 1 ? undefined : [density, 0, 0, density, 0, 0] });
    const textLayer = new TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport });
    const cancel = () => { drawing.cancel(); textLayer.cancel(); };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      await Promise.all([drawing.promise, textLayer.render()]);
      if (signal.aborted) return;
      // Preserve the PDF's links while validating the annotation boundary.
      const annotations: unknown[] = await page.getAnnotations();
      for (const annotation of annotations) {
        if (typeof annotation !== "object" || annotation === null || !("url" in annotation) || !("rect" in annotation)) continue;
        const { url: destination, rect } = annotation;
        if (typeof destination !== "string" || !/^(https?:|mailto:)/i.test(destination) || !Array.isArray(rect) || rect.length !== 4 || !rect.every(value => typeof value === "number" && Number.isFinite(value))) continue;
        const [x1, y1] = viewport.convertToViewportPoint(rect[0], rect[1]);
        const [x2, y2] = viewport.convertToViewportPoint(rect[2], rect[3]);
        const link = document.createElement("a");
        link.className = "resume-page-link";
        link.href = destination;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute("aria-label", destination.replace(/^mailto:/, ""));
        Object.assign(link.style, { left: `${Math.min(x1, x2)}px`, top: `${Math.min(y1, y2)}px`, width: `${Math.abs(x2 - x1)}px`, height: `${Math.abs(y2 - y1)}px` });
        sheet.append(link);
      }
    } catch (error) {
      if (!signal.aborted) throw error;
      return;
    } finally {
      signal.removeEventListener("abort", cancel);
    }
    fragment.append(sheet);
  }
  if (!signal.aborted) host.replaceChildren(fragment);
}

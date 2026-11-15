/**
 * PDF export. Each report page is a fixed-size DOM node (A4 at 96 dpi:
 * 794 × 1123 px) rendered by the browser — so Thai text shapes correctly —
 * rasterised with html2canvas and placed on an A4 page by jsPDF.
 * Libraries are loaded on demand and are precached for offline use.
 */
export async function exportPagesToPdf(pages: HTMLElement[], filename: string): Promise<void> {
  const [{ jsPDF }, html2canvasMod] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const html2canvas = html2canvasMod.default;
  if (document.fonts?.ready) await document.fonts.ready;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  for (let i = 0; i < pages.length; i++) {
    const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
    const img = canvas.toDataURL('image/jpeg', 0.92);
    if (i > 0) pdf.addPage();
    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
    pdf.addImage(img, 'JPEG', 0, 0, canvas.width * ratio, canvas.height * ratio);
  }
  pdf.setProperties({ title: filename.replace(/\.pdf$/, ''), subject: 'EyeReady flight surgeon summary', creator: 'EyeReady (offline)' });
  pdf.save(filename);
}

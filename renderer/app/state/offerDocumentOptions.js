// Missing fields in older offers use document defaults, never the previous form state.
export const documentOptionDefaults = Object.freeze({
  hideOfferDatePdf: false,
  showDiscountColumnPdf: true,
  isEstimate: false,
});

export function applyOfferDocumentOptions(fields = {}) {
  const template = document.getElementById('pdfTemplate');
  if (template) template.value = fields.pdfTemplate === 'modern' ? 'modern' : 'classic';
  for (const [id, fallback] of Object.entries(documentOptionDefaults)) {
    const input = document.getElementById(id);
    if (input) input.checked = typeof fields[id] === 'boolean' ? fields[id] : fallback;
  }
}

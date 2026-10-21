import { t, formatMoney, formatDate, formatPaymentText, getDocLabel, getCompanyFooterLines } from '../i18n/pdfI18n.js';

// Presentation only: rows and amounts come from the same calculation as the classic PDF.
export function renderModernOffer(doc, options) {
  const { fontName, lang, currency, logoData, offerNo, versionText, isEstimate,
    showDiscountCol, body, customer, sumNet, sumVat, sumGross, shipping,
    vatLabel, currencyNote, impactRows } = options;
  const value = id => document.getElementById(id)?.value?.trim() || '';
  const clean = text => String(text ?? '').replace(/[\u00a0\u202f]/g, ' ');
  const money = amount => clean(formatMoney(amount, lang, currency));
  const label = key => t(lang, key).replace(/:$/, '');
  const ink = [31, 43, 58], muted = [101, 117, 138], line = [218, 226, 235];
  const x = 15, right = 195, width = 180, bottom = 267;
  let y = 18;
  function text(content, tx, ty, size = 9, bold = false, color = ink, extra = {}) {
    doc.setFont(fontName, bold ? 'bold' : 'normal');
    doc.setFontSize(size); doc.setTextColor(...color);
    doc.text(clean(content), tx, ty, extra);
  }
  function rule(ty) {
    doc.setDrawColor(...line); doc.setLineWidth(0.2); doc.line(x, ty, right, ty);
  }
  function space(height) {
    if (y + height > bottom) { doc.addPage(); y = 22; }
  }
  function paragraph(content, tx, start, w, size = 9, bold = false, color = ink) {
    doc.setFont(fontName, bold ? 'bold' : 'normal'); doc.setFontSize(size);
    const lines = doc.splitTextToSize(clean(content), w);
    for (const row of lines) { text(row, tx, start, size, bold, color); start += size * 0.45; }
    return start;
  }
  const tableBase = {
    margin: { left: x, right: x, top: 22, bottom: 30 },
    theme: 'plain', rowPageBreak: 'avoid',
    styles: { font: fontName, fontSize: 8, cellPadding: 3, textColor: ink,
      lineColor: line, lineWidth: { bottom: 0.15 }, overflow: 'linebreak' },
    headStyles: { fillColor: [242, 245, 248], textColor: muted, fontStyle: 'bold', fontSize: 7.5 },
  };
  if (logoData) doc.addImage(logoData, 'PNG', x, y, 44, 13.2);
  text(getDocLabel(lang, isEstimate).toUpperCase(), right, y, 8, false, muted, { align: 'right' });
  text(offerNo, right, y + 9, 17, true, ink, { align: 'right' });
  if (versionText) text(versionText, right, y + 15, 7, false, muted, { align: 'right' });
  rule(40);
  y = 51;
  const subtitle = value('creatorNotes');
  if (subtitle) y = paragraph(subtitle, x, y, width, 18, true) + 5;
  const partyY = y;
  text(label('customer').toUpperCase(), x, y, 8, true, muted);
  const supplierLabel = { pl: 'DOSTAWCA', en: 'SUPPLIER', de: 'ANBIETER', hu: 'SZÁLLÍTÓ' }[lang];
  text(supplierLabel, 116, y, 8, true, muted);
  y += 7;
  let leftY = y;
  const customerLines = customer.lines || [customer.name, customer.addr, customer.nip, customer.contact];
  customerLines.filter(Boolean).forEach((row, index) => {
    leftY = paragraph(row, x, leftY, 88, index === 0 ? 10 : 8.5, index === 0, index === 0 ? ink : muted) + 1;
  });
  const supplier = lang === 'de'
    ? ['ESUS IT GmbH', 'Waldsiedlung Fichtendamm 4', '15306 Vierlinden, Deutschland', 'USt-IdNr.: DE353880111']
    : lang === 'hu'
      ? ['ESUS IT ENTERPRISE Kft.', 'Huszár utca 5. 1. em. 7.', '1074 Budapest', 'Adószám: 28753553-2-42']
      : ['ESUS IT Sp. z o.o.', 'ul. Somosierry 30A, 71-181 Szczecin', 'NIP: PL8522690002'];
  let rightY = y;
  supplier.forEach((row, index) => {
    rightY = paragraph(row, 116, rightY, 79, index === 0 ? 10 : 8, index === 0, index === 0 ? ink : muted) + 1;
  });
  rightY += 3;
  const contactLines = [
    `${label('offerContact')}: ${value('creatorName') || t(lang, 'missingData')}`,
    [value('creatorEmail'), value('creatorPhone')].filter(Boolean).join(' · '),
  ];
  contactLines.filter(Boolean).forEach((row, index) => {
    doc.setFont(fontName, index === 0 ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    const size = Math.min(8.5, 8.5 * 79 / Math.max(79, doc.getTextWidth(clean(row))));
    text(row, 116, rightY, size, index === 0, index === 0 ? ink : muted);
    rightY += 5;
  });
  y = Math.max(leftY, rightY, partyY + 30) + 8;

  const vatIndex = showDiscountCol ? 4 : 3;
  const heads = [t(lang, 'thLp'), t(lang, 'thDesc'), t(lang, 'thQty'), t(lang, 'thNetAfterDisc')];
  if (showDiscountCol) heads.push(t(lang, 'thDiscount'));
  heads.push(t(lang, 'thVat'), t(lang, 'thGrossLine'));
  const rows = body.map(row => {
    const result = [row[0], row[1], row[vatIndex + 2], row[2]];
    if (showDiscountCol) result.push(row[3]);
    result.push(row[vatIndex], row[vatIndex + 3]);
    result.__isAlternative = row.__isAlternative;
    return result;
  });
  const widths = showDiscountCol ? [13, 60, 16, 29, 15, 14, 33] : [13, 69, 16, 32, 14, 36];
  doc.autoTable({ ...tableBase, startY: y, head: [heads], body: rows,
    columnStyles: Object.fromEntries(widths.map((cellWidth, i) => [i, { cellWidth, halign: i < 2 ? 'left' : 'right' }])),
    didParseCell(data) {
      if (data.section === 'body' && data.row.raw.__isAlternative) {
        data.cell.styles.fillColor = [247, 249, 251]; data.cell.styles.textColor = muted;
      }
    },
  });
  y = doc.lastAutoTable.finalY + 8;
  const days = value('estimateDays').replace(/[–—]/g, '-');
  let payment = formatPaymentText(lang, value('paymentMethod') || 'prepay', value('invoiceDays') || '30');
  if (lang === 'pl') payment = payment.replace(/\((\d+)\)$/, '($1 dni)');
  const terms = [
    [label('payment'), payment],
    [label('validity'), value('validUntil') ? formatDate(value('validUntil'), lang) : t(lang, 'missingData')],
    ...(days ? [[label('estimatedLeadTime'), /^\d+(?:-\d+)?$/.test(days) ? `${days} ${t(lang, 'businessDays')}` : days]] : []),
    [label('delivery'), shipping.gross ? `${label('shippingGross')}: ${money(shipping.gross)}` : t(lang, 'deliverySellerCost')],
  ];
  // Table pagination also handles unusually long payment/lead-time values.
  space(48);
  const summaryY = y;
  doc.autoTable({ ...tableBase, startY: y, tableWidth: 91,
    margin: { ...tableBase.margin, right: 104 },
    head: [[{ content: label('terms').toUpperCase(), colSpan: 2 }]], body: terms,
    styles: { ...tableBase.styles, fontSize: 8, cellPadding: 2, lineWidth: 0 },
    headStyles: { ...tableBase.headStyles, fillColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 37, textColor: muted }, 1: { cellWidth: 54 } },
  });
  const termsEnd = doc.lastAutoTable.finalY;
  const summaryPage = doc.internal.getCurrentPageInfo().pageNumber;
  // Normally side by side; after a terms page break totals continue below the terms.
  let totalsY = termsEnd > summaryY && summaryPage === doc.lastAutoTable.startPageNumber ? summaryY + 5 : termsEnd + 8;
  y = totalsY; space(38); totalsY = y;
  const totals = [[label('sumNet'), sumNet], [`${label('vat')} ${vatLabel}`, sumVat], [label('shippingGross'), shipping.gross]];
  totals.forEach(([title, amount], i) => {
    text(title, 119, totalsY + i * 7, 8, false, muted);
    text(money(amount), right - 3, totalsY + i * 7, 9, false, ink, { align: 'right' });
  });
  doc.setFillColor(234, 245, 255); doc.rect(116, totalsY + 20, 79, 16, 'F');
  text(label('sumGross'), 119, totalsY + 30, 8.5, true);
  const finalMoney = money(sumGross + shipping.gross);
  doc.setFont(fontName, 'bold'); doc.setFontSize(15);
  const totalSize = Math.min(15, 15 * 44 / Math.max(44, doc.getTextWidth(finalMoney)));
  text(finalMoney, right - 3, totalsY + 30, totalSize, true, [0, 126, 206], { align: 'right' });
  y = Math.max(termsEnd, totalsY + 36) + 9;

  function note(title, content) {
    if (!content) return;
    space(20);
    doc.autoTable({ ...tableBase, startY: y,
      head: [[title]], body: [[Array.isArray(content) ? content.join('\n') : content]],
      styles: { ...tableBase.styles, fontSize: 8.5, lineWidth: 0 },
    });
    y = doc.lastAutoTable.finalY + 7;
  }
  note(label('offerCurrencyNoteTitle'), currencyNote);
  if (impactRows.length) {
    note(label('variantsImpactTitle'), t(lang, 'alternativesSummaryNote'));
    space(24);
    doc.autoTable({ ...tableBase, startY: y,
      head: [[t(lang, 'thLp'), t(lang, 'variantsImpactVariant'), t(lang, 'variantsImpactPrice'), t(lang, 'variantsImpactDelta'), t(lang, 'variantsImpactNewGross')]],
      body: impactRows,
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 59 }, 2: { cellWidth: 33, halign: 'right' }, 3: { cellWidth: 33, halign: 'right' }, 4: { cellWidth: 45, halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 7;
  }
  note(label('extraArrangementsTitle'), value('termsExtra'));
  if (isEstimate) note(getDocLabel(lang, true), t(lang, 'estimateDisclaimer'));

  const pages = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    if (page > 1) text(`${getDocLabel(lang, isEstimate)} · ${offerNo}`, x, 13, 8, false, muted);
    rule(275);
    const footer = getCompanyFooterLines(lang).filter(Boolean).join(' ');
    paragraph(footer, x, 280, 145, 6, false, muted);
    text(offerNo, right, 280, 6.5, false, muted, { align: 'right' });
    text(`${page} / ${pages}`, right, 287, 7, false, muted, { align: 'right' });
  }
}

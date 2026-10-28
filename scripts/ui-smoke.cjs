/* Run with: npx electron scripts/ui-smoke.cjs
 * Uses the real renderer and preload with in-memory IPC fixtures, never user data.
 */
const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.userData', 'ui-smoke');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', output);
app.disableHardwareAcceleration();
const profile = { fullName: 'Jan Testowy', email: 'test@example.com', phone: '123456789', initials: 'JT' };
let settings = { profile, initials: 'JT', offerSeq: {}, integrations: { idosell: { enabled: false } } };
let sequence = 2;
const seed = {
  id: 'test-1', meta: { offerNo: '01/JT/09/2026', offerCcy: 'PLN', lang: 'pl', vatCode: '23', createdAt: '2026-09-11T10:00:00Z' },
  fields: { custName: 'Klient testowy Sp. z o.o.', custNip: '1234567890', custAddr: 'Warszawa', custContact: 'test@example.com', offerStatus: 'nowa', offerLang: 'pl', offerCurrency: 'PLN', offerVat: '23', creatorName: profile.fullName, creatorEmail: profile.email, creatorPhone: profile.phone, creatorNotes: 'Serwer backupowy', paymentMethod: 'prepay', shippingNet: 0, shippingAmount: 0, showDiscountColumnPdf: true },
  items: [{ desc: 'Serwer backupowy', net: 1000, buyNet: 700, buyCcy: 'PLN', discount: 10, qty: 2, warranty: { months: 24 }, internalNote: 'Notatka testowa', alternatives: [] }],
};
const offers = new Map([[seed.id, structuredClone(seed)]]);
let lastSaved;
let win;
const downloads = [];
const calls = [];
const iaiOrders = ['new', 'delivery_waiting', 'packed_ready', 'suspended', 'on_order'].map((status, index) => ({
  orderId: `zamowienie-z-dlugim-identyfikatorem-${index}@example.com-1`, orderSerialNumber: 54955 - index,
  clientResult: { clientBillingAddress: { clientFirm: 'Przykładowa firma technologiczna Spółka z ograniczoną odpowiedzialnością', clientCity: 'Warszawa' } },
  orderDetails: { orderStatus: status, orderAddDate: '2026-09-11 09:10:00', payments: { orderPaymentType: 'prepaid', orderCurrency: { currencyId: index % 2 ? 'EUR' : 'PLN', orderProductsCost: 12345.67 } }, dispatch: { courierName: 'DHL' } },
  productsResults: [{ productId: 123, productName: 'Platforma serwerowa — produkt z długą nazwą i konfiguracją', productQuantity: 2, productOrderPrice: 1234, productOrderPriceNet: 1000 }],
}));
const handlers = {
  'settings:get': () => settings,
  'settings:set': (patch) => (settings = { ...settings, ...patch }),
  'offers:list': () => [...offers.values()],
  'offers:getLast': () => 'test-1',
  'offers:open': (id) => offers.get(id),
  'offers:save': (payload) => { lastSaved = payload; offers.set(payload.id, structuredClone(payload)); return payload; },
  'offers:new': () => { const p = structuredClone(seed); p.id = `test-${sequence++}`; p.meta.offerNo = `${sequence}/JT/09/2026`; p.items = []; p.fields.custName = ''; offers.set(p.id, p); return p; },
  'offers:duplicate': (id) => { const p = structuredClone(offers.get(id)); p.id = `test-${sequence++}`; offers.set(p.id, p); return p; },
  'offers:delete': (id) => offers.delete(id),
  'clients:suggest': () => [],
  'clients:getByNip': () => null,
  'clients:lookupByNip': () => null,
  'app:getVersion': () => '1.7.3',
  'window:isMaximized': () => false,
  'offers:nextSeq': () => 3,
  'upd:getStatus': () => ({}),
  'idosellQuestionsWorker:getStatus': () => ({ enabled: false, isRunning: false }),
  'idosell:ordersList': () => ({ orders: iaiOrders, results: [] }),
  'idosell:orderGet': () => ({ orders: iaiOrders }),
};
const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
for (const channel of new Set([...preload.matchAll(/ipcRenderer\.invoke\("([^"]+)"/g)].map(m => m[1]))) {
  ipcMain.handle(channel, (_e, ...args) => { calls.push(channel); return handlers[channel]?.(...args) ?? {}; });
}
const evaluate = (fn, ...args) => win.webContents.executeJavaScript(`(${fn.toString()})(...${JSON.stringify(args)})`);
async function until(fn, message) {
  for (let i = 0; i < 100; i++) { if (await win.webContents.executeJavaScript(`Boolean((${fn.toString()})())`)) return; await new Promise(r => setTimeout(r, 100)); }
  throw new Error(`Timeout: ${message}`);
}
const click = (id) => evaluate(id => document.getElementById(id).click(), id);
async function capture(name) {
  await new Promise(r => setTimeout(r, 180));
  fs.writeFileSync(path.join(output, name + '.png'), (await win.webContents.capturePage()).toPNG());
}
app.whenReady().then(async () => {
  protocol.handle('https', () => new Response(JSON.stringify([{ effectiveDate: '2026-09-11', rates: [{ code: 'EUR', mid: 4.3 }, { code: 'USD', mid: 4 }] }]), { headers: { 'content-type': 'application/json' } }));
  win = new BrowserWindow({ width: 1440, height: 980, show: false, webPreferences: { preload: path.join(root, 'preload.js'), contextIsolation: true, sandbox: true, backgroundThrottling: false, offscreen: true } });
  const errors = [];
  win.webContents.on('console-message', (_e, level, message) => { if (level === 3 && !message.includes('Content Security Policy')) errors.push(message); });
  win.webContents.session.on('will-download', (_event, item) => { downloads.push(item.getFilename()); item.setSavePath(path.join(output, path.basename(item.getFilename()))); });
  await win.loadFile(path.join(root, 'renderer/index.html'));
  await until(() => document.querySelector('#offersTbody [data-act="open"]'), 'offers loaded');
  assert(await evaluate(() => document.querySelector('.erp-logo img').naturalWidth > 0), 'asset logo loaded');
  assert(await evaluate(() => document.getElementById('btnOffersIaiOrders').disabled), 'unconfigured IAI stays disabled');
  await capture('offers');
  await evaluate(() => document.querySelector('#offersTbody [data-act="open"]').click());
  await until(() => document.getElementById('mainPage').classList.contains('is-active'), 'editor opened');
  assert.equal(await evaluate(() => document.getElementById('custName').value), seed.fields.custName);
  assert.equal(await evaluate(() => document.getElementById('sumGross').textContent.replace(/\s/g, '')), '2214,00zł');
  const html = fs.readFileSync(path.join(root, 'renderer/index.html'), 'utf8');
  const formHtml = html.split('<div id="mainPage"')[1].split('<div id="offersPage"')[0];
  const fieldIds = [...formHtml.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"/g)].map(m => m[1]);
  assert(await evaluate(ids => ids.every(id => document.querySelectorAll('#' + id).length === 1 && document.getElementById('mainPage').contains(document.getElementById(id))), fieldIds), 'all original fields retained in form');
    assert(await evaluate(() => [...document.querySelectorAll('#itemsBody [data-del]')].every(button => {
      const b = button.getBoundingClientRect();
      const i = button.querySelector('i').getBoundingClientRect();
      return Math.abs((b.left + b.right - i.left - i.right) / 2) < 0.5 && Math.abs((b.top + b.bottom - i.top - i.bottom) / 2) < 0.5;
    })), 'delete icons centered within buttons to half a pixel');
    assert(await evaluate(() => ['btnAddItem', 'btnAddItem2'].every(id => {
      const button = document.getElementById(id), icon = button.querySelector('i');
      const b = button.getBoundingClientRect(), i = icon.getBoundingClientRect();
      return getComputedStyle(icon).marginRight === '0px' && Math.abs((b.top + b.bottom - i.top - i.bottom) / 2) < 0.5;
    })), 'add icons vertically centered without inherited margins');
    await capture('editor');
    const editorValues = await evaluate(() => [...document.querySelectorAll('#mainPage input, #mainPage select, #mainPage textarea')].map(n => [n.id, n.value, n.checked]));
    await click('erp-view-page');
    assert(await evaluate(() => document.querySelector('.erp-tabs').hidden && ['data', 'terms', 'finance'].every(k => !document.getElementById('erp-panel-' + k).hidden && document.getElementById('erp-panel-' + k).getAttribute('role') === 'region')), 'onepage reveals all three editor sections');
    assert.deepEqual(await evaluate(() => [...document.querySelectorAll('#mainPage input, #mainPage select, #mainPage textarea')].map(n => [n.id, n.value, n.checked])), editorValues, 'switching layout preserves all field values');
    await capture('editor-onepage');
    await click('erp-view-tabs');
    assert(await evaluate(() => !document.getElementById('erp-panel-data').hidden && document.getElementById('erp-panel-terms').hidden && document.getElementById('erp-panel-finance').hidden), 'tab mode restores single visible panel');
    assert(await evaluate(() => document.querySelector('.itemDetailsRow').hidden), 'item details collapsed by default');
    await evaluate(() => document.querySelector('[data-note="0"]').click());
    assert(await evaluate(() => document.querySelector('[data-inline-note="0"]').open && document.querySelector('[data-warranty="0"] .itemVariantsBlock').hidden), 'note indicator opens inline note and empty alternatives stay hidden');
    await evaluate(() => { const t = document.querySelector('[data-inline-note="0"] textarea'); t.value = 'Notatka testowa'; t.dispatchEvent(new Event('input', { bubbles: true })); });
    await capture('item-details-note');
    await evaluate(() => document.querySelector('[data-alt-add="0"]').click());
    assert(await evaluate(() => !document.querySelector('[data-warranty="0"] .itemVariantsBlock').hidden && document.querySelector('[data-inline-note="0"] textarea').value === 'Notatka testowa'), 'adding alternative preserves internal note');
    await capture('item-details-alternative');
    await evaluate(() => document.querySelector('[data-alt-del="0"]').click());
    await evaluate(() => document.querySelector('.itemDetailsToggle[data-i="0"]').click());
    await click('erp-tab-terms');
    assert.equal(await evaluate(() => document.getElementById('hideOfferDatePdf').checked), false, 'existing offers show version date by default');
    await click('hideOfferDatePdf');
  await evaluate(() => { const p = document.getElementById('paymentMethod'); p.value = 'invoice'; p.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('invoiceDays').value = '14'; document.getElementById('termsExtra').value = 'Warunki testowe'; });
  assert(await evaluate(() => document.getElementById('invoiceDaysWrap').offsetHeight > 0), 'invoice days visible');
  await capture('terms');
  await click('erp-tab-finance');
  assert(await evaluate(() => !!document.querySelector('#profitBreakdownChart .finance-table') && document.getElementById('sumMargin').textContent.includes('22,22')), 'finance breakdown and margin rendered');
  assert.equal(await evaluate(() => document.getElementById('sidebarProfitNet').textContent), await evaluate(() => document.getElementById('sumProfitNet').textContent), 'sidebar profit matches finance totals');
  await capture('finance');
  assert(await evaluate(() => !!document.querySelector('#marginGaugeChart svg') && document.querySelectorAll('.erp-profit-row').length === 1), 'gauge and cost/profit chart restored');
  await evaluate(async () => {
    const { store } = await import('./app/state/store.js');
    const { recalcTotalsUI } = await import('./app/ui/totalsPanel.js');
    const oldCost = store.items[0].buyNet;
    store.items[0].buyNet = 1200;
    recalcTotalsUI();
    if (!document.getElementById('sidebarProfitNet').classList.contains('finance-loss') || !document.querySelector('.finance-table .finance-loss')) throw new Error('Loss must display in both views');
    store.items[0].buyNet = oldCost;
    recalcTotalsUI();
  });
  assert(await evaluate(() => {
    const bar = document.getElementById('appTitlebar').getBoundingClientRect();
    const controls = document.querySelector('.app-win-controls').getBoundingClientRect();
    return Math.abs(bar.top - controls.top) < 1 && controls.bottom <= bar.bottom && controls.right <= bar.right;
  }), 'window controls align with titlebar background');
  await click('btnAddItem');
  assert(await evaluate(() => !document.getElementById('erp-panel-data').hidden), 'add from any tab reveals item table');
  assert.equal(await evaluate(() => document.querySelectorAll('#itemsBody [data-item-main="1"]').length), 2);
  await click('btnOffersRefresh');
  await until(() => document.getElementById('offersPmReportView').classList.contains('is-active'), 'PM navigation');
    assert.equal(lastSaved.fields.termsExtra, 'Warunki testowe', 'hidden terms saved before navigation');
    assert.equal(lastSaved.fields.hideOfferDatePdf, true, 'PDF date preference saved with offer');
  assert.equal(Number(lastSaved.fields.invoiceDays), 14);
  assert.equal(lastSaved.items.length, 2);
    await capture('report');
    assert(await evaluate(() => {
      const inputs = document.getElementById('pmReportInputs');
      const outputs = document.getElementById('pmReportOutputs');
      return ['pmReportMonth', 'pmReportPmSalary', 'pmReportCsvRaw', 'pmReportDoneText', 'pmReportPlanText', 'pmReportOffersBody'].every(id => inputs.contains(document.getElementById(id)))
        && ['pmReportSummary', 'pmReportSubiektTrends', 'pmReportDonePreview', 'pmReportPlanPreview', 'pmReportFinalSummary', 'pmReportExportHtml', 'pmReportExportPdf'].every(id => outputs.contains(document.getElementById(id)))
        && !!(inputs.compareDocumentPosition(outputs) & Node.DOCUMENT_POSITION_FOLLOWING)
        && outputs.lastElementChild.id === 'pmReportExportPanel';
    }), 'report inputs precede all results and exports');
    await evaluate(() => {
      const field = document.getElementById('pmReportDoneText');
      field.value = '[b]Wniosek testowy[/b]';
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert(await evaluate(() => document.getElementById('pmReportDonePreview').textContent.includes('Wniosek testowy')), 'moved text preview continues updating');
    const richChecks = await evaluate(() => {
      const field = document.getElementById('pmReportDoneText');
      const editor = document.getElementById('pmReportDoneTextEditor');
      field.value = '[b]Działania[/b]\n[list]\n[*] Pierwszy punkt\n[*] Drugi punkt\n[/list]';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      const migrated = !!editor.querySelector('strong') && editor.querySelectorAll('li').length === 2 && field.hidden;
      editor.innerHTML = 'Pierwsza linia<div>Druga linia</div>';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      const breaks = field.value === 'Pierwsza linia\nDruga linia';
      editor.innerHTML = 'Ważny wynik'; editor.focus();
      const selection = window.getSelection(), range = document.createRange();
      range.selectNodeContents(editor); selection.removeAllRanges(); selection.addRange(range);
      editor.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      document.querySelector('[data-target="pmReportDoneText"] [data-bb="b"]').click();
      const bold = field.value === '[b]Ważny wynik[/b]' && !!editor.querySelector('b,strong');
      const stored = JSON.parse(localStorage.getItem('esus.pmReport.v1')).doneText === field.value;
      const transfer = new DataTransfer(); transfer.setData('text/plain', '<img src=x onerror=alert(1)>');
      editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
      const safePaste = !editor.querySelector('img');
      document.getElementById('pmReportPlanTextEditor').innerHTML = '<ul><li>Plan A</li><li>Plan B</li></ul>';
      document.getElementById('pmReportPlanTextEditor').dispatchEvent(new Event('input', { bubbles: true }));
      const plan = document.getElementById('pmReportPlanText').value.includes('[list]') && document.getElementById('pmReportPlanPreview').querySelectorAll('li').length === 2;
      editor.scrollIntoView({ block: 'center' });
      return { migrated, breaks, bold, stored, safePaste, plan };
    });
    assert(Object.values(richChecks).every(Boolean), `rich report editing works: ${JSON.stringify(richChecks)}`);
    await capture('report-rich-editor');
    const trendChecks = await evaluate(async () => {
      const { buildMonthlyTrend, metricChange } = await import('./app/ui/pmTrends.js');
      const periods = [{ period: { from: '2025-12-01', to: '2025-12-31' }, metrics: { totalNet: 100 } }, { period: { from: '2026-01-01', to: '2026-01-15' }, metrics: { totalNet: 900 } }];
      const rows = buildMonthlyTrend(periods, { mode: 'month', from: '2026-02-01', to: '2026-02-28' }, { totalNet: 200 }, new Date(2026, 1, 15));
      return { length: rows.length, previous: rows.at(-2).metrics, december: rows.at(-3).metrics.totalNet, current: rows.at(-1).metrics.totalNet, partial: rows.at(-1).partial, delta: metricChange(150, 100), points: metricChange(20, 15, true), zero: metricChange(100, 0), negative: metricChange(100, -100), missing: metricChange(null, 100) };
    });
    assert.equal(trendChecks.length, 12);
    assert.equal(trendChecks.previous, null, 'partial ranges excluded and missing months stay missing');
    assert.equal(trendChecks.december, 100, 'year boundary preserved');
    assert.equal(trendChecks.current, 200);
    assert.equal(trendChecks.partial, true);
    assert(trendChecks.delta.includes('50,00%') && trendChecks.points.includes('5,00 p.p.'));
    assert(trendChecks.zero.includes('brak dodatniej') && trendChecks.negative.includes('brak dodatniej') && trendChecks.missing === 'Brak porównania');
    await evaluate(() => {
      const month = document.getElementById('pmReportMonth');
      month.value = '2026-08'; month.dispatchEvent(new Event('change', { bubbles: true }));
      const csv = document.getElementById('pmReportCsvRaw');
      csv.value = 'Typ;Nazwa;Symbol;Grupa;Ilość;JM;Brutto;Netto;Koszt;Zysk;Marża\nT;Serwer;S1;Serwery;2;szt;1845;1500;1000;500;33.33';
      csv.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('pmReportSaveSubiektPeriod').click();
      month.value = '2026-09'; month.dispatchEvent(new Event('change', { bubbles: true }));
      csv.value = 'Typ;Nazwa;Symbol;Grupa;Ilość;JM;Brutto;Netto;Koszt;Zysk;Marża\nT;Serwer;S1;Serwery;3;szt;3690;3000;2400;600;20';
      csv.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('pmReportSubiektTrends').scrollIntoView({ block: 'start' });
    });
    assert(await evaluate(() => document.querySelectorAll('#pmReportSubiektTrends svg').length === 4 && document.querySelector('#pmReportSubiektTrends .pmTrendKpi small').textContent.includes('100,00%')), 'CSV and archive drive monthly charts and KPIs');
    await capture('report-trends');
    const copied = await evaluate(async () => {
      let captured;
      const original = navigator.clipboard.write;
      navigator.clipboard.write = async items => { captured = items[0]; };
      try {
        document.getElementById('pmReportExportHtml').click();
        for (let i = 0; i < 30 && !captured; i++) await new Promise(r => setTimeout(r, 50));
        const html = await (await captured.getType('text/html')).text();
        const plain = await (await captured.getType('text/plain')).text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const images = [...doc.querySelectorAll('img')];
        const decoded = await Promise.all(images.map(async source => { const image = new Image(); image.src = source.src; await image.decode(); return image.naturalWidth === 1400 && image.naturalHeight === 420; }));
        return { html, images: images.length, decoded: decoded.every(Boolean), headers: doc.querySelectorAll('th').length, readable: [...doc.querySelectorAll('th')].every(c => c.style.color === 'rgb(30, 41, 59)' && c.style.backgroundColor === 'rgb(232, 237, 244)'), history: html.includes('Subiekt — historia miesięczna'), plain: plain.includes('Sprzedaż netto') && !plain.includes('<table') };
      } finally { navigator.clipboard.write = original; }
    });
    assert(copied.headers > 10 && copied.readable && copied.history && copied.plain, 'mail has explicit contrasting cell colors, monthly history and plain-text fallback');
    assert(copied.images === 4 && copied.decoded, 'clipboard contains four valid embedded PNG charts');
    fs.writeFileSync(path.join(output, 'pm-mail.html'), copied.html);
    await click('pmReportExportPdf');
    for (let i = 0; i < 100 && !downloads.some(n => n.startsWith('raport-pm_')); i++) await new Promise(r => setTimeout(r, 100));
    assert(downloads.some(n => n.startsWith('raport-pm_')), 'PM PDF with charts downloaded');
  await click('btnOffers');
  await until(() => document.getElementById('offersListView').classList.contains('is-active'), 'return to offers');
  await evaluate(() => { const el = document.getElementById('offersSearch'); el.value = 'no-match'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal(await evaluate(() => document.querySelectorAll('#offersTbody tr').length), 0);
  await evaluate(() => { const el = document.getElementById('offersSearch'); el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await evaluate(() => document.querySelector('[data-act="dup"]').click());
  await until(() => document.querySelectorAll('#offersTbody tr').length === 2, 'duplicate');
  await evaluate(() => document.querySelector('[data-act="open-number"]').click());
  await until(() => document.getElementById('mainPage').classList.contains('is-active'), 'open from number');
  await click('btnAppSettings');
  await capture('settings');
  assert(await evaluate(() => document.querySelector('header #offerNumberPreview') !== null), 'offer number is the main header');
  assert(await evaluate(() => !document.body.textContent.includes('Numer nadaje program')), 'old numbering explanation removed');
  await click('settingsTabIntegration');
  assert(await evaluate(() => !document.getElementById('settingsPanelIntegration').hidden && !document.querySelector('[id*="QuestionsWorker"]')), 'integration settings contain no worker section');
  await capture('settings-integration');
  await click('settingsTabSystem');
  assert(await evaluate(() => document.getElementById('btnSettingsRefreshRates').offsetHeight > 0 && document.getElementById('btnSettingsClearOffers').offsetHeight > 0), 'administrative actions remain available');
  await capture('settings-system');
  assert(!calls.includes('idosellQuestionsWorker:getStatus'), 'opening settings does not contact worker');
  await evaluate(() => document.querySelector('.settingsModalCloseBtn').click());
  // Export with the real PDF code, intercepting only its final download.
    assert.equal(await evaluate(() => document.getElementById('hideOfferDatePdf').checked), true, 'PDF date preference restored when reopening offer');
    const dateVisibility = await evaluate(async () => {
      const { generatePdf } = await import('./app/export/pdf.js');
      const original = window.jspdf.jsPDF;
      const texts = [];
      window.jspdf.jsPDF = new Proxy(original, { construct(target, args) {
        const doc = Reflect.construct(target, args);
        const text = doc.text;
        doc.text = function(value, ...rest) { texts.push(String(value)); return text.call(this, value, ...rest); };
        return doc;
      } });
      try {
        await generatePdf();
        const hidden = !texts.some(t => t.includes('Wersja z dnia'));
        texts.length = 0;
        document.getElementById('hideOfferDatePdf').checked = false;
        await generatePdf();
        return { hidden, visible: texts.some(t => t.includes('Wersja z dnia')) };
      } finally { window.jspdf.jsPDF = original; }
    });
    assert.deepEqual(dateVisibility, { hidden: true, visible: true }, 'PDF includes version date only when enabled');
  for (let i = 0; i < 50 && !downloads.some(n => n.endsWith('.pdf')); i++) await new Promise(r => setTimeout(r, 100));
  assert(downloads.some(n => n.endsWith('.pdf')), 'PDF generation produces a download');
  const modernResults = await evaluate(async () => {
    const { generatePdf } = await import('./app/export/pdf.js');
    const { store } = await import('./app/state/store.js');
    const original = window.jspdf.jsPDF, originalItems = store.items;
    const ids = ['pdfTemplate', 'offerLang', 'offerCurrency', 'shippingAmount', 'termsExtra', 'hideOfferDatePdf', 'showDiscountColumnPdf', 'isEstimate'];
    const previous = ids.map(id => { const node = document.getElementById(id); return [id, node.value, node.checked]; });
    const results = [];
    let current;
    window.jspdf.jsPDF = new Proxy(original, { construct(target, args) {
      const doc = Reflect.construct(target, args), text = doc.text;
      const texts = [];
      doc.text = function(value, ...rest) { texts.push(String(value)); return text.call(this, value, ...rest); };
      doc.save = () => { results.push({ name: current, texts, pages: doc.internal.getNumberOfPages(), data: doc.output('datauristring').split(',')[1] }); };
      return doc;
    } });
    try {
      document.getElementById('pdfTemplate').value = 'modern';
      document.getElementById('shippingAmount').value = '20';
      for (const lang of ['pl', 'en', 'de', 'hu']) {
        current = lang;
        document.getElementById('offerLang').value = lang;
        document.getElementById('offerCurrency').value = lang === 'pl' ? 'PLN' : 'EUR';
        document.getElementById('hideOfferDatePdf').checked = lang !== 'pl';
        document.getElementById('showDiscountColumnPdf').checked = lang === 'pl';
        document.getElementById('isEstimate').checked = lang === 'hu';
        store.items = [{ desc: 'Switch Ubiquiti USW-24-POE', net: 1000, discount: 10, qty: 2, warranty: { months: 24, nbd: true }, internalNote: 'PRIVATE-NOTE-NEVER-EXPORT', alternatives: [] }];
        await generatePdf();
      }
      current = 'multipage';
      document.getElementById('offerLang').value = 'pl';
      document.getElementById('termsExtra').value = ('Dodatkowe ustalenia i szczegółowe warunki realizacji.\n').repeat(100);
      store.items = Array.from({ length: 35 }, (_, index) => ({ ...store.items[0], desc: `Produkt ${index + 1} z długą nazwą i specyfikacją techniczną`, alternatives: index === 0 ? [{ desc: 'Alternatywny switch', net: 1200, discount: 5, qty: 2 }] : [] }));
      await generatePdf();
      return results;
    } finally {
      store.items = originalItems; window.jspdf.jsPDF = original;
      previous.forEach(([id, value, checked]) => { const node = document.getElementById(id); node.value = value; node.checked = checked; });
    }
  });
  for (const result of modernResults) {
    fs.writeFileSync(path.join(output, `modern-${result.name}.pdf`), Buffer.from(result.data, 'base64'));
    assert(!result.texts.join(' ').includes('PRIVATE-NOTE'), 'internal notes excluded');
    assert.equal(result.texts.some(t => t.includes('Wersja z dnia')), result.name === 'pl', 'modern date visibility');
    assert(result.texts.join(' ').includes('ESUS IT'), 'supplier exported');
  }
  assert(modernResults.find(r => r.name === 'multipage').pages > 2, 'long modern offer paginates');
  assert(modernResults.find(r => r.name === 'pl').texts.some(t => t.replace(/\s/g, '').includes('2238,60')), 'modern gross includes shipping once');
  await click('erp-tab-finance');
  await click('btnExportExcel');
  for (let i = 0; i < 50 && !downloads.some(n => n.endsWith('.xlsx')); i++) await new Promise(r => setTimeout(r, 100));
  assert(downloads.some(n => n.endsWith('.xlsx')), 'Excel export produces a workbook');
  // Configured IAI remains available from the editor and saves before leaving.
  await evaluate(async () => {
    await window.esusAPI.settingsSet({ integrations: { idosell: { enabled: true, baseUrl: 'https://test.invalid', hasApiKey: true } } });
    window.dispatchEvent(new Event('esus:settingsChanged'));
  });
  await until(() => !document.getElementById('btnOffersIaiOrders').disabled, 'configured IAI enabled');
  await click('btnOffersIaiOrders');
    await until(() => document.getElementById('offersIaiOrdersView').classList.contains('is-active'), 'IAI navigation from editor');
    await until(() => document.querySelectorAll('#iaiOrdersTbody tr').length === 5, 'IAI fixture rows loaded');
    const checkIaiActions = () => [...document.querySelectorAll('#iaiOrdersTbody .row-actions')].every(row => {
      const cell = row.closest('td').getBoundingClientRect();
      const children = [...row.children].map(el => el.getBoundingClientRect());
      return children.every((r, i) => r.left >= cell.left && r.right <= cell.right && (!i || r.left >= children[i - 1].right)) && row.querySelector('select').offsetWidth >= 130;
    });
    assert(await evaluate(checkIaiActions), 'IAI document selectors and actions fit their cells');
    await capture('iai');
    await evaluate(() => document.querySelector('#iaiOrdersTbody [data-act="preview"]').click());
    await until(() => document.getElementById('iaiOrdersModalBackdrop').style.display !== 'none' && document.querySelector('.iaiOrdersSerialsInput'), 'IAI details with serial input');
    await capture('iai-preview');
    await click('iaiOrdersModalClose');
    win.setSize(1024, 820);
    await new Promise(r => setTimeout(r, 250));
    assert(await evaluate(checkIaiActions), 'IAI narrow actions do not overlap');
    assert(await evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.getElementById('iaiOrdersTableWrap').scrollWidth > document.getElementById('iaiOrdersTableWrap').clientWidth), 'IAI narrow overflow stays inside table');
    await capture('iai-narrow');
    win.setSize(1440, 980);
  await click('btnOffers');
  await until(() => document.querySelector('#offersTbody [data-act="open"]'), 'return from IAI');
  await evaluate(() => document.querySelector('#offersTbody [data-act="open"]').click());
  await until(() => document.getElementById('mainPage').classList.contains('is-active'), 'editor before resize');
  // Narrow desktop layout must not create document-level horizontal overflow.
  win.setSize(1024, 820);
  await new Promise(r => setTimeout(r, 200));
  assert(await evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '1024px viewport fits');
  await capture('narrow');
  // Sidebar state and notifications must work independently of the active page.
  await evaluate(() => document.querySelector('.erp-collapse').click());
  assert(await evaluate(() => document.documentElement.classList.contains('erp-sidebar-collapsed')), 'sidebar collapsed');
  assert.equal(await evaluate(() => document.querySelector('.erp-collapse').getAttribute('aria-expanded')), 'false');
  const sidebarIconAlignment = await evaluate(() => [...document.querySelectorAll('.erp-sidebar button')].map(button => {
    const icon = button.querySelector('i');
    const a = button.getBoundingClientRect(), b = icon.getBoundingClientRect();
    return { id: button.id || button.className, x: Math.abs(a.left + a.width / 2 - b.left - b.width / 2), y: Math.abs(a.top + a.height / 2 - b.top - b.height / 2), margin: getComputedStyle(icon).marginRight };
  }));
  assert(sidebarIconAlignment.every(icon => icon.x < 0.6 && icon.y < 0.6 && icon.margin === '0px'), `sidebar icons centered: ${JSON.stringify(sidebarIconAlignment)}`);
  await evaluate(async () => {
    const toast = await import('./app/ui/toast.js');
    toast.showToastProgress('Pobieranie aktualizacji…');
    toast.updateToastProgress(42);
  });
  assert.equal(await evaluate(() => document.querySelector('.appToastProgressBar').getAttribute('aria-valuenow')), '42');
  assert(await evaluate(() => document.getElementById('erpNotifications').classList.contains('is-working')), 'dock spinner running');
  await capture('collapsed-progress');
  await click('erpNotifications');
  await new Promise(r => setTimeout(r, 220));
  await evaluate(async () => { const t = await import('./app/ui/toast.js'); t.updateToastProgress(73); });
  await click('erpNotifications');
  assert.equal(await evaluate(() => document.querySelector('.appToastProgressBar').getAttribute('aria-valuenow')), '73', 'progress continues while tucked away');
  await evaluate(async () => {
    const t = await import('./app/ui/toast.js');
    t.endToastProgress();
    t.showToastAction('Potwierdź operację testową', { ms: 0, actionLabel: 'Wykonaj', onAction: async () => {
      await new Promise(r => setTimeout(r, 20));
      t.showToast('Operacja zakończona', { type: 'success', ms: 0 });
    } });
    document.querySelector('.appToastBtnPrimary').click();
  });
  await until(() => document.querySelector('.appToastText').textContent === 'Operacja zakończona', 'action result');
  await new Promise(r => setTimeout(r, 220));
  assert(await evaluate(() => document.getElementById('appToast').classList.contains('is-show')), 'action callback does not hide its success result');
  assert(await evaluate(() => document.getElementById('appToast').getBoundingClientRect().left < 20), 'notifications anchored left');
  await capture('collapsed-success');
  await click('erp-view-page');
  await win.reload();
  await until(() => document.querySelector('#offersTbody [data-act="open"]'), 'reload');
  assert(await evaluate(() => document.documentElement.classList.contains('erp-sidebar-collapsed')), 'collapsed preference restored after reload');
  assert(await evaluate(() => document.querySelector('#mainPage > main').classList.contains('erp-onepage') && !document.getElementById('erp-panel-terms').hidden), 'onepage preference restored after restart');
  await evaluate(() => document.querySelector('#offersTbody [data-act="open"]').click());
  await until(() => document.getElementById('mainPage').classList.contains('is-active'), 'editor after restart');
  assert(await evaluate(() => !document.getElementById('erp-panel-finance').hidden), 'opening an offer preserves onepage layout');
  await click('erp-view-tabs');
  await click('btnOffers');
  await evaluate(() => document.querySelector('.erp-collapse').click());
  assert(await evaluate(() => !document.documentElement.classList.contains('erp-sidebar-collapsed')), 'sidebar expanded');
  await evaluate(async () => {
    const t = await import('./app/ui/toast.js');
    t.showToast('Informacja testowa: dłuższy komunikat zawija się wewnątrz rozwiniętego paska menu.', { type: 'info', ms: 100 });
  });
  await new Promise(r => setTimeout(r, 300));
  assert(await evaluate(() => {
    const toast = document.getElementById('appToast');
    const bounds = toast.getBoundingClientRect();
    return toast.classList.contains('is-show') && bounds.right <= document.querySelector('.erp-sidebar').getBoundingClientRect().right && toast.scrollWidth <= toast.clientWidth;
  }), 'info remains visible and wraps inside expanded sidebar');
  assert(await evaluate(() => getComputedStyle(document.querySelector('.offers-count-pill > span')).display !== 'none'), 'offer count has a visible label');
  await capture('expanded-notification');
  await new Promise(r => setTimeout(r, 5000));
  assert(await evaluate(() => document.getElementById('appToast').style.display === 'none'), 'info auto-hides after five seconds');
  await evaluate(async () => { const t = await import('./app/ui/toast.js'); t.showToast('Nowe powiadomienie', { type: 'info' }); });
  assert(await evaluate(() => !document.getElementById('erpNotifications').classList.contains('has-notification')), 'info does not set unread dot');
  await evaluate(async () => { const t = await import('./app/ui/toast.js'); t.showToast('Ważne powiadomienie', { type: 'warning' }); });
  assert(await evaluate(() => document.getElementById('erpNotifications').classList.contains('has-notification')), 'warning sets unread dot');
  await evaluate(() => document.querySelector('.appToastClose').click());
  assert(await evaluate(() => !document.getElementById('erpNotifications').classList.contains('has-notification')), 'manual dismissal clears unread dot');
  await click('erpNotifications');
  assert(await evaluate(() => !document.getElementById('erpNotifications').classList.contains('has-notification')), 'reopening read message does not mark it unread');
  assert.deepEqual(errors, [], 'renderer has no console errors');
  // Switching between explicitly configured, legacy and new offers must not leak options.
  for (const [id, options] of [['options-x', { pdfTemplate: 'modern', hideOfferDatePdf: true, showDiscountColumnPdf: false, isEstimate: true }], ['options-y', {}]]) {
    const offer = structuredClone(seed);
    offer.id = id; offer.fields.custName = id;
    delete offer.fields.showDiscountColumnPdf;
    Object.assign(offer.fields, options);
    offers.set(id, offer);
  }
  const openOptionsOffer = async name => {
    await click('btnOffers');
    await until(() => document.getElementById('offersListView').classList.contains('is-active'), 'options offer list');
    await until(() => [...document.querySelectorAll('#offersTbody tr')].some(r => r.textContent.includes('options-x')), 'option fixtures loaded');
    await evaluate(name => [...document.querySelectorAll('#offersTbody tr')].find(r => r.textContent.includes(name)).querySelector('[data-act="open"]').click(), name);
    await until(() => document.getElementById('mainPage').classList.contains('is-active'), 'options offer opened');
  };
  const readOptions = () => evaluate(() => ['hideOfferDatePdf', 'showDiscountColumnPdf', 'isEstimate'].map(id => document.getElementById(id).checked));
  await openOptionsOffer('options-x');
  assert.equal(await evaluate(() => document.getElementById('pdfTemplate').value), 'modern');
  assert.deepEqual(await readOptions(), [true, false, true], 'explicit offer options loaded');
  await openOptionsOffer('options-y');
  assert.equal(await evaluate(() => document.getElementById('pdfTemplate').value), 'classic');
  assert.deepEqual(await readOptions(), [false, true, false], 'legacy offer uses defaults rather than previous offer values');
  await click('isEstimate');
  await openOptionsOffer('options-x');
  assert.equal(await evaluate(() => document.getElementById('pdfTemplate').value), 'modern', 'template persists per offer');
  assert.deepEqual(await readOptions(), [true, false, true], 'first offer retains its independent configuration');
  await openOptionsOffer('options-y');
  assert.deepEqual(await readOptions(), [false, true, true], 'changed option persists only on its offer');
  await click('btnNewOffer');
  await until(() => document.getElementById('custName').value === '', 'new offer created');
  assert.deepEqual(await readOptions(), [false, true, false], 'new offers reset document options');
  assert.equal(await evaluate(() => document.getElementById('pdfTemplate').value), 'classic', 'new offer template defaults');
  console.log(JSON.stringify({ passed: true, fieldsPreserved: fieldIds.length, downloads, screenshots: output, ipcCalls: [...new Set(calls)] }));
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });

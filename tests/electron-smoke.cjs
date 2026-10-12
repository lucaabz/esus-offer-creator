const { app, BrowserWindow, dialog, session } = require("electron");
const fs = require("fs");
const path = require("path");
const assert = require("assert/strict");
app.on("browser-window-created", (_event, window) => {
  window.webContents.on("console-message", (_event, level, message) => {
    if (level >= 2) console.error("Renderer:", message);
  });
});
if (process.argv.includes("--package-test")) {
  const resources = path.join(__dirname, "../dist/win-unpacked/resources");
  Object.defineProperty(app, "isPackaged", { value: true });
  Object.defineProperty(process, "resourcesPath", { value: resources });
  const packagedApp = path.join(resources, fs.existsSync(path.join(resources, "app.asar")) ? "app.asar" : "app");
  require(
    path.join(packagedApp, "node_modules/electron-updater"),
  ).autoUpdater.checkForUpdates = async () => null;
  require(path.join(packagedApp, "main.js"));
} else require("../main.js");
const testData = path.join(__dirname, "desktop-data");
fs.mkdirSync(testData, { recursive: true });
app.setPath("userData", testData);
fs.writeFileSync(
  path.join(testData, "user-settings.json"),
  JSON.stringify({
    initials: "QA",
    profile: {
      fullName: "Integration Test",
      email: "test@example.org",
      phone: "030123456",
      initials: "QA",
    },
  }),
);
dialog.showOpenDialog = async () => ({
  canceled: false,
  filePaths: [process.env.ESUS_TEST_PDF || path.join(app.getPath("downloads"), "FV_8_DE_2610.pdf")],
});
dialog.showSaveDialog = async (_parent, options) => ({
  canceled: false,
  filePath: path.join(testData, options.defaultPath),
});
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  try {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["https://api.nbp.pl/*"] },
      (_details, callback) => callback({ cancel: true }),
    );
    await wait(1800);
    const win = BrowserWindow.getAllWindows().find((item) =>
      item.webContents.getURL().endsWith("/renderer/index.html"),
    );
    assert.ok(win, "Main window loaded");
    await win.webContents.executeJavaScript(
      `document.querySelector('#btnOffersNew').click()`,
    );
    await wait(400);
    await win.webContents.executeJavaScript(
      `const input=document.querySelector('#custName');input.value='Navigation Test';input.dispatchEvent(new Event('input',{bubbles:true}))`,
    );
    await win.webContents.executeJavaScript(
      `document.querySelector('#btnOffers').click()`,
    );
    await wait(450);
    const offerBeforeInvoices = await win.webContents.executeJavaScript(
      `(async()=>window.esusAPI.offersOpen(await window.esusAPI.offersGetLast()))()`,
    );
    assert.ok(
      !["invoiceTarget", "invoiceLanguage", "invoiceLineSelect"].some(key => Object.hasOwn(offerBeforeInvoices.fields, key)),
      "Invoice selectors must not leak into saved offer fields",
    );
    assert.equal(
      await win.webContents.executeJavaScript(
        `document.querySelector('#btnOffersInvoices').hidden`,
      ),
      false,
    );
    await win.webContents.executeJavaScript(
      `document.querySelector('#btnOffersInvoices').click()`,
    );
    await wait(1200);
    assert.equal(
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-field="seller.endpoint"]').value`,
      ),
      "verkauf@esus-it.de",
    );
    await win.webContents.executeJavaScript(
      `document.querySelector('[data-action="import"]').click()`,
    );
    for (let i = 0; i < 30; i++) {
      await wait(300);
      if (
        await win.webContents.executeJavaScript(
          `document.querySelector('#invoiceStatus').textContent.includes('Faktura została wczytana')`,
        )
      )
        break;
    }
    assert.equal(
      await win.webContents.executeJavaScript(
        `document.querySelector('#invoicePreviewImage').hidden`,
      ),
      false,
    );
    assert.ok(
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-field="number"]').value.length>0`,
      ),
    );
    await wait(1000);
    const polishLayout = await win.webContents.executeJavaScript(`(() => {
      const source = document.querySelector('[data-field="payment_text"]');
      const method = document.querySelector('[data-field="payment_code"]');
      const controls = [...document.querySelectorAll('#invoiceWorkspace [data-field]')];
      return {
        language: document.querySelector('#invoiceWorkspace').lang,
        tabs: [...document.querySelectorAll('.invoice-tabs button')].map(button => button.textContent),
        fieldCount: controls.length,
        uniqueCount: new Set(controls.map(input => input.dataset.field)).size,
        adjacentPayment: source.closest('label').nextElementSibling === method.closest('label'),
        fullWidthPayment: source.closest('label').classList.contains('invoice-field-wide') && method.closest('label').classList.contains('invoice-field-wide'),
        required: document.querySelector('[data-field="buyer_reference"]').getAttribute('aria-required'),
        requiredLabel: document.querySelector('[data-requirement="buyer_reference"]').textContent,
        optionalLabel: document.querySelector('[data-requirement="purchase_order"]').textContent,
        sourceLabel: document.querySelector('[data-requirement="payment_text"]').textContent,
        taxValue: document.querySelector('[data-field="tax_case"]').value,
        taxLabel: document.querySelector('[data-field="tax_case"]').selectedOptions[0].textContent,
        notes: document.querySelector('#invoiceReport').textContent,
        originalPayment: source.value,
      };
    })()`);
    assert.equal(polishLayout.language, "pl");
    assert.deepEqual(polishLayout.tabs, [
      "Faktura",
      "Sprzedawca",
      "Nabywca",
      "VAT / uwagi",
      "Pozycje",
      "Walidacja",
    ]);
    assert.equal(polishLayout.fieldCount, 56);
    assert.equal(polishLayout.uniqueCount, 56);
    assert.ok(polishLayout.adjacentPayment && polishLayout.fullWidthPayment);
    assert.equal(polishLayout.required, "true");
    assert.equal(polishLayout.requiredLabel, "Wymagane");
    assert.equal(polishLayout.optionalLabel, "Opcjonalne");
    assert.equal(polishLayout.sourceLabel, "Dane z PDF");
    assert.equal(polishLayout.taxValue, "19 % Deutschland");
    assert.equal(polishLayout.taxLabel, "VAT 19% (Niemcy)");
    assert.ok(polishLayout.originalPayment.startsWith("Handelskredit"));
    assert.ok(!/Käufer|Rechnungsdatum|Zahlungsart/.test(polishLayout.notes));
    const emptyFields = await win.webContents.executeJavaScript(`({
      reference:document.querySelector('[data-field="buyer_reference"]').getAttribute('aria-invalid'),
      method:document.querySelector('[data-field="payment_code"]').getAttribute('aria-invalid'),
      optional:document.querySelector('[data-field="purchase_order"]').getAttribute('aria-invalid'),
      zero:document.querySelector('[data-field="paid"]').getAttribute('aria-invalid'),
      missingCount:document.querySelectorAll('#invoiceMissingFields button').length,
      notesCount:document.querySelectorAll('.invoice-import-notes li').length
    })`);
    assert.equal(emptyFields.reference, "true");
    assert.equal(emptyFields.method, "true");
    assert.equal(emptyFields.optional, null);
    assert.equal(emptyFields.zero, null);
    assert.equal(emptyFields.missingCount, 2);
    assert.ok(emptyFields.notesCount > 0);
    await win.webContents.executeJavaScript(
      `document.querySelector('#invoiceTab-report').click();document.querySelector('#invoiceWorkspace').scrollTop=0`,
    );
    await wait(150);
    fs.writeFileSync(
      path.join(__dirname, "invoice-before-validation-ui.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await win.webContents.executeJavaScript(
      `[...document.querySelectorAll('#invoiceMissingFields button')].find(button=>button.textContent.includes('Referencja nabywcy')).click()`,
    );
    assert.equal(
      await win.webContents.executeJavaScript(
        `document.activeElement.dataset.field`,
      ),
      "buyer_reference",
    );
    await win.webContents.executeJavaScript(
      `document.querySelector('[data-action="check"]').click()`,
    );
    for (let i = 0; i < 30; i++) {
      await wait(200);
      if (
        await win.webContents.executeJavaScript(
          `!document.querySelector('[data-action="check"]').disabled`,
        )
      )
        break;
    }
    const missingReport = await win.webContents.executeJavaScript(
      `document.querySelector('#invoiceReport').textContent`,
    );
    assert.ok(missingReport.includes("Brak: Referencja nabywcy"));
    assert.ok(missingReport.includes("Metoda płatności"));
    assert.ok(!missingReport.includes("Fehlt:"));
    await win.webContents.executeJavaScript(
      `{ document.querySelector('#invoiceTab-general').click();const target=document.querySelector('[data-invoice-control=invoiceTarget]');target.value='ZUGFeRD EN16931';target.dispatchEvent(new Event('change')); }`,
    );
    await wait(1000);
    assert.equal(
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-field="buyer_reference"]').getAttribute('aria-required')`,
      ),
      "false",
    );
    assert.equal(
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-field="buyer_reference"]').getAttribute('aria-invalid')`,
      ),
      null,
    );
    await win.webContents.executeJavaScript(
      `{ const target=document.querySelector('[data-invoice-control=invoiceTarget]');target.value='XRechnung';target.dispatchEvent(new Event('change')); }`,
    );
    await wait(1000);
    await win.webContents.executeJavaScript(
      `document.querySelector('#appToast')?.remove()`,
    );
    await wait(150);
    fs.writeFileSync(
      path.join(__dirname, "invoice-ui.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await win.webContents.executeJavaScript(
      `const field=document.querySelector('[data-field="payment_text"]');const workspace=document.querySelector('#invoiceWorkspace');workspace.scrollTop += field.getBoundingClientRect().top - workspace.getBoundingClientRect().top - 75;`,
    );
    await wait(150);
    fs.writeFileSync(
      path.join(__dirname, "invoice-payment-ui.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await win.webContents.executeJavaScript(
      `document.querySelector('#invoiceWorkspace').scrollTop=0`,
    );
    const before = await win.webContents.executeJavaScript(
      `document.querySelector('[data-field="number"]').value`,
    );
    await win.webContents.executeJavaScript(
      `document.querySelector('#invoiceBack').click();document.querySelector('#btnOffersInvoices').click()`,
    );
    assert.equal(
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-field="number"]').value`,
      ),
      before,
    );
    await win.webContents.executeJavaScript(
      `document.querySelector('#invoiceBack').click()`,
    );
    assert.equal(
      await win.webContents.executeJavaScript(
        `document.querySelector('#invoiceWorkspace').hidden`,
      ),
      true,
    );
    assert.equal(
      await win.webContents.executeJavaScript(
        `document.querySelector('#custName').value`,
      ),
      "Navigation Test",
    );
    await wait(150);
    fs.writeFileSync(
      path.join(__dirname, "offers-ui.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await win.webContents.executeJavaScript(
      `document.querySelector('#btnOffersInvoices').click();for(const [field,text] of [['buyer_reference','TEST'],['payment_code','58']]){const input=document.querySelector('[data-field="'+field+'"]');input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('[data-action="export"]').click()`,
    );
    assert.equal(
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-field="buyer_reference"]').getAttribute('aria-invalid')`,
      ),
      null,
    );
    assert.equal(
      await win.webContents.executeJavaScript(
        `document.querySelector('[data-field="payment_code"]').getAttribute('aria-invalid')`,
      ),
      null,
    );
    for (let i = 0; i < 100; i++) {
      await wait(200);
      if (
        await win.webContents.executeJavaScript(
          `!document.querySelector('[data-action="export"]').disabled`,
        )
      )
        break;
    }
    assert.ok(
      await win.webContents.executeJavaScript(
        `document.querySelector('#invoiceStatus').textContent.includes('Zapisano eksport')`,
      ),
      "UI XRechnung export passed",
    );
    await win.webContents.executeJavaScript(
      `const target=document.querySelector('[data-invoice-control=invoiceTarget]');target.value='ZUGFeRD EN16931';target.dispatchEvent(new Event('change'));document.querySelector('[data-invoice-control=invoiceLanguage]').value='en';document.querySelector('[data-action="export"]').click()`,
    );
    for (let i = 0; i < 100; i++) {
      await wait(200);
      if (
        await win.webContents.executeJavaScript(
          `!document.querySelector('[data-action="export"]').disabled`,
        )
      )
        break;
    }
    assert.ok(
      await win.webContents.executeJavaScript(
        `document.querySelector('#invoiceStatus').textContent.includes('Zapisano eksport')`,
      ),
      "UI English ZUGFeRD export passed",
    );
    console.log(
      "PASS: Polish UI, grouped fields, payment order, dynamic required markers, localized preflight, source values preserved, navigation, XRechnung and English ZUGFeRD exports",
    );
    await wait(800);
    const offerAfterInvoices = await win.webContents.executeJavaScript(
      `window.esusAPI.offersOpen(${JSON.stringify(offerBeforeInvoices.id)})`,
    );
    assert.deepEqual(
      offerAfterInvoices,
      offerBeforeInvoices,
      "Invoice editing and exports must leave saved offer data unchanged",
    );
    const duplicated = await win.webContents.executeJavaScript(
      `window.esusAPI.offersDuplicate(${JSON.stringify(offerBeforeInvoices.id)})`,
    );
    assert.notEqual(duplicated.id, offerBeforeInvoices.id);
    assert.notEqual(duplicated.meta.offerNo, offerBeforeInvoices.meta.offerNo);
    assert.deepEqual(duplicated.items, offerBeforeInvoices.items);
    assert.equal(
      duplicated.fields.custName,
      offerBeforeInvoices.fields.custName,
    );
    await win.webContents.executeJavaScript(
      `window.esusAPI.offersDelete(${JSON.stringify(duplicated.id)})`,
    );
    const remaining = await win.webContents.executeJavaScript(
      `window.esusAPI.offersList()`,
    );
    assert.ok(remaining.some((row) => row.id === offerBeforeInvoices.id));
    assert.ok(!remaining.some((row) => row.id === duplicated.id));
    console.log(
      "PASS: original offer save/open/duplicate/delete; invoice controls and edits do not affect offer persistence",
    );
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});

# Architecture – ESUS IT Offer Generator 1.8.0

## Baseline and integration boundaries

The application builds on version 1.7.3 of musicshaggy/esus-offer-creator
(commit `3e90d434289af73a0a31518789a0fd7b819f3e59`). The existing offer, order,
reporting and settings modules remain the foundation of the app. Version 1.8.0
extends the previously integrated local e-invoicing module with shared document
layouts, localized product names and direct order imports.

Changes to existing files cover explicit integration points, document rendering,
shipping lines and additional document metadata. `tests/parity.test.cjs` compares
original files against the pinned Git commit and explicitly accounts for approved
changes. This checks source preservation; it does not guarantee every possible
original workflow.

## Electron, user interface and storage

- `main.js`: existing application, IdoSell requests, settings and PDF printing.
- `preload.js`: IPC interfaces between the renderer and main process.
- `renderer/app/ui/iaiOrders.js`: order selection, document preview, editable
  document metadata, language selection and handoff to the e-invoicing workspace.
- `renderer/app/invoices.js`: Polish e-invoicing interface for PDF and order
  imports, review, corrections, validation and export. Other application areas
  remain mounted when switching modules.
- `invoice-ipc.js`: file dialogs, private Python processes and protection against
  losing unsaved invoice changes when closing the application.

Additional document fields use the existing user settings under
`modulePrefs.iaiOrders.documentDrafts`; no separate database is introduced.
User settings, credentials, imported invoices and generated documents do not belong
in Git.

## Document layouts

`renderer/assets/document-design.json` defines shared colors, page dimensions,
address positioning and the German GmbH company profile. Inter Regular/Bold and
their OFL license are bundled in `renderer/assets/fonts`; no runtime font download
is required.

`renderer/app/config/documentDesign.js` exposes these values to JavaScript.
`offer-layout.js` renders German offers with jsPDF/AutoTable.
`document-layout.js` styles German IAI invoices, order confirmations and delivery
notes for the existing HTML-to-PDF flow. `invoice/pdf_layout.py` renders the German
visible ZUGFeRD invoice using ReportLab. These adapters follow the existing PDF
engines and share design data. Installer resources provide the same design and
font files to Python.

German documents use the GmbH profile. Existing company profiles for other
languages are retained. Foreign-language offers continue to use the existing
renderer, with the authorized footer and shipping adjustments.

German documents share blue accents, normal-weight address, metadata and item
text, and dark bold final totals. Quantities are centered and prices aligned
right; numeric column widths account for formatted values. Repeated table headers
and reserved footer space support multiple pages. The address area targets
standard DIN-long/C5 window envelopes. This is not a general DIN certification.

Offer shipping is a calculated line item. Alternative products remain excluded
from the main total. Delivery notes contain goods only, use a plain document title,
and show the IdoSell order number plus an optional customer purchase-order number.
Delivery dates and conditions are not repeated. Editable document fields supplement
missing API values.

Technical references and electronic endpoints remain in ZUGFeRD XML but are not
repeated in the German PDF. The buyer VAT ID appears directly with the address.
Recognized tracking numbers appear below an unambiguously identified shipping
line; remaining customer notes are displayed separately. Original notes remain
in XML. The visible payment caption uses “Kauf auf Rechnung” for the corresponding
“Handelskredit” payment case. PDF unit prices show two decimals, while XML unit
prices retain their precision.

## Product text by document language

`background/idosellProductTexts.js` uses existing API helpers for read-only calls
to `products/products/search`. It requests `lang_data`, passes the document language
through `productSearchingLangId`, and selects the corresponding entry from
`productDescriptionsLangData`. Supported languages are DE, PL, EN and HU.

Requests accept up to 100 product IDs. A five-minute cache is scoped by shop,
language and product. Additional names are stored under `documentNames`; original
order names, identifiers and prices are preserved. Missing translations or API
errors fall back to the original name with a warning. Preview and export use the
same document language.

## Two sources, one e-invoicing workflow

`invoice/bridge.py` routes seller-profile, PDF-import, order-import, requirements,
validation and export actions. `invoice/model.py` remains the shared invoice model.
Monetary arithmetic uses Decimal, with decimal strings passed between processes.

1. PDF import: the existing importer reads digital IdoSell invoices. The original
   PDF remains available for comparison.
2. Order import: an action in the IAI order dialog opens the same invoice workspace.
   `invoice/order_import.py` maps billing details, items, order prices, language,
   currency and control totals. Replacing an existing draft requires confirmation.
   This source has no original PDF preview.

An order import creates a reviewable draft, not an issued invoice. Order and
invoice numbers stay separate. Invoice number, actual issue/delivery dates and
unverified payment details must be completed or confirmed. Customer purchase-order
references are not interpreted as Leitweg IDs. Fee tax rates are not guessed;
discount, rounding and total discrepancies produce notes rather than silent
balancing. Zero tax is not automatically treated as an intra-community supply.

Both sources use the existing checks and exporters. The existing scope for EUR,
German 19% VAT and reviewed intra-community supplies is not silently extended to
other tax cases.

## XML, PDF/A and official validation

The existing XRechnung exporter produces XML. `invoice/zugferd.py` generates CII XML
and a PDF/A-3 invoice with embedded XML. Supplier identifiers are serialized as a
single identifier; existing payment text can be included with the payment means.
Unit codes such as C62 are structured codes rather than visible product labels.

Validation uses pinned official XRechnung/CII resources and veraPDF for PDF/A.
`invoice/validation/manifest.json` and `.gitattributes` protect resource bytes.
Valid structure does not replace the user's confirmation of actual invoice data.

## Development, packaging and publishing

```powershell
npm.cmd ci
npm.cmd test
npm.cmd start
npm.cmd run dist -- --win nsis --x64 --publish never
```

`scripts/prepare-invoice.ps1`, invoked through existing npm lifecycle hooks,
prepares pinned private Python/Java runtimes and invoice resources. End users
install the Windows setup executable and do not need a Node/Python development
environment.

Application version: 1.8.0. Existing dependency versions are retained. The automatic
update source in `package.json` still points to the original repository,
`musicshaggy/esus-offer-creator`. Pushing or merging the fork does not distribute
an installer or change an installed executable. A separate fork release/update
channel would require an explicit decision. Installer binaries belong in GitHub
release assets, not source commits.

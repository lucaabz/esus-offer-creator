# Verification and change scope – Version 1.8.0

Date: 2026-10-28. The comparison baseline is the fork's last published feature
branch commit (`b3489df`). Its existing e-invoicing integration is extended;
PDF import, requirements checks and both export formats remain available.

## Changes since the last push

- Shared German layouts for offers, order confirmations, delivery notes, IAI
  invoices and ZUGFeRD PDFs; centralized design values, bundled Inter fonts and
  consistent complete footers. Foreign-language company profiles are retained.
- Revised addresses, metadata, tables, totals, page breaks and closing text.
  Offer shipping is included as a calculated line; delivery notes exclude shipping.
- Delivery notes show the IdoSell order number, optional customer purchase-order
  number and delivery date. Additional document fields can be edited manually.
- IdoSell product names follow the selected DE/PL/EN/HU document language, with a
  cache and fallback to original names when translations are unavailable.
- Orders can open directly as drafts in the existing e-invoicing workspace.
  Billing details, order lines and prices are mapped; unverified invoice, tax and
  payment details remain for review. Manual PDF import stays available.
- ZUGFeRD improvements include two-decimal PDF prices with full XML unit-price
  precision, corrected supplier identifiers, payment text, and clearer payment,
  tracking-number and customer-note placement.
- Version 1.8.0, matching installer resources and additional checks without new
  npm dependencies.

## Automated verification

```powershell
npm.cmd test
.\runtime\python\python.exe -X utf8 -m unittest discover -s invoice -p 'test_*.py'
```

Node tests cover official resource hashes including the Git index, explicitly
allowed changes against the original 1.7.3 source, dependency and package
preservation, and localized product-text requests. Python tests cover imports,
order drafts, required fields, numeric precision, XML output and PDF behavior.
The package comparison requires an existing local build; otherwise it is
explicitly skipped.

`tests/electron-smoke.cjs` uses isolated test storage and controlled order data.
It checks offer workflows, navigation, languages, PDF import, XML/ZUGFeRD export,
shipping totals and order handoff, including cancel/confirm when replacing a
draft. Its entry point is `tests/smoke-app`; `--package-test` also checks the local
Windows package. Required local PDF samples are not published.

The most recent complete verification before publication passed 47 Python tests,
6 Node tests and Electron integration checks against source and the Windows
package. The commit-time rerun is also reported in the pull request. A synthetic,
reviewed order draft was checked with the official XRechnung/CII validators.

## Limits

Source parity explicitly permits the authorized layout, shipping, document-field
and integration changes. It does not claim every file is unchanged or every
original workflow has been manually exercised.

An end-to-end comparison of the same live shop order against its PDF invoice
remains outstanding. Product text and order mapping have been checked with
controlled responses. Missing values and supported tax cases still require
review after import. Tests do not constitute general DIN or legal certification.

## Packaging and Git

Windows setup uses the existing electron-builder/NSIS workflow and contains the
private invoice resources. Installer binaries, runtimes, node_modules, credentials,
user settings and sample invoices are excluded from source commits. Component and
build details are documented in `ARCHITEKTUR.md`.

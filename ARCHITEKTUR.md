# ESUS App 1.7.4 – lokale Integration

## Ausgangspunkt und Erhaltung von 1.7.3

Upstream: musicshaggy/esus-offer-creator, Commit `3e90d434289af73a0a31518789a0fd7b819f3e59`.
Der lokale Git-Arbeitsstand baut auf diesem Commit auf. Es wurde nichts auf GitHub veröffentlicht.
Die Geschäftslogik, Vorlagen und Datenformate der ursprünglichen App bleiben erhalten.
Die einzigen Einbindungspunkte sind ein Require in `main.js`, eine zusätzliche API in
`preload.js` und je ein zusätzlicher CSS-/Module-Verweis in `renderer/index.html`.
Paketversion, Paketressourcen und Git-Ignore-Regeln wurden ergänzt.
Der vorhandene Release-Aufruf erhält zusätzlich zwei Zeilen zur Vorbereitung der
Rechnungsressourcen. Seine Versions-, Git-, Veröffentlichungs- und Updateabläufe bleiben erhalten.

`tests/parity.test.cjs` vergleicht sämtliche Originaldateien gegen die Git-Objekte
des oben festgeschriebenen Commits. Eine zweite Referenzkopie ist dafür nicht nötig.
Nur diese dokumentierten Ergänzungen und Paketangaben dürfen abweichen.
Dieser Vergleich sichert Quellcode-Erhaltung; er ersetzt keine vollständige manuelle
Abnahme jedes ursprünglichen Bedienablaufs mit echten IdoSell-Zugangsdaten.

## Komponenten

- `main.js`, `preload.js`, `renderer/app/main.js`: bestehende Electron-App mit ihren
  unveränderten Angebots-, Bestell-, Export-, Berichts- und Einstellungsmodulen.
- `renderer/app/invoices.js`: zusätzlicher, eigenständiger Rechnungsbereich. Beide
  Bereiche bleiben im DOM; Navigation baut vorhandene Formulare nicht neu auf.
  „E-faktury“ steht neben „Zamówienia IAI“ in der Angebotsübersicht.
  „Powrót do ofert“ führt zurück. In Berichts-/Bestellunteransichten wird der
  Menüeintrag ausgeblendet. Die zusätzliche Navigation in der Titelleiste entfällt.
  Die gesamte Bedienoberfläche dieses Moduls ist standardmäßig polnisch. Die
  Dokumentensprache ist davon unabhängig; interne Steuerfallwerte und alle
  Quelltexte werden unverändert gespeichert. `invoice-ui-pl.js` enthält die
  Anzeigeübersetzung von Pflichtmarkierungen, Steuerfallnamen und Import-/Prüfhinweisen.
  Offizielle Validator-Kommunikate bleiben unverändert in aufklappbaren technischen Details.
  Felder sind thematisch gruppiert; zusätzliche optionale Referenzen und Quellangaben
  stehen am Ende. Zahlungsinformation aus PDF und Zahlungsmittelauswahl stehen direkt
  untereinander. Pflichtfelder werden fett und mit „Wymagane“ hervorgehoben; ihre
  Kennzeichnung passt sich weiter an Exportformat und Rechnungsdaten an.
  Leere Pflichtfelder werden zusätzlich rot markiert und mit einem Text-Hinweis
  sowie `aria-invalid` versehen. Die Markierung verschwindet sofort beim Ausfüllen.
  Die Walidacja-Seite zeigt leere Pflichtfelder als anklickbare Liste, einen
  getrennten Prüfstatus, getrennte Fehler-/Warnlisten und Importhinweise als Liste.
  Importhinweise sind ausdrücklich kein Prüfergebnis. Nach Änderungen oder einem
  Formatwechsel wird das vorherige Prüfergebnis nicht mehr als aktuell angezeigt.
- `renderer/css/50_invoices.css`: nur die neue Navigation und den Rechnungsbereich
  betreffende Gestaltung; verwendet die bestehenden ESUS-Farbvariablen. Kein Win95.
- `invoice-ipc.js`: Dateidialoge und lokale Prozesssteuerung. Feste erlaubte Aktionen,
  JSON über stdin/stdout, Zeit- und Antwortgrößenbegrenzung. Kein HTTP-Server.
- `invoice/bridge.py`: Adapter ohne Tkinter. Ruft die bestehenden Fachmodule auf.
- `invoice/model.py`, `importer.py`, `checks.py`, `field_rules.py`, `xrechnung.py`,
  `validator.py`, `address_lookup.py`: übernommen aus IdoRechnung.
- `invoice/zugferd.py`: gleiche XML-Abbildung und Prüfungen; PDF-Beschriftungen haben
  eine zusätzliche Sprachoption. NotoSans aus dem Offer Creator deckt PL/HU-Zeichen ab.
- `invoice/invoice_i18n.py`: sichtbare PDF-Beschriftungen DE/EN/PL/HU. Eingetragene
  Artikeltexte, Bemerkungen, Verkäuferidentität, Beträge und XML werden nicht übersetzt.
- `invoice/validation/`: festgeschriebene offizielle XRechnung-Prüfdateien mit Manifest.
  `.gitattributes` deaktiviert ausschließlich dort die Zeilenenden-Konvertierung,
  damit die offiziellen SHA256-Prüfsummen auch nach einem Git-Checkout stimmen.
- `invoice/vendor/`: lokale Bibliotheken einschließlich Factur-X und SaxonC.
- `invoice/tools/`: veraPDF und Java für PDF/A-Prüfung.
- `runtime/python/`: private Python-3.12-Laufzeit und weitere benötigte Pakete.

## Datenfluss

Electron-Dateiauswahl → Python-PDF-Import → formatneutrales Invoice-JSON → Kontrolle
in Electron → Vorabprüfung → offizielle XML-Prüfung → XML oder geprüftes ZUGFeRD-PDF.

Eine ZUGFeRD-Prüfung vor dem Export prüft das XML. Erst beim Export werden das PDF,
die unveränderte eingebettete XML und PDF/A-3b geprüft. Fehlgeschlagene Prüfungen
geben keinen neuen Export frei. Die bisherigen Prüfberichte werden weiter geschrieben.
Quell-PDF-Vorschauen werden lokal als PNG gerendert und über IPC übertragen.

Die Schnittstelle startet pro Anfrage einen Hintergrundprozess. Für den derzeitigen
Einzelrechnungsbetrieb hält dies den Zustand einfach und isoliert. Python wird mit `-I`
gestartet; der Adapter fügt ausschließlich seine eigenen Module und vendor zum Suchpfad hinzu.

## Lokale Daten

Der ursprüngliche Datenordner bleibt `%LOCALAPPDATA%\ESUS-Quote`. Das neue Verkäuferprofil
liegt darin separat unter `invoices/seller.json`. Angebote und bestehende Einstellungen
behalten ihre ursprünglichen Speicherorte. Rechnungsentwürfe werden auf ausdrücklichen
Speicherklick als JSON gespeichert. Original-PDFs werden nicht verändert oder mitkopiert.

Testläufe verwenden `tests/desktop-data`; sie greifen nicht auf die echte Angebotsdatenbank zu.
Anonymisierte Test-PDFs liegen unter `tests/pdf-samples` und sind von Git ausgeschlossen.

Die bestehenden Angebotsmodule werden nicht dupliziert. Neue Rechnungs-Auswahlfelder
verwenden `data-invoice-control` statt IDs: Die ursprüngliche Angebots-Persistenz sammelt
Formularfelder mit IDs global ein. So gelangen Rechnungswerte nicht in Angebotsdateien.
Der Pakettest bestätigt unveränderte gespeicherte Angebote nach Rechnungsbearbeitung.
Die ungenutzte frühere Tkinter-Oberfläche (`app.py`, `win95_theme.py`, `instant_tabs.py`)
wurde aus dem neuen Rechnungsmodul und dem Windows-Paket entfernt.

## Paket und Veröffentlichung

`Start.cmd` startet bevorzugt das lokale Windows-Paket unter `dist/win-unpacked`.
`npm start` startet die Entwicklungsversion. Installierte Electron-Abhängigkeiten und
private Python-Laufzeit sind in dieser lokalen Lieferung vorhanden.
`scripts/prepare-invoice.ps1` richtet Python 3.12.10, Temurin Java 17.0.20.1,
veraPDF 1.30.3 und alle Python-Abhängigkeiten lokal ein. Downloads werden mit SHA256
geprüft; sämtliche direkten und indirekten Python-Abhängigkeiten sind in den vorhandenen
Requirements festgeschrieben. Pip wird nur beim Aufbau aus einem geprüften Wheel gestartet,
nicht im ausgelieferten Python installiert. Das eingebettete Python sucht ausschließlich
in seiner Standardbibliothek und `invoice/vendor`. Vorbereitung erfolgt vor `npm start`,
`npm run pack`, `npm run dist` sowie im bisherigen Release-Skript.
Der Setup-Fingerabdruck unter `runtime/` verhindert unnötige erneute Downloads und Installationen.
electron-builder kopiert Python und Rechnungsressourcen als `extraResources`, außerhalb
des ASAR-Archivs. Der reproduzierbare Ressourcenaufbau ist implementiert und mit einer
frischen Quellkopie geprüft. Ein vollständiger regulärer Installer-Test und eine gesonderte
Fork-Veröffentlichung/Updatequelle bleiben eigenständige Release-Schritte.
Die bisherige GitHub-Updatekonfiguration wurde erhalten; sie zeigt auf das Originalprojekt.
Der Versionswert 1.7.4 bezeichnet diesen lokalen Entwicklungsstand, keine erfolgte Veröffentlichung.
`runtime/`, `invoice/vendor/` und `invoice/tools/` sind von Git ausgeschlossen.
Ein frischer Clone enthält diese Ressourcen deshalb nicht. `npm run invoice:prepare`
beschafft sie automatisch. Nur der Entwickler benötigt Node/npm und Internet; der fertige
Installer liefert Python, Bibliotheken und Java/veraPDF für den lokalen Betrieb mit.
Im lokalen Paket liegen die JavaScript-Dateien unter `resources/app`, weil der automatische
ASAR-/Ressourcenaufbau innerhalb der abgeschotteten Umgebung unterbrochen wurde. Die
Produktionsabhängigkeiten wurden aus dem erzeugten Archiv übernommen, aktuelle neue
Module ergänzt und die vollständigen Rechnungs-/Python-Ressourcen separat kopiert.
Ein Test mit genau diesen Paketdateien und Ressourcen hat Import, Vorschau, Navigation
und beide Exporte bestätigt. Für den GitHub-Release bleibt ein regulärer Installer-Build erforderlich.

Die vorhandene Rechnung unterstützt weiterhin EUR, den bestätigten IdoSell-PDF-Aufbau,
19% Deutschland und innergemeinschaftliche Warenlieferung. Die Dokumentensprache
erweitert weder Währungen noch Steuerfälle. Keine zusätzlichen IdoSell-API-Funktionen.

Bekannte Originalverhalten bleiben erhalten: interner Angebots-Excel-Export mit 23%,
sprachabhängige Firmenfußzeilen im Angebotsbereich, deaktivierte Bestellanlage und Fragenworker.

## Verifikation

- `node --test tests/parity.test.cjs`: Erhaltung der Originaldateien.
- `runtime/python/python.exe -m unittest discover -s invoice -p "test_*.py" -v`:
  Rechnungsregeln, XML-Validierung, blockierte Exporte, Profilpersistenz, isolierter
  Python-Prozess, vier PDF-Sprachen mit identischer XML und PDF/A-Prüfung.
- `node_modules/electron/dist/electron.exe tests/smoke-app`: gemeinsame
  Oberfläche, Preload/API, Verkäuferdaten, Beispielimport, Vorschau und erhaltene Daten
  beim Bereichswechsel; Screenshots zur visuellen Kontrolle.
  Der abgeschottete Codex-Testlauf benötigt zusätzlich `--no-sandbox --disable-gpu`.
  Der normale Start für Anwender verwendet diese Testoptionen nicht.

## Schließen mit ungespeicherten Rechnungsänderungen

Der Renderer blockiert `beforeunload` nur bei ungespeicherten Änderungen.
`invoice-ipc.js` behandelt dazu Electron `will-prevent-unload` mit einem nativen
Bestätigungsdialog. „Weiter bearbeiten“ behält das Fenster und die Eingaben;
„Änderungen verwerfen und schließen“ hebt die Blockierung auf. Ohne Änderungen
schließt der vorhandene X-Button unmittelbar. `tests/close-app` prüft alle drei Fälle.

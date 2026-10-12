# ESUS App – Entwicklungsstand 1.7.4

Offer Creator 1.7.3 mit zusätzlichem lokalem Rechnungsmodul. In der Angebotsübersicht
steht **E-faktury** neben **Zamówienia IAI**; **Powrót do ofert** führt zurück.
Die Rechnungsoberfläche ist polnisch. ZUGFeRD-PDF-Beschriftungen können DE/EN/PL/HU
sein; Artikeltexte und Kundenbemerkungen bleiben unverändert. Pflichtfelder werden
abhängig von Format und Inhalt hervorgehoben. XML- und PDF/A-Prüfungen erfolgen lokal.
Bestehende Angebots-/Bestellmodule, Vorlagen und Geschäftslogik bleiben erhalten.

## Entwicklung und Installer unter Windows x64

Auf dem Build-Rechner werden Git, Node.js mit npm und Internet benötigt. Python und
Java müssen nicht systemweit installiert werden. Im Projektordner:

```powershell
npm ci
npm run invoice:prepare
npm test
.\runtime\python\python.exe -m unittest discover -s invoice -p 'test_*.py' -v
npm start
```

`invoice:prepare` lädt Python 3.12.10, Temurin Java 17.0.20.1 und veraPDF 1.30.3
mit festgeschriebenen SHA256-Prüfsummen. `invoice/requirements.txt` fixiert sämtliche
Python-Abhängigkeiten einschließlich ihrer Windows-x64-Wheel-Prüfsummen.
Die Ressourcen werden nur im Projekt eingerichtet. Ein erneuter Aufruf ohne Änderung
verwendet den vorbereiteten Stand. `npm start`, `npm run pack` und `npm run dist`
führen den Vorbereitungsschritt automatisch aus. Auch der vorhandene Release-Aufruf
bereitet die Ressourcen vor. Der Anwender erhält sie im Installer und benötigt kein npm,
Python oder Java für den Betrieb.

Lokales Installationspaket ohne Veröffentlichung bauen:

```powershell
npm run dist -- --win --publish never
```

Die Ausgabe liegt in `dist`. Der bestehende `electron-builder` und seine Windows-
Konfiguration werden weiterverwendet. `npm run pack` erzeugt nur den Programmordner.
`Start.cmd` startet bevorzugt diesen Ordner; alternativ die eingerichtete Entwicklungsversion.
Für den regulären Installer gelten die bisherigen Voraussetzungen des Originalprojekts.
Der Stand des tatsächlichen Build-Tests ist in [PRUEFUNG.md](PRUEFUNG.md) dokumentiert.

## Was in Git gehört

Quellcode, Build-Skripte, `package.json`, `package-lock.json`, Python-Requirements,
Validierungsregeln/Manifeste, Schriften, Tests und Dokumentation gehören ins Repository.
`runtime/`, `invoice/vendor/`, `invoice/tools/`, `node_modules/`, `dist/` und erzeugte
Test-/Benutzerdaten sind ausgeschlossen. Keine Rechnungen oder Zugangsdaten hochladen.

`invoice/seller-defaults.json` ist erforderlich und enthält die vorausgefüllten
ESUS-Firmen-, Steuer-, Bank- und Kontaktdaten. Diese Angaben werden in einem öffentlichen
Fork öffentlich sichtbar. Änderungen am Verkäuferprofil während der Nutzung bleiben
lokal unter `%LOCALAPPDATA%\ESUS-Quote\invoices\seller.json`.

## Änderungen in den eigenen Fork übertragen

Im bereits vorhandenen lokalen Projekt arbeiten. `DEIN_GITHUB_NAME` durch den tatsächlichen
GitHub-Namen ersetzen; bei anderem Repository-Namen die URL ebenfalls anpassen.
`upstream` zeigt bereits auf das Originalprojekt, `origin` ist hier noch nicht eingerichtet.

```powershell
cd 'C:\Users\Luca\Documents\Codex\2026-10-11\ich\outputs\ESUS-App'
git switch -c feature/e-invoices
git remote add origin https://github.com/DEIN_GITHUB_NAME/esus-offer-creator.git
git add .gitattributes .gitignore main.js preload.js renderer/index.html package.json package-lock.json
git add scripts/release_publish.cmd scripts/prepare-invoice.ps1
git add ARCHITEKTUR.md PRUEFUNG.md README.md Start.cmd Start.ps1 invoice-ipc.js invoice tests
git add renderer/app/invoices.js renderer/app/invoice-ui-pl.js renderer/css/50_invoices.css
git diff --cached --stat
git diff --cached
git commit -m "Add local XRechnung and ZUGFeRD invoice module"
git push -u origin feature/e-invoices
```

Vor dem Commit die Änderungen und Verkäufer-Vorgaben prüfen. Kein Force-Push und
kein manuelles Ersetzen des gesamten GitHub-Repositories erforderlich.

## Frischen Download testen

In einem anderen Ordner klonen; der Test darf nicht die Ressourcen der bisherigen
Arbeitskopie verwenden:

```powershell
git clone --branch feature/e-invoices https://github.com/DEIN_GITHUB_NAME/esus-offer-creator.git ESUS-Test
cd ESUS-Test
npm ci
npm run invoice:prepare
npm test
.\runtime\python\python.exe -m unittest discover -s invoice -p 'test_*.py' -v
npm run dist -- --win --publish never
```

Danach den erzeugten Installer aus `dist` ausführen. Angebote anlegen/speichern/öffnen,
PDF-/Excel-Ausgabe, Auftragsbestätigung/Lieferschein und die tatsächlich genutzten
IdoSell-Funktionen prüfen. Im Rechnungsbereich PDF importieren, Vorschau und Pflichtfelder
prüfen und beide Ausgabeformate exportieren. Die Anwendung auch mit dem X schließen.
Die ursprünglichen lokalen Benutzerdaten werden weiterhin benutzt; vor der eigenen
Abnahme empfiehlt sich eine Kopie des bestehenden Datenordners.

Der zusätzliche Electron-Beispieltest erwartet die bestätigte IdoSell-Beispielrechnung.
Sie wird nicht eingecheckt. Bei anderem Speicherort `ESUS_TEST_PDF` setzen:

```powershell
$env:ESUS_TEST_PDF = 'C:\Pfad\FV_8_DE_2610.pdf'
.\node_modules\electron\dist\electron.exe tests/smoke-app
```

## Erst im eigenen Fork übernehmen, dann den Autor anfragen

Nach erfolgreicher Abnahme im eigenen Fork einen PR mit **base: master** und
**compare: feature/e-invoices** erstellen und mit **Create a merge commit** übernehmen.
Den Feature-Branch behalten. Anschließend **Compare across forks** wählen:

- Ziel: `musicshaggy/esus-offer-creator`, Branch `master`.
- Quelle: eigener Fork, Branch `feature/e-invoices`.

Titel: **Add local XRechnung and ZUGFeRD invoice module**. In der Beschreibung Umfang,
unveränderte Originalmodule, minimale Einbindungspunkte und Prüfergebnisse samt Grenzen
aus `PRUEFUNG.md` nennen. Für eine Vorabprüfung im Dropdown **Create draft pull request**
wählen; nach abgeschlossener Abnahme **Ready for review**. Wenn alles zuvor geprüft wurde,
kann direkt ein normaler PR erstellt werden.

`scripts/release_publish.cmd` veröffentlicht und erhöht die Version. Für den lokalen
Test den oben angegebenen Build mit `--publish never` verwenden. Die Update-/Releasequelle
zeigt weiterhin auf das Originalprojekt und bleibt für den PR erhalten. Eine eigene
Fork-Veröffentlichung benötigt separat angepasste Release-/Updatekonfiguration.

GitHub-Dokumentation: [Fork erstellen](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/fork-a-repo?tool=webui),
[Pull Request aus einem Fork](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork).

Architektur und Datenfluss: [ARCHITEKTUR.md](ARCHITEKTUR.md).

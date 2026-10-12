# Prüfung der lokalen Integration 1.7.4

Stand: 12.10.2026.

Zeilenenden: Offizielle Prüfdateien müssen bytegenau dem SHA256-Manifest entsprechen.
Die neue `.gitattributes` schützt ausschließlich `invoice/validation/**` vor Git-
Konvertierung. Bereits hinzugefügte Dateien müssen mit `git add --renormalize
invoice/validation` erneut aufgenommen werden. Der Referenztest prüft jetzt außerdem
die Prüfsummen der tatsächlich im Git-Index enthaltenen Prüfdateien.

## Reproduzierbare Rechnungsressourcen und Installer-Aufbau

`scripts/prepare-invoice.ps1` eingerichtet und mit einer Quellkopie ohne private
Laufzeit-/Prüfordner ausgeführt. Alle Download-Prüfsummen stimmten; die festgeschriebenen
Windows-x64-Abhängigkeiten ließen sich installieren. Alle 33 Python-Tests bestanden
mit der frisch geladenen eingebetteten Python-3.12.10-Laufzeit, einschließlich XML und
PDF/A-3b. Ein zweiter Aufruf übersprang die bereits fertige Einrichtung.
Die vorhandenen npm-Start-/Build-Befehle und das Release-Skript rufen die Vorbereitung auf.
Die Originaldateien und bestehenden Abhängigkeiten bestehen den Referenzvergleich
weiterhin; hinzu kommt nur der dokumentierte Vorbereitungsschritt im Release-Skript.

Der vollständige normale npm-/Build-Ablauf ist in dieser Umgebung nicht abschließend
bestanden: Electron-Entpacken und Ressourcen-Kopieren melden hier EPERM-Dateizugriffsfehler.
Für den Pakettest wurden das geprüfte Electron-Archiv separat entpackt und die vom
Vorbereitungsskript erzeugten Ressourcen vollständig kopiert. electron-builder erzeugte
das reguläre ASAR-Paket mit `npmRebuild=false` als lokaler Testoption.
Beim anschließenden NSIS-Aufbau aus diesem Programmpaket verweigert Windows den Start
von `makensis.exe` mit „Illegales Verschieben einer System-DLL“ (DLL-Adresskonflikt).
Auch der direkte Aufruf des Installerwerkzeugs meldet denselben Fehler.
Deshalb gibt es weiterhin keine erfolgreich gebaute/abgenommene Setup-EXE. Der reguläre
Build `npm run dist -- --win --publish never` und die Installation müssen außerhalb
dieser abgeschotteten Umgebung geprüft werden. Die originale Installerkonfiguration
wurde dafür nicht durch einen anderen Installer ersetzt.

Das vervollständigte reguläre ASAR-Programmpaket wurde separat mit seinen eigenen
Python-/Prüfressourcen geprüft. Der Electron-Test bestand: polnische Oberfläche,
Navigation, Import/Vorschau, Pflichtmarkierungen, XRechnung und englisches ZUGFeRD
sowie ursprüngliches Angebot speichern/öffnen/duplizieren/löschen. Die gespeicherten
Angebotsdaten blieben nach Rechnungsbearbeitung und Exporten unverändert.
Dieser Pakettest ersetzt keine erfolgreich ausgeführte Installerinstallation.

Aktualisierung der Rechnungsoberfläche: alle 56 Felder vollständig und eindeutig
vorhanden; polnische Beschriftungen, Optionen, Pflichtmarkierungen, Importhinweise,
Vorabprüfmeldungen und eigene Dialoge. Zahlungsinformation und Methodenauswahl
stehen direkt untereinander. Dynamische Referenzpflicht bei XRechnung/ZUGFeRD,
Erhaltung der deutschen internen Steuerfallwerte und unveränderter PDF-Quellangaben
sowie beide Exporte im Test mit den aktuellen Windows-Paketdateien bestätigt.
Screenshots der gruppierten Formulare und des Zahlungsabschnitts visuell geprüft.

Validierungsübersicht: Importhinweise als separate Liste, Prüfstatus getrennt und
leere Pflichtfelder als anklickbare Übersicht geprüft. Der UI-Test bestätigt rote
Markierung und `aria-invalid` bei fehlender Käuferreferenz/Zahlungsmittel, keine
Fehlermarkierung für optionale Angaben oder einen gültigen Nullbetrag, direkte
Navigation zum ausgewählten fehlenden Feld, Entfernen der Markierung beim
Ausfüllen und beim Wechsel zu einem Format ohne entsprechende Pflicht. Beide
Exporte funktionieren weiterhin mit den Paketdateien.

## Erfolgreich geprüft

- Finale Wiederholungsprüfung: drei Referenz-/Pakettests und alle 33 Python-Tests bestanden.
  5.750 Originaldateien sowie separat `package.json` und `package-lock.json` geprüft.
  Der aktuelle Upstream-Branch `master` stand am 12.10.2026 weiterhin auf dem Referenzcommit.
- Originale Geschäftslogik, Vorlagen, CSS, Abhängigkeitsversionen und Updatekonfiguration
  unverändert. Bestehende Dateien enthalten nur die dokumentierten Einbindungspunkte,
  Paket-/Versionsangaben und Ignore-Ergänzungen.
- Angebot speichern, öffnen, duplizieren und löschen mit den Paketdateien geprüft.
  Gespeicherte Angebotsdaten bleiben nach Rechnungsbearbeitung und beiden Exporten
  vollständig unverändert. Neue Auswahlfelder wurden dafür aus der globalen
  ID-basierten Angebots-Persistenz herausgehalten, ohne Originalmodule zu ändern.
- Fenster schließen geprüft: ohne Änderungen unmittelbar, bei Änderungen Bearbeitung
  fortsetzen oder Änderungen verwerfen und schließen.
- Drei ungenutzte Dateien der alten Tkinter-/Win95-Oberfläche aus dem neuen Modul
  und Paket entfernt. Der ursprüngliche separate IdoRechnung-Ordner bleibt erhalten.

- Alle Originaldateien von Commit `3e90d434289af73a0a31518789a0fd7b819f3e59`
  gegen die Referenz verglichen. Abweichungen nur bei den dokumentierten
  Einbindungspunkten, Paketangaben und Ignore-Regeln.
- 33 Python-Tests bestanden. Enthalten: vorhandene Vorabprüfungen, offizielle
  XRechnung-/CII-Regeln, Zahlenpräzision, Exportblockierung bei Fehlern, bezahlte
  PayPal-Rechnung, innergemeinschaftliche Lieferung, mehrseitige Rechnung und
  unabhängige PDF/A-Prüfung.
- Neue Sprachprüfung: DE/EN/PL/HU mit identischem eingebetteten XML, erhaltenem
  Artikeltext, korrekt extrahierbaren Sonderzeichen und erfolgreicher PDF/A-3b-Prüfung.
- Vier Sprach-PDFs gerendert und visuell kontrolliert; NotoSans statt Vera verhindert
  fehlende polnische/ungarische Zeichen. Tabellenbreite berücksichtigt längere Beschriftungen.
- Electron-Test mit isolierten Testdaten: Verkäufer-Vorgaben, Beispielrechnung
  FV_8_DE_2610, Import, Original-PDF-Vorschau, Pflichtmarkierungen, Navigation mit
  erhaltenen Angebots- und Rechnungsdaten, XRechnung-Export und englisches ZUGFeRD.
- Derselbe Test mit den JavaScript-Dateien, Produktionsabhängigkeiten und
  Python-/Prüfressourcen aus dem lokalen Windows-Paket bestanden.
- UI-Screenshots geprüft: bestehender Angebotsbereich erhalten; neuer Rechnungsbereich
  mit gleichen Farben, Schrift und Formularstil. Keine Win95-Komponenten eingebunden.

## Grenzen der Abnahme

Es wurden keine Live-IdoSell-Zugangsdaten verwendet. Die Originalfunktionen wurden durch
Quellcode-Erhaltung abgesichert; sämtliche realen API-Antwortvarianten, Drucker und
ursprünglichen Benutzerabläufe sind damit noch nicht vollständig manuell abgenommen.

Das Windows-Paket ist ein lokal startbarer Ordner. Der automatisierte Installer-Build
wurde durch Dateisystembeschränkungen der Arbeitsumgebung unterbrochen. Die Ressourcen
wurden lokal vervollständigt und geprüft. Ein regulärer Installer, Signierung und die
GitHub-Fork-/Updatequelle sind noch keine abgeschlossenen Release-Schritte.

Die privaten Python-, Bibliotheks- und Java/veraPDF-Ressourcen bleiben von Git ausgeschlossen.
Ein frischer Clone richtet sie jetzt über das eingecheckte Vorbereitungsskript ein.
Der Electron-Beispieltest verwendet eine lokale Beispielrechnung; andere Rechner können
deren Pfad über `ESUS_TEST_PDF` angeben. Die echte Rechnung wird nicht eingecheckt.
Live-API-Aufrufe, physischer Druck und Installation eines echten Updates wurden nicht geprüft.

Die Version wurde nicht veröffentlicht. Das Original-Repository wurde nicht verändert.

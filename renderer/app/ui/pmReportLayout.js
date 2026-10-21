// Move live controls without recreating them, so report state and listeners stay intact.
export function organizePmReport() {
  const root = document.getElementById('offersPmReportView');
  const shell = root?.querySelector('.pmReportShell');
  if (!shell || shell.dataset.organized) return;
  shell.dataset.organized = 'true';
  const byId = id => document.getElementById(id);
  const hero = shell.querySelector('.pmReportHero');
  const setup = byId('pmReportMonth').closest('section');
  const selection = byId('pmReportOffersBody').closest('section');
  const editors = shell.querySelector('.pmReportEditors');
  const csvPanel = byId('pmReportCsvRaw').closest('article');
  const insights = byId('pmReportRoiPlaceholder').closest('article');
  const offersSummary = byId('pmReportSummary');
  const offersCharts = shell.querySelector('.pmReportChartGrid--offers');
  const intros = [...shell.querySelectorAll(':scope > .pmReportSectionIntro')];
  const finalSummary = byId('pmReportFinalSummary').closest('section');
  const group = (id, title, description) => {
    const section = document.createElement('section');
    section.id = id;
    section.className = 'pmReportFlowGroup';
    section.setAttribute('aria-labelledby', `${id}Title`);
    const header = document.createElement('div');
    header.className = 'pmReportFlowHeading';
    const h = document.createElement('h2'); h.id = `${id}Title`; h.textContent = title;
    const p = document.createElement('p'); p.textContent = description;
    header.append(h, p); section.append(header); return section;
  };
  const inputs = group('pmReportInputs', '1. Przygotuj raport', 'Wybierz okres i oferty, wczytaj dane sprzedaży, uzupełnij działania oraz plan.');
  const outputs = group('pmReportOutputs', '2. Wyniki i podgląd raportu', 'Wyniki aktualizują się po zmianie danych. Eksport gotowego raportu znajduje się na końcu.');
  const subiektOutput = document.createElement('section');
  subiektOutput.className = 'pmReportPanel';
  subiektOutput.append(byId('pmReportSubiektStats'), byId('pmReportSubiektTrends'), csvPanel.querySelector('.pmReportSubiektTables'));
  const textPreview = document.createElement('section');
  textPreview.className = 'pmReportEditors';
  textPreview.hidden = true; // Text is formatted directly in the editors; retain export preview nodes.
  textPreview.style.display = 'none';
  for (const [id, title] of [['pmReportDonePreview', 'Wykonane działania'], ['pmReportPlanPreview', 'Plan na kolejny okres']]) {
    const preview = byId(id);
    preview.previousElementSibling?.remove(); // Old inline preview label inside the input card.
    const card = document.createElement('article'); card.className = 'pmReportPanel';
    const heading = document.createElement('h3'); heading.textContent = title;
    card.append(heading, preview); textPreview.append(card);
  }
  const exportPanel = document.createElement('section');
  exportPanel.id = 'pmReportExportPanel';
  exportPanel.className = 'pmReportPanel pmReportExportPanel';
  const exportHeading = document.createElement('h3'); exportHeading.textContent = 'Eksport gotowego raportu';
  const actions = document.createElement('div'); actions.className = 'pmReportActions';
  actions.append(byId('pmReportExportHtml'), byId('pmReportExportPdf'));
  exportPanel.append(exportHeading, actions);
  root.querySelector('.pmReportFabDock').hidden = true;
  hero.querySelector('p').textContent = 'Najpierw uzupełnij dane raportu, następnie sprawdź wyniki i wyeksportuj całość.';
  inputs.append(setup, selection, csvPanel, editors);
  outputs.append(intros[0], offersSummary, offersCharts, intros[1], subiektOutput, insights, textPreview, finalSummary, exportPanel);
  shell.replaceChildren(hero, inputs, outputs);
}

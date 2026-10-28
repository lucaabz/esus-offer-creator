import { toggleToast } from './toast.js';

// Move the existing controls, rather than copying them: persistence, exports and
// event handlers keep using the same elements and IDs inside mainPage.
export function initErpLayout() {
  if (document.querySelector('.erp-sidebar')) return;
  const byId = (id) => document.getElementById(id);
  const sidebar = document.createElement('nav');
  sidebar.className = 'erp-sidebar';
  sidebar.setAttribute('aria-label', 'Moduły aplikacji');
  sidebar.id = 'erpSidebar';
  sidebar.innerHTML = '<div class="erp-logo"></div><button type="button" class="erp-collapse" aria-controls="erpSidebar"><i class="fa-solid fa-angles-left" aria-hidden="true"></i><span class="erp-nav-label">Zwiń menu</span></button><div class="erp-nav-caption">OBSZAR ROBOCZY</div><div class="erp-nav-items"></div><div class="erp-nav-bottom"><button type="button" id="erpNotifications" aria-controls="appToast" aria-expanded="false" title="Powiadomienia"><i class="fa-regular fa-bell" aria-hidden="true"></i><span class="erp-nav-label">Powiadomienia</span><span class="erp-notification-dot" aria-hidden="true"></span></button></div>';
  sidebar.querySelector('.erp-logo').append(document.querySelector('header .brand img'));
  const nav = sidebar.querySelector('.erp-nav-items');
  for (const id of ['btnOffers', 'btnOffersIaiOrders', 'btnOffersRefresh']) {
    const button = byId(id);
    button.classList.add('erp-nav-button');
    // Text-only labels and existing span labels share the compact behavior.
    for (const node of [...button.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        const label = document.createElement('span');
        label.textContent = node.textContent.trim();
        node.replaceWith(label);
      }
    }
    button.querySelectorAll('span').forEach(label => label.classList.add('erp-nav-label'));
    if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', button.textContent.trim());
    if (!button.hasAttribute('title')) button.title = button.textContent.trim();
    nav.append(button);
  }
  const settings = byId('btnAppSettings');
  const settingsLabel = document.createElement('span');
  settingsLabel.className = 'erp-nav-label';
  settingsLabel.textContent = 'Ustawienia';
  settings.append(settingsLabel);
  sidebar.querySelector('.erp-nav-bottom').append(settings);
  document.querySelector('header').before(sidebar);
  const collapse = sidebar.querySelector('.erp-collapse');
  let collapsed = false;
  try { collapsed = localStorage.getItem('esus.sidebarCollapsed') === 'true'; } catch {}
  const applyCollapsed = () => {
    document.documentElement.classList.toggle('erp-sidebar-collapsed', collapsed);
    collapse.setAttribute('aria-expanded', String(!collapsed));
    collapse.setAttribute('aria-label', collapsed ? 'Rozwiń menu' : 'Zwiń menu');
    collapse.title = collapsed ? 'Rozwiń menu' : 'Zwiń menu';
    collapse.querySelector('i').className = `fa-solid fa-angles-${collapsed ? 'right' : 'left'}`;
    window.dispatchEvent(new Event('resize'));
  };
  collapse.addEventListener('click', () => {
    collapsed = !collapsed;
    try { localStorage.setItem('esus.sidebarCollapsed', String(collapsed)); } catch {}
    applyCollapsed();
  });
  sidebar.addEventListener('transitionend', event => {
    if (event.propertyName === 'width') window.dispatchEvent(new Event('resize'));
  });
  applyCollapsed();
  const notifications = byId('erpNotifications');
  notifications.addEventListener('click', toggleToast);
  window.addEventListener('esus:notification', ({ detail }) => {
    notifications.setAttribute('aria-expanded', String(detail.visible));
    notifications.classList.toggle('has-notification', detail.available);
    notifications.classList.toggle('is-working', detail.progress);
    notifications.dataset.type = detail.type;
    notifications.querySelector('i').className = detail.progress ? 'fa-solid fa-spinner' : 'fa-regular fa-bell';
    notifications.title = detail.progress ? 'Operacja w toku — pokaż postęp' : 'Powiadomienia';
  });

  const main = document.querySelector('#mainPage > main');
  const identity = byId('offerIdentitySection');
  const status = identity.querySelector('.offerTopStatus');
  const editorHeading = document.createElement('div');
  editorHeading.className = 'erp-editor-heading';
  editorHeading.innerHTML = '<div class="erp-breadcrumb">Oferty / Edycja oferty</div>';
  editorHeading.append(byId('offerNumberPreview'));
  document.querySelector('header .brand').append(editorHeading);
  const settingsCard = document.querySelector('.offerSettingsCard');
  const totals = byId('offerItemsSection').querySelector('.totals');
  const tabs = document.createElement('div');
  tabs.className = 'erp-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Sekcje oferty');
  const workspace = document.createElement('div');
  workspace.className = 'erp-workspace';
  const content = document.createElement('div');
  content.className = 'erp-content';
  const summary = document.createElement('aside');
  summary.className = 'erp-summary';
  summary.setAttribute('aria-label', 'Ustawienia i podsumowanie oferty');
  summary.append(status, settingsCard, totals);
  const profitSummary = document.createElement('section');
  profitSummary.className = 'erp-profit-summary';
  profitSummary.setAttribute('aria-label', 'Wewnętrzne podsumowanie zysku');
  profitSummary.innerHTML = '<div class="k">Potencjalny zysk netto</div><div id="sidebarProfitNet" class="v">—</div><div class="erp-profit-margin">Marża <span id="sidebarMargin">—</span></div><div class="hint">Dane wewnętrzne · poza PDF</div>';
  summary.append(profitSummary);
  workspace.append(content, summary);
  const panels = [
    ['data', 'Dane i pozycje', ['offerCustomerSection', 'offerItemsSection']],
    ['terms', 'Warunki i dokument', ['offerTermsSection', 'offerCreatorSection']],
    ['finance', 'Zyski i marża', ['offerFinanceSection']],
  ];
  let editorView = 'tabs';
  let activePanel = 'data';
  try { if (localStorage.getItem('esus.editorView') === 'page') editorView = 'page'; } catch {}
  const activate = (key) => {
    activePanel = key;
    for (const [id, label] of panels) {
      const active = id === key;
      const panel = byId(`erp-panel-${id}`);
      panel.hidden = editorView === 'tabs' && !active;
      panel.setAttribute('role', editorView === 'tabs' ? 'tabpanel' : 'region');
      panel.setAttribute('aria-labelledby', editorView === 'tabs' ? `erp-tab-${id}` : `erp-section-title-${id}`);
      const tab = byId(`erp-tab-${id}`);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    // Item drag overlays measure the visible table after a tab switch.
    window.dispatchEvent(new Event('resize'));
  };
  panels.forEach(([key, label, ids], index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = `erp-tab-${key}`;
    tab.textContent = label;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `erp-panel-${key}`);
    tab.addEventListener('click', () => activate(key));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? panels.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + panels.length) % panels.length;
      activate(panels[next][0]);
      byId(`erp-tab-${panels[next][0]}`).focus();
    });
    const panel = document.createElement('section');
    panel.id = `erp-panel-${key}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    const heading = document.createElement('h2');
    heading.id = `erp-section-title-${key}`;
    heading.className = 'erp-page-section-title';
    heading.textContent = label;
    panel.append(heading);
    ids.forEach((id) => panel.append(byId(id)));
    tabs.append(tab);
    content.append(panel);
  });
  // All live fields have been moved out of the old decorative wrappers.
  const editorToolbar = document.createElement('div');
  editorToolbar.className = 'erp-editor-toolbar';
  const viewPicker = document.createElement('div');
  viewPicker.className = 'erp-view-picker';
  viewPicker.setAttribute('role', 'group');
  viewPicker.setAttribute('aria-label', 'Widok edytora oferty');
  viewPicker.innerHTML = '<span>Widok:</span><button type="button" id="erp-view-tabs">Zakładki</button><button type="button" id="erp-view-page">Jedna strona</button>';
  editorToolbar.append(tabs, viewPicker);
  main.replaceChildren(editorToolbar, workspace);
  const applyEditorView = () => {
    main.classList.toggle('erp-onepage', editorView === 'page');
    tabs.hidden = editorView === 'page';
    byId('erp-view-tabs').setAttribute('aria-pressed', String(editorView === 'tabs'));
    byId('erp-view-page').setAttribute('aria-pressed', String(editorView === 'page'));
    activate(activePanel);
  };
  for (const view of ['tabs', 'page']) {
    byId(`erp-view-${view}`).addEventListener('click', () => {
      editorView = view;
      try { localStorage.setItem('esus.editorView', view); } catch {}
      applyEditorView();
    });
  }
  applyEditorView();

  // Settings use a compact navigation column with one working section at a time.
  const settingsTabs = document.querySelector('.settingsTabs');
  const systemTab = document.createElement('button');
  systemTab.type = 'button';
  systemTab.id = 'settingsTabSystem';
  systemTab.className = 'settingsTabBtn';
  systemTab.dataset.settingsTab = 'system';
  systemTab.setAttribute('role', 'tab');
  systemTab.textContent = 'Dane aplikacji';
  settingsTabs.append(systemTab);
  const systemPanel = document.createElement('div');
  systemPanel.id = 'settingsPanelSystem';
  systemPanel.className = 'settingsTabPanel';
  systemPanel.dataset.settingsPanel = 'system';
  systemPanel.setAttribute('role', 'tabpanel');
  systemPanel.hidden = true;
  systemPanel.append(document.querySelector('.settingsDangerSection'));
  document.querySelector('.settingsModalCard').append(systemPanel);
  byId('settingsTabGeneral').textContent = 'Profil wystawcy';
  byId('settingsTabIntegration').textContent = 'Integracja IdoSell';
  for (const key of ['General', 'Integration', 'System']) {
    byId(`settingsTab${key}`).setAttribute('aria-controls', `settingsPanel${key}`);
    byId(`settingsPanel${key}`).setAttribute('aria-labelledby', `settingsTab${key}`);
  }
  activate('data');
  byId('btnAddItem').addEventListener('click', () => {
    activate('data');
    byId('offerItemsSection').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  window.addEventListener('esus:editorOpened', () => activate('data'));

  const syncNav = () => {
    const onOffers = byId('offersPage').classList.contains('is-active');
    const report = onOffers && byId('offersPmReportView').classList.contains('is-active');
    const orders = onOffers && byId('offersIaiOrdersView').classList.contains('is-active');
    for (const [id, active] of [
      ['btnOffers', !report && !orders], ['btnOffersRefresh', report], ['btnOffersIaiOrders', orders],
    ]) {
      byId(id).classList.toggle('is-current', active);
      if (active) byId(id).setAttribute('aria-current', 'page');
      else byId(id).removeAttribute('aria-current');
    }
    byId('headerTitle').textContent = report ? 'Raport PM' : orders ? 'Zamówienia IAI' : onOffers ? 'Oferty' : 'Edycja oferty';
  };
  const observer = new MutationObserver(syncNav);
  for (const id of ['mainPage', 'offersPage', 'offersPmReportView', 'offersIaiOrdersView']) {
    observer.observe(byId(id), { attributes: true, attributeFilter: ['class'] });
  }
  syncNav();
}

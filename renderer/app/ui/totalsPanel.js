import { escapeHtml, money, moneyCcy, toNumber } from "../utils/format.js";
import { store } from "../state/store.js";
import { itemNetAfterDiscount } from "../calc/pricing.js";
import { getVatRateFromUI, getVatFromUI } from "../utils/vat.js";
import { toPLN, fromPLN } from "../utils/currency.js";
import { syncShippingFormUi } from "../utils/shipping.js";
import { renderProfitVisuals } from "./profitVisuals.js";

let totals = {
  revenueNet: 0,
  costNet: 0,
  profitNet: 0,
  marginPct: 0,
  sumVat: 0,
  sumGross: 0,
};

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function moneyWithPLNFromPLN(amountPLN, offerCcy) {
  const vPLN = Number(amountPLN || 0);

  if (!offerCcy || offerCcy === "PLN") {
    return money(vPLN, "PLN");
  }

  const vOffer = fromPLN(vPLN, offerCcy);
  return `${money(vOffer, offerCcy)} | ${money(vPLN, "PLN")}`;
}

function renderFinanceCharts() {
  const root = document.getElementById("profitBreakdownChart");
  if (!root) return;
  const offerCcy = String(store.offer?.ccy || store.settings?.offerCcy || "PLN").toUpperCase();
  const chartItems = [];
  const rows = store.items.map((item, index) => {
    const qty = Math.max(1, parseInt(item?.qty || 1, 10) || 1);
    const revenue = toPLN(itemNetAfterDiscount(item) * qty, offerCcy);
    const cost = toPLN(Math.max(0, toNumber(item.buyNet)) * qty, String(item.buyCcy || "PLN").toUpperCase());
    const profit = revenue - cost;
    chartItems.push({ label: String(item.desc || `Pozycja ${index + 1}`), revenue, cost, profit });
    const margin = revenue > 0 ? (profit / revenue * 100).toLocaleString("pl-PL", { maximumFractionDigits: 2 }) + "%" : "—";
    return '<tr><td class="finance-lp">' + (index + 1) + '</td><td class="finance-description">' + escapeHtml(String(item.desc || "Pozycja " + (index + 1))) + '</td><td>' + qty + '</td><td>' + escapeHtml(money(revenue, "PLN")) + '</td><td>' + escapeHtml(money(cost, "PLN")) + '</td><td class="' + (profit < 0 ? 'finance-loss' : 'finance-profit') + '">' + escapeHtml(money(profit, "PLN")) + '</td><td>' + margin + '</td></tr>';
  });
  renderProfitVisuals(chartItems, totals.marginPct);
  root.innerHTML = '<table class="finance-table" aria-label="Rentowność pozycji w PLN"><thead><tr><th>Lp.</th><th>Pozycja</th><th>Ilość</th><th>Sprzedaż netto</th><th>Koszt netto</th><th>Zysk netto</th><th>Marża</th></tr></thead><tbody>' + (rows.join('') || '<tr><td colspan="7" class="finance-empty">Dodaj pozycje do oferty, aby zobaczyć ich rentowność.</td></tr>') + '</tbody></table>';
}

export function recalcTotalsUI() {
  const vatRate = getVatRateFromUI();
  const vat = getVatFromUI();
  setText("sumVatLabel", `Suma VAT ${vat.label}`);

  const offerCcy = String(store.offer?.ccy || store.settings?.offerCcy || "PLN").toUpperCase();
  syncShippingFormUi();
  setText("shippingNetLabel", `Koszt wysy\u0142ki (${offerCcy})`);

  // 1) Sprzedaż (offerCcy) + VAT w walucie oferty
  let revenueOffer = 0;
  let revenuePLN = 0;
  let costPLN = 0;

  for (const it of store.items) {
    const qty = Math.max(1, parseInt(it?.qty || 1, 10));
    const lineOffer = itemNetAfterDiscount(it) * qty;

    revenueOffer += lineOffer;
    revenuePLN += toPLN(lineOffer, offerCcy);

    // koszt zawsze sprowadzamy do PLN (buyCcy-aware)
    const buyNet = Math.max(0, toNumber(it.buyNet));
    const buyCcy = String(it.buyCcy || "PLN").toUpperCase();
    costPLN += toPLN(buyNet * qty, buyCcy);
  }

  const sumVatOffer = revenueOffer * vatRate;
  const sumGrossOffer = revenueOffer + sumVatOffer;

  // 2) Wewnętrzne (marża na bazie PLN)
  const profitPLN = revenuePLN - costPLN;
  const marginPct = revenuePLN > 0 ? (profitPLN / revenuePLN) * 100 : 0;

  // 3) Dane totals trzymamy spójnie: revenue/VAT/gross w walucie oferty, cost/profit w PLN (bazowe)
  totals = {
    revenueNet: revenueOffer,
    costNet: costPLN,       // PLN
    profitNet: profitPLN,   // PLN
    marginPct,
    sumVat: sumVatOffer,
    sumGross: sumGrossOffer,
  };

  setText("sumNet", moneyCcy(totals.revenueNet, offerCcy));
  setText("sumVat", moneyCcy(totals.sumVat, offerCcy));
  setText("sumGross", moneyCcy(totals.sumGross, offerCcy));

  // ✅ tylko tutaj: show offerCcy + PLN
  setText("sumCostNet", moneyWithPLNFromPLN(totals.costNet, offerCcy));
  setText("sumProfitNet", moneyWithPLNFromPLN(totals.profitNet, offerCcy));
  setText("sidebarProfitNet", moneyWithPLNFromPLN(totals.profitNet, offerCcy));
  setText("sidebarMargin", totals.marginPct.toLocaleString("pl-PL", { maximumFractionDigits: 2 }) + "%");
  for (const id of ["sidebarProfitNet", "sumProfitNet"]) {
    document.getElementById(id)?.classList.toggle("finance-loss", totals.profitNet < 0);
  }

  setText(
    "sumMargin",
    totals.marginPct.toLocaleString("pl-PL", { maximumFractionDigits: 2 }) + "%"
  );

  renderFinanceCharts();
}

export function getTotalsUI() {
  return totals;
}

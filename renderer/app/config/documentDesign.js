// One source for browser PDFs, HTML documents and the packaged Python renderer.
import configuration from "../../assets/document-design.json" assert { type: "json" };
configuration.colors.heading = configuration.colors.accent;
export const documentDesign = Object.freeze(configuration);

export function companyColumns(company = documentDesign.company) {
  const iban = String(company.iban || "").replace(/\s/g, "").match(/.{1,4}/g)?.join(" ") || "";
  return [
    [company.name, company.street, company.city, `Telefon: ${company.phone}`,
      `E-Mail: ${company.email}`, company.website?.replace(/^https?:\/\//,"").trim().replace(/\/$/,"")],
    [`Steuernr.: ${company.taxId}`, `USt-IdNr.: ${company.vatId}`, company.register,
      `Geschäftsführung: ${company.management}`],
    [company.bank, `IBAN: ${iban}`, `BIC: ${company.bic}`],
  ];
}

// Keep the original foreign company data; unavailable bank details stay absent.
export function legacyCompanyColumns(lines, contacts = []) {
  return [[lines[0], ...contacts].filter(Boolean), lines.slice(1,2), lines.slice(2)];
}

export function legacyContactLines(profile = {}, lang = "pl") {
  const website={pl:"www.esus-it.pl",en:"www.esus-it.com",de:"www.esus-it.de"}[lang];
  return [profile.fullName,profile.phone ? `Tel: ${profile.phone}` : "",
    profile.email ? `E-Mail: ${profile.email}` : "",website ? `Web: ${website}` : ""].filter(Boolean);
}

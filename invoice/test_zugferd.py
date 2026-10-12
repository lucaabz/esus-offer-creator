"""Hybrid export tests including independent PDF/A validation."""
import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from lxml import etree

from field_rules import requirement
from test_checks import valid_invoice
from zugferd import build_cii, check_pdf, export_zugferd, validate_cii


class ZugferdTest(unittest.TestCase):
    def test_format_specific_required_fields(self):
        self.assertEqual("Pflicht", requirement("buyer_reference", "XRechnung", {}))
        self.assertEqual("optional", requirement("buyer_reference", "ZUGFeRD EN16931", {}))
        self.assertEqual("bedingt", requirement("iban", "ZUGFeRD EN16931", {}))
        self.assertEqual("Pflicht", requirement("iban", "ZUGFeRD EN16931", {"payment_code": "58"}))
        self.assertEqual("Pflicht", requirement("buyer.vat_id", "ZUGFeRD EN16931", {"tax_case": "Innergemeinschaftliche Lieferung"}))

    def test_optional_buyer_reference_and_contact_can_be_empty(self):
        inv = valid_invoice()
        inv.buyer_reference = inv.contact_name = inv.contact_phone = inv.contact_email = ""
        inv.buyer.endpoint = inv.seller.endpoint = ""
        inv.payment_code = ""
        result = validate_cii(build_cii(inv))
        self.assertEqual([], result.errors, result.summary())

    def test_official_cii_rules_reject_bad_total(self):
        root = etree.fromstring(build_cii(valid_invoice()))
        tag = "{urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100}GrandTotalAmount"
        root.find(".//" + tag).text = "1000.00"
        result = validate_cii(etree.tostring(root))
        self.assertTrue(result.errors)
        self.assertTrue(any("BR-CO-15" in e for e in result.errors), result.summary())

    def test_paid_paypal_hybrid_and_xml_round_trip(self):
        from pypdf import PdfReader
        inv = valid_invoice()
        inv.payment_code, inv.paid, inv.payable = "68", inv.gross_total, "0.00"
        inv.buyer_reference = ""
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            target = Path(directory) / "invoice.pdf"
            result = export_zugferd(inv, target)
            self.assertTrue(result.valid, result.summary())
            reader = PdfReader(target)
            xml = list(reader.attachments["factur-x.xml"])[0]
            self.assertEqual(build_cii(inv), xml)
            self.assertIn("Offener Zahlbetrag", reader.pages[0].extract_text())
            report = json.loads(target.with_suffix(".validation.json").read_text(encoding="utf-8"))
            self.assertEqual(hashlib.sha256(target.read_bytes()).hexdigest(), report["pdf_sha256"])
            self.assertIn('isCompliant="true"', report["pdfa_report"])

    def test_intra_community_delivery_has_no_invented_recipient_name(self):
        inv = valid_invoice()
        inv.tax_case, inv.tax_reason = "Innergemeinschaftliche Lieferung", "Steuerfreie innergemeinschaftliche Lieferung"
        inv.buyer.country = inv.delivery_country = "PL"
        inv.buyer.vat_id, inv.delivery_city, inv.delivery_postcode = "PL1234567890", "Warszawa", "00-001"
        inv.tax_total, inv.gross_total, inv.payable = "0.00", inv.net_total, inv.net_total
        for line in inv.lines:
            line.tax_rate, line.tax_amount, line.gross_amount = "0", "0.00", line.net_amount
        xml = build_cii(inv)
        self.assertFalse(validate_cii(xml).errors)
        ram = "{urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100}"
        ship = etree.fromstring(xml).find(".//" + ram + "ShipToTradeParty")
        self.assertIsNone(ship.find(ram + "Name"))
        self.assertEqual("PL", ship.findtext(ram + "PostalTradeAddress/" + ram + "CountryID"))

    def test_pdfa_failure_preserves_existing_export(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            target = Path(directory) / "invoice.pdf"
            target.write_bytes(b"old invoice")
            with patch("zugferd.check_pdf", side_effect=ValueError("forced PDF/A failure")):
                result = export_zugferd(valid_invoice(), target)
            self.assertFalse(result.valid)
            self.assertEqual(b"old invoice", target.read_bytes())
            self.assertFalse(target.with_suffix(".validation.json").exists())

    def test_multi_page_invoice_passes_pdfa(self):
        from pypdf import PdfReader
        inv = valid_invoice()
        inv.lines = []
        for index in range(35):
            line = copy.deepcopy(valid_invoice().lines[0])
            line.identifier = str(index + 1)
            line.description = "Langer Beispielartikel mit Sonderzeichen ä ö ü und einer vollständigen Leistungsbeschreibung"
            line.quantity, line.net_price, line.net_amount, line.tax_amount, line.gross_amount = "1", "100.00", "100.00", "19.00", "119.00"
            inv.lines.append(line)
        inv.net_total, inv.tax_total, inv.gross_total, inv.payable = "3500.00", "665.00", "4165.00", "4165.00"
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            target = Path(directory) / "long.pdf"
            result = export_zugferd(inv, target)
            self.assertTrue(result.valid, result.summary())
            self.assertGreater(len(PdfReader(target).pages), 1)


if __name__ == "__main__":
    unittest.main()

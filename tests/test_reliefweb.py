import json
import os
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from fast_signals import parse_reliefweb_json, Article  # noqa: E402

SAMPLE = json.dumps({
    "data": [
        {"href": "https://api.reliefweb.int/v2/reports/1",
         "fields": {
             "title": "Cholera outbreak in Region X",
             "body": "<p>Cases <b>rising</b> sharply.</p>",
             "country": [{"name": "Sudan", "iso3": "SDN"}],
             "date": {"created": "2026-05-10T00:00:00+00:00"},
             "source": [{"name": "WHO"}],
             "disease": [{"name": "Cholera"}],
             "url": "https://reliefweb.int/report/sudan/cholera-1"}},
        {"fields": {
             "title": "Measles surge",
             "body": "Plain text body.",
             "url": "https://reliefweb.int/report/measles-2",
             "date": {"created": "2026-05-09T00:00:00+00:00"}}},
    ]
})


class ParseReliefWebTest(unittest.TestCase):
    def setUp(self):
        self.arts = parse_reliefweb_json(SAMPLE)

    def test_count_and_type(self):
        self.assertEqual(len(self.arts), 2)
        self.assertTrue(all(isinstance(a, Article) for a in self.arts))

    def test_fields_mapped(self):
        a = self.arts[0]
        self.assertEqual(a.source, "reliefweb")
        self.assertEqual(a.title, "Cholera outbreak in Region X")
        self.assertEqual(a.url, "https://reliefweb.int/report/sudan/cholera-1")
        self.assertEqual(a.pub_date, "2026-05-10T00:00:00+00:00")

    def test_body_html_stripped(self):
        self.assertNotIn("<", self.arts[0].body)
        self.assertIn("rising", self.arts[0].body)

    def test_url_falls_back_to_href(self):
        self.assertIsInstance(self.arts[1].url, str)

    def test_garbage_and_empty(self):
        self.assertEqual(parse_reliefweb_json("not json"), [])
        self.assertEqual(parse_reliefweb_json("{}"), [])
        self.assertEqual(parse_reliefweb_json('{"data": []}'), [])
        self.assertEqual(parse_reliefweb_json('{"data": "x"}'), [])


class AppnameGuardTest(unittest.TestCase):
    APPROVED = "episcope-ownalex-9yimg"

    def _read(self, rel):
        with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
            return f.read()

    def test_both_scripts_use_approved_appname(self):
        for rel in ("scripts/fast_signals.py", "scripts/fetch_data.py"):
            src = self._read(rel)
            self.assertIn(self.APPROVED, src, f"{rel} missing approved appname")

    def test_no_legacy_vigilo_appname(self):
        self.assertNotIn('("appname", "vigilo")',
                          self._read("scripts/fetch_data.py"))


if __name__ == "__main__":
    unittest.main()

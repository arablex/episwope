import os
import re
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


SECTION_IDS = ["overview", "breadth", "capabilities", "audience",
               "compare", "validation", "pricing"]
FORBIDDEN = ["trusted by", "predict", "lead-time", "lead time",
             "earlier than who", "case study", "join thousands",
             "our customers say"]
NO_SOCIAL_PROOF = ["testimonial", "logo-wall", "logowall",
                   "client-logos", "clientlogos", "star-rating",
                   "starrating", "case-study", "casestudy"]


class BusinessLandingTest(unittest.TestCase):
    def setUp(self):
        self.en = read("business.html")
        self.ru = read("ru/business.html")

    def test_pages_exist_and_have_required_sections(self):
        for page in (self.en, self.ru):
            for sid in SECTION_IDS:
                self.assertIn(f'id="{sid}"', page)

    def test_en_ru_structural_parity(self):
        ids = lambda h: re.findall(r'<section id="([^"]+)"', h)
        self.assertEqual(ids(self.en), ids(self.ru),
                         "EN/RU business section order must match 1:1")

    def test_no_forbidden_tokens(self):
        for name, page in (("business.html", self.en),
                           ("ru/business.html", self.ru)):
            low = page.lower()
            for bad in FORBIDDEN:
                self.assertNotIn(bad, low, f"{name} contains '{bad}'")

    def test_no_social_proof_scaffolding(self):
        for name, page in (("business.html", self.en),
                           ("ru/business.html", self.ru)):
            low = page.lower()
            for bad in NO_SOCIAL_PROOF:
                self.assertNotIn(bad, low,
                                 f"{name} has social-proof '{bad}'")

    def test_methodology_link_present_quiet(self):
        for page in (self.en, self.ru):
            self.assertIn("/methodology", page)

    def test_who_its_for_three_cards(self):
        for page in (self.en, self.ru):
            seg = page.split('id="audience"', 1)[1].split("</section>", 1)[0]
            self.assertEqual(len(re.findall(r'class="seg-card\b', seg)), 3)

    def test_pricing_no_invented_numbers(self):
        for page in (self.en, self.ru):
            pr = page.split('id="pricing"', 1)[1].split("</section>", 1)[0]
            self.assertNotIn("$", pr)
            self.assertNotIn("/mo", pr.lower())

    def test_reduced_motion_respected(self):
        for page in (self.en, self.ru):
            self.assertIn("prefers-reduced-motion", page)


class ConsumerLandingTest(unittest.TestCase):
    def test_existing_sections_intact(self):
        for rel in ("index.html", "ru/index.html"):
            h = read(rel)
            for sid in ("how", "features", "data", "pricing"):
                self.assertIn(f'id="{sid}"', h,
                              f"{rel} lost section #{sid}")

    def test_for_business_links_to_business_page(self):
        for rel in ("index.html", "ru/index.html"):
            self.assertIn('href="/business"', read(rel),
                          f"{rel} For-Business must link /business")

    def test_login_affordance_present(self):
        self.assertIn(">Log in<", read("index.html"))
        self.assertIn(">Войти<", read("ru/index.html"))


class NetlifyRouteTest(unittest.TestCase):
    def test_business_rewrite(self):
        toml = read("netlify.toml")
        self.assertRegex(
            toml,
            r'from\s*=\s*"/business"\s*\n\s*to\s*=\s*"/business\.html"'
            r'\s*\n\s*status\s*=\s*200')


if __name__ == "__main__":
    unittest.main()

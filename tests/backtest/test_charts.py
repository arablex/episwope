import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.charts import roc_svg, histogram_svg


class ChartsTest(unittest.TestCase):
    def test_roc_svg_structure(self):
        svg = roc_svg([(0.0, 0.0), (0.2, 0.6), (1.0, 1.0)],
                       title="ROC")
        self.assertTrue(svg.startswith("<svg"))
        self.assertIn("</svg>", svg)
        self.assertIn("polyline", svg)
        self.assertIn("ROC", svg)

    def test_histogram_svg_structure(self):
        svg = histogram_svg([1.0, 2.0, 2.0, 8.0, 9.0], bins=4,
                            title="Lead time (weeks)")
        self.assertTrue(svg.startswith("<svg"))
        self.assertIn("rect", svg)
        self.assertIn("Lead time", svg)

    def test_histogram_handles_empty(self):
        svg = histogram_svg([], bins=4, title="Empty")
        self.assertIn("no data", svg.lower())

    def test_deterministic(self):
        a = roc_svg([(0.0, 0.0), (1.0, 1.0)], title="X")
        b = roc_svg([(0.0, 0.0), (1.0, 1.0)], title="X")
        self.assertEqual(a, b)

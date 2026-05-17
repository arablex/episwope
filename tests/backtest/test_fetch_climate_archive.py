import json
import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.fetch_climate_archive import parse_archive

SAMPLE = json.dumps({
    "daily": {
        "time": ["2014-01-01", "2014-01-02", "2014-01-03"],
        "temperature_2m_mean": [27.5, None, 28.1],
        "precipitation_sum": [0.0, 5.2, None],
    }
})


class ParseArchiveTest(unittest.TestCase):
    def test_drops_rows_with_missing_values(self):
        out = parse_archive(SAMPLE)
        self.assertEqual([r["d"] for r in out], ["2014-01-01"])
        self.assertEqual(out[0]["t"], 27.5)
        self.assertEqual(out[0]["p"], 0.0)

    def test_empty_on_garbage(self):
        self.assertEqual(parse_archive("{}"), [])
        self.assertEqual(parse_archive("not json"), [])

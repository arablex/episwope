"""Unit tests for digest rendering. Resend HTTP is mocked."""
import unittest
from unittest.mock import patch
from datetime import datetime, timezone
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from send_digests import render_digest, should_send_to, plan_sends

EVENTS = {
    "events": [
        {"id": "e1", "country": "Brazil", "disease": "Dengue", "severity": "alert", "cases": 34000, "deaths": 142, "source": "PAHO"},
        {"id": "e2", "country": "Brazil", "disease": "Yellow Fever", "severity": "warning", "cases": 600, "deaths": 8, "source": "WHO"},
        {"id": "e3", "country": "Uganda", "disease": "Ebola", "severity": "critical", "cases": 142, "deaths": 38, "source": "WHO"},
    ]
}

class RenderDigestTest(unittest.TestCase):
    def test_renders_subject_in_user_language(self):
        sub = {"email": "a@x.com", "countries": ["Brazil"], "lang": "ru", "unsubToken": "tok"}
        msg = render_digest(sub, EVENTS)
        self.assertIn("Бразилия", msg["subject"])

    def test_includes_active_threats(self):
        sub = {"email": "a@x.com", "countries": ["Brazil"], "lang": "en", "unsubToken": "tok"}
        msg = render_digest(sub, EVENTS)
        self.assertIn("Dengue", msg["html"])
        self.assertIn("Yellow Fever", msg["html"])

    def test_calm_section_for_country_with_no_events(self):
        sub = {"email": "a@x.com", "countries": ["Iceland"], "lang": "en", "unsubToken": "tok"}
        msg = render_digest(sub, EVENTS)
        self.assertIn("No active threats", msg["html"])

    def test_unsubscribe_link_present(self):
        sub = {"email": "a@x.com", "countries": ["Brazil"], "lang": "en", "unsubToken": "tok123"}
        msg = render_digest(sub, EVENTS)
        self.assertIn("unsubscribe?t=tok123", msg["html"])

    def test_multiple_countries_one_email(self):
        sub = {"email": "a@x.com", "countries": ["Brazil", "Uganda"], "lang": "en", "unsubToken": "tok"}
        msg = render_digest(sub, EVENTS)
        self.assertIn("Brazil", msg["html"])
        self.assertIn("Uganda", msg["html"])
        self.assertEqual(msg["html"].count("</article>"), 2)

class ShouldSendToTest(unittest.TestCase):
    def test_not_verified_skipped(self):
        sub = {"status": "pending", "lastDigestSentAt": None}
        self.assertFalse(should_send_to(sub, datetime(2026, 5, 11, 9, 0, tzinfo=timezone.utc)))

    def test_unsubscribed_skipped(self):
        sub = {"status": "unsubscribed", "lastDigestSentAt": None}
        self.assertFalse(should_send_to(sub, datetime(2026, 5, 11, 9, 0, tzinfo=timezone.utc)))

    def test_verified_never_sent_is_eligible(self):
        sub = {"status": "verified", "lastDigestSentAt": None}
        self.assertTrue(should_send_to(sub, datetime(2026, 5, 11, 9, 0, tzinfo=timezone.utc)))

    def test_verified_recently_sent_is_skipped(self):
        sub = {"status": "verified", "lastDigestSentAt": "2026-05-11T09:00:00Z"}
        # Same day: skip
        self.assertFalse(should_send_to(sub, datetime(2026, 5, 11, 21, 0, tzinfo=timezone.utc)))

    def test_verified_sent_8_days_ago_is_eligible(self):
        sub = {"status": "verified", "lastDigestSentAt": "2026-05-04T09:00:00Z"}
        self.assertTrue(should_send_to(sub, datetime(2026, 5, 12, 9, 0, tzinfo=timezone.utc)))

class PlanSendsTest(unittest.TestCase):
    def test_only_mondays_in_window(self):
        subs = [{"status": "verified", "lastDigestSentAt": None, "email": "a@x.com", "countries": ["Brazil"], "lang": "en", "unsubToken": "t"}]
        # 2026-05-14 is a Thursday -> no sends
        plan = plan_sends(subs, EVENTS, now=datetime(2026, 5, 14, 9, 0, tzinfo=timezone.utc))
        self.assertEqual(plan, [])
        # 2026-05-11 is a Monday -> 1 send
        plan = plan_sends(subs, EVENTS, now=datetime(2026, 5, 11, 9, 0, tzinfo=timezone.utc))
        self.assertEqual(len(plan), 1)

if __name__ == "__main__":
    unittest.main()

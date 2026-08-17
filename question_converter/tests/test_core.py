from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from qc.balance import answer_index_report, shuffle_mcq_answers  # noqa: E402
from qc.config import (  # noqa: E402
    english_filename,
    grade_prefix,
    math_filename,
    science_section_filename,
)
from qc.detect import parse_textbook_path  # noqa: E402
from qc.parse import chunk_text, parse_sectioned_questions, split_text_by_sections  # noqa: E402
from qc.ranges import parse_chapter_block, parse_page_range, parse_section_ranges  # noqa: E402
from qc.validate import (  # noqa: E402
    validate_blank,
    validate_english_initial,
    validate_mcq,
    validate_tf,
)


class DetectTests(unittest.TestCase):
    def test_folder_and_name(self):
        book = parse_textbook_path(Path("pdfs/G10/phy.pdf"))
        self.assertIsNotNone(book)
        self.assertEqual(book.grade, 10)
        self.assertEqual(book.subject, "phy")
        self.assertEqual(book.key, "G10_phy")

    def test_grade11_english_alias(self):
        book = parse_textbook_path(Path("/tmp/Grade11_English.pdf"))
        self.assertEqual(book.grade, 11)
        self.assertEqual(book.subject, "en")

    def test_rejects_unknown(self):
        self.assertIsNone(parse_textbook_path(Path("notes.pdf")))


class RangeTests(unittest.TestCase):
    def test_page_range(self):
        self.assertEqual(parse_page_range("12-35", 100), (12, 35))
        self.assertEqual(parse_page_range("p.12 to 20", 40), (12, 20))

    def test_chapter_block(self):
        block = parse_chapter_block("1: 5-28\nChapter 2: 29-50\n", 200)
        self.assertEqual(block[1], (5, 28))
        self.assertEqual(block[2], (29, 50))

    def test_sections(self):
        secs = parse_section_ranges("1.1:12-18, 1.2:19-28", 40)
        self.assertEqual(secs["1.1"], (12, 18))
        self.assertEqual(secs["1.2"], (19, 28))


class ParseTests(unittest.TestCase):
    def test_json_object_sections(self):
        raw = '{"1.1": [{"q": "A capacitor stores energy.", "type": "tf", "c": "true", "e": "ok"}]}'
        grouped = parse_sectioned_questions(raw)
        self.assertEqual(len(grouped["1.1"]), 1)

    def test_section_header_format(self):
        raw = """1.1
[
  {"q": "Hello", "type": "tf", "c": "true", "e": "e"}
]

1.2
[
  {"q": "Bye", "type": "tf", "c": "false", "e": "e"}
]
"""
        grouped = parse_sectioned_questions(raw)
        self.assertEqual(list(grouped), ["1.1", "1.2"])

    def test_fenced_array(self):
        raw = '```json\n{"questions": [{"q": "x", "type": "mcq", "a": ["a","b","c"], "c": 1}]}\n```'
        grouped = parse_sectioned_questions(raw)
        self.assertEqual(grouped["all"][0]["c"], 1)

    def test_split_merges_deep_ids(self):
        text = "1.1 Intro\nHello\n1.2 Body\n1.2.1 Deep\nMore\n1.3 End\n"
        parts = split_text_by_sections(text, 1)
        self.assertIn("1.1", parts)
        self.assertIn("1.2", parts)
        self.assertIn("More", parts["1.2"])

    def test_chunk_text(self):
        text = "aaa\n\nbbb\n\nccc"
        chunks = chunk_text(text, 7)
        self.assertGreaterEqual(len(chunks), 2)


class FilenameTests(unittest.TestCase):
    def test_matches_existing_quiz_names(self):
        self.assertEqual(science_section_filename("bio", 1, "1.1", "Fill_Blank"), "bio_Chapter_1_1.1_Fill_Blank.json")
        self.assertEqual(science_section_filename("phy", 1, None, "MCQ"), "phy_Chapter_1_MCQ.json")
        self.assertEqual(math_filename(1, 1), "math_Chapter_1_1_Mark.json")
        self.assertEqual(math_filename(3, 3), "math_Chapter_3_3_Marks.json")
        self.assertEqual(english_filename(5, "initial_letter"), "en_unit5_initial_letter.json")
        self.assertEqual(english_filename(5, "mcq"), "en_unit5_mcq.json")
        self.assertEqual(grade_prefix(10) + "phy_Chapter_1_MCQ.json", "G10_phy_Chapter_1_MCQ.json")
        self.assertEqual(grade_prefix(11) + "en_unit1_mcq.json", "G11_en_unit1_mcq.json")


class ValidateTests(unittest.TestCase):
    def test_tf_and_blank(self):
        self.assertIsNotNone(validate_tf({"q": "Ice melts.", "c": "true", "e": "yes"}))
        self.assertIsNone(validate_tf({"q": "Ice melts.", "c": "TRUEISH"}))
        self.assertIsNotNone(validate_blank({"q": "Water is ____.", "c": "H2O", "e": "ok"}))
        self.assertIsNone(validate_blank({"q": "No blank here", "c": "x"}))

    def test_mcq_three_and_four(self):
        ok3 = validate_mcq({"q": "Q", "a": ["a", "b", "c"], "c": 2, "e": "e"}, 3)
        self.assertEqual(ok3["c"], 2)
        self.assertIsNone(validate_mcq({"q": "Q", "a": ["a", "b"], "c": 0}, 3))
        ok4 = validate_mcq({"q": "Q", "a": ["a", "b", "c", "d"], "c": 3}, 4)
        self.assertEqual(len(ok4["a"]), 4)

    def test_english_initial(self):
        item = validate_english_initial(
            {"q": "She has a_____ a deep understanding.", "a": "acquired"}
        )
        self.assertEqual(item["type"], "blank")
        self.assertEqual(item["a"], "acquired")


class BalanceTests(unittest.TestCase):
    def test_spreads_correct_index(self):
        items = [{"type": "mcq", "q": f"q{i}", "a": ["A", "B", "C"], "c": 0} for i in range(9)]
        shuffled = shuffle_mcq_answers(items)
        counts = answer_index_report(shuffled)
        self.assertEqual(sum(counts.values()), 9)
        self.assertGreaterEqual(counts.get(0, 0), 1)
        self.assertGreaterEqual(counts.get(1, 0), 1)
        self.assertGreaterEqual(counts.get(2, 0), 1)
        # Correct option text is preserved.
        for old, new in zip(items, shuffled):
            self.assertEqual(old["a"][old["c"]], new["a"][new["c"]])


class WriterSmokeTests(unittest.TestCase):
    def test_dump_roundtrip(self):
        from qc.writers import dump_json

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "bio_Chapter_1_1.1_MCQ.json"
            data = [{"q": "Q", "type": "mcq", "a": ["a", "b", "c"], "c": 1, "e": "e"}]
            dump_json(path, data)
            self.assertEqual(json.loads(path.read_text()), data)


if __name__ == "__main__":
    unittest.main()

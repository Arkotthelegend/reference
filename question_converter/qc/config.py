from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PDFS_DIR = ROOT / "pdfs"
MAPS_DIR = ROOT / "maps"
CACHE_DIR = ROOT / "cache"
OUTPUT_DIR = ROOT / "output"
PROMPTS_DIR = ROOT / "prompts"

SUBJECT_ALIASES = {
    "en": "en",
    "eng": "en",
    "english": "en",
    "math": "math",
    "maths": "math",
    "mathematics": "math",
    "phy": "phy",
    "physics": "phy",
    "chem": "chem",
    "chemistry": "chem",
    "bio": "bio",
    "biology": "bio",
}

SUBJECT_NAMES = {
    "en": "English",
    "math": "Mathematics",
    "phy": "Physics",
    "chem": "Chemistry",
    "bio": "Biology",
}

SCIENCE_SUBJECTS = ("phy", "chem", "bio")

SCIENCE_QUIZ_TYPES = (
    ("tf", "True_False"),
    ("blank", "Fill_Blank"),
    ("mcq", "MCQ"),
)

# Per 1M tokens (USD). Used only for estimates / hard budget stop.
MODEL_PRICES = {
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4.1-nano": (0.10, 0.40),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4o": (2.50, 10.00),
}

DEFAULT_PROVIDER = "openai"
DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_BUDGET_USD = 10.0
BUDGET_RESERVE_USD = 0.50

MAX_CHARS_PER_CALL = 12000
MAX_OUTPUT_TOKENS = 8000

MATH_1_MARK_COUNT = (40, 50)
MATH_2_MARK_COUNT = (20, 28)
MATH_3_MARK_COUNT = (20, 28)
EN_INITIAL_COUNT = 100
EN_MCQ_COUNT = 80
SCIENCE_CHAPTER_TARGET = (100, 200)


def grade_folder(grade: int) -> str:
    if grade == 10:
        return "G10"
    if grade == 11:
        return "G11"
    return ""


def output_file(grade: int, filename: str) -> Path:
    return OUTPUT_DIR / grade_folder(grade) / filename


def math_mark_suffix(marks: int) -> str:
    return "1_Mark" if marks == 1 else f"{marks}_Marks"


def science_section_filename(subject: str, chapter: int, section: str | None, kind: str) -> str:
    if section:
        return f"{subject}_Chapter_{chapter}_{section}_{kind}.json"
    return f"{subject}_Chapter_{chapter}_{kind}.json"


def math_filename(chapter: int, marks: int) -> str:
    return f"math_Chapter_{chapter}_{math_mark_suffix(marks)}.json"


def english_filename(unit: int, kind: str) -> str:
    return f"en_unit{unit}_{kind}.json"

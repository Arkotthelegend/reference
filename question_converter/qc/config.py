from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PDFS_DIR = ROOT / "pdfs"
MAPS_DIR = ROOT / "maps"
CACHE_DIR = ROOT / "cache"
OUTPUT_DIR = ROOT / "output"
PROMPTS_DIR = ROOT / "prompts"
QUIZZES_DIR = ROOT.parent / "quizzes"

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
    "gemini-2.5-flash-lite": (0.10, 0.40),
    "gemini-2.0-flash-lite": (0.075, 0.30),
    "gemini-2.0-flash": (0.10, 0.40),
    "gemini-2.5-flash": (0.30, 2.50),
    "gemini-1.5-flash": (0.075, 0.30),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1-nano": (0.10, 0.40),
    "llama-3.3-70b-versatile": (0.59, 0.79),
}

DEFAULT_MODELS = {
    "gemini": "gemini-2.5-flash-lite",
    "openai": "gpt-4o-mini",
    "groq": "llama-3.3-70b-versatile",
}

GEMINI_FALLBACKS = (
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
)

# Cheap defaults that still follow long exam prompts.
DEFAULT_PROVIDER = "gemini"
DEFAULT_MODEL = DEFAULT_MODELS[DEFAULT_PROVIDER]
DEFAULT_BUDGET_USD = 8.0
# Stop a little early so retries cannot blow the last cents.
BUDGET_RESERVE_USD = 0.40

MAX_CHARS_PER_CALL = 14000
MAX_OUTPUT_TOKENS = 16384

MATH_1_MARK_COUNT = (40, 50)
MATH_2_MARK_COUNT = (20, 28)
MATH_3_MARK_COUNT = (20, 28)
EN_INITIAL_COUNT = 100
EN_MCQ_COUNT = 80
SCIENCE_CHAPTER_TARGET = (100, 200)


def grade_prefix(grade: int) -> str:
    if grade == 10:
        return "G10_"
    if grade == 11:
        return "G11_"
    return ""


def grade_folder(grade: int) -> str:
    if grade == 10:
        return "G10"
    if grade == 11:
        return "G11"
    return ""


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

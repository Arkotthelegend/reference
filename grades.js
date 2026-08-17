/*
============================================================
GRADE / CHAPTER CONFIG  —  edit this file when you add content
============================================================

Quiz JSON files — keep grades in separate folders:

  Grade 12:  quizzes/phy_Chapter_1_MCQ.json
  Grade 11:  quizzes/G11/G11_phy_Chapter_1_MCQ.json
  Grade 10:  quizzes/G10/G10_en_unit1_mcq.json

Same pattern for every subject:
  math_Chapter_1_1_Mark.json     →  quizzes/G11/G11_math_Chapter_1_1_Mark.json
  en_unit1_mcq.json              →  quizzes/G10/G10_en_unit1_mcq.json
  mm_အပြော_အမှန်ရွေး.json          →  quizzes/G11/G11_mm_အပြော_အမှန်ရွေး.json
  phy_Chapter_1_1.1_MCQ.json     →  quizzes/G11/G11_phy_Chapter_1_1.1_MCQ.json

HOW TO CHANGE CHAPTERS
  1. Change the numbers in subjectsList({ math: ?, phy: ?, ... })
  2. Edit subChapters below. Example:
       'Chapter 3': ['3.1', '3.2', '3.3']
  3. Add matching JSON files using the names above.

GOOGLE SHEET (paid users)
  Grade 12 keeps your current columns:
    all, mm, en, math, phy, chem, bio, eco
  Add new columns for Grade 11 and Grade 10 (expiry date, same format as now):
    g11_all, g11_mm, g11_en, g11_math, g11_phy, g11_chem, g11_bio, g11_eco
    g10_all, g10_mm, g10_en, g10_math, g10_phy, g10_chem, g10_bio, g10_eco
  Put a date like 2027-12-31 in the cell to unlock that subject.
  g11_all / g10_all unlocks every subject for that grade.
  If your Apps Script maps columns by header name automatically, adding
  the columns is enough. If it has a hardcoded subject list, add these
  new names there too.

ENGLISH GRAMMAR (shared for Grade 10, 11, and 12)
  All grades use the same topic list and the same files:
    quizzes/past_simple.json
    notes/grammar_past_simple.json
  Do not put G10_/G11_ prefixes or G10/G11 folders on grammar files.
============================================================
*/

function subjectsList(ch) {
    const eco = { id: 'eco', name: 'ဘောဂဗေဒ', chapters: ch.eco };
    if (ch.ecoSkip && ch.ecoSkip.length) eco.skipChapters = ch.ecoSkip;
    return [
        { id: 'mm', name: 'မြန်မာစာ' },
        { id: 'en', name: 'အင်္ဂလိပ်စာ', units: ch.enUnits || 12 },
        { id: 'math', name: 'သင်္ချာ', chapters: ch.math },
        { id: 'phy', name: 'ရူပဗေဒ', chapters: ch.phy },
        { id: 'chem', name: 'ဓာတုဗေဒ', chapters: ch.chem },
        { id: 'bio', name: 'ဇီဝဗေဒ', chapters: ch.bio },
        eco
    ];
}

const GRADE_CONFIG = {

    // ---------- GRADE 12 (current files, no prefix) ----------
    12: {
        label: 'Grade 12',
        filePrefix: '',
        quizFolder: '',
        sheetPrefix: '',
        showOldQuestions: true,
        enUnits: 12,
        mmCategories: ['အပြော', 'စကားပြေ', 'ကဗျာ', 'ရေသည်', 'အရေး'],
        mmChapters: ['အခန်း ၁', 'အခန်း ၂', 'အခန်း ၃'],
        mmDailyFiles: [
            'mm_အပြော_အမှန်ရွေး',
            'mm_စကားပြေ_အမှန်ရွေး',
            'mm_ကဗျာ_အမှန်ရွေး',
            'mm_အဖတ်_အမှန်ရွေး'
        ],
        subjects: subjectsList({ math: 11, phy: 13, chem: 8, bio: 6, eco: 8, enUnits: 12, ecoSkip: [6] }),
        subChapters: {
            phy: {
                'Chapter 1': ['1.1', '1.2', '1.3'],
                'Chapter 2': ['2.1', '2.2'],
                'Chapter 3': ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6'],
                'Chapter 4': ['4.1', '4.2', '4.3', '4.4', '4.5'],
                'Chapter 5': ['5.1', '5.2', '5.3'],
                'Chapter 6': ['6.1', '6.2', '6.3', '6.4', '6.5'],
                'Chapter 7': ['7.1', '7.2', '7.3', '7.4', '7.5', '7.6', '7.7', '7.8'],
                'Chapter 8': ['8.1', '8.2', '8.3', '8.4'],
                'Chapter 9': ['9.1', '9.2', '9.3', '9.4', '9.5'],
                'Chapter 10': ['10.1', '10.2', '10.3', '10.4', '10.5'],
                'Chapter 11': ['11.1', '11.2', '11.3', '11.4', '11.5', '11.6', '11.7'],
                'Chapter 12': ['12.1', '12.2', '12.3'],
                'Chapter 13': ['13.1', '13.2', '13.3', '13.4']
            },
            chem: {
                'Chapter 1': ['1.1', '1.2', '1.3', '1.4', '1.5'],
                'Chapter 2': ['2.1', '2.2', '2.3'],
                'Chapter 3': ['3.1', '3.2', '3.3'],
                'Chapter 4': ['4.1', '4.2', '4.3'],
                'Chapter 5': ['5.1', '5.2', '5.3', '5.4', '5.5'],
                'Chapter 6': ['6.1', '6.2', '6.3'],
                'Chapter 7': ['7.1', '7.2', '7.3', '7.4'],
                'Chapter 8': ['8.1', '8.2', '8.3']
            },
            bio: {
                'Chapter 1': ['1.1', '1.2'],
                'Chapter 2': ['2.1', '2.2', '2.3', '2.4'],
                'Chapter 3': ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8'],
                'Chapter 4': ['4.1', '4.2'],
                'Chapter 5': ['5.1', '5.2', '5.3', '5.4', '5.5'],
                'Chapter 6': ['6.1', '6.2', '6.3', '6.4']
            },
            eco: {
                'Chapter 1': [],
                'Chapter 2': [],
                'Chapter 3': [],
                'Chapter 4': [],
                'Chapter 5': [],
                'Chapter 7': [],
                'Chapter 8': []
            }
        }
    },

    // ---------- GRADE 11  (files in quizzes/G11/ named G11_...) ----------
    11: {
        label: 'Grade 11',
        filePrefix: 'G11_',
        quizFolder: 'G11',
        sheetPrefix: 'g11_',
        showOldQuestions: false,
        enUnits: 12,
        mmCategories: ['အပြော', 'စကားပြေ', 'ကဗျာ', 'ရေသည်', 'အရေး'],
        mmChapters: ['အခန်း ၁', 'အခန်း ၂', 'အခန်း ၃'],
        mmDailyFiles: [
            'mm_အပြော_အမှန်ရွေး',
            'mm_စကားပြေ_အမှန်ရွေး',
            'mm_ကဗျာ_အမှန်ရွေး',
            'mm_အဖတ်_အမှန်ရွေး'
        ],
        subjects: subjectsList({ math: 11, phy: 13, chem: 8, bio: 6, eco: 8, enUnits: 12, ecoSkip: [6] }),
        subChapters: {
            phy: {
                'Chapter 1': ['1.1', '1.2', '1.3'],
                'Chapter 2': ['2.1', '2.2'],
                'Chapter 3': ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6'],
                'Chapter 4': ['4.1', '4.2', '4.3', '4.4', '4.5'],
                'Chapter 5': ['5.1', '5.2', '5.3'],
                'Chapter 6': ['6.1', '6.2', '6.3', '6.4', '6.5'],
                'Chapter 7': ['7.1', '7.2', '7.3', '7.4', '7.5', '7.6', '7.7', '7.8'],
                'Chapter 8': ['8.1', '8.2', '8.3', '8.4'],
                'Chapter 9': ['9.1', '9.2', '9.3', '9.4', '9.5'],
                'Chapter 10': ['10.1', '10.2', '10.3', '10.4', '10.5'],
                'Chapter 11': ['11.1', '11.2', '11.3', '11.4', '11.5', '11.6', '11.7'],
                'Chapter 12': ['12.1', '12.2', '12.3'],
                'Chapter 13': ['13.1', '13.2', '13.3', '13.4']
            },
            chem: {
                'Chapter 1': ['1.1', '1.2', '1.3', '1.4', '1.5'],
                'Chapter 2': ['2.1', '2.2', '2.3'],
                'Chapter 3': ['3.1', '3.2', '3.3'],
                'Chapter 4': ['4.1', '4.2', '4.3'],
                'Chapter 5': ['5.1', '5.2', '5.3', '5.4', '5.5'],
                'Chapter 6': ['6.1', '6.2', '6.3'],
                'Chapter 7': ['7.1', '7.2', '7.3', '7.4'],
                'Chapter 8': ['8.1', '8.2', '8.3']
            },
            bio: {
                'Chapter 1': ['1.1', '1.2'],
                'Chapter 2': ['2.1', '2.2', '2.3', '2.4'],
                'Chapter 3': ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8'],
                'Chapter 4': ['4.1', '4.2'],
                'Chapter 5': ['5.1', '5.2', '5.3', '5.4', '5.5'],
                'Chapter 6': ['6.1', '6.2', '6.3', '6.4']
            },
            eco: {
                'Chapter 1': [],
                'Chapter 2': [],
                'Chapter 3': [],
                'Chapter 4': [],
                'Chapter 5': [],
                'Chapter 7': [],
                'Chapter 8': []
            }
        }
    },

    // ---------- GRADE 10  (files in quizzes/G10/ named G10_...) ----------
    10: {
        label: 'Grade 10',
        filePrefix: 'G10_',
        quizFolder: 'G10',
        sheetPrefix: 'g10_',
        showOldQuestions: false,
        enUnits: 12,
        mmCategories: ['အပြော', 'စကားပြေ', 'ကဗျာ', 'ရေသည်', 'အရေး'],
        mmChapters: ['အခန်း ၁', 'အခန်း ၂', 'အခန်း ၃'],
        mmDailyFiles: [
            'mm_အပြော_အမှန်ရွေး',
            'mm_စကားပြေ_အမှန်ရွေး',
            'mm_ကဗျာ_အမှန်ရွေး',
            'mm_အဖတ်_အမှန်ရွေး'
        ],
        subjects: subjectsList({ math: 11, phy: 13, chem: 8, bio: 6, eco: 8, enUnits: 12, ecoSkip: [6] }),
        subChapters: {
            phy: {
                'Chapter 1': ['1.1', '1.2', '1.3'],
                'Chapter 2': ['2.1', '2.2'],
                'Chapter 3': ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6'],
                'Chapter 4': ['4.1', '4.2', '4.3', '4.4', '4.5'],
                'Chapter 5': ['5.1', '5.2', '5.3'],
                'Chapter 6': ['6.1', '6.2', '6.3', '6.4', '6.5'],
                'Chapter 7': ['7.1', '7.2', '7.3', '7.4', '7.5', '7.6', '7.7', '7.8'],
                'Chapter 8': ['8.1', '8.2', '8.3', '8.4'],
                'Chapter 9': ['9.1', '9.2', '9.3', '9.4', '9.5'],
                'Chapter 10': ['10.1', '10.2', '10.3', '10.4', '10.5'],
                'Chapter 11': ['11.1', '11.2', '11.3', '11.4', '11.5', '11.6', '11.7'],
                'Chapter 12': ['12.1', '12.2', '12.3'],
                'Chapter 13': ['13.1', '13.2', '13.3', '13.4']
            },
            chem: {
                'Chapter 1': ['1.1', '1.2', '1.3', '1.4', '1.5'],
                'Chapter 2': ['2.1', '2.2', '2.3'],
                'Chapter 3': ['3.1', '3.2', '3.3'],
                'Chapter 4': ['4.1', '4.2', '4.3'],
                'Chapter 5': ['5.1', '5.2', '5.3', '5.4', '5.5'],
                'Chapter 6': ['6.1', '6.2', '6.3'],
                'Chapter 7': ['7.1', '7.2', '7.3', '7.4'],
                'Chapter 8': ['8.1', '8.2', '8.3']
            },
            bio: {
                'Chapter 1': ['1.1', '1.2'],
                'Chapter 2': ['2.1', '2.2', '2.3', '2.4'],
                'Chapter 3': ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8'],
                'Chapter 4': ['4.1', '4.2'],
                'Chapter 5': ['5.1', '5.2', '5.3', '5.4', '5.5'],
                'Chapter 6': ['6.1', '6.2', '6.3', '6.4']
            },
            eco: {
                'Chapter 1': [],
                'Chapter 2': [],
                'Chapter 3': [],
                'Chapter 4': [],
                'Chapter 5': [],
                'Chapter 7': [],
                'Chapter 8': []
            }
        }
    }
};

// Shared by Grade 10, 11, and 12. Files live in quizzes/ with no grade prefix.
const EN_GRAMMAR_TOPICS = [
    { title: "Past Simple", id: "past_simple" },
    { title: "Present Simple", id: "present_simple" },
    { title: "Present Continuous", id: "present_continuous" },
    { title: "Past Continuous", id: "past_continuous" },
    { title: "Present Perfect", id: "present_perfect" },
    { title: "Present Perfect Continuous", id: "present_perfect_continuous" },
    { title: "Future Simple", id: "future_simple" },
    { title: "Going To/Will Be", id: "going_to" },
    { title: "Future Continuous", id: "future_continuous" },
    { title: "Used To", id: "used_to" },
    { title: "Modal Auxiliaries", id: "modal_auxiliaries" },
    { title: "Nouns In Apposition", id: "nouns_in_apposition" },
    { title: "Not + Any = No", id: "not_any_no" },
    { title: "Active Voice To Passive Voice", id: "active_passive_voice" },
    { title: "Passive Voice To Active Voice", id: "passive_active_voice" },
    { title: "Impersonal Passive", id: "impersonal_passive" },
    { title: "Zero Conditional", id: "zero_conditional" },
    { title: "First Conditional", id: "first_conditional" },
    { title: "Second Conditional", id: "second_conditional" },
    { title: "Third Conditional", id: "third_conditional" },
    { title: "Subordinating Conjunction", id: "subordinating_conjunction" },
    { title: "Clauses Of Contact", id: "clauses_of_contact" },
    { title: "As If / As Though", id: "as_if_as_though" },
    { title: "Preposition and Conjunction for Purposes", id: "preposition_conjunction_purpose" },
    { title: "Verbs of Cause and Effect", id: "verbs_cause_effect" },
    { title: "Linking Words to Show Cause and Effect", id: "linking_words_cause_effect" },
    { title: "As soon as To No sooner", id: "as_soon_as_no_sooner" },
    { title: "No sooner To As soon as", id: "no_sooner_as_soon_as" },
    { title: "Both ... and", id: "both_and" },
    { title: "Not only ... But also", id: "not_only_but_also" },
    { title: "Neither ... nor", id: "neither_nor" },
    { title: "Either ... or", id: "either_or" },
    { title: "So and Neither", id: "so_and_neither" },
    { title: "So that", id: "so_that" },
    { title: "Such that", id: "such_that" },
    { title: "Too ... to / Enough to", id: "too_to_enough_to" },
    { title: "Before + V-ing", id: "before_ving" },
    { title: "After + V-ing", id: "after_ving" },
    { title: "Without + V-ing", id: "without_ving" },
    { title: "By + V-ing", id: "by_ving" },
    { title: "Introductory Phrases", id: "introductory_phrases" },
    { title: "Participle Phrases", id: "participle_phrases" },
    { title: "Gerund and Infinitive with 'to'", id: "gerund_infinitive" },
    { title: "Verbs followed by a noun group", id: "verbs_followed_by_noun_group" },
    { title: "Joining Sentences Using Relative Pronouns", id: "joining_relative_pronouns" },
    { title: "Omission Of Relative Pronouns", id: "omission_relative_pronouns" },
    { title: "It is / It was", id: "it_is_it_was" },
    { title: "Double Negative Structure", id: "double_negative_structure" },
    { title: "No Matter", id: "no_matter" },
    { title: "Omission of Verbs", id: "omission_of_verbs" },
    { title: "The more / The less", id: "the_more_the_less" },
    { title: "As ... As", id: "as_as" },
    { title: "Not as ... as", id: "not_as_as" },
    { title: "Inversion (Full Verb Before Subject)", id: "inversion_full_verb" },
    { title: "As and Like", id: "as_and_like" }
];

let subjects = [];

function getSelectedGrade() {
    const g = parseInt(localStorage.getItem('selectedGrade') || '12', 10);
    return GRADE_CONFIG[g] ? g : 12;
}

function getGradeCfg() {
    return GRADE_CONFIG[getSelectedGrade()];
}

function refreshSubjectsFromGrade() {
    subjects = getGradeCfg().subjects;
}

function stripGradeFilePrefix(fileName) {
    return String(fileName || '').replace(/^(g10_|g11_|G10_|G11_)/, '');
}

function gradeFromQuizFile(fileName) {
    const base = String(fileName || '').replace(/^old_/, '');
    if (/^(g10_|G10_)/.test(base)) return 10;
    if (/^(g11_|G11_)/.test(base)) return 11;
    return 12;
}

function isSharedEnGrammarFile(fileName) {
    const id = stripGradeFilePrefix(fileName).replace(/\.json$/i, '');
    return EN_GRAMMAR_TOPICS.some(function (t) { return t.id === id; });
}

function withGradePrefix(fileName) {
    if (!fileName) return fileName;
    if (fileName.startsWith('old_') || fileName.startsWith('daily_')) return fileName;
    if (isSharedEnGrammarFile(fileName)) return stripGradeFilePrefix(fileName);
    const prefix = getGradeCfg().filePrefix || '';
    const base = stripGradeFilePrefix(fileName);
    if (!prefix) return base;
    if (base.startsWith('old_') || base.startsWith('daily_')) return fileName;
    return prefix + base;
}

function quizUrl(fileName) {
    if (isSharedEnGrammarFile(fileName)) {
        const base = stripGradeFilePrefix(fileName).replace(/\.json$/i, '');
        return './quizzes/' + base + '.json';
    }
    const prefixed = withGradePrefix(fileName);
    const folder = getGradeCfg().quizFolder || '';
    if (!folder || prefixed.startsWith('old_') || prefixed.startsWith('daily_')) {
        return './quizzes/' + prefixed + '.json';
    }
    return './quizzes/' + folder + '/' + prefixed + '.json';
}

refreshSubjectsFromGrade();

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

Grade 10 / 11 files often use slightly different spellings
(chme, Blank, Def, eng_UnIt, unprefixed eco, 2_Mark). Buttons still
use the Grade 12 names. quizUrlCandidates / fetchQuizJson try those
aliases without renaming the JSON files.

HOW TO CHANGE CHAPTERS
  1. Change the numbers in subjectsList({ math: ?, phy: ?, ... })
  2. Edit subChapters below. Example:
       'Chapter 3': ['3.1', '3.2', '3.3']
  3. Add matching JSON files using the names above.
  Grade 10 / 11 also have quizLayout built from the JSON names in
  quizzes/G10 and quizzes/G11. Menus only show chapters, sub-chapters,
  and quiz types that exist in those folders. Do not copy Grade 12 lists.

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
        mmPlayCategory: 'ရေသည်',
        mmProseTitles: ['ညောင်ရမ်းကြီးသမီး', 'သစ္စာနှင့်ပညာ', 'ခေတ်', 'မလုပ်မစား', 'စာဘူးတောင်း', 'ဦးဖေမောင်တင်', 'အဖြူနှင့်အနက်', 'စိတ်ဓာတ်ရင့်ကျက်တည်ငြိမ်ခြင်း'],
        mmPoetryTitles: ['ပေါ်နွေလလျှင်', 'ငါ့ကိုလွယ်အမယ်ကြီးနှင့်', 'ဩဝါဒထူးပျို့', 'ပေါင်းရှစ်ယောက်ကောက်စိုက်သူ', 'အညာမင်္ဂလာဆောင်', 'ကမ္ဗောဇသို့', 'လက်ဖက်ရည်ကြမ်းဝိုင်း', 'ပဒေသာလက်ရာ'],
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

    // ---------- GRADE 11  (files in quizzes/G11/ named G11_...)
    11: {
        label: 'Grade 11',
        filePrefix: 'G11_',
        quizFolder: 'G11',
        sheetPrefix: 'g11_',
        showOldQuestions: false,
        enUnits: 12,
        mmCategories: ["အပြော", "စကားပြေ", "ကဗျာ", "မဲဇာတောင်ခြေ", "အရေး"],
        mmPlayCategory: 'မဲဇာတောင်ခြေ',
        mmProseTitles: ["သိင်္ဃသူ့သမီး", "ပတ္တမြားပြဿနာဖြင့်စုံစမ်းခန်း", "ဝဇီကိုင်", "မျိုးချစ်ဇာတ်မင်းသားကြီးမင်္ဂလာဦးအောင်မောင်း", "အလုပ်", "ဆားဒယ်", "လူလည်းတစ်ထွေရေလည်းတခြား", "ကျွန်ုပ်တို့၏နိုင်ငံတော်"],
        mmPoetryTitles: ["ရွှေနှင့်ယိုးမှားပန်းစံကား", "ဝိဇ္ဇာသိပ္ပလူ့ကိစ္စ", "မပန်ရလည်းမပန်ချင်", "နွေဦးကာလမြူထသောခါ", "မဲဇာတောင်ခြေ", "သင်သေသွားသော်", "အလှရှိရာ", "ဂျိန်းဖော့ပွဲတော်"],
        mmChapters: ["အခန်း ၁", "အခန်း ၂", "အခန်း ၃"],
        mmDailyFiles: [
            'mm_အပြော_အမှန်ရွေး',
            'mm_စကားပြေ_အမှန်ရွေး',
            'mm_ကဗျာ_အမှန်ရွေး',
            'mm_အဖတ်_အမှန်ရွေး'
        ],
        subjects: subjectsList({ math: 11, phy: 12, chem: 8, bio: 6, eco: 6, enUnits: 12 }),
        subChapters: {
            phy: {
                'Chapter 1': [],
                'Chapter 2': [],
                'Chapter 3': [],
                'Chapter 4': [],
                'Chapter 5': [],
                'Chapter 6': [],
                'Chapter 7': [],
                'Chapter 8': [],
                'Chapter 9': [],
                'Chapter 10': [],
                'Chapter 11': [],
                'Chapter 12': []
            },
            chem: {
                'Chapter 1': ["1.1", "1.2", "1.3", "1.4"],
                'Chapter 2': ["2.1", "2.2", "2.3", "2.4"],
                'Chapter 3': ["3.1", "3.2", "3.3", "3.4", "3.5"],
                'Chapter 4': ["4.1", "4.2", "4.3", "4.4", "4.5"],
                'Chapter 5': ["5.1", "5.2", "5.3", "5.4", "5.5"],
                'Chapter 6': ["6.1", "6.2", "6.3", "6.4"],
                'Chapter 7': ["7.1", "7.2", "7.3", "7.4"],
                'Chapter 8': ["8.1", "8.2", "8.3", "8.4", "8.5"]
            },
            bio: {
                'Chapter 1': ["1.1", "1.2", "1.3", "1.4", "1.5"],
                'Chapter 2': ["2.1", "2.2"],
                'Chapter 3': ["3.1", "3.2", "3.3"],
                'Chapter 4': ["4.1", "4.2", "4.3"],
                'Chapter 5': ["5.1", "5.2", "5.3", "5.4", "5.5"],
                'Chapter 6': ["6.1", "6.2", "6.3", "6.4", "6.5"]
            },
            eco: {
                'Chapter 1': [],
                'Chapter 2': [],
                'Chapter 3': [],
                'Chapter 4': [],
                'Chapter 5': [],
                'Chapter 6': []
            }
        },
        quizLayout: {"bio": {"chapters": {"1": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"1.1": ["Fill_Blank", "MCQ", "True_False"], "1.2": ["Fill_Blank", "MCQ", "True_False"], "1.3": ["Fill_Blank", "MCQ", "True_False"], "1.4": ["Fill_Blank", "MCQ", "True_False"], "1.5": ["Fill_Blank", "MCQ", "True_False"]}}, "2": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"2.1": ["Fill_Blank", "MCQ", "True_False"], "2.2": ["Fill_Blank", "MCQ"]}}, "3": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"3.1": ["Fill_Blank", "MCQ", "True_False"], "3.2": ["Fill_Blank", "MCQ", "True_False"], "3.3": ["Fill_Blank", "MCQ", "True_False"]}}, "4": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"4.1": ["Fill_Blank", "MCQ", "True_False"], "4.2": ["Fill_Blank", "MCQ", "True_False"], "4.3": ["Fill_Blank", "MCQ", "True_False"]}}, "5": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"5.1": ["Fill_Blank", "MCQ", "True_False"], "5.2": ["Fill_Blank", "MCQ", "True_False"], "5.3": ["Fill_Blank", "MCQ", "True_False"], "5.4": ["Fill_Blank", "MCQ"], "5.5": ["Fill_Blank", "MCQ", "True_False"]}}, "6": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"6.1": ["Fill_Blank", "MCQ", "True_False"], "6.2": ["Fill_Blank", "MCQ", "True_False"], "6.3": ["Fill_Blank", "MCQ", "True_False"], "6.4": ["Fill_Blank", "MCQ", "True_False"], "6.5": ["Fill_Blank", "MCQ", "True_False"]}}}}, "chem": {"chapters": {"1": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"1.1": ["Fill_Blank", "MCQ", "True_False"], "1.2": ["Fill_Blank", "MCQ", "True_False"], "1.3": ["Fill_Blank", "MCQ", "True_False"], "1.4": ["Fill_Blank", "MCQ", "True_False"]}, "def": true}, "2": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"2.1": ["Fill_Blank", "MCQ", "True_False"], "2.2": ["Fill_Blank", "MCQ", "True_False"], "2.3": ["Fill_Blank", "MCQ", "True_False"], "2.4": ["Fill_Blank", "MCQ", "True_False"]}, "def": true}, "3": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"3.1": ["Fill_Blank", "MCQ", "True_False"], "3.2": ["Fill_Blank", "MCQ", "True_False"], "3.3": ["Fill_Blank", "MCQ", "True_False"], "3.4": ["Fill_Blank", "MCQ", "True_False"], "3.5": ["Fill_Blank", "MCQ", "True_False"]}, "def": true}, "4": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"4.1": ["Fill_Blank", "MCQ", "True_False"], "4.2": ["Fill_Blank", "MCQ", "True_False"], "4.3": ["Fill_Blank", "MCQ", "True_False"], "4.4": ["Fill_Blank", "MCQ", "True_False"], "4.5": ["Fill_Blank", "MCQ", "True_False"]}, "def": true}, "5": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"5.1": ["Fill_Blank", "MCQ", "True_False"], "5.2": ["Fill_Blank", "MCQ", "True_False"], "5.3": ["Fill_Blank", "MCQ", "True_False"], "5.4": ["Fill_Blank", "MCQ", "True_False"], "5.5": ["Fill_Blank", "MCQ", "True_False"]}, "def": true}, "6": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"6.1": ["Fill_Blank", "MCQ", "True_False"], "6.2": ["Fill_Blank", "MCQ", "True_False"], "6.3": ["Fill_Blank", "MCQ", "True_False"], "6.4": ["Fill_Blank", "MCQ", "True_False"]}, "def": true}, "7": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"7.1": ["Fill_Blank", "MCQ", "True_False"], "7.2": ["MCQ", "True_False"], "7.3": ["Fill_Blank", "MCQ", "True_False"], "7.4": ["Fill_Blank", "MCQ", "True_False"]}, "def": true}, "8": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"8.1": ["Fill_Blank", "MCQ", "True_False"], "8.2": ["Fill_Blank", "MCQ", "True_False"], "8.3": ["Fill_Blank", "MCQ"], "8.4": ["Fill_Blank", "MCQ", "True_False"], "8.5": ["Fill_Blank", "MCQ", "True_False"]}, "def": true}}}, "eco": {"chapters": {"1": {"types": ["Fill_Blank", "MCQ"], "whole": ["Fill_Blank", "MCQ"]}, "2": {"types": ["Fill_Blank", "MCQ"], "whole": ["Fill_Blank", "MCQ"]}, "3": {"types": ["Fill_Blank", "MCQ"], "whole": ["Fill_Blank", "MCQ"]}, "4": {"types": ["Fill_Blank", "MCQ"], "whole": ["Fill_Blank", "MCQ"]}, "5": {"types": ["Fill_Blank", "MCQ"], "whole": ["Fill_Blank", "MCQ"]}, "6": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"]}}}, "math": {"chapters": {"1": {"marks": ["3_Mark", "1_Mark", "2_Marks"]}, "2": {"marks": ["3_Mark", "2_Mark", "1_Mark"]}, "3": {"marks": ["1_Mark", "2_Mark", "3_Mark"]}, "4": {"marks": ["3_Mark", "2_Mark", "1_Mark"]}, "5": {"marks": ["2_Mark", "1_Mark", "3_Mark"]}, "6": {"marks": ["2_Mark", "1_Mark", "3_Mark"]}, "7": {"marks": ["1_Mark", "2_Mark", "3_Mark"]}, "8": {"marks": ["1_Mark", "2_Mark"]}, "9": {"marks": ["1_Mark", "3_Mark", "2_Mark"]}, "10": {"marks": ["2_Mark", "3_Mark", "1_Mark"]}, "11": {"marks": ["2_Mark", "3_Mark", "1-Mark"]}}}, "phy": {"chapters": {"1": {"def": true, "formula": true}, "2": {"def": true, "formula": true}, "3": {"def": true, "formula": true}, "4": {"def": true, "formula": true}, "5": {"def": true, "formula": true}, "6": {"def": true, "formula": true}, "7": {"def": true, "formula": true}, "8": {"def": true, "formula": true}, "9": {"def": true, "formula": true}, "10": {"def": true, "formula": true}, "11": {"def": true, "formula": true}, "12": {"def": true, "formula": true}}}, "en": {"mcq": [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "initial": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}, "mm": {"အရေး": ["အခန်း ၁", "အခန်း ၂", "အခန်း ၃"], "အပြော": ["အခန်း ၁", "အခန်း ၂", "အခန်း ၃"]}}
    },

    // ---------- GRADE 10  (files in quizzes/G10/ named G10_...)
    10: {
        label: 'Grade 10',
        filePrefix: 'G10_',
        quizFolder: 'G10',
        sheetPrefix: 'g10_',
        showOldQuestions: false,
        enUnits: 12,
        mmCategories: ["အပြော", "စကားပြေ", "ကဗျာ", "အရေး"],
        mmProseTitles: ["ယောမင်းကြီးစိတ်ဓာတ်", "ဝီရိယနှစ်မျိုး", "စာဖတ်ခြင်းအလေ့", "ယောက်ျားအမှန်", "ဗိုလ်ချုပ်အောင်ဆန်း၏ကျောင်းသားဘဝနှင့်ပညာရေးအမြင်", "အိမ်သူအိမ်သားကောင်း၏အရည်အချင်းများ", "ပြည်သူပြည်သားတာဝန်", "ဂီတစာဆိုလှိုင်ထိပ်ခေါင်တင်", "အိုးစည်သံ", "လူ့မနော"],
        mmPoetryTitles: ["သီကုံးပန်းသွင်နေ့တိုင်းဆင်", "နှမထွေးမယ့်ကိုလိုလျှင်", "ဝသန်ကာလမိုးကျတည့်လျှင်", "လက်ဆောင်", "ဗုံတော်သား", "အင်းလယ်ကရွှေကြာပန်း", "ပတ္တမြားရွှေဂူ", "လှိုင်ကလေးသင်", "သပြေညို", "အလွမ်းပြေစာတစ်စောင်"],
        mmChapters: ["အခန်း ၁", "အခန်း ၂", "အခန်း ၃"],
        mmDailyFiles: [
            'mm_အပြော_အမှန်ရွေး',
            'mm_စကားပြေ_အမှန်ရွေး',
            'mm_ကဗျာ_အမှန်ရွေး',
            'mm_အဖတ်_အမှန်ရွေး'
        ],
        subjects: subjectsList({ math: 10, phy: 11, chem: 8, bio: 5, eco: 10, enUnits: 12 }),
        subChapters: {
            phy: {
                'Chapter 1': ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7"],
                'Chapter 2': ["2.1", "2.2", "2.3", "2.4"],
                'Chapter 3': ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6"],
                'Chapter 4': ["4.1", "4.2", "4.3", "4.4"],
                'Chapter 5': ["5.1", "5.2"],
                'Chapter 6': ["6.1", "6.2", "6.3", "6.4"],
                'Chapter 7': ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6"],
                'Chapter 8': ["8.1", "8.2", "8.3", "8.4"],
                'Chapter 9': ["9.1", "9.2", "9.3", "9.4", "9.5", "9.6"],
                'Chapter 10': ["10.1", "10.2", "10.3", "10.4", "10.5"],
                'Chapter 11': ["11.1", "11.2", "11.3", "11.4", "11.5"]
            },
            chem: {
                'Chapter 1': ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"],
                'Chapter 2': ["2.1", "2.2", "2.3", "2.4"],
                'Chapter 3': ["3.1", "3.2", "3.3", "3.4", "3.5"],
                'Chapter 4': [],
                'Chapter 5': [],
                'Chapter 6': [],
                'Chapter 7': [],
                'Chapter 8': []
            },
            bio: {
                'Chapter 1': ["1.1", "1.2", "1.3"],
                'Chapter 2': ["2.1", "2.2", "2.3"],
                'Chapter 3': ["3.1", "3.2", "3.3"],
                'Chapter 4': ["4.1", "4.2", "4.3"],
                'Chapter 5': ["5.1", "5.2", "5.3"]
            },
            eco: {
                'Chapter 1': [],
                'Chapter 2': [],
                'Chapter 3': [],
                'Chapter 4': [],
                'Chapter 5': [],
                'Chapter 6': [],
                'Chapter 7': [],
                'Chapter 8': [],
                'Chapter 9': [],
                'Chapter 10': []
            }
        },
        quizLayout: {"bio": {"chapters": {"1": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"1.1": ["Fill_Blank", "True_False"], "1.2": ["Fill_Blank", "True_False"], "1.3": ["Fill_Blank", "True_False"]}}, "2": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"2.1": ["Fill_Blank", "MCQ", "True_False"], "2.2": ["Fill_Blank", "MCQ", "True_False"], "2.3": ["True_False"]}}, "3": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"3.1": ["Fill_Blank", "MCQ", "True_False"], "3.2": ["Fill_Blank", "MCQ", "True_False"], "3.3": ["Fill_Blank", "MCQ", "True_False"]}}, "4": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"4.1": ["Fill_Blank", "MCQ", "True_False"], "4.2": ["Fill_Blank", "MCQ", "True_False"], "4.3": ["Fill_Blank", "MCQ", "True_False"]}}, "5": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"5.1": ["Fill_Blank", "MCQ", "True_False"], "5.2": ["Fill_Blank", "MCQ", "True_False"], "5.3": ["True_False"]}}}}, "chem": {"chapters": {"1": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"1.1": ["Fill_Blank", "MCQ"], "1.2": ["Fill_Blank", "MCQ"], "1.3": ["Fill_Blank", "MCQ", "True_False"], "1.4": ["Fill_Blank", "MCQ", "True_False"], "1.5": ["Fill_Blank", "True_False"], "1.6": ["Fill_Blank", "MCQ", "True_False"]}, "def": true}, "2": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "True_False"], "subs": {"2.1": ["Fill_Blank", "MCQ", "True_False"], "2.2": ["Fill_Blank", "MCQ", "True_False"], "2.3": ["Fill_Blank", "MCQ", "True_False"], "2.4": ["Fill_Blank", "MCQ", "True_False"]}, "def": true}, "3": {"types": ["Fill_Blank", "True_False"], "whole": ["Fill_Blank", "True_False"], "subs": {"3.1": ["Fill_Blank", "True_False"], "3.2": ["True_False"], "3.3": ["Fill_Blank", "True_False"], "3.4": ["Fill_Blank", "True_False"], "3.5": ["Fill_Blank", "True_False"]}, "def": true}, "4": {"def": true}, "5": {"def": true}, "6": {"def": true}, "7": {"def": true}, "8": {"def": true}}}, "eco": {"chapters": {"1": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"]}, "2": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"]}, "3": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"]}, "4": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"]}, "5": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"]}, "6": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"]}, "7": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"]}, "8": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"]}, "9": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"]}, "10": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"]}}}, "math": {"chapters": {"1": {"marks": ["2_Mark", "3_Mark", "1_Mark"]}, "2": {"marks": ["3_Mark", "1-Mark", "2_Mark"]}, "3": {"marks": ["2_Mark", "1_Mark", "3_Mark"]}, "4": {"marks": ["2_Mark", "1_Mark", "3_Mark"]}, "5": {"marks": ["3_Mark", "2_Mark", "1_Mark"]}, "6": {"marks": ["1_Mark", "3_Mark", "2_Mark"]}, "7": {"marks": ["2_mark", "3_Mark", "1_Mark"]}, "8": {"marks": ["2_Mark", "3_Mark", "1_Mark"]}, "9": {"marks": ["1_Mark", "2_Mark", "3_Mark"]}, "10": {"marks": ["2_Mark", "1_Mark", "3_Mark"]}}}, "phy": {"chapters": {"1": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"1.1": ["Fill_Blank", "MCQ", "True_False"], "1.2": ["Fill_Blank", "MCQ", "True_False"], "1.3": ["Fill_Blank", "MCQ", "True_False"], "1.4": ["Fill_Blank", "MCQ", "True_False"], "1.5": ["Fill_Blank", "MCQ"], "1.6": ["Fill_Blank", "MCQ", "True_False"], "1.7": ["Fill_Blank", "MCQ", "True_False"]}, "def": true, "formula": true}, "2": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"2.1": ["Fill_Blank", "MCQ", "True_False"], "2.2": ["Fill_Blank", "MCQ", "True_False"], "2.3": ["Fill_Blank", "MCQ", "True_False"], "2.4": ["Fill_Blank", "MCQ", "True_False"]}, "def": true, "formula": true}, "3": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"3.1": ["Fill_Blank", "MCQ", "True_False"], "3.2": ["Fill_Blank", "MCQ", "True_False"], "3.3": ["Fill_Blank", "MCQ", "True_False"], "3.4": ["Fill_Blank", "MCQ", "True_False"], "3.5": ["Fill_Blank", "MCQ", "True_False"], "3.6": ["Fill_Blank", "MCQ", "True_False"]}, "def": true, "formula": true}, "4": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"4.1": ["Fill_Blank", "MCQ", "True_False"], "4.2": ["Fill_Blank", "MCQ", "True_False"], "4.3": ["Fill_Blank", "MCQ", "True_False"], "4.4": ["Fill_Blank", "MCQ", "True_False"]}, "def": true, "formula": true}, "5": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"5.1": ["Fill_Blank", "MCQ", "True_False"], "5.2": ["Fill_Blank", "MCQ", "True_False"]}, "def": true, "formula": true}, "6": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"6.1": ["Fill_Blank", "MCQ", "True_False"], "6.2": ["Fill_Blank", "MCQ", "True_False"], "6.3": ["Fill_Blank", "MCQ", "True_False"], "6.4": ["Fill_Blank", "MCQ", "True_False"]}, "def": true, "formula": true}, "7": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"7.1": ["Fill_Blank", "MCQ", "True_False"], "7.2": ["Fill_Blank", "MCQ", "True_False"], "7.3": ["Fill_Blank", "MCQ", "True_False"], "7.4": ["Fill_Blank", "MCQ", "True_False"], "7.5": ["Fill_Blank", "MCQ", "True_False"], "7.6": ["Fill_Blank", "MCQ", "True_False"]}, "def": true, "formula": true}, "8": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"8.1": ["Fill_Blank", "MCQ", "True_False"], "8.2": ["Fill_Blank", "MCQ", "True_False"], "8.3": ["MCQ", "True_False"], "8.4": ["MCQ", "True_False"]}, "def": true, "formula": true}, "9": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"9.1": ["Fill_Blank", "MCQ", "True_False"], "9.2": ["Fill_Blank", "MCQ", "True_False"], "9.3": ["Fill_Blank", "MCQ", "True_False"], "9.4": ["Fill_Blank", "MCQ", "True_False"], "9.5": ["Fill_Blank", "MCQ"], "9.6": ["Fill_Blank"]}, "def": true, "formula": true}, "10": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"10.1": ["Fill_Blank", "MCQ", "True_False"], "10.2": ["Fill_Blank", "MCQ", "True_False"], "10.3": ["Fill_Blank", "MCQ", "True_False"], "10.4": ["Fill_Blank", "MCQ", "True_False"], "10.5": ["Fill_Blank", "MCQ", "True_False"]}, "def": true, "formula": true}, "11": {"types": ["Fill_Blank", "MCQ", "True_False"], "whole": ["Fill_Blank", "MCQ", "True_False"], "subs": {"11.1": ["Fill_Blank", "MCQ", "True_False"], "11.2": ["Fill_Blank", "True_False"], "11.3": ["Fill_Blank", "MCQ", "True_False"], "11.4": ["Fill_Blank", "MCQ", "True_False"], "11.5": ["Fill_Blank", "True_False"]}, "def": true, "formula": true}}}, "en": {"mcq": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "initial": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}, "mm": {"အပြော": ["အခန်း ၁", "အခန်း ၂"], "အရေး": ["အခန်း ၁", "အခန်း ၂", "အခန်း ၃"]}}
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

function getGradeCfgFor(grade) {
    var g = parseInt(grade, 10);
    return GRADE_CONFIG[g] || GRADE_CONFIG[12];
}


function chapterNumFromName(chapterName) {
    const m = String(chapterName || '').match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
}

function quizLayoutRoot() {
    return getGradeCfg().quizLayout || null;
}

function quizChapterLayout(subId, chapterName) {
    const root = quizLayoutRoot();
    if (!root || !root[subId] || !root[subId].chapters) return null;
    const n = chapterNumFromName(chapterName);
    return root[subId].chapters[String(n)] || null;
}

function gradeQuizTypes(subId, chapterName) {
    const lay = quizChapterLayout(subId, chapterName);
    if (!lay) return ['True_False', 'Fill_Blank', 'MCQ'];
    return (lay.types || []).slice();
}

function gradeHasWholeQuiz(subId, chapterName, quizType) {
    const lay = quizChapterLayout(subId, chapterName);
    if (!lay) return true;
    return (lay.whole || []).indexOf(quizType) >= 0;
}

function gradeSubChaptersForType(subId, chapterName, quizType) {
    const lay = quizChapterLayout(subId, chapterName);
    const fallback = (getGradeCfg().subChapters[subId] && getGradeCfg().subChapters[subId][chapterName]) || [];
    if (!lay) return fallback.slice();
    const subs = lay.subs || {};
    const keys = Object.keys(subs);
    keys.sort(function (a, b) {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const da = pa[i] || 0, db = pb[i] || 0;
            if (da !== db) return da - db;
        }
        return 0;
    });
    if (!quizType) return keys;
    return keys.filter(function (k) { return (subs[k] || []).indexOf(quizType) >= 0; });
}

function gradeHasDefinition(subId, chapterName) {
    const lay = quizChapterLayout(subId, chapterName);
    if (!lay) return true;
    return !!lay.def;
}

function gradeHasFormula(subId, chapterName) {
    const lay = quizChapterLayout(subId, chapterName);
    if (!lay) return true;
    return !!lay.formula;
}

function gradeMathMarks(chapterName) {
    const lay = quizChapterLayout('math', chapterName);
    if (!lay || !lay.marks || !lay.marks.length) return null;
    const raw = lay.marks;
    function pick(re) {
        for (let i = 0; i < raw.length; i++) if (re.test(raw[i])) return raw[i];
        return null;
    }
    const out = [];
    const one = pick(/1[-_]Mark/i);
    const two = pick(/2_Marks/) || pick(/2_Mark/i);
    const three = pick(/3_Marks/) || pick(/3_Mark/i);
    if (one) out.push(one);
    if (two) out.push(two);
    if (three) out.push(three);
    return out;
}

function gradeEnUnitsForType(typeName) {
    const root = quizLayoutRoot();
    if (!root || !root.en) return null;
    const t = String(typeName || '').toLowerCase();
    if (t.indexOf('mcq') >= 0) return (root.en.mcq || []).slice();
    if (t.indexOf('initial') >= 0) return (root.en.initial || []).slice();
    return null;
}

function gradeMmChaptersFor(cat) {
    const root = quizLayoutRoot();
    if (root && root.mm && root.mm[cat] && root.mm[cat].length) return root.mm[cat].slice();
    return (getGradeCfg().mmChapters || ['အခန်း ၁', 'အခန်း ၂', 'အခန်း ၃']).slice();
}

function getEnGrammarTopics() {
    return EN_GRAMMAR_TOPICS.slice();
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

function mmProseTitles() {
    return (getGradeCfg().mmProseTitles || []).slice();
}

function mmPoetryTitles() {
    return (getGradeCfg().mmPoetryTitles || []).slice();
}

function mmPlayCategory() {
    return getGradeCfg().mmPlayCategory || '';
}

function mmHasYeThae() {
    return mmPlayCategory() === 'ရေသည်';
}

function isMmPlayQuizFile(fileName) {
    const baseName = stripGradeFilePrefix(fileName || '');
    return baseName.startsWith('mm_ရေသည်_') ||
        baseName.startsWith('old_mm_ရေသည်_') ||
        baseName.startsWith('mm_မဲဇာတောင်ခြေ_') ||
        baseName.startsWith('old_mm_မဲဇာတောင်ခြေ_');
}

function quizUrlForGrade(grade, fileName) {
    const cfg = getGradeCfgFor(grade);
    if (isSharedEnGrammarFile(fileName)) {
        const base = stripGradeFilePrefix(fileName).replace(/\.json$/i, '');
        return './quizzes/' + base + '.json';
    }
    const raw = String(fileName || '').replace(/\.json$/i, '');
    if (raw.startsWith('old_') || raw.startsWith('daily_')) {
        return './quizzes/' + raw + '.json';
    }
    const prefix = cfg.filePrefix || '';
    const folder = cfg.quizFolder || '';
    const base = stripGradeFilePrefix(raw);
    if (base.startsWith('old_') || base.startsWith('daily_')) {
        return './quizzes/' + raw + '.json';
    }
    const prefixed = prefix ? (prefix + base) : base;
    if (!folder) return './quizzes/' + prefixed + '.json';
    return './quizzes/' + folder + '/' + prefixed + '.json';
}

function quizUrl(fileName) {
    return quizUrlForGrade(getSelectedGrade(), fileName);
}

function quizAliasStems(base) {
    const stems = [];
    function add(s) {
        if (s && stems.indexOf(s) === -1) stems.push(s);
    }
    const isChem = /^chem_/i.test(base);
    const isEn = /^en_unit/i.test(base);
    const isMath = /^math_/i.test(base);
    const isPhy = /^phy_/i.test(base);
    const transforms = [];
    if (isChem) {
        transforms.push(function (s) { return s.replace(/^chem_/, 'chme_'); });
        transforms.push(function (s) { return s.replace(/^chem_/, 'Chme_'); });
        transforms.push(function (s) { return s.replace(/^chem_/, 'C_chme_'); });
        transforms.push(function (s) { return s.replace(/^chem_/, 'chne_'); });
        transforms.push(function (s) { return s.replace(/_Fill_Blank/g, '_Blank'); });
        transforms.push(function (s) { return s.replace(/_definition$/i, '_Key_Terms'); });
        transforms.push(function (s) { return s.replace(/_Chapter_/, '_Chaptr_'); });
        transforms.push(function (s) { return s.replace(/_Chapter_(\d+)_(\d+\.\d+)/, '_Chapter$1_$2'); });
        transforms.push(function (s) { return s.replace(/_Chapter_(\d+)_(\d+\.\d+)/, '_Chapter_$1-$2'); });
        transforms.push(function (s) { return s.replace(/_Chapter_(\d+)_(\d+\.\d+)/, '_Chapter_$2'); });
        transforms.push(function (s) { return s.replace(/_Chapter_/g, '_chapter_'); });
    }
    if (isPhy) {
        transforms.push(function (s) { return s.replace(/_definition$/i, '_Def'); });
        transforms.push(function (s) { return s.replace(/_formula$/i, '_Formula'); });
    }
    if (isMath) {
        transforms.push(function (s) { return s.replace(/_(\d)_Marks$/, '_$1_Mark'); });
        transforms.push(function (s) { return s.replace(/_1_Mark$/, '_1-Mark'); });
        transforms.push(function (s) { return s.replace(/_2_Mark$/, '_2_mark'); });
        transforms.push(function (s) { return s.replace(/_Chapter_/, '_Chaapter_'); });
    }
    if (isEn) {
        transforms.push(function (s) {
            const m = s.match(/^en_unit(\d+)_mcq$/i);
            return m ? ('eng_Unit_' + m[1] + '_MCQ') : s;
        });
        transforms.push(function (s) {
            const m = s.match(/^en_unit(\d+)_mcq$/i);
            return m ? ('eng_UnIt_' + m[1] + '_MCQ') : s;
        });
        transforms.push(function (s) {
            const m = s.match(/^en_unit(\d+)_mcq$/i);
            return m ? ('en_Unit_' + m[1] + '_MCQ') : s;
        });
        transforms.push(function (s) {
            const m = s.match(/^en_unit(\d+)_initial_letter$/i);
            return m ? ('eng_Unit_' + m[1] + '_Initial') : s;
        });
    }
    add(base);
    for (let i = 0; i < stems.length && i < 40; i++) {
        const cur = stems[i];
        for (let t = 0; t < transforms.length; t++) add(transforms[t](cur));
    }
    return stems;
}

function quizUrlCandidatesForGrade(grade, fileName) {
    const primary = quizUrlForGrade(grade, fileName);
    const list = [primary];
    function add(url) {
        if (url && list.indexOf(url) === -1) list.push(url);
    }
    const cfg = getGradeCfgFor(grade);
    const folder = cfg.quizFolder || '';
    const raw = String(fileName || '').replace(/\.json$/i, '');
    if (!folder || raw.startsWith('old_') || raw.startsWith('daily_') || isSharedEnGrammarFile(fileName)) {
        return list;
    }
    const prefix = cfg.filePrefix || '';
    const base = stripGradeFilePrefix(raw);
    const dir = './quizzes/' + folder + '/';
    const prefixes = [prefix, ''];
    if (/^chem_/i.test(base) && prefix) {
        prefixes.push(prefix.toLowerCase());
        prefixes.push(prefix.replace('_', ''));
    }
    quizAliasStems(base).forEach(function (stem) {
        prefixes.forEach(function (p) {
            add(dir + p + stem + '.json');
            if (/definition|_Def|Key_Terms/i.test(stem)) add(dir + p + stem + '_.json');
            if (/Initial/i.test(stem)) add(dir + p + stem + '.jason');
            if (/^math_/i.test(stem) && /_\d_Mark$/i.test(stem)) add(dir + p + stem);
        });
    });
    return list;
}

function quizUrlCandidates(fileName) {
    return quizUrlCandidatesForGrade(getSelectedGrade(), fileName);
}

const _quizHitCache = {};

function quizCacheKey(fileName) {
    return String(getSelectedGrade()) + ':' + stripGradeFilePrefix(String(fileName || '').replace(/\.json$/i, ''));
}

function quizBust(url) {
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'cb=' + Date.now();
}

function fetchQuizResponse(fileName) {
    const urls = quizUrlCandidates(fileName);
    const key = quizCacheKey(fileName);
    function tryOne(url) {
        return fetch(quizBust(url)).then(function (res) {
            return res.ok ? { url: url, res: res } : null;
        }).catch(function () { return null; });
    }
    const cached = _quizHitCache[key];
    const start = cached
        ? tryOne(cached).then(function (hit) {
            if (hit) return hit;
            delete _quizHitCache[key];
            return null;
        })
        : Promise.resolve(null);
    return start.then(function (hit) {
        if (hit) return hit;
        return tryOne(urls[0]);
    }).then(function (hit) {
        if (hit) {
            _quizHitCache[key] = hit.url;
            return hit.res;
        }
        const rest = urls.slice(1);
        function batch(i) {
            if (i >= rest.length) return Promise.reject(new Error('missing'));
            const chunk = rest.slice(i, i + 6);
            return Promise.all(chunk.map(tryOne)).then(function (results) {
                for (let n = 0; n < results.length; n++) {
                    if (results[n]) {
                        _quizHitCache[key] = results[n].url;
                        return results[n].res;
                    }
                }
                return batch(i + 6);
            });
        }
        return batch(0);
    });
}

function fetchQuizJson(fileName) {
    return fetchQuizResponse(fileName).then(function (res) { return res.json(); });
}

refreshSubjectsFromGrade();

/* English grammar practice — rewrite sheet helpers. */
(function (root) {
    var RULES = {
        past_simple: 'Past Simple · V2',
        present_simple: 'Present Simple · V1 / Vs',
        present_continuous: 'am / is / are + V-ing',
        past_continuous: 'was / were + V-ing',
        present_perfect: 'have / has + V3',
        present_perfect_continuous: 'have / has been + V-ing',
        future_simple: 'will + V1',
        going_to: 'going to / will be',
        future_continuous: 'will be + V-ing',
        used_to: 'used to + V1',
        modal_auxiliaries: 'modal + V1',
        nouns_in_apposition: 'Nouns in apposition',
        not_any_no: 'not + any = no',
        active_passive_voice: 'Active → Passive',
        passive_active_voice: 'Passive → Active',
        impersonal_passive: 'Impersonal passive',
        zero_conditional: 'Zero conditional',
        first_conditional: 'First conditional',
        second_conditional: 'Second conditional',
        third_conditional: 'Third conditional',
        subordinating_conjunction: 'Subordinating conjunction',
        clauses_of_contact: 'Clauses of contact',
        as_if_as_though: 'as if / as though',
        preposition_conjunction_purpose: 'Purpose',
        verbs_cause_effect: 'Cause and effect verbs',
        linking_words_cause_effect: 'Cause and effect',
        as_soon_as_no_sooner: 'as soon as → no sooner',
        no_sooner_as_soon_as: 'no sooner → as soon as',
        both_and: 'both … and',
        not_only_but_also: 'not only … but also',
        neither_nor: 'neither … nor',
        either_or: 'either … or',
        so_and_neither: 'so / neither',
        so_that: 'so that',
        such_that: 'such that',
        too_to_enough_to: 'too … to / enough to',
        before_ving: 'before + V-ing',
        after_ving: 'after + V-ing',
        without_ving: 'without + V-ing',
        by_ving: 'by + V-ing',
        introductory_phrases: 'Introductory phrases',
        participle_phrases: 'Participle phrases',
        gerund_infinitive: 'Gerund / infinitive',
        verbs_followed_by_noun_group: 'Verb + noun group',
        joining_relative_pronouns: 'Relative pronouns',
        omission_relative_pronouns: 'Omission of relative pronouns',
        it_is_it_was: 'It is / It was',
        double_negative_structure: 'Double negative',
        no_matter: 'No matter',
        omission_of_verbs: 'Omission of verbs',
        the_more_the_less: 'the more / the less',
        as_as: 'as … as',
        not_as_as: 'not as … as',
        inversion_full_verb: 'Inversion',
        as_and_like: 'as / like'
    };

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function topicIdFromFile(fileName) {
        var base = String(fileName || '').replace(/^(g10_|g11_|G10_|G11_)/, '').replace(/\.json$/i, '');
        if (typeof root.isSharedEnGrammarFile === 'function' && root.isSharedEnGrammarFile(base)) return base;
        if (base.indexOf('old_') === 0) return base.slice(4);
        return base;
    }

    function isPracticeFile(fileName) {
        var base = String(fileName || '').replace(/^(g10_|g11_|G10_|G11_)/, '').replace(/\.json$/i, '');
        if (typeof root.isSharedEnGrammarFile === 'function' && root.isSharedEnGrammarFile(base)) return true;
        if (base.indexOf('old_') === 0) {
            var id = base.slice(4);
            var oldList = root.oldENGrammarTopics || [];
            return oldList.some(function (t) { return t.id === id; });
        }
        return false;
    }

    function ruleChip(fileName, fallbackTitle) {
        var id = topicIdFromFile(fileName);
        if (RULES[id]) return RULES[id];
        return String(fallbackTitle || id || 'Grammar');
    }

    function hasGrammarNote(fileName) {
        var id = topicIdFromFile(fileName);
        return typeof root.isSharedEnGrammarFile === 'function' && root.isSharedEnGrammarFile(id);
    }

    function formatPrompt(raw) {
        var s = String(raw == null ? '' : raw);
        var out = '';
        var re = /\([^()]+\)/g;
        var last = 0;
        var m;
        while ((m = re.exec(s))) {
            out += esc(s.slice(last, m.index));
            out += '<span class="rw-hint">' + esc(m[0]) + '</span>';
            last = m.index + m[0].length;
        }
        out += esc(s.slice(last));
        return out;
    }

    function wordKey(tok) {
        return String(tok || '').toLowerCase().replace(/^[“”"'([{]+|[”"'.,!?;:)\]}]+$/g, '');
    }

    function promptWordSet(prompt) {
        var body = String(prompt || '').replace(/\([^()]*\)/g, ' ');
        var set = {};
        body.split(/\s+/).forEach(function (w) {
            var k = wordKey(w);
            if (k) set[k] = 1;
        });
        return set;
    }

    function formatAnswer(prompt, answer) {
        var known = promptWordSet(prompt);
        var parts = String(answer == null ? '' : answer).split(/(\s+)/);
        return parts.map(function (part) {
            if (!part) return '';
            if (/^\s+$/.test(part)) return part;
            var k = wordKey(part);
            if (k && !known[k]) return '<span class="rw-change">' + esc(part) + '</span>';
            return esc(part);
        }).join('');
    }

    function normalizeTry(s) {
        return String(s || '')
            .toLowerCase()
            .replace(/[“”"'.,!?;:]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function answersMatch(typed, official) {
        var a = normalizeTry(typed);
        var b = normalizeTry(official);
        if (!a || !b) return false;
        return a === b;
    }

    root.REEDGrammar = {
        topicIdFromFile: topicIdFromFile,
        isPracticeFile: isPracticeFile,
        ruleChip: ruleChip,
        hasGrammarNote: hasGrammarNote,
        formatPrompt: formatPrompt,
        formatAnswer: formatAnswer,
        answersMatch: answersMatch,
        esc: esc
    };
})(typeof window !== 'undefined' ? window : globalThis);

/* Private MIIT practice tab. Visible only for the app admin. */
(function (root) {
    function admin() {
        return typeof root.isAppAdmin === 'function' && root.isAppAdmin();
    }

    function applyChrome() {
        var on = admin();
        document.body.classList.toggle('admin-role', !!on);
        var tab = document.getElementById('nav-miit');
        if (tab) tab.hidden = !on;
        if (!on) {
            var screen = document.getElementById('miit-screen');
            if (screen && screen.classList.contains('active-screen') && typeof root.goTab === 'function') {
                root.goTab('home');
            }
            return;
        }
        bind();
    }

    function backToTab() {
        if (typeof root.showScreen === 'function') root.showScreen('miit');
        document.querySelectorAll('.nav-item').forEach(function (item) {
            item.classList.remove('nav-active');
        });
        var tab = document.getElementById('nav-miit');
        if (tab) tab.classList.add('nav-active');
    }

    function startEnglish() {
        if (!admin()) return;
        if (typeof root.setOldQuestionContext === 'function') root.setOldQuestionContext(false);
        if (typeof root.startQuizFile !== 'function') return;
        root.startQuizFile('miit_en_mcq', backToTab, false);
    }

    function bind() {
        if (bind.done) return;
        bind.done = true;
        var btn = document.getElementById('miit-en');
        if (btn) btn.onclick = startEnglish;
        fetch('./quizzes/miit_en_mcq.json?cb=' + Date.now()).then(function (res) {
            return res.ok ? res.json() : null;
        }).then(function (data) {
            if (!btn || !Array.isArray(data) || !data.length) return;
            btn.textContent = 'English · ' + data.length;
        }).catch(function () {});
    }

    root.REEDMiit = {
        applyChrome: applyChrome,
        startEnglish: startEnglish
    };
})(typeof window !== 'undefined' ? window : globalThis);

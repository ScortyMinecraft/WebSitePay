/* eslint-disable no-alert */
const ROUTES = /** @type {const} */ ({
  home: "home",
  terms: "terms",
  how: "how",
  compare: "compare",
  quiz: "quiz",
  business: "business",
  stats: "stats",
});

const STORAGE_KEY = "cashlessEduSite.v1";

function nowISO() {
  return new Date().toISOString();
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function fmtInt(n) {
  try {
    return new Intl.NumberFormat("ru-RU").format(n);
  } catch {
    return String(n);
  }
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else if (v === false || v == null) {}
    else node.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c == null) continue;
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("toast--on");
  window.clearTimeout(toast._timer);
  toast._timer = window.setTimeout(() => t.classList.remove("toast--on"), 1800);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function defaultState() {
  return {
    createdAt: nowISO(),
    lastSeenAt: nowISO(),
    views: {},
    actions: {},
    learnedTerms: [],
    quiz: {
      bestScore: 0,
      bestTotal: 0,
      last: null,
    },
    achievements: {},
  };
}

function saveState(patchFn) {
  const prev = loadState() ?? defaultState();
  const next = patchFn ? patchFn(structuredClone(prev)) : prev;
  next.lastSeenAt = nowISO();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function trackView(route) {
  saveState((s) => {
    s.views[route] = (s.views[route] ?? 0) + 1;
    s.actions["view_any"] = (s.actions["view_any"] ?? 0) + 1;
    s.actions[`view_${route}`] = (s.actions[`view_${route}`] ?? 0) + 1;
    return s;
  });
  checkAchievements();
}

function trackAction(name) {
  saveState((s) => {
    s.actions[name] = (s.actions[name] ?? 0) + 1;
    return s;
  });
  checkAchievements();
}

function unlockAchievement(id, meta) {
  const unlockedAt = nowISO();
  const justUnlocked = saveState((s) => {
    if (s.achievements[id]?.unlockedAt) return s;
    s.achievements[id] = { unlockedAt, ...meta };
    return s;
  });
  if (justUnlocked?.achievements?.[id]?.unlockedAt === unlockedAt) {
    toast(`Достижение: ${meta.name}`);
  }
}

function checkAchievements() {
  const s = loadState() ?? defaultState();
  const termsTotal = window.__DATA?.terms ? Object.keys(window.__DATA.terms).length : null;

  // Первый термин
  if (s.learnedTerms.length >= 1) {
    unlockAchievement("first_step", {
      name: "🎓 Первый шаг",
      description: "Изучен первый термин",
    });
  }

  // Мастер глоссария
  if (termsTotal != null && s.learnedTerms.length >= termsTotal) {
    unlockAchievement("glossary_master", {
      name: "📚 Мастер глоссария",
      description: "Изучены все термины",
    });
  }

  // Ученик (пройдена викторина)
  if ((s.quiz?.bestTotal ?? 0) > 0) {
    unlockAchievement("quiz_done", {
      name: "📖 Ученик",
      description: "Пройдена викторина",
    });
  }

  // Эксперт викторины
  if ((s.quiz?.bestTotal ?? 0) > 0 && (s.quiz?.bestScore ?? 0) === (s.quiz?.bestTotal ?? 0)) {
    unlockAchievement("quiz_expert", {
      name: "🏆 Эксперт викторины",
      description: "100% правильных ответов",
    });
  }

  // Бизнес-симулятор
  if ((s.actions?.business_calc ?? 0) >= 1) {
    unlockAchievement("business_simulator", {
      name: "💼 Бизнес‑симулятор",
      description: "Использован симулятор бизнеса",
    });
  }

  // Мастер сравнений
  if ((s.actions?.view_compare ?? 0) >= 1) {
    unlockAchievement("comparison_master", {
      name: "⚖️ Мастер сравнений",
      description: "Открыто сравнение типов эквайринга",
    });
  }

  // Активный пользователь
  if ((s.actions?.view_any ?? 0) >= 20) {
    unlockAchievement("active_user", {
      name: "🔥 Активный пользователь",
      description: "Открыто 20+ разделов сайта",
    });
  }

  // Исследователь (все основные функции)
  const needed = ["view_terms", "view_how", "view_compare", "view_quiz", "view_business", "view_stats"];
  const hasAll = needed.every((k) => (s.actions?.[k] ?? 0) > 0);
  if (hasAll) {
    unlockAchievement("researcher", {
      name: "🔍 Исследователь",
      description: "Открыты все основные разделы",
    });
  }
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Не удалось загрузить ${path} (${res.status})`);
  }
  return await res.json();
}

async function ensureDataLoaded() {
  if (window.__DATA) return window.__DATA;
  const [terms, quiz, comparison, business] = await Promise.all([
    loadJSON("./data/terms.json"),
    loadJSON("./data/quiz.json"),
    loadJSON("./data/comparison.json"),
    loadJSON("./data/business_types.json"),
  ]);
  window.__DATA = { terms, quiz, comparison, business };
  checkAchievements();
  return window.__DATA;
}

function setActiveNav(route) {
  document.querySelectorAll(".nav__item").forEach((b) => {
    const is = b.getAttribute("data-route") === route;
    if (is) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
}

function getRoute() {
  const h = (location.hash || "").replace(/^#\/?/, "");
  return ROUTES[h] ? h : ROUTES.home;
}

function setRoute(route) {
  location.hash = `#/${route}`;
}

function renderHome() {
  const data = window.__DATA;
  const s = loadState() ?? defaultState();
  const termsTotal = Object.keys(data.terms).length;
  const learned = s.learnedTerms.length;
  const best = s.quiz?.bestTotal ? `${s.quiz.bestScore}/${s.quiz.bestTotal}` : "—";
  const achCount = Object.keys(s.achievements || {}).length;

  return el("div", { class: "view" }, [
    el("div", { class: "grid" }, [
      el("div", { class: "card" }, [
        el("div", { class: "card__inner" }, [
          el("div", { class: "card__title" }, [el("div", {}, ["Учись быстро и понятно"]), el("span", { class: "pill" }, ["💡 ", el("strong", {}, ["безнал"]), " простыми словами"])]),
          el("div", { class: "card__subtitle" }, [
            "Этот сайт заменяет Telegram‑бота: тут есть глоссарий, сценарии “как это работает”, сравнение типов эквайринга, викторина и бизнес‑симулятор.",
          ]),
          el("div", { class: "card__actions" }, [
            el("button", { class: "btn btn--primary", onclick: () => setRoute("terms") }, ["Начать с терминов"]),
            el("button", { class: "btn", onclick: () => setRoute("quiz") }, ["Пройти викторину"]),
            el("button", { class: "btn btn--ghost", onclick: () => setRoute("business") }, ["Подобрать эквайринг для бизнеса"]),
          ]),
        ]),
      ]),
      el("div", { class: "card" }, [
        el("div", { class: "card__inner" }, [
          el("div", { class: "card__title" }, ["Твой прогресс"]),
          el("div", { class: "kpi", style: "margin-top:12px" }, [
            el("div", { class: "kpi__card" }, [el("div", { class: "kpi__label" }, ["Изучено терминов"]), el("div", { class: "kpi__value" }, [`${learned}/${termsTotal}`])]),
            el("div", { class: "kpi__card" }, [el("div", { class: "kpi__label" }, ["Лучший тест"]), el("div", { class: "kpi__value" }, [best])]),
            el("div", { class: "kpi__card" }, [el("div", { class: "kpi__label" }, ["Достижения"]), el("div", { class: "kpi__value" }, [String(achCount)])]),
            el("div", { class: "kpi__card" }, [el("div", { class: "kpi__label" }, ["Активность"]), el("div", { class: "kpi__value" }, [String(s.actions?.view_any ?? 0)])]),
          ]),
          el("div", { class: "card__actions" }, [
            el("button", { class: "btn btn--ghost", onclick: () => setRoute("stats") }, ["Открыть статистику"]),
            el(
              "button",
              {
                class: "btn btn--danger",
                onclick: () => {
                  if (confirm("Сбросить прогресс (термины, результаты, достижения)?")) {
                    localStorage.removeItem(STORAGE_KEY);
                    toast("Прогресс сброшен");
                    render();
                  }
                },
              },
              ["Сбросить прогресс"]
            ),
          ]),
        ]),
      ]),
    ]),
  ]);
}

function renderTerms() {
  const data = window.__DATA;
  const s = loadState() ?? defaultState();
  const keys = Object.keys(data.terms).sort((a, b) => a.localeCompare(b, "ru"));

  let q = "";
  const learned = new Set(s.learnedTerms);

  const search = el("input", {
    class: "input",
    placeholder: "Поиск: например «эквайринг» или «3ds»",
    oninput: (e) => {
      q = e.target.value.trim().toLowerCase();
      list.replaceWith(buildList());
    },
  });

  function markLearned(k) {
    const normalized = k;
    const next = saveState((st) => {
      const set = new Set(st.learnedTerms);
      set.add(normalized);
      st.learnedTerms = Array.from(set);
      return st;
    });
    learned.clear();
    for (const t of next.learnedTerms) learned.add(t);
    checkAchievements();
  }

  function buildList() {
    const filtered = keys.filter((k) => {
      if (!q) return true;
      const d = data.terms[k];
      return (
        k.toLowerCase().includes(q) ||
        d.definition.toLowerCase().includes(q) ||
        d.simple.toLowerCase().includes(q) ||
        d.example.toLowerCase().includes(q)
      );
    });

    return el(
      "div",
      { class: "list" },
      filtered.map((k) => {
        const d = data.terms[k];
        const isLearned = learned.has(k);
        return el("div", { class: "item" }, [
          el("div", { class: "item__head" }, [
            el("div", {}, [
              el("div", { class: "item__title" }, [k.replace(/_/g, " ").toUpperCase()]),
              el("div", { class: "item__meta mono" }, [`/${k}`]),
            ]),
            el("div", { class: `pill ${isLearned ? "pill--ok" : ""}` }, [
              isLearned ? "✅ Изучено" : "📌 Не отмечено",
            ]),
          ]),
          el("div", { class: "item__body" }, [
            el("p", {}, [el("strong", {}, ["Определение: "]), d.definition]),
            el("p", {}, [el("strong", {}, ["Простыми словами: "]), d.simple]),
            el("p", {}, [el("strong", {}, ["Пример: "]), d.example]),
          ]),
          el("div", { class: "card__actions" }, [
            el(
              "button",
              {
                class: `btn ${isLearned ? "btn--ghost" : "btn--primary"}`,
                onclick: () => {
                  markLearned(k);
                  toast(isLearned ? "Уже отмечено" : "Отмечено как изученное");
                  render();
                },
              },
              [isLearned ? "Отмечено" : "Отметить как изученное"]
            ),
          ]),
        ]);
      })
    );
  }

  let list = buildList();

  const termsTotal = keys.length;
  const learnedCount = (loadState() ?? defaultState()).learnedTerms.length;

  return el("div", { class: "view" }, [
    el("div", { class: "card" }, [
      el("div", { class: "card__inner" }, [
        el("div", { class: "card__title" }, ["Глоссарий терминов"]),
        el("div", { class: "card__subtitle" }, [
          "Выбирай термин, читай объяснение и отмечай как изученный — прогресс сохранится на этом устройстве.",
        ]),
        el("div", { class: "card__actions" }, [
          el("span", { class: "pill" }, ["Всего: ", el("strong", {}, [String(termsTotal)])]),
          el("span", { class: "pill pill--ok" }, ["Изучено: ", el("strong", {}, [String(learnedCount)])]),
        ]),
        el("div", { class: "card__actions" }, [
          el(
            "button",
            {
              class: "btn btn--ghost",
              onclick: () => {
                saveState((st) => {
                  st.learnedTerms = [];
                  return st;
                });
                toast("Термины очищены");
                render();
              },
            },
            ["Очистить отметки"]
          ),
        ]),
      ]),
    ]),
    el("div", { class: "card" }, [
      el("div", { class: "card__inner" }, [
        el("div", { class: "row" }, [el("div", { class: "field" }, [el("div", { class: "field__label" }, ["Поиск"]), search])]),
      ]),
    ]),
    list,
  ]);
}

function renderHowItWorks() {
  const blocks = [
    {
      id: "buyer",
      title: "👤 Покупатель",
      html: `
        <p><strong>Шаг 1:</strong> выбираете товар/услугу.</p>
        <p><strong>Шаг 2:</strong> подходите к кассе или переходите к оплате онлайн.</p>
        <p><strong>Шаг 3:</strong> оплачиваете картой (терминал/ввод данных).</p>
        <p><strong>Шаг 4:</strong> подтверждаете платёж (PIN, биометрия или 3D Secure).</p>
        <p><strong>Шаг 5:</strong> получаете подтверждение (чек/уведомление).</p>
        <p><strong>Шаг 6:</strong> деньги списаны — покупка завершена ✅</p>
      `,
      tip: "Важно: обычно всё занимает секунды.",
    },
    {
      id: "seller",
      title: "🏪 Продавец",
      html: `
        <p><strong>Шаг 1:</strong> выбираете банк‑эквайер.</p>
        <p><strong>Шаг 2:</strong> подаёте заявку и документы.</p>
        <p><strong>Шаг 3:</strong> банк проверяет (обычно 1–7 дней).</p>
        <p><strong>Шаг 4:</strong> получаете терминал/картридер или доступ к платёжному шлюзу.</p>
        <p><strong>Шаг 5:</strong> настраиваете и тестируете.</p>
        <p><strong>Шаг 6:</strong> начинаете принимать карты 💳</p>
      `,
      tip: "Комиссия часто 1.5–3% от суммы покупок.",
    },
    {
      id: "bank",
      title: "🏦 Банк",
      html: `
        <p><strong>Шаг 1:</strong> подключает бизнес к эквайрингу.</p>
        <p><strong>Шаг 2:</strong> получает запрос оплаты от терминала/сайта.</p>
        <p><strong>Шаг 3:</strong> проверяет карту и баланс, одобряет/отклоняет.</p>
        <p><strong>Шаг 4:</strong> обеспечивает безопасность (шифрование, антифрод, 3D Secure).</p>
        <p><strong>Шаг 5:</strong> переводит деньги продавцу, удерживая комиссию.</p>
      `,
      tip: "Банк зарабатывает на комиссии и отвечает за надёжность.",
    },
  ];

  let active = "buyer";

  const buttons = el(
    "div",
    { class: "card__actions" },
    blocks.map((b) =>
      el(
        "button",
        {
          class: `btn ${active === b.id ? "btn--primary" : "btn--ghost"}`,
          onclick: () => {
            active = b.id;
            render();
          },
        },
        [b.title]
      )
    )
  );

  const cur = blocks.find((b) => b.id === active);

  return el("div", { class: "view" }, [
    el("div", { class: "card" }, [
      el("div", { class: "card__inner" }, [
        el("div", { class: "card__title" }, ["Как это работает"]),
        el("div", { class: "card__subtitle" }, [
          "Один и тот же платёж выглядит по‑разному для покупателя, продавца и банка. Выберите роль и прочитайте сценарий.",
        ]),
        buttons,
      ]),
    ]),
    el("div", { class: "card" }, [
      el("div", { class: "card__inner" }, [
        el("div", { class: "card__title" }, [cur.title]),
        el("div", { class: "item__body", html: cur.html }),
        el("div", { class: "pill", style: "margin-top:12px" }, ["💡 ", cur.tip]),
      ]),
    ]),
  ]);
}

function renderCompare() {
  const data = window.__DATA;
  const types = data.comparison.types;

  const rows = [
    ["Стоимость", (t) => t.cost],
    ["Оборудование", (t) => t.equipment],
    ["Безопасность", (t) => t.security],
    ["Подключение", (t) => t.setup_time],
    ["Лучше для", (t) => t.best_for],
    ["Плюсы", (t) => (t.pros || []).join(", ")],
    ["Минусы", (t) => (t.cons || []).join(", ")],
  ];

  const table = el("table", { class: "table" }, [
    el("thead", {}, [
      el("tr", {}, [el("th", {}, ["Критерий"]), ...types.map((t) => el("th", {}, [t.name]))]),
    ]),
    el(
      "tbody",
      {},
      rows.map(([label, getter]) =>
        el("tr", {}, [el("td", {}, [label]), ...types.map((t) => el("td", {}, [getter(t)]))])
      )
    ),
  ]);

  return el("div", { class: "view" }, [
    el("div", { class: "card" }, [
      el("div", { class: "card__inner" }, [
        el("div", { class: "card__title" }, ["Сравнение типов эквайринга"]),
        el("div", { class: "card__subtitle" }, [
          "Смотри разницу по стоимости, оборудованию и скорости подключения — так проще понять, что подходит бизнесу.",
        ]),
      ]),
    ]),
    el("div", { class: "card" }, [el("div", { class: "card__inner" }, [table])]),
  ]);
}

function renderQuiz() {
  const data = window.__DATA;
  const questions = data.quiz.questions;
  const s = loadState() ?? defaultState();

  let idx = 0;
  let score = 0;
  let locked = false;
  let shuffled = [];
  let correctIdx = 0;

  function shuffleQuestion(i) {
    const q = questions[i];
    const opts = q.options.slice();
    const correct = q.correct;
    const correctAnswer = opts[correct];
    for (let j = opts.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [opts[j], opts[k]] = [opts[k], opts[j]];
    }
    shuffled = opts;
    correctIdx = opts.indexOf(correctAnswer);
  }

  function renderCard() {
    const q = questions[idx];
    shuffleQuestion(idx);
    locked = false;

    const title = el("div", { class: "card__title" }, [
      el("div", {}, ["Викторина"]),
      el("span", { class: "pill" }, [
        "Вопрос ",
        el("strong", {}, [String(idx + 1)]),
        "/",
        el("strong", {}, [String(questions.length)]),
      ]),
    ]);

    const subtitle = el("div", { class: "card__subtitle" }, [
      "Выберите ответ. После каждого вопроса будет объяснение.",
    ]);

    const qText = el("div", { class: "item", style: "margin-top:12px" }, [
      el("div", { class: "item__title" }, [q.question]),
    ]);

    const opts = el(
      "div",
      { class: "list", style: "margin-top:12px" },
      shuffled.map((opt, i) =>
        el(
          "button",
          {
            class: "quizOpt",
            onclick: () => onAnswer(i),
          },
          [opt]
        )
      )
    );

    const actions = el("div", { class: "card__actions" }, [
      el(
        "button",
        {
          class: "btn btn--ghost",
          onclick: () => {
            if (confirm("Отменить викторину?")) {
              render();
            }
          },
        },
        ["Отменить"]
      ),
    ]);

    return el("div", { class: "card" }, [el("div", { class: "card__inner" }, [title, subtitle, qText, opts, actions])]);
  }

  function onAnswer(chosen) {
    if (locked) return;
    locked = true;

    const q = questions[idx];
    const nodes = Array.from(document.querySelectorAll(".quizOpt"));
    nodes.forEach((n) => n.setAttribute("disabled", "true"));

    const isCorrect = chosen === correctIdx;
    if (isCorrect) {
      score += 1;
      nodes[chosen].classList.add("quizOpt--correct");
    } else {
      nodes[chosen].classList.add("quizOpt--wrong");
      nodes[correctIdx].classList.add("quizOpt--correct");
    }

    const expl = el("div", { class: "item", style: "margin-top:12px" }, [
      el("div", { class: "item__title" }, [isCorrect ? "✅ Правильно" : "❌ Неправильно"]),
      el("div", { class: "item__body" }, [q.explanation]),
    ]);

    const nextBtn = el(
      "button",
      {
        class: "btn btn--primary",
        onclick: () => {
          idx += 1;
          if (idx >= questions.length) finish();
          else render();
        },
      },
      [idx + 1 >= questions.length ? "Показать результат" : "Следующий вопрос"]
    );

    const wrap = document.querySelector("#view");
    wrap.appendChild(expl);
    wrap.appendChild(el("div", { class: "card" }, [el("div", { class: "card__inner" }, [nextBtn])]));
  }

  function finish() {
    const total = questions.length;
    const percent = Math.round((score / total) * 100);

    trackAction("quiz_finish");

    saveState((st) => {
      if (score > (st.quiz?.bestScore ?? 0) || total > (st.quiz?.bestTotal ?? 0)) {
        st.quiz.bestScore = Math.max(st.quiz.bestScore ?? 0, score);
        st.quiz.bestTotal = total;
      } else if ((st.quiz?.bestTotal ?? 0) === total) {
        st.quiz.bestScore = Math.max(st.quiz.bestScore ?? 0, score);
      }
      st.quiz.last = { score, total, percent, finishedAt: nowISO() };
      return st;
    });
    checkAchievements();

    let headline = "Результат";
    let pillClass = "pill--warn";
    let msg = `Вы ответили правильно на ${score} из ${total} (${percent}%).`;
    if (percent === 100) {
      headline = "🏆 Вы эксперт в безнале!";
      pillClass = "pill--ok";
      msg += " Отличная работа!";
    } else if (percent >= 70) {
      headline = "🎯 Отличный результат!";
      pillClass = "pill--ok";
      msg += " Вы хорошо разбираетесь в теме.";
    } else {
      headline = "📚 Есть куда расти";
      pillClass = "pill--warn";
      msg += " Изучите термины и попробуйте снова.";
    }

    const best = (loadState() ?? defaultState()).quiz;

    const view = el("div", { class: "view" }, [
      el("div", { class: "card" }, [
        el("div", { class: "card__inner" }, [
          el("div", { class: "card__title" }, [headline]),
          el("div", { class: "card__subtitle" }, [msg]),
          el("div", { class: "card__actions" }, [
            el("span", { class: `pill ${pillClass}` }, [
              "Сейчас: ",
              el("strong", {}, [`${score}/${total}`]),
            ]),
            el("span", { class: "pill" }, [
              "Лучший: ",
              el("strong", {}, [
                best?.bestTotal ? `${best.bestScore}/${best.bestTotal}` : "—",
              ]),
            ]),
          ]),
          el("div", { class: "card__actions" }, [
            el("button", { class: "btn btn--primary", onclick: () => setRoute("quiz") }, ["Пройти ещё раз"]),
            el("button", { class: "btn", onclick: () => setRoute("terms") }, ["Изучить термины"]),
            el("button", { class: "btn btn--ghost", onclick: () => setRoute("stats") }, ["Статистика"]),
          ]),
        ]),
      ]),
    ]);

    const root = document.getElementById("view");
    root.replaceChildren(view);
  }

  // Первый рендер вопроса
  return el("div", { class: "view" }, [renderCard()]);
}

function renderBusiness() {
  const data = window.__DATA;
  const businesses = data.business.businesses;

  const select = el(
    "select",
    { class: "select" },
    [
      el("option", { value: "" }, ["Выберите бизнес…"]),
      ...businesses.map((b) => el("option", { value: String(b.id) }, [b.name])),
    ]
  );
  const avg = el("input", { class: "input", type: "number", min: "0", placeholder: "Например: 500" });
  const tx = el("input", { class: "input", type: "number", min: "0", placeholder: "Например: 50" });

  const out = el("div", {});

  function commissionRateFor(recommended) {
    const map = {
      мобильный_эквайринг: 0.023,
      торговый_эквайринг: 0.02,
      интернет_эквайринг: 0.028,
      биоэквайринг: 0.022,
    };
    return map[recommended] ?? 0.025;
  }

  function calc() {
    const id = Number(select.value);
    const b = businesses.find((x) => x.id === id);
    if (!b) {
      out.replaceChildren(el("div", { class: "pill pill--warn" }, ["Выберите тип бизнеса."]));
      return;
    }
    const avgCheck = Number(avg.value);
    const transactions = Number(tx.value);
    if (!Number.isFinite(avgCheck) || avgCheck <= 0 || !Number.isFinite(transactions) || transactions <= 0) {
      out.replaceChildren(el("div", { class: "pill pill--warn" }, ["Введите средний чек и количество покупок в день."]));
      return;
    }

    trackAction("business_calc");

    const dailyRevenue = avgCheck * transactions;
    const monthlyRevenue = dailyRevenue * 30;
    const rate = commissionRateFor(b.recommended);
    const monthlyCommission = monthlyRevenue * rate;
    const monthlyNet = monthlyRevenue - monthlyCommission;
    const lossPercent = (b.loss_without_cards ?? 0) / 100;
    const potentialLoss = monthlyRevenue * lossPercent;

    const recTitle = b.recommended.replace(/_/g, " ").toUpperCase();

    const view = el("div", { class: "card" }, [
      el("div", { class: "card__inner" }, [
        el("div", { class: "card__title" }, ["Рекомендация"]),
        el("div", { class: "card__actions" }, [
          el("span", { class: "pill" }, ["Бизнес: ", el("strong", {}, [b.name])]),
          el("span", { class: "pill" }, ["Оборот/мес: ", el("strong", {}, [`${fmtInt(Math.round(monthlyRevenue))} ₽`])]),
        ]),
        el("div", { class: "item", style: "margin-top:12px" }, [
          el("div", { class: "item__head" }, [
            el("div", {}, [
              el("div", { class: "item__title" }, [`🎯 Рекомендуемый тип: ${recTitle}`]),
              el("div", { class: "item__meta" }, [b.estimated_cost]),
            ]),
            b.alternative
              ? el("span", { class: "pill" }, [
                  "Альтернатива: ",
                  el("strong", {}, [b.alternative.replace(/_/g, " ")]),
                ])
              : el("span", { class: "pill" }, ["Альтернатива: ", el("strong", {}, ["—"])]),
          ]),
          el("div", { class: "item__body" }, [
            el("p", {}, [el("strong", {}, ["Почему: "]), b.reason]),
            el("p", {}, [el("strong", {}, ["Банки: "]), (b.banks || []).join(", ")]),
          ]),
        ]),
        el("div", { class: "kpi", style: "margin-top:12px" }, [
          el("div", { class: "kpi__card" }, [
            el("div", { class: "kpi__label" }, ["Комиссия/мес (примерно)"]),
            el("div", { class: "kpi__value" }, [`${fmtInt(Math.round(monthlyCommission))} ₽`]),
          ]),
          el("div", { class: "kpi__card" }, [
            el("div", { class: "kpi__label" }, ["Чистый доход/мес"]),
            el("div", { class: "kpi__value" }, [`${fmtInt(Math.round(monthlyNet))} ₽`]),
          ]),
          el("div", { class: "kpi__card" }, [
            el("div", { class: "kpi__label" }, ["Потери без карт (оценка)"]),
            el("div", { class: "kpi__value" }, [`${fmtInt(Math.round(potentialLoss))} ₽`]),
          ]),
          el("div", { class: "kpi__card" }, [
            el("div", { class: "kpi__label" }, ["Отказов без карт"]),
            el("div", { class: "kpi__value" }, [`${b.loss_without_cards}%`]),
          ]),
        ]),
      ]),
    ]);

    out.replaceChildren(view);
  }

  const hint = el("div", { class: "pill" }, ["Заполните поля и нажмите «Рассчитать»."]);

  const form = el("div", { class: "card" }, [
    el("div", { class: "card__inner" }, [
      el("div", { class: "card__title" }, ["Бизнес‑симулятор"]),
      el("div", { class: "card__subtitle" }, [
        "Выберите бизнес, введите средний чек и количество покупок в день — сайт посчитает оборот, комиссию и покажет рекомендацию.",
      ]),
      el("div", { class: "row", style: "margin-top:12px" }, [
        el("div", { class: "field" }, [el("div", { class: "field__label" }, ["Тип бизнеса"]), select]),
        el("div", { class: "field" }, [el("div", { class: "field__label" }, ["Средний чек (₽)"]), avg]),
        el("div", { class: "field" }, [el("div", { class: "field__label" }, ["Покупок в день"]), tx]),
      ]),
      el("div", { class: "card__actions" }, [
        el("button", { class: "btn btn--primary", onclick: calc }, ["Рассчитать"]),
        el("button", { class: "btn btn--ghost", onclick: () => setRoute("compare") }, ["Сравнить типы"]),
      ]),
      el("div", { style: "margin-top:10px" }, [hint]),
    ]),
  ]);

  return el("div", { class: "view" }, [form, out]);
}

function renderStats() {
  const data = window.__DATA;
  const s = loadState() ?? defaultState();

  const termsTotal = Object.keys(data.terms).length;
  const learned = s.learnedTerms.length;
  const best = s.quiz?.bestTotal ? `${s.quiz.bestScore}/${s.quiz.bestTotal}` : "—";
  const ach = Object.values(s.achievements || {}).sort((a, b) => (a.unlockedAt || "").localeCompare(b.unlockedAt || ""));

  const achievementsList = el(
    "div",
    { class: "list" },
    ach.length
      ? ach.map((a) =>
          el("div", { class: "item" }, [
            el("div", { class: "item__head" }, [
              el("div", { class: "item__title" }, [a.name]),
              el("div", { class: "item__meta" }, [new Date(a.unlockedAt).toLocaleString("ru-RU")]),
            ]),
            el("div", { class: "item__body" }, [a.description]),
          ])
        )
      : [el("div", { class: "pill pill--warn" }, ["Пока нет достижений — начните с терминов или викторины."])]
  );

  return el("div", { class: "view" }, [
    el("div", { class: "card" }, [
      el("div", { class: "card__inner" }, [
        el("div", { class: "card__title" }, ["Статистика"]),
        el("div", { class: "kpi", style: "margin-top:12px" }, [
          el("div", { class: "kpi__card" }, [
            el("div", { class: "kpi__label" }, ["Термины"]),
            el("div", { class: "kpi__value" }, [`${learned}/${termsTotal}`]),
          ]),
          el("div", { class: "kpi__card" }, [
            el("div", { class: "kpi__label" }, ["Лучший тест"]),
            el("div", { class: "kpi__value" }, [best]),
          ]),
          el("div", { class: "kpi__card" }, [
            el("div", { class: "kpi__label" }, ["Достижений"]),
            el("div", { class: "kpi__value" }, [String(Object.keys(s.achievements || {}).length)]),
          ]),
          el("div", { class: "kpi__card" }, [
            el("div", { class: "kpi__label" }, ["Открытий разделов"]),
            el("div", { class: "kpi__value" }, [String(s.actions?.view_any ?? 0)]),
          ]),
        ]),
      ]),
    ]),
    el("div", { class: "card" }, [
      el("div", { class: "card__inner" }, [
        el("div", { class: "card__title" }, ["Достижения"]),
        el("div", { class: "card__subtitle" }, [
          "Работает локально на этом компьютере (как “память” бота, но без базы).",
        ]),
      ]),
    ]),
    achievementsList,
  ]);
}

function renderNotReady(err) {
  return el("div", { class: "view" }, [
    el("div", { class: "card" }, [
      el("div", { class: "card__inner" }, [
        el("div", { class: "card__title" }, ["Не удалось загрузить данные JSON"]),
        el("div", { class: "card__subtitle" }, [
          "Скорее всего, вы открыли файл напрямую (file://). Для загрузки JSON браузеру нужен локальный сервер.",
        ]),
        el("div", { class: "item", style: "margin-top:12px" }, [
          el("div", { class: "item__title" }, ["Что сделать"]),
          el("div", { class: "item__body" }, [
            el("p", {}, ["1) Откройте `README.md` и запустите `serve.bat` (или команду `python -m http.server`)."]),
            el("p", {}, ["2) Откройте сайт по адресу, который напишет сервер (обычно `http://localhost:8000`)."]),
            el("p", {}, ["Ошибка: ", el("span", { class: "mono" }, [String(err?.message || err)])]),
          ]),
        ]),
      ]),
    ]),
  ]);
}

function renderRoute(route) {
  switch (route) {
    case ROUTES.home:
      return renderHome();
    case ROUTES.terms:
      return renderTerms();
    case ROUTES.how:
      return renderHowItWorks();
    case ROUTES.compare:
      return renderCompare();
    case ROUTES.quiz:
      return renderQuiz();
    case ROUTES.business:
      return renderBusiness();
    case ROUTES.stats:
      return renderStats();
    default:
      return renderHome();
  }
}

async function render() {
  const route = getRoute();
  setActiveNav(route);
  trackView(route);

  const root = document.getElementById("view");
  root.replaceChildren(el("div", { class: "pill" }, ["Загрузка данных…"]));

  try {
    await ensureDataLoaded();
    root.replaceChildren(renderRoute(route));
  } catch (e) {
    root.replaceChildren(renderNotReady(e));
  }
}

function wireNav() {
  document.querySelectorAll(".nav__item").forEach((b) => {
    b.addEventListener("click", () => {
      const route = b.getAttribute("data-route");
      if (!route) return;
      setRoute(route);
    });
  });
}

window.addEventListener("hashchange", () => render());
window.addEventListener("DOMContentLoaded", async () => {
  wireNav();
  if (!location.hash) setRoute("home");
  await render();
});


const PAGE_TO_FILE = {
  home: "index.html",
  terms: "terms.html",
  how: "how.html",
  compare: "compare.html",
  quiz: "quiz.html",
  business: "business.html",
  stats: "stats.html",
};

const STORAGE_KEY = "cashlessEduSite.v2";

function nowISO() {
  return new Date().toISOString();
}
function fmtInt(n) {
  return new Intl.NumberFormat("ru-RU").format(n);
}
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) node.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}
function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("toast--on");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove("toast--on"), 1800);
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
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
    quiz: { bestScore: 0, bestTotal: 0, last: null },
    achievements: {},
  };
}
function saveState(mutator) {
  const state = loadState() ?? defaultState();
  const next = mutator ? mutator(structuredClone(state)) : state;
  next.lastSeenAt = nowISO();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
function trackAction(name) {
  saveState((s) => {
    s.actions[name] = (s.actions[name] || 0) + 1;
    return s;
  });
}
function trackView(route) {
  saveState((s) => {
    s.views[route] = (s.views[route] || 0) + 1;
    s.actions.view_any = (s.actions.view_any || 0) + 1;
    s.actions[`view_${route}`] = (s.actions[`view_${route}`] || 0) + 1;
    return s;
  });
}
function goTo(page) {
  location.href = PAGE_TO_FILE[page] || "index.html";
}

async function loadJSON(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
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
  return window.__DATA;
}

function unlockAchievement(id, name, description) {
  const unlockedAt = nowISO();
  const res = saveState((s) => {
    if (s.achievements[id]) return s;
    s.achievements[id] = { name, description, unlockedAt };
    return s;
  });
  if (res.achievements[id]?.unlockedAt === unlockedAt) toast(`Достижение: ${name}`);
}
function checkAchievements() {
  const s = loadState() ?? defaultState();
  const termsCount = window.__DATA ? Object.keys(window.__DATA.terms).length : 0;
  if (s.learnedTerms.length >= 1) unlockAchievement("first", "🎓 Первый шаг", "Изучен первый термин");
  if (termsCount && s.learnedTerms.length >= termsCount) unlockAchievement("all_terms", "📚 Мастер глоссария", "Изучены все термины");
  if ((s.quiz.bestTotal || 0) > 0) unlockAchievement("quiz_done", "📖 Ученик", "Пройдена викторина");
  if (s.quiz.bestTotal > 0 && s.quiz.bestScore === s.quiz.bestTotal) unlockAchievement("quiz_100", "🏆 Эксперт викторины", "100% правильных ответов");
  if ((s.actions.business_calc || 0) > 0) unlockAchievement("business", "💼 Бизнес-симулятор", "Использован бизнес-симулятор");
  if ((s.actions.view_compare || 0) > 0) unlockAchievement("compare", "⚖️ Мастер сравнений", "Открыт раздел сравнения");
  if ((s.actions.view_any || 0) >= 20) unlockAchievement("active", "🔥 Активный пользователь", "Открыто 20+ разделов");
  const needed = ["view_terms", "view_how", "view_compare", "view_quiz", "view_business", "view_stats"];
  if (needed.every((k) => (s.actions[k] || 0) > 0)) unlockAchievement("explorer", "🔍 Исследователь", "Открыты все основные разделы");
}

function renderHome() {
  const s = loadState() ?? defaultState();
  const termsTotal = Object.keys(window.__DATA.terms).length;
  const ach = Object.keys(s.achievements).length;
  const best = s.quiz.bestTotal ? `${s.quiz.bestScore}/${s.quiz.bestTotal}` : "—";

  return el("div", { class: "view" }, [
    el("div", { class: "hero card" }, [
      el("div", { class: "card__inner hero__inner" }, [
        el("div", {}, [
          el("div", { class: "card__title" }, ["Сайт по теме безналичной оплаты"]),
          el("div", { class: "card__subtitle" }, ["Веб-версия проекта: теория, практика, тестирование и расчеты для бизнеса."]),
          el("div", { class: "card__actions" }, [
            el("button", { class: "btn btn--primary", onclick: () => goTo("terms") }, ["Начать обучение"]),
            el("button", { class: "btn", onclick: () => goTo("quiz") }, ["Пройти викторину"]),
          ]),
          el("div", { class: "kpi", style: "margin-top:14px" }, [
            el("div", { class: "kpi__card" }, [el("div", { class: "kpi__label" }, ["Термины"]), el("div", { class: "kpi__value" }, [`${s.learnedTerms.length}/${termsTotal}`])]),
            el("div", { class: "kpi__card" }, [el("div", { class: "kpi__label" }, ["Лучший тест"]), el("div", { class: "kpi__value" }, [best])]),
            el("div", { class: "kpi__card" }, [el("div", { class: "kpi__label" }, ["Достижения"]), el("div", { class: "kpi__value" }, [String(ach)])]),
            el("div", { class: "kpi__card" }, [el("div", { class: "kpi__label" }, ["Активность"]), el("div", { class: "kpi__value" }, [String(s.actions.view_any || 0)])]),
          ]),
        ]),
        el("img", { class: "hero__img", src: "./assets/hero-photo.jpg", alt: "Фото: оплата картой в торговой точке" }),
      ]),
    ]),
    el("div", { class: "card" }, [el("div", { class: "card__inner" }, [
      el("div", { class: "card__title" }, ["Разделы сайта"]),
      el("div", { class: "card__actions" }, [
        el("img", { class: "mini-icon", src: "./assets/icon-terms.svg", alt: "Иконка терминов" }),
        el("img", { class: "mini-icon", src: "./assets/icon-quiz.svg", alt: "Иконка викторины" }),
        el("img", { class: "mini-icon", src: "./assets/icon-business.svg", alt: "Иконка бизнеса" }),
      ]),
      el("div", { class: "item__body" }, [
        el("p", {}, ["Термины, интерактивный раздел “Как это работает”, таблица сравнения, викторина, бизнес-симулятор и статистика прогресса."]),
      ]),
    ])]),
  ]);
}

function renderTerms() {
  const keys = Object.keys(window.__DATA.terms).sort((a, b) => a.localeCompare(b, "ru"));
  let query = "";
  function mark(k) {
    saveState((s) => {
      const set = new Set(s.learnedTerms);
      set.add(k);
      s.learnedTerms = Array.from(set);
      return s;
    });
    checkAchievements();
    toast("Термин отмечен");
    render();
  }
  function list() {
    const s = loadState() ?? defaultState();
    const learned = new Set(s.learnedTerms);
    return el("div", { class: "list" }, keys.filter((k) => {
      if (!query) return true;
      const t = window.__DATA.terms[k];
      const q = query.toLowerCase();
      return k.includes(q) || t.definition.toLowerCase().includes(q) || t.simple.toLowerCase().includes(q);
    }).map((k) => {
      const t = window.__DATA.terms[k];
      return el("div", { class: "item" }, [
        el("div", { class: "item__head" }, [
          el("div", { class: "item__title" }, [k.replaceAll("_", " ")]),
          el("span", { class: `pill ${learned.has(k) ? "pill--ok" : ""}` }, [learned.has(k) ? "✅ Изучено" : "📌 Новое"]),
        ]),
        el("div", { class: "item__body" }, [
          el("p", {}, [el("strong", {}, ["Определение: "]), t.definition]),
          el("p", {}, [el("strong", {}, ["Простыми словами: "]), t.simple]),
          el("p", {}, [el("strong", {}, ["Пример: "]), t.example]),
        ]),
        el("button", { class: "btn btn--primary", onclick: () => mark(k) }, ["Отметить как изученное"]),
      ]);
    }));
  }
  const search = el("input", { class: "input", placeholder: "Поиск по терминам...", oninput: (e) => { query = e.target.value.trim(); wrap.replaceChildren(list()); } });
  const wrap = el("div", {}, [list()]);
  return el("div", { class: "view" }, [
    el("div", { class: "card" }, [el("div", { class: "card__inner" }, [
      el("div", { class: "card__title" }, ["Глоссарий терминов"]),
      el("div", { class: "card__subtitle" }, ["Изучайте термины и отмечайте прогресс."]),
      search,
    ])]),
    wrap,
  ]);
}

function renderHow() {
  const cards = [
    [
      "👤 Покупатель",
      "1) Выбирает товар или услугу.\n2) На кассе прикладывает/вставляет карту, а в интернете вводит реквизиты на защищенной странице.\n3) Подтверждает платёж: PIN, push-уведомление или 3D Secure код.\n4) Получает чек и уведомление банка.\n5) В случае спорной операции может обратиться в банк для оспаривания (chargeback).",
    ],
    [
      "🏪 Продавец",
      "1) Выбирает банк-эквайер и тариф (ставка, абонплата, сроки вывода).\n2) Подписывает договор, предоставляет документы бизнеса.\n3) Устанавливает POS-терминал или подключает платежный шлюз к сайту.\n4) Принимает платежи и видит статусы операций в личном кабинете.\n5) Получает средства на расчетный счет за минусом комиссии.\n6) Контролирует возвраты, отмены и спорные транзакции.",
    ],
    [
      "🏦 Банк и платёжная инфраструктура",
      "1) Принимает запрос на авторизацию от терминала или платежного шлюза.\n2) Проверяет карту: валидность, лимиты, риски мошенничества.\n3) Отправляет решение: одобрено или отказ.\n4) После авторизации проводит клиринг и окончательные расчеты между банками.\n5) Обеспечивает безопасность: шифрование, мониторинг антифрода, 3D Secure.",
    ],
    [
      "🔒 Безопасность и типичные ошибки",
      "Что защищает платежи: EMV-чип, токенизация, 3D Secure, антифрод-мониторинг.\nЧастые причины отказа: недостаточно средств, неверный PIN/CVV, истек срок карты, лимиты банка, сбой сети.\nПрактический совет: всегда сверяйте URL платежной страницы и не передавайте коды подтверждения третьим лицам.",
    ],
  ];
  return el("div", { class: "view" }, [
    el("div", { class: "card" }, [el("div", { class: "card__inner" }, [
      el("div", { class: "card__title" }, ["Как это работает"]),
      el("div", { class: "card__subtitle" }, ["Подробная схема процесса оплаты: от действия покупателя до межбанковских расчетов и защиты транзакций."]),
    ])]),
    el("div", { class: "list" }, cards.map(([t, d]) => el("div", { class: "item" }, [
      el("div", { class: "item__title" }, [t]),
      el("div", { class: "item__body" }, d.split("\n").map((line) => el("p", {}, [line]))),
    ]))),
  ]);
}

function renderCompare() {
  const types = window.__DATA.comparison.types;
  const rows = [
    ["Стоимость", (t) => t.cost], ["Оборудование", (t) => t.equipment], ["Безопасность", (t) => t.security], ["Подключение", (t) => t.setup_time], ["Лучше для", (t) => t.best_for],
  ];
  return el("div", { class: "view" }, [
    el("div", { class: "card" }, [el("div", { class: "card__inner" }, [el("div", { class: "card__title" }, ["Сравнение типов эквайринга"])])]),
    el("div", { class: "card" }, [el("div", { class: "card__inner" }, [
      el("table", { class: "table" }, [
        el("thead", {}, [el("tr", {}, [el("th", {}, ["Критерий"]), ...types.map((t) => el("th", {}, [t.name]))])]),
        el("tbody", {}, rows.map(([name, fn]) => el("tr", {}, [el("td", {}, [name]), ...types.map((t) => el("td", {}, [fn(t)]))]))),
      ]),
    ])]),
  ]);
}

function renderQuiz() {
  const qs = window.__DATA.quiz.questions;
  if (!window.__QUIZ_SESSION) {
    window.__QUIZ_SESSION = { i: 0, score: 0, done: false };
  }
  const session = window.__QUIZ_SESSION;

  function normalizeExplanation(text) {
    return String(text || "")
      .replace(/^\s*(Правильно!|Верно!|Точно!)\s*/i, "")
      .trim();
  }

  /** Мотивация по числу правильных ответов (и доле в %). */
  function quizMotivation(score, total) {
    const p = total > 0 ? (score / total) * 100 : 0;
    if (p >= 100) {
      return {
        cls: "pill--ok",
        title: "Блестяще!",
        text: "Все ответы верные — вы отлично знаете тему безналичных платежей.",
      };
    }
    if (p >= 80) {
      return {
        cls: "pill--ok",
        title: "Очень хорошо!",
        text: "Сильный результат. Загляните в раздел «Термины», чтобы закрепить редкие нюансы.",
      };
    }
    if (p >= 60) {
      return {
        cls: "pill--warn",
        title: "Неплохо!",
        text: "База есть, но хорошо бы ещё немного подучить материал и пройти викторину снова.",
      };
    }
    if (p >= 40) {
      return {
        cls: "pill--warn",
        title: "Есть над чем поработать",
        text: "Часть вопросов пока сложна — откройте глоссарий и раздел «Как это работает», затем попробуйте ещё раз.",
      };
    }
    if (p >= 20) {
      return {
        cls: "pill--warn",
        title: "Не сдавайтесь",
        text: "Тема непростая. Начните с терминов, читайте спокойно — со второй попытки обычно заметно лучше.",
      };
    }
    return {
      cls: "pill--danger",
      title: "Стоит начать с основ",
      text: "Пройдите раздел «Термины» и «Сравнить», а потом вернитесь к викторине — так будет проще.",
    };
  }

  function showResult() {
    const total = qs.length;
    const percent = Math.round((session.score * 100) / total);
    const mot = quizMotivation(session.score, total);
    const scorePillCls = percent >= 60 ? "pill--ok" : percent >= 40 ? "pill--warn" : "pill--danger";
    saveState((s) => {
      s.quiz.bestTotal = Math.max(s.quiz.bestTotal, total);
      s.quiz.bestScore = Math.max(s.quiz.bestScore, session.score);
      s.quiz.last = { score: session.score, total, percent, finishedAt: nowISO() };
      return s;
    });
    trackAction("quiz_finish");
    checkAchievements();
    return el("div", { class: "card" }, [el("div", { class: "card__inner" }, [
      el("div", { class: "card__title" }, ["Результат викторины"]),
      el("div", { class: `pill ${scorePillCls}`, style: "margin-top:10px" }, [`${session.score}/${total} (${percent}%)`]),
      el("div", { class: `pill ${mot.cls}`, style: "margin-top:12px; white-space:normal; max-width:100%; border-radius:14px; text-align:left" }, [
        el("strong", {}, [mot.title]),
        " — ",
        mot.text,
      ]),
      el("div", { class: "card__actions" }, [
        el("button", { class: "btn btn--primary", onclick: () => { window.__QUIZ_SESSION = { i: 0, score: 0, done: false }; render(); } }, ["Пройти снова"]),
        el("button", { class: "btn", onclick: () => goTo("terms") }, ["Изучить термины"]),
      ]),
    ])]);
  }

  function qCard() {
    const q = qs[session.i];
    const options = q.options.map((text, idx) => el("button", {
      class: "quizOpt",
      onclick: () => {
        const all = document.querySelectorAll(".quizOpt");
        all.forEach((b) => b.setAttribute("disabled", "true"));
        const isCorrect = idx === q.correct;
        if (idx === q.correct) {
          session.score += 1;
          options[idx].classList.add("quizOpt--correct");
        } else {
          options[idx].classList.add("quizOpt--wrong");
          options[q.correct].classList.add("quizOpt--correct");
        }
        const header = isCorrect
          ? "✅ Правильно!"
          : `❌ Неправильно. Верный ответ: ${q.options[q.correct]}`;
        card.appendChild(el("div", { class: "item", style: "margin-top:10px" }, [
          el("div", { class: "item__title" }, [header]),
          el("div", { class: "item__body" }, [normalizeExplanation(q.explanation)]),
        ]));
        card.appendChild(el("button", { class: "btn btn--primary", style: "margin-top:10px", onclick: () => { session.i += 1; if (session.i >= qs.length) session.done = true; render(); } }, [session.i + 1 >= qs.length ? "Показать результат" : "Следующий вопрос"]));
      },
    }, [text]));
    const card = el("div", { class: "card__inner" }, [
      el("div", { class: "card__title" }, [`Викторина: вопрос ${session.i + 1}/${qs.length}`]),
      el("div", { class: "item", style: "margin-top:10px" }, [el("div", { class: "item__title" }, [q.question])]),
      el("div", { class: "list", style: "margin-top:10px" }, options),
    ]);
    return el("div", { class: "card" }, [card]);
  }

  if (session.done || session.i >= qs.length) return el("div", { class: "view" }, [showResult()]);
  return el("div", { class: "view" }, [qCard()]);
}

function renderBusiness() {
  const arr = window.__DATA.business.businesses;
  const select = el("select", { class: "select" }, [el("option", { value: "" }, ["Выберите бизнес"]), ...arr.map((b) => el("option", { value: b.id }, [b.name]))]);
  const avg = el("input", { class: "input", type: "number", min: "1", placeholder: "Средний чек" });
  const tx = el("input", { class: "input", type: "number", min: "1", placeholder: "Покупок в день" });
  const out = el("div", {});
  function calc() {
    const b = arr.find((x) => String(x.id) === select.value);
    const a = Number(avg.value);
    const t = Number(tx.value);
    if (!b || a <= 0 || t <= 0) {
      out.replaceChildren(el("div", { class: "pill pill--warn" }, ["Заполните все поля корректно."]));
      return;
    }
    trackAction("business_calc");
    checkAchievements();
    const rev = a * t * 30;
    const loss = Math.round(rev * (b.loss_without_cards / 100));
    out.replaceChildren(el("div", { class: "card" }, [el("div", { class: "card__inner" }, [
      el("div", { class: "card__title" }, [`Рекомендация: ${b.recommended.replaceAll("_", " ")}`]),
      el("div", { class: "item__body" }, [
        el("p", {}, [el("strong", {}, ["Причина: "]), b.reason]),
        el("p", {}, [el("strong", {}, ["Примерный оборот/мес: "]), `${fmtInt(rev)} ₽`]),
        el("p", {}, [el("strong", {}, ["Потери без карт: "]), `${fmtInt(loss)} ₽ (${b.loss_without_cards}%)`]),
        el("p", {}, [el("strong", {}, ["Банки: "]), b.banks.join(", ")]),
      ]),
    ])]));
  }
  return el("div", { class: "view" }, [
    el("div", { class: "card" }, [el("div", { class: "card__inner" }, [
      el("div", { class: "card__title" }, ["Бизнес-симулятор"]),
      el("div", { class: "row", style: "margin-top:10px" }, [
        el("div", { class: "field" }, [el("div", { class: "field__label" }, ["Тип бизнеса"]), select]),
        el("div", { class: "field" }, [el("div", { class: "field__label" }, ["Средний чек"]), avg]),
        el("div", { class: "field" }, [el("div", { class: "field__label" }, ["Покупок/день"]), tx]),
      ]),
      el("div", { class: "card__actions" }, [el("button", { class: "btn btn--primary", onclick: calc }, ["Рассчитать"])]),
    ])]),
    out,
  ]);
}

function renderStats() {
  const s = loadState() ?? defaultState();
  const termsTotal = Object.keys(window.__DATA.terms).length;
  const ach = Object.values(s.achievements);
  return el("div", { class: "view" }, [
    el("div", { class: "card" }, [el("div", { class: "card__inner" }, [
      el("div", { class: "card__title" }, ["Статистика и достижения"]),
      el("div", { class: "kpi", style: "margin-top:12px" }, [
        el("div", { class: "kpi__card" }, [el("div", { class: "kpi__label" }, ["Термины"]), el("div", { class: "kpi__value" }, [`${s.learnedTerms.length}/${termsTotal}`])]),
        el("div", { class: "kpi__card" }, [el("div", { class: "kpi__label" }, ["Лучший тест"]), el("div", { class: "kpi__value" }, [s.quiz.bestTotal ? `${s.quiz.bestScore}/${s.quiz.bestTotal}` : "—"])]),
        el("div", { class: "kpi__card" }, [el("div", { class: "kpi__label" }, ["Достижения"]), el("div", { class: "kpi__value" }, [String(ach.length)])]),
        el("div", { class: "kpi__card" }, [el("div", { class: "kpi__label" }, ["Активность"]), el("div", { class: "kpi__value" }, [String(s.actions.view_any || 0)])]),
      ]),
      el("div", { class: "card__actions" }, [
        el("button", {
          class: "btn btn--danger",
          onclick: () => {
            if (!confirm("Сбросить прогресс?")) return;
            localStorage.removeItem(STORAGE_KEY);
            toast("Прогресс сброшен");
            setTimeout(() => location.reload(), 300);
          },
        }, ["Сбросить прогресс"]),
      ]),
    ])]),
    el("div", { class: "list" }, ach.length ? ach.map((a) => el("div", { class: "item" }, [
      el("div", { class: "item__head" }, [el("div", { class: "item__title" }, [a.name]), el("div", { class: "item__meta" }, [new Date(a.unlockedAt).toLocaleString("ru-RU")])]),
      el("div", { class: "item__body" }, [a.description]),
    ])) : [el("div", { class: "pill pill--warn" }, ["Пока нет достижений."])]),
  ]);
}

function renderNotReady(err) {
  return el("div", { class: "view" }, [
    el("div", { class: "card" }, [el("div", { class: "card__inner" }, [
      el("div", { class: "card__title" }, ["Ошибка загрузки данных"]),
      el("div", { class: "item__body" }, [`Запустите сайт через serve.bat. Детали: ${String(err.message || err)}`]),
    ])]),
  ]);
}

async function render() {
  const page = document.body.dataset.page || "home";
  document.querySelectorAll(".nav__item").forEach((a) => {
    if (a.dataset.route === page) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });

  const root = document.getElementById("view");
  root.replaceChildren(el("div", { class: "pill" }, ["Загрузка..."]));
  try {
    await ensureDataLoaded();
    trackView(page);
    checkAchievements();
    const map = { home: renderHome, terms: renderTerms, how: renderHow, compare: renderCompare, quiz: renderQuiz, business: renderBusiness, stats: renderStats };
    root.replaceChildren(map[page] ? map[page]() : renderHome());
  } catch (e) {
    root.replaceChildren(renderNotReady(e));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  render();
});

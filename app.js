(function () {
  const Q = window.QUESTIONS, M = window.MODULES;
  const KEY = window.TRAINER_KEY || "fg-best";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // Перемешиваем варианты, чтобы не запоминать «правильный — второй»
  const prep = (q) => { const order = shuffle([0, 1, 2]); return { ...q, o: order.map((i) => q.o[i]), a: order.indexOf(q.a) }; };
  const pts = (n) => n + " балл" + (n % 10 === 1 && n % 100 !== 11 ? "" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "а" : "ов");
  const variants = [...new Set(Q.filter((q) => !q.x).map((q) => q.v || 1))].sort();
  const bestKey = (v) => (variants.length > 1 ? KEY + "-" + v : KEY);

  // Вкладки
  document.querySelectorAll("nav button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach((x) => x.setAttribute("aria-selected", x === b));
    ["exam", "topics", "sheet", "links"].forEach((t) => ($("#p-" + t).hidden = t !== b.dataset.tab));
  }));

  function optsHTML(q, chosen, reveal) {
    return q.o.map((t, i) => {
      let cls = "opt";
      if (reveal) { if (i === q.a) cls += " ok"; else if (i === chosen) cls += " bad"; }
      else if (i === chosen) cls += " sel";
      return `<button class="${cls}" data-i="${i}" ${reveal ? "disabled" : ""}><span class="n">${i + 1}</span><span>${esc(t)}</span></button>`;
    }).join("");
  }

  // ---------- Пробный вариант ----------
  const exam = { v: 1, qs: [], ans: [], i: 0, left: 3600, timer: null, done: false };
  const P = $("#p-exam");

  function examIntro() {
    const many = variants.length > 1;
    const bests = variants.map((v) => store.get(bestKey(v))).map((b, k) => (b ? `${many ? "вариант " + variants[k] + ": " : ""}${pts(+b)}` : null)).filter(Boolean);
    P.innerHTML = `<div class="card">
      <span class="tag">Как на олимпиаде</span>
      <p class="qtext">30 вопросов по 10 темам, по 3 на тему. На всё 60 минут. Ответы и разбор покажем в конце.</p>
      <p class="note">Возьмите черновик и ручку, калькулятор отложите: на олимпиаде он запрещён.${bests.length ? ` Лучший результат на этом устройстве: ${bests.join(", ")}.` : ""}</p>
      <div class="row" style="justify-content:flex-start">${variants.map((v) => `<button class="btn" data-v="${v}">${many ? "Вариант " + v : "Начать"}</button>`).join("")}</div></div>`;
    P.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => examStart(+b.dataset.v)));
  }

  function examStart(v) {
    exam.v = v;
    exam.qs = Q.filter((q) => !q.x && (q.v || 1) === v).map(prep);
    exam.ans = exam.qs.map(() => null);
    exam.i = 0; exam.left = 3600; exam.done = false;
    clearInterval(exam.timer);
    exam.timer = setInterval(() => { exam.left--; tick(); if (exam.left <= 0) examFinish(); }, 1000);
    examRender();
  }

  function tick() {
    const el = $("#exam-timer"); if (!el) return;
    const m = Math.floor(exam.left / 60), s = exam.left % 60;
    el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    el.classList.toggle("low", exam.left < 300);
  }

  function examRender() {
    const N = exam.qs.length, last = exam.i === N - 1;
    const q = exam.qs[exam.i], answered = exam.ans.filter((a) => a !== null).length;
    P.innerHTML = `<div class="card">
      <div class="row"><span class="meta">${variants.length > 1 ? "Вариант " + exam.v + " · " : ""}Вопрос ${exam.i + 1} / ${N} · ${pts(q.p)}</span><span class="timer" id="exam-timer"></span></div>
      <div class="bar"><i style="width:${answered / N * 100}%"></i></div>
      <span class="tag">${esc(M[q.m])}</span>
      <p class="qtext">${esc(q.q)}</p>
      <div class="opts">${optsHTML(q, exam.ans[exam.i], false)}</div>
      <div class="row">
        <button class="btn ghost" id="ex-prev" ${exam.i === 0 ? "disabled" : ""}>Назад</button>
        <span class="meta">Отвечено ${answered} из ${N}</span>
        ${last ? `<button class="btn" id="ex-finish">Сдать работу</button>` : `<button class="btn" id="ex-next">Дальше</button>`}
      </div></div>
      ${last ? "" : `<div class="row"><span></span><button class="btn ghost" id="ex-finish">Сдать работу досрочно</button></div>`}`;
    tick();
    P.querySelectorAll(".opt").forEach((b) => (b.onclick = () => { exam.ans[exam.i] = +b.dataset.i; examRender(); }));
    $("#ex-prev").onclick = () => { exam.i--; examRender(); };
    const nx = $("#ex-next"); if (nx) nx.onclick = () => { exam.i++; examRender(); };
    $("#ex-finish").onclick = examFinish;
  }

  function examFinish() {
    if (exam.done) return;
    exam.done = true; clearInterval(exam.timer);
    const N = exam.qs.length, max = exam.qs.reduce((s, q) => s + q.p, 0);
    let score = 0, right = 0;
    exam.qs.forEach((q, i) => { if (exam.ans[i] === q.a) { score += q.p; right++; } });
    const best = +(store.get(bestKey(exam.v)) || 0);
    if (score > best) store.set(bestKey(exam.v), score);
    const spent = 3600 - Math.max(exam.left, 0), share = score / max;
    const verdict = share >= 0.8 ? "Отличный уровень, так держать." : share >= 0.6 ? "Неплохо. Перечитайте разбор ошибок и пройдите темы, где ошиблись." : "Есть над чем поработать: начните со шпаргалки и режима «По темам».";
    P.innerHTML = `<div class="card">
      <span class="tag">Результат${variants.length > 1 ? " · вариант " + exam.v : ""}</span>
      <div class="row"><span class="score">${score}<span class="meta"> / ${max}</span></span>
      <span class="meta">Верно ${right} из ${N} · время ${Math.floor(spent / 60)} мин ${spent % 60} с</span></div>
      <p class="note">${verdict}</p>
      <div class="row" style="justify-content:flex-start"><button class="btn" id="ex-again">Пройти ещё раз</button>
      ${variants.length > 1 ? `<button class="btn ghost" id="ex-menu">Выбрать вариант</button>` : ""}</div></div>
      <ol class="review">${exam.qs.map((q, i) => {
        const ok = exam.ans[i] === q.a;
        return `<li><span class="st ${ok ? "ok" : "bad"}">${i + 1}. ${ok ? "Верно" : exam.ans[i] === null ? "Нет ответа" : "Ошибка"} · ${esc(M[q.m])}</span>
          <span>${esc(q.q)}</span>
          ${ok ? "" : `<span>${exam.ans[i] !== null ? `Ваш ответ: ${esc(q.o[exam.ans[i]])}<br>` : ""}<b>Верно: ${esc(q.o[q.a])}</b></span>`}
          <span class="note">${esc(q.e)}</span></li>`;
      }).join("")}</ol>`;
    $("#ex-again").onclick = () => examStart(exam.v);
    const mn = $("#ex-menu"); if (mn) mn.onclick = examIntro;
    P.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- По темам ----------
  const tp = { mod: -1, pool: [], i: 0, chosen: null, right: 0, total: 0 };
  const T = $("#p-topics");

  function topicsStart(mod) {
    tp.mod = mod;
    tp.pool = shuffle(Q.filter((q) => mod < 0 || q.m === mod)).map(prep);
    tp.i = 0; tp.chosen = null; tp.right = 0; tp.total = 0;
    topicsRender();
  }

  function topicsRender() {
    const chips = [`<button class="chip" data-m="-1" aria-pressed="${tp.mod === -1}">Все (${Q.length})</button>`]
      .concat(M.map((n, k) => `<button class="chip" data-m="${k}" aria-pressed="${tp.mod === k}">${esc(n)} (${Q.filter((q) => q.m === k).length})</button>`)).join("");
    let body;
    if (tp.i >= tp.pool.length) {
      body = `<div class="card"><span class="tag">Тема пройдена</span>
        <p class="qtext">Верно ${tp.right} из ${tp.total}.</p>
        <div class="row"><button class="btn" id="tp-again">Ещё раз</button></div></div>`;
    } else {
      const q = tp.pool[tp.i], rev = tp.chosen !== null, ok = tp.chosen === q.a;
      body = `<div class="card">
        <div class="row"><span class="meta">${tp.i + 1} / ${tp.pool.length} · ${pts(q.p)}</span><span class="meta">Верно ${tp.right} из ${tp.total}</span></div>
        <span class="tag">${esc(M[q.m])}${q.x ? " · доп. задача" : ""}</span>
        <p class="qtext">${esc(q.q)}</p>
        <div class="opts">${optsHTML(q, tp.chosen, rev)}</div>
        ${rev ? `<p class="expl ${ok ? "ok" : "bad"}"><b>${ok ? "Верно" : "Неверно. Правильный ответ: " + esc(q.o[q.a])}</b>${esc(q.e)}</p>
        <div class="row"><span></span><button class="btn" id="tp-next">Следующий</button></div>` : ""}
      </div>`;
    }
    T.innerHTML = `<div class="chips">${chips}</div>${body}`;
    T.querySelectorAll(".chip").forEach((c) => (c.onclick = () => topicsStart(+c.dataset.m)));
    T.querySelectorAll(".opt").forEach((b) => (b.onclick = () => {
      tp.chosen = +b.dataset.i; tp.total++; if (tp.chosen === tp.pool[tp.i].a) tp.right++; topicsRender();
    }));
    const nx = $("#tp-next"); if (nx) nx.onclick = () => { tp.i++; tp.chosen = null; topicsRender(); };
    const ag = $("#tp-again"); if (ag) ag.onclick = () => topicsStart(tp.mod);
  }

  examIntro();
  topicsStart(-1);
})();

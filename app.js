/* Équipe Nexus — terminal (lecture seule de data/nexus.json). */
(function () {
  "use strict";
  const TZ = "Europe/Paris";
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nf = (v, d = 2) => v == null || isNaN(v) ? "—" : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const sg = (v, d = 2, u = "") => v == null || isNaN(v) ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + nf(Math.abs(v), d) + u;
  const cls = v => v == null ? "mut" : v > 0 ? "up" : v < 0 ? "dn" : "mut";
  const eur = (v, d = 2) => nf(v, d) + " €";
  const hm = iso => iso ? new Date(iso).toLocaleTimeString("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) : "—";
  const dhm = iso => iso ? new Date(iso).toLocaleString("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(" ", " · ") : "—";
  const day = iso => iso ? new Date(iso).toLocaleDateString("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }) : "—";
  const px = (v, m) => v == null ? "—" : nf(v, v >= 1000 ? 1 : 2) + (m === "EU" ? " €" : " $");
  const mk = m => `<span class="mk ${esc(m)}">${esc(m)}</span>`;
  const LEG = {tp1:"TP1 (50 %)", tp2:"TP2", stop:"stop", vwap:"VWAP", session:"fin de séance", full:"sortie unique"};
  const exitLab = t => (t.leg && LEG[t.leg] ? LEG[t.leg] + " · " : "") + (t.exit_reason || "");
  let D = null;

  /* ---------- onglets ---------- */
  function show(tab) {
    document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.id === "tab-" + tab));
    if (history.replaceState) history.replaceState(null, "", "#" + tab);
  }
  document.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { show(b.dataset.tab); if (innerWidth < 1024) scrollTo({ top: $(".tab.on").offsetTop - 40, behavior: "smooth" }); }));
  const keys = { F1: "port", F2: "sig", F3: "jrnl", F4: "mkt", F5: "team", F6: "crypto" };
  addEventListener("keydown", e => { if (keys[e.key]) { e.preventDefault(); show(keys[e.key]); } });
  const h0 = location.hash.slice(1); if (["port", "sig", "jrnl", "mkt", "team", "crypto"].includes(h0)) show(h0);

  /* ---------- horloge ---------- */
  function clock() {
    const t = new Date().toLocaleTimeString("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    $("#clock").innerHTML = `PARIS <b>${t}</b>`;
  }
  setInterval(clock, 1000); clock();

  /* ---------- rendu ---------- */
  function renderTape() {
    const items = D.tape.filter(t => t.p != null).map(t =>
      `<span class="tk ${t.m === "EU" ? "eu" : t.m === "CRYPTO" ? "crypto" : ""}"><b>${esc(t.s.replace(/\.(PA|DE|AS|MI|MC|BR|SW|L)$/, ""))}</b><span class="px">${nf(t.p, t.p >= 1000 ? 1 : 2)}</span><span class="${cls(t.c)}">${t.c == null ? "" : (t.c >= 0 ? "▲ " : "▼ ") + sg(t.c, 2, " %")}</span></span>`).join("");
    $("#tape").innerHTML = items + items;
  }

  function renderStatus() {
    const e = D.engine, p = $("#status"), gen = new Date(D.generated_at), age = (Date.now() - gen) / 60000;
    const open = Object.values(D.sessions || {}).some(s => s.state === "open");
    let c = "off", t = "moteur arrêté";
    if (e.running && e.state === "actif") { c = "live"; t = "moteur actif"; }
    else if (e.running) { c = "idle"; t = open ? "moteur actif" : "en veille · hors séance"; }
    p.className = "pill " + c; p.querySelector("b").textContent = `${t} · màj ${hm(D.generated_at)}`;
    const st = $("#stale");
    if (open && age > 35) { st.hidden = false; st.textContent = `Données en retard : dernière mise à jour il y a ${Math.round(age)} min (${dhm(D.generated_at)}, heure de Paris).`; }
    else st.hidden = true;
    $("#gen").textContent = `Données du ${dhm(D.generated_at)}.`;
  }

  function renderCapital() {
    const c = D.capital, s = D.stats;
    $("#capital").innerHTML = `
      <div class="cap-l">CAPITAL PAPIER</div>
      <div class="cap-v num">${nf(c.equity)}<small>€</small></div>
      <div class="cap-pl ${cls(c.pnl)}">${sg(c.pnl, 2, " €")} · ${sg(c.pnl_pct, 2, " %")}</div>
      <div class="cap-base">capital de départ ${eur(c.start, 0)} · lancé le ${esc(dhm(D.created_at))}</div>
      <div class="kpis">
        <div class="kpi"><span>P&amp;L du jour</span><b class="${cls(c.pnl_day)}">${sg(c.pnl_day, 2, " €")}</b></div>
        <div class="kpi"><span>Frais payés</span><b>${eur(c.fees)}</b></div>
        <div class="kpi"><span>Drawdown max</span><b class="${c.max_dd_pct < 0 ? "dn" : "mut"}">${sg(c.max_dd_pct, 2, " %")}</b></div>
        <div class="kpi"><span>Trades clos</span><b>${s.n || 0}</b></div>
        <div class="kpi"><span>Réussite</span><b>${s.win_rate == null ? "—" : nf(s.win_rate, 0) + " %"}</b></div>
        <div class="kpi"><span>Liquidités</span><b>${eur(c.cash, 0)}</b></div>
      </div>
      <div class="note">Net de tous les frais simulés Interactive Brokers (commission, frais de bourse, glissement). Positions valorisées à leur valeur de liquidation.</div>`;
  }

  function renderChart() {
    const box = $("#chart"), W = box.clientWidth || 600, H = box.clientHeight || 230, L = 8, R = 52, T = 10, B = 22;
    const start = D.capital.start || 1000;
    const series = [{ k: "Portefeuille", col: "#ffb000", pts: D.curve.map(([t, v]) => [Date.parse(t), (v / start - 1) * 100]), main: true }];
    const bc = D.bench_curve || {};
    if (bc.US) series.push({ k: "S&P 500", col: "#5aa9ff", pts: bc.US.points.map(([t, v]) => [Date.parse(t), v]) });
    if (bc.EU) series.push({ k: "Euro Stoxx 50", col: "#b18cff", pts: bc.EU.points.map(([t, v]) => [Date.parse(t), v]) });
    const all = series.flatMap(s => s.pts);
    if (all.length < 2) { box.innerHTML = `<div class="empty">La courbe apparaîtra après les premiers cycles.</div>`; return; }
    let x0 = Math.min(...all.map(p => p[0])), x1 = Math.max(...all.map(p => p[0]));
    let y0 = Math.min(0, ...all.map(p => p[1])), y1 = Math.max(0, ...all.map(p => p[1]));
    const pad = Math.max(0.15, (y1 - y0) * 0.12); y0 -= pad; y1 += pad; if (x1 === x0) x1 = x0 + 1;
    const X = t => L + (t - x0) / (x1 - x0) * (W - L - R), Y = v => T + (y1 - v) / (y1 - y0) * (H - T - B);
    const path = pts => pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join("");
    let g = "";
    for (let i = 0; i <= 4; i++) { const v = y0 + (y1 - y0) * i / 4; g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${W - R + 6}" y="${Y(v) + 3}">${sg(v, 2, "%")}</text>`; }
    const fmtX = t => { const s = (x1 - x0) / 864e5; return s < 2 ? hm(new Date(t).toISOString()) : new Date(t).toLocaleDateString("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit" }); };
    let xl = ""; for (let i = 0; i <= 3; i++) { const t = x0 + (x1 - x0) * i / 3; xl += `<text x="${X(t)}" y="${H - 4}" text-anchor="${i === 0 ? "start" : i === 3 ? "end" : "middle"}">${fmtX(t)}</text>`; }
    const m = series[0];
    const area = m.pts.length > 1 ? path(m.pts) + `L${X(m.pts[m.pts.length - 1][0])},${Y(0)}L${X(m.pts[0][0])},${Y(0)}Z` : "";
    const lines = series.slice().reverse().map(s => `<path d="${path(s.pts)}" fill="none" stroke="${s.col}" stroke-width="${s.main ? 2.4 : 1.5}" stroke-linejoin="round" ${s.main ? 'filter="url(#glow)"' : 'opacity=".85"'}/>` +
      (s.pts.length ? `<circle cx="${X(s.pts[s.pts.length - 1][0])}" cy="${Y(s.pts[s.pts.length - 1][1])}" r="${s.main ? 4 : 3}" fill="${s.col}"/>` : "")).join("");
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb000" stop-opacity=".30"/><stop offset="1" stop-color="#ffb000" stop-opacity=".02"/></linearGradient>
      <filter id="glow" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g class="grid">${g}</g><line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#3a3f4b" stroke-width="1"/>
      <path d="${area}" fill="url(#ga)"/>${lines}${xl}<line id="cx" y1="${T}" y2="${H - B}" stroke="#ffb00066" stroke-dasharray="3 3" visibility="hidden"/></svg><div class="tip" id="tip" hidden></div>`;
    $("#legend").innerHTML = series.map(s => { const l = s.pts[s.pts.length - 1]; return `<span><i style="background:${s.col}"></i>${esc(s.k)}<b class="${cls(l && l[1])}">${l ? sg(l[1], 2, " %") : "—"}</b></span>`; }).join("");
    const svg = box.querySelector("svg"), tip = $("#tip"), cx = $("#cx");
    const move = ev => {
      const r = svg.getBoundingClientRect(), xx = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) * W / r.width;
      const t = x0 + (xx - L) / (W - L - R) * (x1 - x0);
      const near = s => s.pts.reduce((a, p) => Math.abs(p[0] - t) < Math.abs(a[0] - t) ? p : a, s.pts[0]);
      const p = near(m); if (!p) return;
      cx.setAttribute("x1", X(p[0])); cx.setAttribute("x2", X(p[0])); cx.setAttribute("visibility", "visible");
      tip.hidden = false; tip.style.left = (X(p[0]) / W * 100) + "%"; tip.style.top = (Y(p[1]) / H * 100) + "%";
      tip.innerHTML = `${dhm(new Date(p[0]).toISOString())}<br>` + series.map(s => { const q = near(s); return `<span style="color:${s.col}">${esc(s.k)}</span> ${q ? sg(q[1], 2, " %") : "—"}`; }).join("<br>");
    };
    svg.addEventListener("mousemove", move); svg.addEventListener("touchmove", move, { passive: true });
    svg.addEventListener("mouseleave", () => { tip.hidden = true; cx.setAttribute("visibility", "hidden"); });
  }

  const empty = (t, s) => `<div class="empty-box"><b>${t}</b>${s}</div>`;

  function renderPortfolio() {
    const P = D.positions || [], r = D.rules || {};
    const today = D.trades.filter(t => (t.closed_at || "").slice(0, 10) === (D.generated_at || "").slice(0, 10));
    $("#tab-port").innerHTML = `
      <article class="panel"><div class="ph"><h2>POSITIONS OUVERTES</h2><span class="hint">${P.length} / ${(r.max_open_positions_if_protected && P.length && P.every(p => p.stop >= p.entry)) ? r.max_open_positions_if_protected : (r.max_open_positions || 2)} max · TP1 50 % à 1R, TP2 à 2,5R ou VWAP · clôture forcée 10 min avant la fin de séance · toucher une carte pour le graphique</span></div>
      ${P.length ? `<div id="live-cards-port" class="live-cards"></div>`
        : empty("Aucune position ouverte", "L'équipe n'achète que si les quatre analystes et le responsable du risque sont d'accord. Les candidats bloqués sont visibles dans Signaux.")}</article>
      <div class="grid2">
        <article class="panel"><div class="ph"><h2>AUJOURD'HUI</h2><span class="hint">${esc(day(D.generated_at))}</span></div>
          <div class="chips"><span class="chip">Trades clos <b>${today.length}</b></span><span class="chip">P&amp;L <b class="${cls(D.capital.pnl_day)}">${sg(D.capital.pnl_day, 2, " €")}</b></span>
          <span class="chip">Décisions du risque <b>${D.n_decisions_today}</b></span><span class="chip">Cycles <b>${D.engine.n_cycles}</b></span><span class="chip">Titres suivis <b>${(D.universe.US || 0) + (D.universe.EU || 0)}</b></span></div>
          <div class="note">Dernier cycle d'analyse : ${esc(dhm(D.engine.last_cycle))} (${esc((D.engine.last_markets || []).join(" + ") || "—")}). Un cycle toutes les 5 minutes pendant les séances.</div></article>
        <article class="panel"><div class="ph"><h2>STATISTIQUES</h2><span class="hint">tous les trades clos</span></div>
          <div class="chips"><span class="chip">Gagnants <b class="up">${D.stats.wins || 0}</b></span><span class="chip">Perdants <b class="dn">${D.stats.losses || 0}</b></span>
          <span class="chip">Gain moyen <b>${D.stats.avg_win == null ? "—" : eur(D.stats.avg_win)}</b></span><span class="chip">Perte moyenne <b>${D.stats.avg_loss == null ? "—" : eur(D.stats.avg_loss)}</b></span>
          <span class="chip">Profit factor <b>${D.stats.profit_factor == null ? "—" : nf(D.stats.profit_factor)}</b></span><span class="chip">Espérance/trade <b>${D.stats.expectancy == null ? "—" : sg(D.stats.expectancy, 2, " €")}</b></span>
          <span class="chip">Meilleur <b class="up">${sg(D.stats.best, 2, " €")}</b></span><span class="chip">Pire <b class="dn">${sg(D.stats.worst, 2, " €")}</b></span></div></article>
      </div>`;
  }

  function bar(v) { const c = v >= 62 ? "var(--up)" : v >= 45 ? "var(--amb)" : "var(--dn)"; return `<div class="bar"><i style="width:${Math.max(3, Math.min(100, v || 0))}%;background:${c}"></i></div>`; }
  function sc(lbl, v, tot) { return `<div class="sc ${tot ? "tot" : ""}"><span>${lbl}</span><b>${v == null ? "—" : nf(v, 0)}</b>${bar(v)}</div>`; }

  function renderSignals() {
    const S = D.signals || [], w = D.weights || {};
    const cards = S.map(s => `<div class="sig">
      <div class="sig-h"><div><span class="sym">${esc(s.symbol)}</span>${mk(s.market)} <span class="mut">${esc(s.name)}</span> <span class="meta">· ${esc(s.setup || "")} · ${hm(s.ts)}${s.n_seen > 1 ? ` · vu ${s.n_seen}×` : ""}</span></div>
        <span class="verdict ${esc(s.decision)}">${s.decision === "ACHAT" ? "ACHAT" : "VETO RISQUE"}</span></div>
      <div class="scores">${sc("Technique", s.tech)}${sc("News", s.news)}${sc("X", s.x)}${sc("Fondam.", s.fund)}${sc("Global", s.composite, 1)}</div>
      <ul class="reasons ${s.decision === "ACHAT" ? "ok" : ""}">${(s.reasons || []).map(r => `<li>${esc(r)}</li>`).join("")}</ul>
      ${s.entry ? `<div class="meta" style="margin-top:6px">Plan : entrée ${px(s.entry, s.market)} · stop ${px(s.stop, s.market)} · ${s.tp1 != null ? `TP1 ${px(s.tp1, s.market)} (50 %) · TP2 ${px(s.tp2, s.market)}` : `objectif ${px(s.target, s.market)}`}</div>` : ""}
      ${s.why ? `<details class="why"><summary>AVIS DES ANALYSTES ▾</summary>
        <p><b>Technique :</b> ${esc(s.why.tech)}</p><p><b>News :</b> ${esc(s.why.news)}</p><p><b>X :</b> ${esc(s.why.x)}</p><p><b>Fondamentaux :</b> ${esc(s.why.fund)}</p></details>` : ""}
    </div>`).join("");
    const watch = (D.watch || []).map(r => `<tr><td class="sym">${esc(r.symbol)}${mk(r.market)}<small>${esc(r.name)}</small></td><td>${px(r.price, r.market)}</td><td>${nf(r.tech, 0)}</td><td>${esc(r.setup || "—")}</td></tr><tr class="sub"><td colspan="4">${esc((r.why || []).join(" · "))}</td></tr>`).join("");
    const plan = (D.plan.top || []).map(p => `<tr><td class="sym">${esc(p.symbol)}${mk(p.market)}<small>${esc(p.name)}</small></td><td>${nf(p.watch_score, 0)}</td><td>${esc(p.trend || "—")}</td><td class="${cls(p.ret20)}">${sg(p.ret20, 1, " %")}</td><td>${nf(p.news, 0)}</td><td>${nf(p.x, 0)}</td><td>${nf(p.fund, 0)}</td><td>${esc(p.earnings || "—")}</td></tr>`).join("");
    $("#tab-sig").innerHTML = `
      <article class="panel"><div class="ph"><h2>CANDIDATS DU JOUR</h2><span class="hint">score global = ${Math.round((w.technical || .5) * 100)} % technique + ${Math.round((w.news || .15) * 100)} % news + ${Math.round((w.x || .15) * 100)} % X + ${Math.round((w.fundamentals || .2) * 100)} % fondamentaux · seuil ${D.min_score || 62}</span></div>
        ${S.length ? cards : empty("Aucun setup aujourd'hui", "L'analyste technique n'a encore trouvé aucune cassure ou rebond valable.")}</article>
      <article class="panel"><div class="ph"><h2>À L'AFFÛT · TECHNIQUE</h2><span class="hint">meilleurs scores du dernier cycle (${hm(D.scan_ts)})</span></div>
        <div class="scroll"><table class="tbl"><thead><tr><th>Titre</th><th>Cours</th><th>Score</th><th>Setup</th></tr></thead><tbody>${watch}</tbody></table></div></article>
      <article class="panel"><div class="ph"><h2>PLAN PRÉ-MARCHÉ</h2><span class="hint">préparé le ${esc(D.plan.date || "—")} · tendance journalière + news + X + fondamentaux</span></div>
        <div class="scroll"><table class="tbl"><thead><tr><th>Titre</th><th>Score</th><th>Tendance</th><th>20 j</th><th>News</th><th>X</th><th>Fond.</th><th>Résultats</th></tr></thead><tbody>${plan}</tbody></table></div>
        ${(D.plan.earnings_soon || []).length ? `<div class="note">Exclus pour résultats imminents : ${D.plan.earnings_soon.map(e => `${esc(e.name)} (${esc(e.earnings)})`).join(", ")}.</div>` : ""}</article>`;
  }

  function renderJournal() {
    const T = D.trades || [];
    const rows = T.map(t => `<tr><td class="sym">${esc(t.symbol)}${mk(t.market)}<small>${esc(t.name)} · ${esc(t.setup || "")}</small></td>
      <td>${dhm(t.opened_at)}<br><small class="mut">→ ${hm(t.closed_at)}</small></td><td>${px(t.entry_raw, t.market)}</td><td>${px(t.exit_raw, t.market)}</td>
      <td>${eur(t.notional_eur, 0)}</td><td>${eur(t.costs_eur)}</td><td class="${cls(t.pnl_eur)}">${sg(t.pnl_eur, 2, " €")}<br><small>${sg(t.pnl_pct, 2, " %")}</small></td>
      <td style="text-align:left;color:var(--mut)">${esc(exitLab(t))}</td></tr>`).join("");
    $("#tab-jrnl").innerHTML = `<article class="panel"><div class="ph"><h2>JOURNAL DES TRADES</h2><span class="hint">${T.length} trade(s) clos · du plus récent au plus ancien</span></div>
      ${T.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Titre</th><th>Ouvert / clos</th><th>Entrée</th><th>Sortie</th><th>Montant</th><th>Frais</th><th>P&amp;L net</th><th style="text-align:left">Sortie</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : empty("Aucun trade clos pour l'instant", "Le premier trade apparaîtra ici avec son entrée, sa sortie, les frais payés et le résultat net.")}</article>`;
  }

  const ST = { open: "OUVERTE", pre: "AVANT OUVERTURE", post: "CLÔTURÉE", closed: "FERMÉE" };
  function renderMarket() {
    const S = D.sessions, X = (D.mood.x || {}).market || {}, N = D.mood.news || {};
    const ses = ["EU", "US", "CRYPTO"].map(m => { const s = S[m] || {}; const lab = m === "EU" ? "Europe" : m === "US" ? "États-Unis" : "Crypto (7j/7)"; return `<div class="ses"><div class="st ${esc(s.state)}">● ${ST[s.state] || "—"}</div>
      <div class="hr">${lab}</div>
      <div class="meta">${s.open ? `séance ${esc(s.open)} – ${esc(s.close)}` : "pas de séance aujourd'hui"}${s.state !== "open" && s.next_open ? `<br>prochaine ouverture : ${esc(dhm(s.next_open))}` : ""}</div></div>`; }).join("");
    const idx = (D.indices || []).map(i => `<div class="ix"><span>${esc(i.n)}</span><b>${i.p == null ? "—" : nf(i.p, 2)}</b><em class="${cls(i.c)}" style="font:600 12px var(--mono);font-style:normal">${sg(i.c, 2, " %")}</em></div>`).join("");
    const g = (v, lo = -1, hi = 1) => `<div class="gauge"><i style="left:${Math.max(2, Math.min(98, (v - lo) / (hi - lo) * 100))}%"></i></div>`;
    const lab = v => v == null ? "—" : v <= -0.3 ? "négative" : v < -0.05 ? "plutôt négative" : v <= 0.05 ? "neutre" : v < 0.3 ? "plutôt positive" : "positive";
    const xm = ["US", "EU"].map(m => X[m] ? `<div style="margin-top:12px"><h3>${m === "US" ? "États-Unis" : "Europe"} · <span class="${cls(X[m].score)}">${lab(X[m].score)} (${sg(X[m].score, 1)})</span></h3>${g(X[m].score)}<div class="note" style="margin-top:6px">${esc(X[m].summary_fr)}</div></div>` : "").join("");
    const posts = ((D.mood.x || {}).posts || []).map(p => `<li><span class="dot" style="background:${p.stance === "neg" ? "var(--dn)" : p.stance === "pos" ? "var(--up)" : "var(--amb)"}"></span><div><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.text)}</a><span class="meta">${esc(p.author)} · ${esc(p.s)}</span></div></li>`).join("");
    const heads = (N.headlines || []).map(h => `<li><span class="dot" style="background:${h.sent > 0 ? "var(--up)" : h.sent < 0 ? "var(--dn)" : "var(--dim)"}"></span><div><a href="${esc(h.link)}" target="_blank" rel="noopener">${esc(h.title)}</a><span class="meta">${esc(h.s)} · il y a ${h.age_h < 1 ? Math.max(1, Math.round(h.age_h * 60)) + " min" : nf(h.age_h, 0) + " h"}</span></div></li>`).join("");
    $("#tab-mkt").innerHTML = `
      <article class="panel"><div class="ph"><h2>SÉANCES</h2><span class="hint">heure de Paris</span></div><div class="sess">${ses}</div></article>
      <article class="panel"><div class="ph"><h2>INDICES &amp; RÉFÉRENCES</h2><span class="hint">variation du jour</span></div><div class="idx">${idx}</div></article>
      <div class="grid2">
        <article class="panel"><div class="ph"><h2>AMBIANCE SUR X</h2><span class="hint">màj ${esc(dhm((D.mood.x || {}).updated_at))}</span></div>${xm || empty("Pas de lecture X récente", "")}
          ${posts ? `<ul class="news" style="margin-top:10px">${posts}</ul>` : ""}<div class="note">${esc((D.mood.x || {}).source || "")}</div></article>
        <article class="panel"><div class="ph"><h2>FIL D'ACTUALITÉ</h2><span class="hint">${N.n || 0} titres analysés · ambiance ${lab(N.avg)}</span></div>${N.avg != null ? g(N.avg, -0.5, 0.5) : ""}
          <ul class="news">${heads || "<li class='mut'>Aucune actualité en cache.</li>"}</ul></article>
      </div>`;
  }

  function renderTeam() {
    const r = D.rules || {}, c = D.costs || {}, w = D.weights || {};
    const ag = [
      ["TEC", "Analyste technique", `Barres 5 min : VWAP, EMA 9/21, EMA 20 (15 min), ATR, volume relatif. Cherche une cassure du range d'ouverture avec volume ou un rebond sur VWAP/EMA21. Poids ${Math.round((w.technical || .5) * 100)} %.`],
      ["NWS", "Analyste news", `Lit Google News (EN/FR) et Yahoo Finance sur 24 h et note le ton. Poids ${Math.round((w.news || .15) * 100)} %.`],
      ["X", "Analyste X", `Suit les comptes crédibles (Reuters, Bloomberg, CNBC, WSJ…) sur le titre et le marché. Poids ${Math.round((w.x || .15) * 100)} %.`],
      ["FND", "Analyste fondamental", `Consensus des analystes, objectif de cours, PER et date des résultats. Poids ${Math.round((w.fundamentals || .2) * 100)} %.`],
      ["RSK", "Responsable du risque", `Droit de veto : score global ≥ ${D.min_score || 62}, indice au-dessus de son VWAP, pas de résultats imminents, objectif ≥ 3× les frais, perte du jour limitée, taille de position.`],
      ["TRD", "Trader", "Exécute les ordres fictifs au dernier cours avec frais et glissement. Sortie en deux temps : vente de 50 % à 1R (TP1), stop de la moitié restante à l'entrée + 0,3R, puis TP2 à 2,5R ou sortie si une barre 5 min clôture sous le VWAP. Si les frais du TP1 mangent le gain, sortie unique à 2R. Clôture tout 10 min avant la fin de séance."],
    ].map(([i, n, d]) => `<div class="agent"><div class="ic">${i}</div><div><h3>${n}</h3><p>${d}</p></div></div>`).join("");
    const rules = [
      [`${nf(r.max_position_pct, 0)} %`, "du capital maximum par position (≈ " + nf((D.capital.equity || 1000) * (r.max_position_pct || 35) / 100, 0) + " €)"],
      [`${r.max_open_positions || 2}`, `positions ouvertes au maximum, ${r.max_open_positions_if_protected || 3} quand toutes les positions ouvertes ont leur stop au prix d'entrée`],
      [`${nf(r.risk_per_trade_pct, 1)} %`, "du capital risqué par trade (stop = 1,5 × ATR)"],
      [`TP1 ${nf(r.tp1_r != null ? r.tp1_r : 1, 1)}R`, "vente de " + nf((r.partial_fraction != null ? r.partial_fraction : 0.5) * 100, 0) + " % de la position (US et Europe)"],
      [`TP2 ${nf(r.tp2_r != null ? r.tp2_r : 2.5, 1)}R`, "moitié restante, ou sortie si une barre 5 min clôture sous le VWAP ; stop remonte à l'entrée + " + nf(r.runner_stop_r != null ? r.runner_stop_r : 0.3, 1) + "R (si les frais du TP1 sont trop élevés : sortie unique à 2R)"],
      [`−${nf(r.daily_loss_limit_pct, 0)} %`, "perte du jour : plus aucune entrée"],
      ["0", "position gardée la nuit (day trading strict)"],
    ].map(([b, s]) => `<div class="rule"><b>${b}</b><span>${s}</span></div>`).join("");
    const fee = m => { const x = c[m]; if (!x) return ""; const e = (x.examples || []).find(z => z.pct === 35) || (x.examples || [])[0] || {};
      return `<div class="rule"><b>${m === "US" ? "Actions US" : "Actions Europe"}</b><span>${esc(x.desc)}. Aller-retour sur ${eur(e.notional, 0)} : <b style="display:inline;font-size:13px">${eur(e.rt_eur)}</b> (${nf(e.rt_pct, 2)} %), glissement ${nf(x.slippage_pct_per_side, 2)} % par côté.</span></div>`; };
    $("#tab-team").innerHTML = `
      <article class="panel"><div class="ph"><h2>L'ÉQUIPE</h2><span class="hint">six agents, décisions mécaniques</span></div><div class="agents">${ag}</div></article>
      <article class="panel"><div class="ph"><h2>RÈGLES DU RISQUE</h2><span class="hint">appliquées sans exception</span></div><div class="rules">${rules}</div></article>
      <article class="panel"><div class="ph"><h2>FRAIS SIMULÉS</h2><span class="hint">${esc(D.broker || "")}</span></div><div class="grid2">${fee("US")}${fee("EU")}</div>
        <div class="note">${(D.sizing_reco || []).map(esc).join("<br>")}</div></article>`;
  }



  function gridOf(sym) {
    return ((D && D.crypto && D.crypto.grids && D.crypto.grids.items) || []).find(g => g.symbol === sym);
  }
  function gridsHtml(C) {
    const G = C.grids || {};
    const items = G.items || [];
    if (!G.enabled && !items.length) return "";
    const stLab = { running: "EN COURS", paused: "PAUSE", stopped: "STOP" };
    const rgLab = { range: "dans la fourchette", healthy_pullback: "repli sain", real_downtrend: "tendance baissière", rebound: "rebond confirmé" };
    const cards = items.map(g => {
      const st = g.status || "running";
      const rg = g.regime || "";
      const rgTxt = g.regime_label || rgLab[rg] || "";
      return `<button type="button" class="grid-card" data-grid="${esc(g.symbol)}">
        <div class="grid-card-h"><span class="sym">${esc(g.symbol)}${mk("CRYPTO")}</span>
          <span class="grid-flag ${esc(st)}">${esc(stLab[st] || st)}</span></div>
        ${rgTxt ? `<div class="grid-reg"><span class="grid-flag regime-${esc(rg)}">${esc(rgTxt)}</span></div>` : ""}
        <div class="grid-meta">${esc(g.name || "")} · budget ${eur(g.capital_eur, 0)} · ${g.n_levels || 0} niveaux · pas ${nf(g.step_pct, 2)} %${g.avg_entry ? " · px moyen " + px(g.avg_entry, "CRYPTO") : ""}</div>
        <div class="grid-row">
          <div class="grid-px">${g.last != null ? px(g.last, "CRYPTO") : "—"}</div>
          <div class="live-pnl ${cls(g.pnl_eur)}">${sg(g.pnl_eur, 2, " €")}<small>${sg(g.pnl_pct, 2, " %")} · réalisé ${sg(g.realized_pnl_eur, 2, " €")}</small></div>
        </div>
        <div class="grid-lvls">
          <span>Bas <b>${px(g.lower, "CRYPTO")}</b></span>
          <span>Haut <b>${px(g.upper, "CRYPTO")}</b></span>
          <span>Stock <b>${g.n_lots || 0}</b> lot${(g.n_lots||0)>1?"s":""} · ${eur(g.inventory_cost_eur, 0)}</span>
          ${(g.locked_eur||0)>0 ? `<span>Verrouillé <b>${eur(g.locked_eur)}</b></span>` : ""}
        </div>
        <div class="grid-decision">${g.last_decision ? `<b>${esc(g.last_decision)}</b> · ${esc(dhm(g.last_decision_at))} — ${esc(g.pause_reason || (G.events||[]).find(e => e.symbol===g.symbol && e.action===g.last_decision)?.reason || "toucher pour le graphique")}` : "Toucher pour le graphique des niveaux"}</div>
      </button>`;
    }).join("");
    const ev = (G.events || []).filter(e => e.action !== "buy" && e.action !== "sell").slice(0, 12);
    const evHtml = ev.length ? `<ul class="grid-events">${ev.map(e => `<li><small>${esc(dhm(e.ts))} · ${esc(e.symbol)}</small><span class="act">${esc((e.action||"").toUpperCase())}</span>${esc(e.reason || "")}</li>`).join("")}</ul>` : `<div class="empty">Le surveillant n'a pas encore pris de décision.</div>`;
    const rules = (G.rules && G.rules.text) || "";
    return `
      <article class="panel"><div class="ph"><h2>GRILLES + SURVEILLANT</h2><span class="hint">4 paires · 250 € chacune · liquidités partagées avec le day trading · toucher pour le graphique</span></div>
        ${items.length ? `<div class="grid-cards" id="grid-cards">${cards}</div>` : empty("Grilles en cours d'initialisation", "Le moteur calcule une fourchette sur la volatilité 1 h au prochain cycle.")}
        ${rules ? `<div class="note">${esc(rules)}</div>` : ""}
      </article>
      <article class="panel"><div class="ph"><h2>DÉCISIONS DU SURVEILLANT</h2><span class="hint">régime, descente, pause, rebond, stop, gains verrouillés</span></div>
        ${evHtml}</article>`;
  }

  function renderCrypto() {
    const C = D.crypto || {};
    const box = $("#tab-crypto");
    if (!box) return;
    if (!C.enabled && C.enabled !== undefined && !C.start) {
      box.innerHTML = `<article class="panel">${empty("Portefeuille crypto inactif", "Le carnet papier crypto n'est pas encore initialisé.")}</article>`;
      return;
    }
    const r = C.rules || {}, P = C.positions || [], T = C.trades || [], s = C.stats || {}, ses = C.session || {};

    const trows = T.slice().reverse().map(t => `<tr><td class="sym">${esc(t.symbol)}${mk("CRYPTO")}<small>${esc(t.name || "")} · ${esc(t.setup || "")}</small></td>
      <td>${dhm(t.opened_at)}<br><small class="mut">→ ${hm(t.closed_at)}</small></td><td>${px(t.entry_raw, "CRYPTO")}</td><td>${px(t.exit_raw, "CRYPTO")}</td>
      <td>${eur(t.notional_eur, 0)}</td><td>${eur(t.costs_eur)}</td><td class="${cls(t.pnl_eur)}">${sg(t.pnl_eur, 2, " €")}<br><small>${sg(t.pnl_pct, 2, " %")}</small></td>
      <td style="text-align:left;color:var(--mut)">${esc(exitLab(t))}</td></tr>`).join("");
    const start = C.start || 1000;
    const curvePts = (C.curve || []).map(([ts, v]) => [Date.parse(ts), (v / start - 1) * 100]);
    const btcPct = (C.bench && C.bench.since_start_pct != null) ? C.bench.since_start_pct : null;
    const chartHtml = (function () {
      const W = 640, H = 200, L = 8, R = 52, T = 10, B = 22;
      if (curvePts.length < 2) return `<div class="empty">La courbe apparaîtra après les premiers cycles crypto.</div>`;
      const btcPts = btcPct == null ? [] : curvePts.map((p, i) => [p[0], i === curvePts.length - 1 ? btcPct : null]).filter(p => p[1] != null);
      // simple last-point overlay only if we don't have a full BTC series; still draw portfolio path
      let x0 = Math.min(...curvePts.map(p => p[0])), x1 = Math.max(...curvePts.map(p => p[0]));
      let ys = curvePts.map(p => p[1]); if (btcPct != null) ys.push(btcPct);
      let y0 = Math.min(0, ...ys), y1 = Math.max(0, ...ys);
      const pad = Math.max(0.15, (y1 - y0) * 0.12); y0 -= pad; y1 += pad; if (x1 === x0) x1 = x0 + 1;
      const X = t => L + (t - x0) / (x1 - x0) * (W - L - R), Y = v => T + (y1 - v) / (y1 - y0) * (H - T - B);
      const path = pts => pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join("");
      let g = "";
      for (let i = 0; i <= 4; i++) { const v = y0 + (y1 - y0) * i / 4; g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${W - R + 6}" y="${Y(v) + 3}">${sg(v, 2, "%")}</text>`; }
      const area = curvePts.length > 1 ? path(curvePts) + `L${X(curvePts[curvePts.length - 1][0])},${Y(0)}L${X(curvePts[0][0])},${Y(0)}Z` : "";
      const btcLine = btcPct == null ? "" : `<line x1="${L}" x2="${W - R}" y1="${Y(btcPct)}" y2="${Y(btcPct)}" stroke="#5aa9ff" stroke-dasharray="4 3" stroke-width="1.5"/><text x="${L + 4}" y="${Y(btcPct) - 4}" fill="#5aa9ff" style="font:500 10px var(--mono)">BTC ${sg(btcPct, 2, " %")}</text>`;
      return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><g class="grid">${g}</g><line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#3a3f4b"/>
        <path d="${area}" fill="url(#ga)"/>${btcLine}<path d="${path(curvePts)}" fill="none" stroke="#ffb000" stroke-width="2.4" stroke-linejoin="round"/>
        ${curvePts.length ? `<circle cx="${X(curvePts[curvePts.length - 1][0])}" cy="${Y(curvePts[curvePts.length - 1][1])}" r="4" fill="#ffb000"/>` : ""}</svg>`;
    })();
    const last = curvePts.length ? curvePts[curvePts.length - 1][1] : null;
    const scan = (C.scan && C.scan.top) || [];
    const scanRows = scan.map(r => `<tr><td class="sym">${esc(r.symbol)}<small>${esc(r.name || "")}</small></td><td>${px(r.price, "CRYPTO")}</td><td>${nf(r.tech, 0)}</td><td>${esc(r.setup || "—")}</td></tr>`).join("");
    const dec = (C.scan && C.scan.decisions) || [];
    const decCards = dec.map(d => `<div class="sig"><div class="sig-h"><div><span class="sym">${esc(d.symbol)}</span>${mk("CRYPTO")} <span class="meta">${esc(d.setup || "")}</span></div>
      <span class="verdict ${esc(d.decision)}">${d.decision === "ACHAT" ? "ACHAT" : "VETO RISQUE"}</span></div>
      <div class="scores">${sc("Technique", (d.tech && d.tech.score) != null ? d.tech.score : d.composite, 1)}</div>
      <ul class="reasons ${d.decision === "ACHAT" ? "ok" : ""}">${(d.reasons || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      ${d.entry ? `<div class="meta" style="margin-top:6px">Plan : entrée ${px(d.entry, "CRYPTO")} · stop ${px(d.stop, "CRYPTO")} · ${d.tp1 != null ? `TP1 ${px(d.tp1, "CRYPTO")} (50 %) · TP2 ${px(d.tp2, "CRYPTO")}` : `objectif ${px(d.target, "CRYPTO")}`}</div>` : ""}
    </div>`).join("");
    box.innerHTML = `
      ${gridsHtml(C)}
      <section class="hero" style="margin-bottom:16px">
        <article class="panel capital">
          <div class="cap-l">CAPITAL CRYPTO · PAPIER SÉPARÉ · ${esc(C.broker || r.broker || "OKX Europe (simulation papier)")}</div>
          <div class="cap-v num">${nf(C.equity)}<small>€</small></div>
          <div class="cap-pl ${cls(C.pnl_total)}">${sg(C.pnl_total, 2, " €")} · ${sg(C.pnl_total_pct, 2, " %")}</div>
          <div class="cap-base">départ ${eur(start, 0)} · lancé le ${esc(dhm(C.created_at))} · séance ${esc(ses.open || "00:30")}–${esc(ses.close || "23:50")} · ${esc((ST[ses.state] || ses.state || "—"))}</div>
          <div class="kpis">
            <div class="kpi"><span>P&amp;L du jour</span><b class="${cls(C.pnl_day)}">${sg(C.pnl_day, 2, " €")}</b></div>
            <div class="kpi"><span>Frais</span><b>${eur(C.fees)}</b></div>
            <div class="kpi"><span>Liquidités</span><b>${eur(C.cash, 0)}</b></div>
            <div class="kpi"><span>Trades clos</span><b>${s.n || 0}</b></div>
            <div class="kpi"><span>Réussite</span><b>${s.win_rate == null ? "—" : nf(s.win_rate, 0) + " %"}</b></div>
            <div class="kpi"><span>Bitcoin</span><b class="${cls(C.bench && C.bench.since_start_pct)}">${C.bench && C.bench.since_start_pct != null ? sg(C.bench.since_start_pct, 2, " %") : "—"}</b></div>
          </div>
          <div class="note">Carnet fictif distinct des actions (1 000 €), modèle ${esc(C.broker || r.broker || "OKX Europe (simulation papier)")}. ${(C.universe && C.universe.length) ? (C.universe.length + " cryptos suivies : " + C.universe.map(u => u.name || u.symbol).join(", ")) : "Liste de cryptos liquides"} · day trading 7j/7, clôture forcée à 23h50 heure de Paris. Achat uniquement.</div>
        </article>
        <article class="panel curve">
          <div class="ph"><h2>COURBE CRYPTO</h2><span class="hint">vs Bitcoin buy &amp; hold · % depuis le lancement</span></div>
          <div class="chart" style="min-height:200px">${chartHtml}</div>
          <div class="legend"><span><i style="background:#ffb000"></i>Portefeuille crypto<b class="${cls(last)}">${last == null ? "—" : sg(last, 2, " %")}</b></span>
            <span><i style="background:#5aa9ff"></i>Bitcoin (buy &amp; hold)<b class="${cls(btcPct)}">${btcPct == null ? "—" : sg(btcPct, 2, " %")}</b></span></div>
        </article>
      </section>
      <article class="panel"><div class="ph"><h2>POSITIONS CRYPTO</h2><span class="hint">${P.length} / ${r.max_open_positions || 2} max · TP1 50 % à 1R, TP2 2,5R ou VWAP 00h00 · flatten 23h50 · toucher une carte pour le graphique</span></div>
        ${P.length ? `<div id="live-cards-crypto" class="live-cards"></div>`
          : empty("Aucune position crypto ouverte", "Le bot n'entre qu'entre 00h30 et 23h20, si le setup technique et le risque sont validés. Tout est fermé à 23h50.")}</article>
      <div class="grid2">
        <article class="panel"><div class="ph"><h2>DERNIERS SETUPS</h2><span class="hint">cycle ${esc(hm((C.scan && C.scan.ts) || C.last_cycle && C.last_cycle.ts))}</span></div>
          ${decCards || (scanRows ? `<div class="scroll"><table class="tbl"><thead><tr><th>Titre</th><th>Cours</th><th>Tech</th><th>Setup</th></tr></thead><tbody>${scanRows}</tbody></table></div>` : empty("Pas encore de setup", "Les cycles tournent toutes les 5 minutes pendant la séance crypto."))}</article>
        <article class="panel"><div class="ph"><h2>RÈGLES CRYPTO</h2><span class="hint">${esc(C.broker || r.broker || "OKX Europe (simulation papier)")} · carnet à part des actions IBKR</span></div>
          <div class="rules">${[r.exits, r.fees_desc, `Risque ${r.risk_per_trade_pct || 1.5} % par trade · plafond ${r.max_position_pct || 35} % · max ${r.max_open_positions || 2} positions · stop journalier −${r.daily_loss_limit_pct || 3} % · pas d'entrée après ${r.no_entry_after || "23:20"} ni avant ${r.open || "00:30"}.`].filter(Boolean).map(x => `<p>${esc(x)}</p>`).join("")}</div></article>
      </div>
      <article class="panel"><div class="ph"><h2>JOURNAL CRYPTO</h2><span class="hint">${T.length} trade(s) clos</span></div>
        ${T.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Titre</th><th>Ouvert / clos</th><th>Entrée</th><th>Sortie</th><th>Montant</th><th>Frais</th><th>P&amp;L net</th><th style="text-align:left">Sortie</th></tr></thead><tbody>${trows}</tbody></table></div>`
          : empty("Aucun trade crypto clos", "Les sorties (TP1, TP2, stop, VWAP, 23h50) apparaîtront ici, avec les frais OKX Europe.")}</article>`;
    document.querySelectorAll("#tab-crypto [data-grid]").forEach(el => {
      el.addEventListener("click", () => openGridChart(el.dataset.grid));
    });
  }


  /* ---------- suivi live des positions + graphique ---------- */
  const LIVE_RAW = "https://raw.githubusercontent.com/aronsonkyllian-ux/nexus-bourse/live/data/live.json";
  const LIVE_EVERY_MS = 4000;
  let liveTimer = null, liveFeed = null, chartSym = null, chartApi = null, candleSeries = null, chartBars = [];

  function allPositions() {
    const out = [];
    for (const p of (D && D.positions) || []) out.push(p);
    for (const p of (D && D.crypto && D.crypto.positions) || []) out.push(Object.assign({}, p, { market: p.market || "CRYPTO" }));
    return out;
  }
  function pairOf(sym) {
    const m = (D && D.crypto_pairs) || {};
    return m[sym] || { binance: String(sym).replace("-USD", "USDT"), okx: String(sym).replace("-USD", "-USDT") };
  }
  function sellCommission(p, shares, price) {
    const f = p.fees || (D && D.fees_live && D.fees_live[p.market]) || {};
    const value = shares * price, m = p.market;
    if (m === "US") {
      let c = Math.max(f.min_per_order || 0, shares * (f.commission_per_share || 0));
      c = Math.min(c, value * (f.max_pct_of_value || 100) / 100);
      c += c * (f.pass_through_pct_of_commission || 0) / 100;
      c += shares * (f.third_party_per_share || 0);
      c += value * (f.sec_fee_rate_on_sales || 0);
      return c;
    }
    if (m === "CRYPTO") return Math.max(f.min_per_order || 0, value * (f.pct_of_value || 0.20) / 100);
    let c = Math.max(f.min_per_order || 0, value * (f.pct_of_value || 0) / 100);
    if (f.max_per_order) c = Math.min(c, f.max_per_order);
    return c + (f.third_party_per_order || 0);
  }
  function markLive(p, price, fx) {
    const shares = Math.abs(p.shares || 0);
    const fxi = fx || p.fx || (p.market === "EU" ? 1 : ((D && D.capital && D.capital.fx_eurusd) || 1.08));
    const gross = shares * price / fxi;
    const val = gross * (1 - (p.cost_side || 0)) - sellCommission(p, shares, price) / fxi;
    const pnl = val - (p.notional_eur || 0) - (p.entry_cost_eur || 0);
    const den = (p.notional_eur || 0) + (p.entry_cost_eur || 0);
    return { price, fx: fxi, val, pnl, pct: den ? pnl / den * 100 : 0 };
  }
  function progOf(p, price) {
    const a = Number(p.stop), b = Number(p.tp2 != null ? p.tp2 : p.target);
    if (!isFinite(a) || !isFinite(b) || a === b) return 0.5;
    return Math.max(0, Math.min(1, (price - a) / (b - a)));
  }
  function tickPct(p, level) {
    const a = Number(p.stop), b = Number(p.tp2 != null ? p.tp2 : p.target);
    if (!isFinite(a) || !isFinite(b) || a === b) return 0.5;
    return Math.max(0, Math.min(1, (level - a) / (b - a)));
  }
  function distPct(price, level) {
    if (price == null || level == null || !price) return null;
    return (level - price) / price * 100;
  }
  function liveFresh() {
    if (!liveFeed || !liveFeed.ts) return false;
    const age = Date.now() - Date.parse(liveFeed.ts);
    return isFinite(age) && age < 180 * 1000;
  }
  function liveLabel(src, delay, market) {
    if (src === "ticker") return { cls: "live", text: "LIVE" };
    if (src === "yahoo" || src === "klines") {
      if (market === "EU" || delay) return { cls: "delayed", text: "LIVE · retard ~" + (delay || 15) + " min" };
      return { cls: "live", text: "LIVE" };
    }
    return { cls: "deferred", text: "DIFFÉRÉ" };
  }
  function mergeLive(p) {
    const q = liveFeed && liveFeed.quotes && liveFeed.quotes[p.symbol];
    const mkrow = liveFeed && (liveFeed.marks || []).find(x => x.symbol === p.symbol);
    const fx = (q && q.fx) || (mkrow && mkrow.fx) || p.fx || (D && D.capital && D.capital.fx_eurusd);
    let price, src = "snapshot", delay = p.market === "EU" ? 15 : 0;
    if (p._tick != null) { price = p._tick; src = "ticker"; delay = 0; }
    else if (q && q.price != null && liveFresh()) { price = q.price; src = q.src || "yahoo"; delay = q.delay_min; }
    else if (mkrow && mkrow.price != null && liveFresh()) { price = mkrow.price; src = mkrow.src; delay = mkrow.delay_min; }
    else { price = p.last; src = "snapshot"; }
    let m;
    if (p.entry_cost_eur != null && p.shares) m = markLive(p, price, fx);
    else if (mkrow && liveFresh() && p._tick == null) m = { price, pnl: mkrow.pnl_eur, pct: mkrow.pnl_pct, val: mkrow.value_eur, fx };
    else m = { price, pnl: p.pnl_eur, pct: p.pnl_pct, val: null, fx };
    m.src = src; m.delay_min = delay;
    return m;
  }
  function cardHtml(p, m) {
    const price = m.price, lab = liveLabel(m.src, m.delay_min, p.market);
    const dStop = distPct(price, p.stop), d1 = distPct(price, p.tp1), d2 = distPct(price, p.tp2 != null ? p.tp2 : p.target);
    const pr = progOf(p, price) * 100, t1 = p.tp1 != null ? tickPct(p, p.tp1) * 100 : null;
    const book = p.market === "CRYPTO" ? "crypto" : "stocks";
    return `<button type="button" class="live-card" data-sym="${esc(p.symbol)}" data-book="${book}">
      <div class="live-card-h"><span class="sym">${esc(p.symbol)}${mk(p.market)}</span>
        <span class="live-flag ${lab.cls}">${esc(lab.text)}</span></div>
      <div class="live-name">${esc(p.name || "")} · ${esc(p.setup || "")} · ${hm(p.opened_at)}${p.exit_status ? " · " + esc(p.exit_status) : ""}</div>
      <div class="live-row">
        <div class="live-px">${px(price, p.market)}</div>
        <div class="live-pnl ${cls(m.pnl)}">${sg(m.pnl, 2, " €")}<small>${sg(m.pct, 2, " %")}</small></div>
      </div>
      <div class="live-lvls">
        <span>SL <b>${px(p.stop, p.market)}</b> <small>${sg(dStop, 2, " %")}</small></span>
        ${p.use_partial && p.tp1 != null ? `<span>TP1 <b>${px(p.tp1, p.market)}</b> <small>${sg(d1, 2, " %")}</small></span>` : ""}
        <span>TP2 <b>${px(p.tp2 != null ? p.tp2 : p.target, p.market)}</b> <small>${sg(d2, 2, " %")}</small></span>
      </div>
      <div class="live-prog" aria-hidden="true"><i class="fill" style="width:${pr}%"></i>
        ${t1 != null ? `<b class="tick" style="left:${t1}%"></b>` : ""}
        <em class="knob" style="left:${pr}%"></em></div>
      <div class="live-hint">Toucher pour le graphique · 5 min</div>
    </button>`;
  }
  function bindCards(root) {
    if (!root) return;
    root.querySelectorAll(".live-card").forEach(el => el.addEventListener("click", () => openPosChart(el.dataset.sym)));
  }
  function paintLive() {
    const list = allPositions();
    const blot = $("#live-blotter");
    if (blot) {
      if (!list.length) { blot.hidden = true; blot.innerHTML = ""; }
      else {
        blot.hidden = false;
        blot.innerHTML = `<div class="live-blotter-h"><span>POSITIONS EN DIRECT</span><span class="mut">${list.length} ouverte${list.length > 1 ? "s" : ""} · toucher pour le graphique</span></div><div class="live-cards">${list.map(p => cardHtml(p, mergeLive(p))).join("")}</div>`;
        bindCards(blot);
      }
    }
    const port = $("#live-cards-port");
    if (port) { const stocks = list.filter(p => p.market !== "CRYPTO"); port.innerHTML = stocks.map(p => cardHtml(p, mergeLive(p))).join(""); bindCards(port); }
    const cry = $("#live-cards-crypto");
    if (cry) { const cs = list.filter(p => p.market === "CRYPTO"); cry.innerHTML = cs.map(p => cardHtml(p, mergeLive(p))).join(""); bindCards(cry); }
    if (chartSym) refreshOpenChart();
  }
  async function fetchTickers(list) {
    const cryptos = list.filter(p => p.market === "CRYPTO");
    await Promise.all(cryptos.map(async p => {
      const pair = pairOf(p.symbol);
      try {
        const r = await fetch("https://www.okx.com/api/v5/market/ticker?instId=" + encodeURIComponent(pair.okx), { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          const last = j && j.data && j.data[0] && parseFloat(j.data[0].last);
          if (last > 0) { p._tick = last; return; }
        }
      } catch (e) {}
      try {
        const r = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=" + encodeURIComponent(pair.binance), { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          const last = parseFloat(j.price);
          if (last > 0) p._tick = last;
        }
      } catch (e) {}
    }));
  }
  async function fetchLiveJson() {
    const url = ((D && D.live && D.live.url) || LIVE_RAW) + "?t=" + Date.now();
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    liveFeed = await r.json();
  }
  async function tickLive() {
    if (document.hidden || !D) return;
    const list = allPositions();
    if (!list.length) { stopLiveTimer(); paintLive(); return; }
    const tasks = [];
    if (list.some(p => p.market === "CRYPTO")) tasks.push(fetchTickers(list));
    if (list.some(p => p.market !== "CRYPTO") || chartSym) tasks.push(fetchLiveJson().catch(() => {}));
    await Promise.all(tasks);
    paintLive();
  }
  function startLiveTimer() {
    if (liveTimer) return;
    tickLive();
    liveTimer = setInterval(tickLive, LIVE_EVERY_MS);
  }
  function stopLiveTimer() { if (liveTimer) { clearInterval(liveTimer); liveTimer = null; } }
  function syncLiveTimer() {
    if (!document.hidden && allPositions().length) startLiveTimer();
    else if (!chartSym) stopLiveTimer();
  }

  function parisMidnightMs(now) {
    now = now || new Date();
    const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const p = Object.fromEntries(fmt.formatToParts(now).filter(x => x.type !== "literal").map(x => [x.type, x.value]));
    const elapsed = ((+p.hour) * 3600 + (+p.minute) * 60 + (+p.second)) * 1000 + now.getMilliseconds();
    return now.getTime() - elapsed;
  }
  async function loadCryptoBars(p) {
    const pair = pairOf(p.symbol);
    const start = parisMidnightMs();
    try {
      const r = await fetch("https://api.binance.com/api/v3/klines?symbol=" + encodeURIComponent(pair.binance) + "&interval=5m&startTime=" + start + "&limit=500", { cache: "no-store" });
      if (r.ok) {
        const raw = await r.json();
        if (Array.isArray(raw) && raw.length) {
          return raw.map(k => ({ time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
        }
      }
    } catch (e) {}
    try {
      const r = await fetch("https://www.okx.com/api/v5/market/candles?instId=" + encodeURIComponent(pair.okx) + "&bar=5m&limit=300", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        const raw = (j && j.data) || [];
        return raw.map(k => ({ time: Math.floor((+k[0]) / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4] }))
          .filter(b => b.time * 1000 >= start).sort((a, b) => a.time - b.time);
      }
    } catch (e) {}
    const ch = liveFeed && liveFeed.charts && liveFeed.charts[p.symbol];
    return (ch && ch.bars || []).map(b => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
  }
  function loadStockBars(p) {
    const ch = liveFeed && liveFeed.charts && liveFeed.charts[p.symbol];
    return (ch && ch.bars || []).map(b => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
  }
  function vwapFromBars(bars) {
    const ch = liveFeed && liveFeed.charts && chartSym && liveFeed.charts[chartSym];
    if (ch && ch.vwap) return ch.vwap;
    let num = 0, den = 0;
    for (const b of bars || []) {
      const typ = (b.high + b.low + b.close) / 3, v = b.volume || 1;
      num += typ * v; den += v;
    }
    return den ? num / den : null;
  }
  function applyLiveToLastBar(bars, price) {
    if (!bars || !bars.length || price == null) return bars;
    const last = Object.assign({}, bars[bars.length - 1]);
    last.close = price;
    last.high = Math.max(last.high, price);
    last.low = Math.min(last.low, price);
    return bars.slice(0, -1).concat([last]);
  }
  function priceLines(series, p) {
    const lines = [
      { price: p.entry, color: "#ffb000", title: "ENTRÉE", lineWidth: 2, lineStyle: 0 },
      { price: p.stop, color: "#ff4d5e", title: "SL", lineWidth: 2, lineStyle: 0 },
    ];
    if (p.use_partial && p.tp1 != null) lines.push({ price: p.tp1, color: "#21d07a", title: "TP1", lineWidth: 1, lineStyle: 2 });
    const tp2 = p.tp2 != null ? p.tp2 : p.target;
    if (tp2 != null) lines.push({ price: tp2, color: "#21d07a", title: "TP2", lineWidth: 2, lineStyle: 0 });
    const vwap = vwapFromBars(chartBars);
    if (vwap && !p._gridOnly) lines.push({ price: vwap, color: "#5aa9ff", title: "VWAP", lineWidth: 1, lineStyle: 2 });
    const g = p._grid || gridOf(p.symbol);
    if (g) {
      if (g.lower != null) lines.push({ price: g.lower, color: "#ff4d5e", title: "BAS", lineWidth: 1, lineStyle: 2 });
      if (g.upper != null) lines.push({ price: g.upper, color: "#21d07a", title: "HAUT", lineWidth: 1, lineStyle: 2 });
      (g.levels || []).forEach(lv => {
        const col = lv.kind === "held" ? "#ffb000" : lv.kind === "buy" ? "#5aa9ff" : "rgba(33,208,122,.45)";
        lines.push({ price: lv.price, color: col, title: "", lineWidth: 1, lineStyle: 3, axisLabelVisible: false });
      });
    }
    lines.forEach(l => { if (l.price != null) series.createPriceLine(l); });
  }
  function entryMarker(p, bars) {
    if (!p.opened_at || !bars || !bars.length) return [];
    let t = Math.floor(Date.parse(p.opened_at) / 1000);
    if (!isFinite(t)) return [];
    t = t - (t % 300);
    const first = bars[0].time, last = bars[bars.length - 1].time;
    if (t < first) t = first;
    if (t > last) t = last;
    const exact = bars.reduce((best, b) => Math.abs(b.time - t) < Math.abs(best - t) ? b.time : best, bars[0].time);
    return [{ time: exact, position: "belowBar", color: "#ffb000", shape: "arrowUp", text: "Achat" }];
  }
  function destroyChart() {
    if (chartApi) { try { chartApi.remove(); } catch (e) {} }
    chartApi = candleSeries = null;
    const el = $("#pos-chart-canvas");
    if (el) el.innerHTML = "";
  }
  function drawCanvasFallback(el, bars, p) {
    const wrap = el.getBoundingClientRect();
    const W = Math.max(320, Math.floor(wrap.width) || 360), H = Math.max(240, Math.floor(wrap.height) || 280);
    el.innerHTML = `<canvas width="${W}" height="${H}" style="width:100%;height:100%"></canvas>`;
    const c = el.querySelector("canvas").getContext("2d");
    c.fillStyle = "#0b0c10"; c.fillRect(0, 0, W, H);
    if (!bars.length) { c.fillStyle = "#8a909e"; c.font = "13px sans-serif"; c.fillText("Pas de barres 5 min pour le moment.", 16, 40); return; }
    const padL = 8, padR = 58, padT = 16, padB = 24;
    let lo = Math.min(...bars.map(b => b.low)), hi = Math.max(...bars.map(b => b.high));
    [p.entry, p.stop, p.tp1, p.tp2 || p.target, vwapFromBars(bars)].forEach(v => { if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    const span = (hi - lo) || 1; lo -= span * 0.04; hi += span * 0.04;
    const X = i => padL + i / Math.max(1, bars.length - 1) * (W - padL - padR);
    const Y = v => padT + (hi - v) / (hi - lo) * (H - padT - padB);
    const levels = [["#ffb000", p.entry, "ENTRÉE"], ["#ff4d5e", p.stop, "SL"], ["#21d07a", p.tp1, "TP1"], ["#21d07a", p.tp2 != null ? p.tp2 : p.target, "TP2"], ["#5aa9ff", vwapFromBars(bars), "VWAP"]];
    levels.forEach(([col, v, lab]) => {
      if (v == null) return;
      c.strokeStyle = col; c.globalAlpha = 0.9; c.setLineDash(lab === "VWAP" || lab === "TP1" ? [5, 4] : []);
      c.beginPath(); c.moveTo(padL, Y(v)); c.lineTo(W - padR, Y(v)); c.stroke(); c.setLineDash([]);
      c.globalAlpha = 1; c.fillStyle = col; c.font = "10px monospace"; c.fillText(lab, W - padR + 4, Y(v) + 3);
    });
    const w = Math.max(2, (W - padL - padR) / bars.length * 0.7);
    bars.forEach((b, i) => {
      const x = X(i), up = b.close >= b.open;
      c.strokeStyle = c.fillStyle = up ? "#21d07a" : "#ff4d5e";
      c.beginPath(); c.moveTo(x, Y(b.high)); c.lineTo(x, Y(b.low)); c.stroke();
      const y1 = Y(Math.max(b.open, b.close)), y2 = Y(Math.min(b.open, b.close));
      c.fillRect(x - w / 2, y1, w, Math.max(1, y2 - y1));
    });
  }
  function renderChartLib(el, bars, p) {
    destroyChart();
    const LW = window.LightweightCharts;
    if (!LW || !bars.length) { drawCanvasFallback(el, bars, p); return; }
    chartApi = LW.createChart(el, {
      layout: { background: { color: "#0b0c10" }, textColor: "#8a909e", fontFamily: "IBM Plex Mono, ui-monospace, monospace" },
      grid: { vertLines: { color: "#161a23" }, horzLines: { color: "#161a23" } },
      rightPriceScale: { borderColor: "#2a3140" },
      timeScale: { borderColor: "#2a3140", timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: "#ffb000", width: 1, style: 2, labelBackgroundColor: "#ffb000" },
                   horzLine: { color: "#ffb000", width: 1, style: 2, labelBackgroundColor: "#ffb000" } },
      localization: { locale: "fr-FR",
        timeFormatter: t => new Date(t * 1000).toLocaleTimeString("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) },
      handleScroll: { vertTouchDrag: false },
      width: el.clientWidth, height: el.clientHeight,
    });
    const rng = (function(){
      const vals = [];
      bars.forEach(b => { vals.push(b.high, b.low); });
      [p.entry, p.stop, p.tp1, p.tp2, p.target].forEach(v => { if (v != null && isFinite(+v)) vals.push(+v); });
      const g = p._grid || gridOf(p.symbol);
      if (g) { [g.lower, g.upper, g.last].forEach(v => { if (v != null && isFinite(+v)) vals.push(+v); });
        (g.levels || []).forEach(lv => { if (lv && lv.price != null) vals.push(+lv.price); }); }
      const vw = vwapFromBars(bars); if (vw != null) vals.push(vw);
      const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      const pad = (hi - lo) * 0.06 || Math.abs(lo) * 0.002;
      return { minValue: lo - pad, maxValue: hi + pad };
    })();
    candleSeries = chartApi.addCandlestickSeries({
      upColor: "#21d07a", downColor: "#ff4d5e", borderUpColor: "#21d07a", borderDownColor: "#ff4d5e",
      wickUpColor: "#21d07a", wickDownColor: "#ff4d5e",
      autoscaleInfoProvider: () => ({ priceRange: rng }),
    });
    candleSeries.setData(bars);
    priceLines(candleSeries, p);
    const mk = entryMarker(p, bars);
    if (mk.length) candleSeries.setMarkers(mk);
    chartApi.timeScale().fitContent();
    requestAnimationFrame(() => { if (chartApi) { chartApi.applyOptions({ width: el.clientWidth, height: el.clientHeight }); chartApi.timeScale().fitContent(); } });
  }

  async function openGridChart(sym) {
    const g = gridOf(sym);
    if (!g) return;
    const p = { symbol: g.symbol, name: g.name, market: "CRYPTO", entry: g.last, last: g.last,
      shares: 0, _grid: g, _gridOnly: true, setup: "grille", pnl_eur: g.pnl_eur, pnl_pct: g.pnl_pct,
      opened_at: g.opened_at };
    chartSym = "grid:" + sym;
    const box = $("#pos-chart");
    box.hidden = false;
    document.body.classList.add("chart-open");
    $("#pos-chart-title").textContent = g.symbol + (g.name ? " · " + g.name : "") + " · grille";
    const st = g.status === "running" ? "EN COURS" : g.status === "paused" ? "PAUSE" : "STOP";
    $("#pos-chart-sub").textContent = "bougies 5 minutes · " + st + " · pas " + nf(g.step_pct, 2) + " %";
    $("#pos-chart-px").innerHTML = `${g.last != null ? px(g.last, "CRYPTO") : "—"} <small class="${cls(g.pnl_eur)}">${sg(g.pnl_eur, 2, " €")} · ${sg(g.pnl_pct, 2, " %")}</small>`;
    $("#pos-chart-legend").innerHTML = `<span><i class="sl"></i>Bas ${px(g.lower, "CRYPTO")}</span><span><i class="tp"></i>Haut ${px(g.upper, "CRYPTO")}</span><span><i class="entry"></i>Stock ${g.n_lots || 0} lots</span><span><i class="vwap"></i>Niveaux d'achat / vente</span>`;
    const el = $("#pos-chart-canvas");
    el.innerHTML = `<div class="empty" style="padding:24px">Chargement du graphique…</div>`;
    chartBars = await loadCryptoBars(p);
    chartBars = applyLiveToLastBar(chartBars, g.last);
    renderChartLib(el, chartBars, p);
    startLiveTimer();
  }
  async function openPosChart(sym) {
    const p = allPositions().find(x => x.symbol === sym);
    if (!p) return;
    chartSym = sym;
    const box = $("#pos-chart");
    box.hidden = false;
    document.body.classList.add("chart-open");
    $("#pos-chart-title").textContent = p.symbol + (p.name ? " · " + p.name : "");
    const m = mergeLive(p);
    const lab = liveLabel(m.src, m.delay_min, p.market);
    $("#pos-chart-sub").textContent = "bougies 5 minutes · " + lab.text + (p.setup ? " · " + p.setup : "");
    $("#pos-chart-px").innerHTML = `${px(m.price, p.market)} <small class="${cls(m.pnl)}">${sg(m.pnl, 2, " €")} · ${sg(m.pct, 2, " %")}</small>`;
    $("#pos-chart-legend").innerHTML = `<span><i class="entry"></i>Entrée ${px(p.entry, p.market)}</span><span><i class="sl"></i>Stop ${px(p.stop, p.market)}</span>${p.tp1 != null ? `<span><i class="tp"></i>TP1 ${px(p.tp1, p.market)}</span>` : ""}<span><i class="tp"></i>TP2 ${px(p.tp2 != null ? p.tp2 : p.target, p.market)}</span><span><i class="vwap"></i>VWAP</span>`;
    const el = $("#pos-chart-canvas");
    el.innerHTML = `<div class="empty" style="padding:24px">Chargement du graphique…</div>`;
    if (p.market !== "CRYPTO") { try { await fetchLiveJson(); } catch (e) {} }
    chartBars = p.market === "CRYPTO" ? await loadCryptoBars(p) : loadStockBars(p);
    chartBars = applyLiveToLastBar(chartBars, m.price);
    renderChartLib(el, chartBars, p);
    startLiveTimer();
  }
  function refreshOpenChart() {
    if (chartSym && String(chartSym).startsWith("grid:")) {
      const g = gridOf(chartSym.slice(5));
      if (!g) { closePosChart(); return; }
      $("#pos-chart-px").innerHTML = `${g.last != null ? px(g.last, "CRYPTO") : "—"} <small class="${cls(g.pnl_eur)}">${sg(g.pnl_eur, 2, " €")} · ${sg(g.pnl_pct, 2, " %")}</small>`;
      if (chartBars.length && g.last != null) {
        chartBars = applyLiveToLastBar(chartBars, g.last);
        if (candleSeries) { try { candleSeries.update(chartBars[chartBars.length - 1]); } catch (e) {} }
      }
      return;
    }
    const p = allPositions().find(x => x.symbol === chartSym);
    if (!p) { closePosChart(); return; }
    const m = mergeLive(p);
    const lab = liveLabel(m.src, m.delay_min, p.market);
    $("#pos-chart-sub").textContent = "bougies 5 minutes · " + lab.text + (p.setup ? " · " + p.setup : "");
    $("#pos-chart-px").innerHTML = `${px(m.price, p.market)} <small class="${cls(m.pnl)}">${sg(m.pnl, 2, " €")} · ${sg(m.pct, 2, " %")}</small>`;
    if (!chartBars.length) return;
    chartBars = applyLiveToLastBar(chartBars, m.price);
    if (candleSeries) {
      const last = chartBars[chartBars.length - 1];
      try { candleSeries.update(last); } catch (e) {}
    } else {
      drawCanvasFallback($("#pos-chart-canvas"), chartBars, p);
    }
  }
  function closePosChart() {
    destroyChart();
    chartSym = null; chartBars = [];
    const box = $("#pos-chart");
    if (box) box.hidden = true;
    document.body.classList.remove("chart-open");
    syncLiveTimer();
  }
  const _closeBtn = $("#pos-chart-close");
  if (_closeBtn) _closeBtn.addEventListener("click", closePosChart);
  const _overlay = $("#pos-chart");
  if (_overlay) _overlay.addEventListener("click", e => { if (e.target === _overlay) closePosChart(); });
  addEventListener("keydown", e => { if (e.key === "Escape" && chartSym) closePosChart(); });
  addEventListener("resize", () => {
    if (chartApi && chartSym) {
      const el = $("#pos-chart-canvas");
      if (el) chartApi.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    }
  });

  function render() {
    renderTape(); renderStatus(); renderCapital(); renderChart(); renderPortfolio(); renderSignals(); renderJournal(); renderMarket(); renderTeam(); renderCrypto();
    paintLive(); syncLiveTimer();
  }

  async function load() {
    try {
      const r = await fetch("data/nexus.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      D = await r.json(); render();
    } catch (e) {
      if (!D) { $("#status").className = "pill off"; $("#status").querySelector("b").textContent = "données indisponibles"; }
    }
  }
  load(); setInterval(load, 60000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { load(); tickLive(); }
    else stopLiveTimer();
  });
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => D && renderChart(), 150); });
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();

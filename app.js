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
    const tgt = p => {
      if (p.use_partial && (p.tp1 != null || p.tp2 != null))
        return `${px(p.tp1, p.market)} / ${px(p.tp2, p.market)}<br><small>${p.tp1_done ? "TP1 fait · vers TP2" : "TP1 en attente"}</small>`;
      return px(p.target, p.market);
    };
    const rows = P.map(p => `<tr><td class="sym">${esc(p.symbol)}${mk(p.market)}<small>${esc(p.name)} · ${esc(p.setup || "")} · ${hm(p.opened_at)}${p.exit_status ? " · " + esc(p.exit_status) : ""}</small></td>
      <td>${px(p.entry, p.market)}</td><td>${px(p.last, p.market)}</td><td class="dn">${px(p.stop, p.market)}</td><td class="up">${tgt(p)}</td>
      <td>${eur(p.notional_eur, 0)}</td><td class="${cls(p.pnl_eur)}">${sg(p.pnl_eur, 2, " €")}<br><small>${sg(p.pnl_pct, 2, " %")}</small></td></tr>`).join("");
    const today = D.trades.filter(t => (t.closed_at || "").slice(0, 10) === (D.generated_at || "").slice(0, 10));
    $("#tab-port").innerHTML = `
      <article class="panel"><div class="ph"><h2>POSITIONS OUVERTES</h2><span class="hint">${P.length} / ${(r.max_open_positions_if_protected && P.length && P.every(p => p.stop >= p.entry)) ? r.max_open_positions_if_protected : (r.max_open_positions || 2)} max · TP1 50 % à 1R, TP2 à 2,5R ou VWAP · clôture forcée 10 min avant la fin de séance</span></div>
      ${P.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Titre</th><th>Entrée</th><th>Dernier</th><th>Stop</th><th>TP1 / TP2</th><th>Montant</th><th>P&amp;L</th></tr></thead><tbody>${rows}</tbody></table></div>`
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


  function renderCrypto() {
    const C = D.crypto || {};
    const box = $("#tab-crypto");
    if (!box) return;
    if (!C.enabled && C.enabled !== undefined && !C.start) {
      box.innerHTML = `<article class="panel">${empty("Portefeuille crypto inactif", "Le carnet papier crypto n'est pas encore initialisé.")}</article>`;
      return;
    }
    const r = C.rules || {}, P = C.positions || [], T = C.trades || [], s = C.stats || {}, ses = C.session || {};
    const tgt = p => {
      if (p.use_partial && (p.tp1 != null || p.tp2 != null))
        return `${px(p.tp1, "CRYPTO")} / ${px(p.tp2, "CRYPTO")}<br><small>${p.tp1_done ? "TP1 fait · vers TP2" : "TP1 en attente"}</small>`;
      return px(p.target, "CRYPTO");
    };
    const rows = P.map(p => `<tr><td class="sym">${esc(p.symbol)}${mk("CRYPTO")}<small>${esc(p.name)} · ${esc(p.setup || "")} · ${hm(p.opened_at)}${p.exit_status ? " · " + esc(p.exit_status) : ""}</small></td>
      <td>${px(p.entry, "CRYPTO")}</td><td>${px(p.last, "CRYPTO")}</td><td class="dn">${px(p.stop, "CRYPTO")}</td><td class="up">${tgt(p)}</td>
      <td>${eur(p.notional_eur, 0)}</td><td class="${cls(p.pnl_eur)}">${sg(p.pnl_eur, 2, " €")}<br><small>${sg(p.pnl_pct, 2, " %")}</small></td></tr>`).join("");
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
      <section class="hero" style="margin-bottom:16px">
        <article class="panel capital">
          <div class="cap-l">CAPITAL CRYPTO · PAPIER SÉPARÉ</div>
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
          <div class="note">Carnet fictif distinct des actions (1 000 €). ${(C.universe && C.universe.length) ? (C.universe.length + " cryptos suivies : " + C.universe.map(u => u.name || u.symbol).join(", ")) : "Liste de cryptos liquides"} · day trading 7j/7, clôture forcée à 23h50 heure de Paris. Achat uniquement.</div>
        </article>
        <article class="panel curve">
          <div class="ph"><h2>COURBE CRYPTO</h2><span class="hint">vs Bitcoin buy &amp; hold · % depuis le lancement</span></div>
          <div class="chart" style="min-height:200px">${chartHtml}</div>
          <div class="legend"><span><i style="background:#ffb000"></i>Portefeuille crypto<b class="${cls(last)}">${last == null ? "—" : sg(last, 2, " %")}</b></span>
            <span><i style="background:#5aa9ff"></i>Bitcoin (buy &amp; hold)<b class="${cls(btcPct)}">${btcPct == null ? "—" : sg(btcPct, 2, " %")}</b></span></div>
        </article>
      </section>
      <article class="panel"><div class="ph"><h2>POSITIONS CRYPTO</h2><span class="hint">${P.length} / ${r.max_open_positions || 2} max · TP1 50 % à 1R, TP2 2,5R ou VWAP 00h00 · flatten 23h50</span></div>
        ${P.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Titre</th><th>Entrée</th><th>Dernier</th><th>Stop</th><th>TP1 / TP2</th><th>Montant</th><th>P&amp;L</th></tr></thead><tbody>${rows}</tbody></table></div>`
          : empty("Aucune position crypto ouverte", "Le bot n'entre qu'entre 00h30 et 23h20, si le setup technique et le risque sont validés. Tout est fermé à 23h50.")}</article>
      <div class="grid2">
        <article class="panel"><div class="ph"><h2>DERNIERS SETUPS</h2><span class="hint">cycle ${esc(hm((C.scan && C.scan.ts) || C.last_cycle && C.last_cycle.ts))}</span></div>
          ${decCards || (scanRows ? `<div class="scroll"><table class="tbl"><thead><tr><th>Titre</th><th>Cours</th><th>Tech</th><th>Setup</th></tr></thead><tbody>${scanRows}</tbody></table></div>` : empty("Pas encore de setup", "Les cycles tournent toutes les 5 minutes pendant la séance crypto."))}</article>
        <article class="panel"><div class="ph"><h2>RÈGLES CRYPTO</h2><span class="hint">même philosophie que les actions, carnet à part</span></div>
          <div class="rules">${[r.exits, r.fees_desc, `Risque ${r.risk_per_trade_pct || 1.5} % par trade · plafond ${r.max_position_pct || 35} % · max ${r.max_open_positions || 2} positions · stop journalier −${r.daily_loss_limit_pct || 3} % · pas d'entrée après ${r.no_entry_after || "23:20"} ni avant ${r.open || "00:30"}.`].filter(Boolean).map(x => `<p>${esc(x)}</p>`).join("")}</div></article>
      </div>
      <article class="panel"><div class="ph"><h2>JOURNAL CRYPTO</h2><span class="hint">${T.length} trade(s) clos</span></div>
        ${T.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Titre</th><th>Ouvert / clos</th><th>Entrée</th><th>Sortie</th><th>Montant</th><th>Frais</th><th>P&amp;L net</th><th style="text-align:left">Sortie</th></tr></thead><tbody>${trows}</tbody></table></div>`
          : empty("Aucun trade crypto clos", "Les sorties (TP1, TP2, stop, VWAP, 23h50) apparaîtront ici, avec les frais IBKR.")}</article>`;
  }

  function render() {
    renderTape(); renderStatus(); renderCapital(); renderChart(); renderPortfolio(); renderSignals(); renderJournal(); renderMarket(); renderTeam(); renderCrypto();
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
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => D && renderChart(), 150); });
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();

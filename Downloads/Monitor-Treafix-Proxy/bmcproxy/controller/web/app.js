// Duong dan goc cua web: "/" hoac link bi mat "/<chuoi>/" (cau hinh web_path)
const BASE = location.pathname.replace(/[^/]*$/, "");
"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtNum = (n) => Number(n || 0).toLocaleString("vi-VN");
const fmtTs = (s) => (s || "").replace("T", " ");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const state = {
  me: null, page: "overview", sites: [], bmcs: [], overview: null, warnings: [],
  settings: null, filter: "", editing: null, templates: {}, selected: new Set(),
};
const ROLE_LABEL = { admin: "Quản trị", operator: "Vận hành", viewer: "Chỉ xem" };
const PHASE = {
  synced: ["ok", "đã đồng bộ"], pending: ["warn", "chưa áp dụng"], applying: ["info", "đang áp dụng"],
  failed: ["bad", "áp dụng lỗi"], empty: ["", "chưa có BMC"],
};

// ------------------------------------------------------------------ API
async function api(method, path, body) {
  const opt = { method, headers: { "X-Requested-With": "bmcproxy" }, credentials: "same-origin" };
  if (body !== undefined) {
    opt.headers["Content-Type"] = "application/json";
    opt.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + "api/" + path, opt);
  const ctype = res.headers.get("Content-Type") || "";
  const data = ctype.includes("json") ? await res.json() : await res.text();
  if (res.status === 401 && path !== "login") {
    showLogin();
    throw new Error("Phiên đăng nhập đã hết hạn");
  }
  if (!res.ok) {
    const e = new Error((data && data.error) || res.statusText);
    e.data = data;
    e.status = res.status;
    throw e;
  }
  return data;
}

function toast(msg, isError = false) {
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " error" : "");
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), isError ? 7000 : 3500);
}

function confirmBox(title, text, okLabel = "Đồng ý") {
  return new Promise((resolve) => {
    const dlg = $("#dlg-confirm");
    $("#confirm-title").textContent = title;
    $("#confirm-text").textContent = text;
    $("#confirm-ok").textContent = okLabel;
    let answered = false;
    $("#confirm-ok").onclick = () => { answered = true; dlg.close(); resolve(true); };
    dlg.onclose = () => { if (!answered) resolve(false); };
    dlg.showModal();
  });
}

function infoBox(title, html) {
  $("#info-title").textContent = title;
  $("#info-body").innerHTML = html;
  $("#dlg-info").showModal();
}

/** Hộp thoại form chung: fields = [{name,label,type,value,options,help,span}], onSubmit(data) */
function formBox(title, fields, onSubmit, okLabel = "Lưu") {
  $("#gen-title").textContent = title;
  $("#gen-ok").textContent = okLabel;
  $("#gen-error").textContent = "";
  $("#gen-body").innerHTML = `<div class="fields">${fields.map((f) => {
    const span = f.span === false ? "" : ' class="span-2"';
    const help = f.help ? `<small class="help">${f.help}</small>` : "";
    if (f.type === "select") {
      return `<label${span}>${esc(f.label)}<select name="${f.name}">${f.options.map(([v, l]) =>
        `<option value="${esc(v)}"${String(v) === String(f.value) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>${help}</label>`;
    }
    if (f.type === "checks") {
      return `<div class="span-2"><label>${esc(f.label)}</label><div class="check-row" data-checks="${f.name}">${f.options.map(([v, l]) =>
        `<label><input type="checkbox" value="${esc(v)}"${(f.value || []).includes(v) ? " checked" : ""}> ${esc(l)}</label>`).join("") || '<span class="hint">chưa có site</span>'}</div>${help}</div>`;
    }
    if (f.type === "html") return `<div class="span-2">${f.html}</div>`;
    return `<label${span}>${esc(f.label)}<input name="${f.name}" type="${f.type || "text"}" value="${esc(f.value ?? "")}" placeholder="${esc(f.placeholder || "")}"${f.readonly ? " readonly" : ""}>${help}</label>`;
  }).join("")}</div>`;
  const form = $("#gen-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {};
    fields.forEach((f) => {
      if (f.type === "checks") data[f.name] = $$(`[data-checks="${f.name}"] input:checked`, form).map((i) => i.value);
      else if (f.type !== "html") data[f.name] = form.elements[f.name].value.trim();
    });
    try {
      await onSubmit(data);
      $("#dlg-form").close();
    } catch (err) {
      $("#gen-error").textContent = err.message;
    }
  };
  $("#dlg-form").showModal();
}

$$("[data-close-dialog]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));

// ------------------------------------------------------------------ Quyền
const isAdmin = () => state.me && state.me.role === "admin";
const canEdit = (site) => state.me && (state.me.role === "admin" ||
  (state.me.role === "operator" && (!state.me.sites.length || state.me.sites.includes(site))));
const editableSites = () => state.sites.filter((s) => canEdit(s.key));
const siteLabel = (k) => { const s = state.sites.find((x) => x.key === k); return s ? s.label : k; };
const RANK = { viewer: 0, operator: 1, admin: 2 };

// ------------------------------------------------------------------ Đăng nhập
function showLogin() {
  state.me = null;
  $("#app").classList.add("hidden");
  $("#login").classList.remove("hidden");
  api("GET", "login-info").then((r) => {
    const h = $("#login-ad-hint");
    h.classList.toggle("hidden", !r.ldap);
    if (r.ldap) {
      h.textContent = "Dùng tài khoản công ty (Windows / AD)" + (r.domain ? `, vd ${r.domain.split(".")[0].toUpperCase()}\\tên hoặc tên@${r.domain}` : "")
        + ". Tài khoản riêng của web vẫn đăng nhập được.";
      $("#login-user").placeholder = "tên đăng nhập Windows";
    }
  }).catch(() => { });
  $("#login-form [name=user]").focus();
}

async function showApp(me) {
  state.me = me;
  $("#login").classList.add("hidden");
  $("#whoami").textContent = me.name;
  $("#whorole").textContent = ROLE_LABEL[me.role] + (me.sites.length ? ` · ${me.sites.join(", ")}` : "");
  $("#avatar").textContent = me.name.slice(0, 2);
  $("#avatar").title = me.name + " (" + (ROLE_LABEL[me.role] || me.role) + ")";
  $$("[data-min-role]").forEach((a) => a.classList.toggle("hidden", RANK[me.role] < RANK[a.dataset.minRole]));
  $$("[data-admin-only]").forEach((a) => a.classList.toggle("hidden", !isAdmin()));
  state.settings = await api("GET", "settings");
  state.templates = await api("GET", "templates");
  await refreshAll();
  initSidebar();
  route();
  if (!state.me) return;  // het phien giua chung -> da ve trang dang nhap
  $("#app").classList.remove("hidden");  // chi hien khi da tai xong du lieu cua phien hop le
  if (me.must_change) forcePasswordChange();
}

// Quan tri vien dat lai mat khau -> nguoi dung phai doi o lan dang nhap sau
function forcePasswordChange() {
  formBox("Đổi mật khẩu trước khi dùng tiếp", [
    { type: "html", html: '<p class="hint">Quản trị viên vừa đặt lại mật khẩu cho bạn. Hãy đổi sang mật khẩu riêng (≥ 10 ký tự).</p>' },
    { name: "old", label: "Mật khẩu hiện tại", type: "password" },
    { name: "new", label: "Mật khẩu mới (≥ 10 ký tự)", type: "password" },
    { name: "again", label: "Nhập lại mật khẩu mới", type: "password" },
  ], async (d) => {
    if (d.new !== d.again) throw new Error("Hai lần nhập mật khẩu mới không khớp");
    await api("POST", "password", { old: d.old, new: d.new });
    state.me.must_change = false;
    toast("Đã đổi mật khẩu");
  }, "Đổi mật khẩu");
  const dlg = $("#dlg-form");
  dlg.addEventListener("close", function again() {  // khong cho bo qua
    dlg.removeEventListener("close", again);
    if (state.me && state.me.must_change) setTimeout(forcePasswordChange, 50);
  });
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  $("#login-error").textContent = "";
  try {
    const body = { user: f.user.value, password: f.password.value, remember: f.remember.checked };
    if (!$("#login-otp-row").classList.contains("hidden")) body.otp = f.otp.value.trim();
    const r = await api("POST", "login", body);
    // Cho trinh duyet hoi "Luu mat khau?" (Chrome / Edge; trinh duyet khac tu nhan dien form)
    try {
      if (window.PasswordCredential && navigator.credentials) {
        await navigator.credentials.store(new PasswordCredential({ id: body.user, password: body.password, name: body.user }));
      }
    } catch { /* trinh duyet khong ho tro / nguoi dung tu choi */ }
    f.password.value = "";
    f.otp.value = "";
    $("#login-otp-row").classList.add("hidden");
    await showApp(r);
  } catch (err) {
    if (err.data && err.data.need_otp) {  // tai khoan bat 2FA: hien o nhap ma
      $("#login-otp-row").classList.remove("hidden");
      f.otp.required = true;
      f.otp.focus();
    }
    $("#login-error").textContent = err.message;
  }
});

$("#btn-logout").addEventListener("click", async () => {
  $("#app").classList.add("hidden");
  await api("POST", "logout").catch(() => { });
  location.replace(location.pathname);  // tai lai trang: xoa sach du lieu phien cu khoi trinh duyet
});
// Nut Back sau khi dang xuat: trinh duyet hien lai trang cu tu bo nho -> kiem tra lai phien
window.addEventListener("pageshow", (e) => { if (e.persisted) location.reload(); });

// ------------------------------------------------------------------ Điều hướng
const PAGES = {
  overview: { title: "Tổng quan", sub: "Tình trạng cổng truy cập BMC trên mọi site" },
  sites: { title: "Site", sub: "Mỗi site là một server Traefik chạy agent" },
  bmcs: { title: "BMC", sub: "Mỗi BMC được mở qua một cổng riêng trên server Traefik của site" },
  traefik: { title: "Traefik", sub: "Router đang chạy trên từng server" },
  audit: { title: "Nhật ký", sub: "Ai đã làm gì, lúc nào" },
  backups: { title: "Sao lưu", sub: "Tự sao lưu trước mỗi lần nhập, khôi phục, xoá site" },
  users: { title: "Người dùng", sub: "Tài khoản đăng nhập giao diện và quyền theo site" },
  settings: { title: "Cài đặt", sub: "Cài đặt chung và tài khoản của bạn" },
  templates: { title: "Mẫu BMC", sub: "" },
};

const ICO_ACTIONS = {
  refresh: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  export: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
  templates: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  bulk: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>',
  plus: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
};

function headActions(page) {
  const box = $("#head-actions");
  box.innerHTML = "";
  const add = (icoKey, text, cls, fn, tip) => {
    const b = document.createElement("button");
    b.className = "btn " + cls;
    b.innerHTML = `${ICO_ACTIONS[icoKey] || ""} <span class="lbl">${esc(text)}</span>`;
    if (tip) b.title = tip;
    b.onclick = fn;
    box.appendChild(b);
  };
  if (page === "overview" || page === "bmcs") add("refresh", "Kiểm tra kết nối", "", () => recheck(), "Kiểm tra kết nối toàn bộ BMC");
  if (page === "bmcs") add("export", "Xuất CSV", "", exportCsv, "Xuất danh sách BMC ra CSV");
  if (page === "bmcs") add("templates", "Mẫu", "", openTemplates, "Mẫu BMC");
  if (page === "bmcs" && editableSites().length) add("bulk", "Thêm hàng loạt", "", openBulk, "Thêm hoặc đổi mẫu hàng loạt BMC");
  if (page === "bmcs" && editableSites().length) add("plus", "Thêm BMC", "primary", () => openDrawer(null), "Thêm BMC mới");
  if (page === "sites" && isAdmin()) add("plus", "Thêm site", "primary", addSite, "Thêm site Traefik mới");
  if (page === "traefik") add("refresh", "Làm mới", "", loadTraefik, "Làm mới router Traefik");
  if (page === "users") add("plus", "Thêm tài khoản", "primary", () => editUser(null), "Thêm tài khoản quản trị/vận hành");
}

function route() {
  let page = (location.hash || "#overview").slice(1).split("?")[0];
  if (page === "templates") {  // mo hop thoai mau tren trang BMC
    history.replaceState(null, "", "#bmcs");
    page = "bmcs";
    setTimeout(openTemplates, 0);
  }
  const link = $(`.side-nav a[data-page="${page}"]`);
  if (!PAGES[page] || (link && link.classList.contains("hidden"))) page = "overview";
  state.page = page;
  $$(".side-nav a").forEach((a) => a.classList.toggle("active", a.dataset.page === page));
  $$(".page").forEach((p) => p.classList.toggle("hidden", p.id !== "page-" + page));
  $("#page-title").textContent = PAGES[page].title;
  $("#page-sub").textContent = PAGES[page].sub;
  headActions(page);
  $("#sidebar").classList.remove("open");
  if (page === "traefik") loadTraefik();
  if (page === "backups") loadBackups();
  if (page === "audit") loadAudit();
  if (page === "users") loadUsers();
  if (page === "settings") renderSettings();
}
window.addEventListener("hashchange", route);
$("#btn-menu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

// Thu gọn menu chỉ còn icon (nhớ theo trình duyệt & tự động thích ứng)
function setCollapsed(on) {
  $("#app").classList.toggle("collapsed", on);
  const b = $("#btn-collapse");
  if (b) {
    b.title = on ? "Mở rộng menu" : "Thu gọn menu (chỉ hiện icon)";
    b.setAttribute("aria-label", b.title);
  }
  $$(".side-nav a, .side-btn").forEach((el) => {
    const tip = el.dataset.tip || el.title || el.querySelector(".nav-lbl")?.textContent?.trim() || "";
    if (tip) {
      el.dataset.tip = tip;
      if (on) el.removeAttribute("title");
      else el.setAttribute("title", tip);
    }
  });
  if (state.me && $("#avatar")) {
    $("#avatar").title = state.me.name + " (" + (ROLE_LABEL[state.me.role] || state.me.role) + ")";
  }
  try { localStorage.setItem("bmcgw.sideCollapsed", on ? "1" : "0"); } catch { /* khong luu duoc thi thoi */ }
}

function initSidebar() {
  let saved = null;
  try { saved = localStorage.getItem("bmcgw.sideCollapsed"); } catch { }
  if (saved === "1" || (saved === null && window.innerWidth <= 1024 && window.innerWidth > 640)) {
    setCollapsed(true);
  } else {
    setCollapsed(false);
  }
}

$("#btn-collapse").addEventListener("click", () => setCollapsed(!$("#app").classList.contains("collapsed")));
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
    e.preventDefault();
    setCollapsed(!$("#app").classList.contains("collapsed"));
  }
});
window.addEventListener("resize", () => {
  try {
    if (localStorage.getItem("bmcgw.sideCollapsed") === null) {
      if (window.innerWidth <= 1024 && window.innerWidth > 640) {
        if (!$("#app").classList.contains("collapsed")) setCollapsed(true);
      }
    }
  } catch { }
});
initSidebar();

document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-goto-filter]");
  if (g) setFilter(g.dataset.gotoFilter);
  const s = e.target.closest("[data-goto-site]");
  if (s) { $("#filter-site").value = s.dataset.gotoSite; renderBmcs(); }
});

// ------------------------------------------------------------------ Dữ liệu chung
async function refreshAll() {
  const [sites, bmcs, ov, warnings] = await Promise.all([
    api("GET", "sites"), api("GET", "bmcs"), api("GET", "overview"), api("GET", "warnings"),
  ]);
  state.sites = sites;
  state.bmcs = bmcs;
  state.overview = ov;
  state.warnings = warnings;
  fillSiteSelects();
  renderOverview();
  renderSites();
  renderBmcs();
  renderPending();
}

function fillSiteSelects() {
  const opts = state.sites.map((s) => `<option value="${esc(s.key)}">${esc(s.label)} (${esc(s.key)})</option>`).join("");
  for (const id of ["#filter-site", "#audit-site"]) {
    const sel = $(id);
    const cur = sel.value;
    sel.innerHTML = '<option value="">Mọi site</option>' + opts;
    sel.value = cur;
  }
  const t = $("#traefik-site");
  if (t) {
    const cur = t.value;
    if (state.sites.length) {
      t.innerHTML = opts;
      if (cur) t.value = cur;
    } else {
      t.innerHTML = '<option value="">(Chưa có site nào)</option>';
    }
  }
  $("#nav-site-count").textContent = state.sites.length || "";
  $("#nav-warn-count").textContent = (state.warnings || []).length || "";
}

async function recheck(site) {
  const sites = site ? [site] : state.sites.filter((s) => canEdit(s.key)).map((s) => s.key);
  if (!sites.length) return toast("Không có site nào để kiểm tra", true);
  try {
    await Promise.all(sites.map((k) => api("POST", `sites/${k}/command`, { name: "recheck" })));
    toast("Đã yêu cầu agent kiểm tra lại, kết quả có sau vài giây");
    setTimeout(() => refreshAll().catch(() => { }), 12000);
  } catch (err) { toast(err.message, true); }
}

// ------------------------------------------------------------------ Tổng quan
function siteDot(s) {
  return `<span class="dot ${s.online ? "up" : "down"}" title="${s.online ? "agent đang kết nối" : "agent mất liên lạc"}"></span>`;
}
function phaseTag(s) {
  const [cls, txt] = PHASE[s.phase] || ["", s.phase];
  return `<span class="tag ${cls}">${txt}</span>`;
}

function renderOverview() {
  const o = state.overview;
  if (!o) return;
  const online = o.sites.filter((s) => s.online).length;
  const authTotal = o.auth.ok + o.auth.deny + o.auth.error;
  const kpis = [
    { lbl: "Site trực tuyến", num: `${online}/${o.sites.length}`, foot: "agent đang kết nối", cls: online < o.sites.length ? "bad" : "ok" },
    { lbl: "BMC hoạt động", num: o.bmcs, foot: o.checked ? `${o.checked - o.down.length} kết nối được` : "đang chờ kết quả", cls: "accent" },
    { lbl: "Mất kết nối", num: o.down.length, foot: "server không mở được TCP tới BMC", cls: o.down.length ? "bad" : "ok" },
    { lbl: "Chưa xác thực", num: o.open, foot: "cổng mở cho mọi người", cls: o.open ? "bad" : "ok" },
    { lbl: "Lượt xác thực", num: fmtNum(authTotal), foot: `${fmtNum(o.auth.deny)} bị chặn · ${fmtNum(o.auth.error)} lỗi`, cls: o.auth.error ? "warn" : "" },
  ];
  $("#kpis").innerHTML = kpis.map((k) => `<div class="kpi ${k.cls}">
    <div class="lbl">${k.lbl}</div><div class="num">${k.num}</div><div class="foot">${esc(k.foot)}</div></div>`).join("");

  $("#ov-sites").innerHTML = o.sites.map((s) => `<a class="site-mini" href="#sites">
    <div class="top">${siteDot(s)}<span class="grow">${esc(s.label)}</span>${phaseTag(s)}</div>
    <div class="meta"><span>${s.enabled} BMC</span>${s.down ? `<span class="tag bad">${s.down} mất kết nối</span>` : ""}
      ${s.traefik.errors ? `<span class="tag bad">${s.traefik.errors} router lỗi</span>` : ""}
      <span>${esc(s.domain)}</span></div></a>`).join("");

  const w = state.warnings || [];
  $("#ov-warn-count").textContent = w.length ? `${w.length} mục` : "";
  $("#ov-warnings").innerHTML = w.length ? w.slice(0, 12).map((x) => `<div class="list-item">
      <span class="sev ${x.level}"></span>${x.site ? `<span class="tag">${esc(siteLabel(x.site))}</span>` : ""}
      <span class="grow" title="${esc(x.text)}">${esc(x.text)}</span></div>`).join("")
    : '<div class="list-empty">Không có cảnh báo.</div>';

  $("#ov-down").innerHTML = o.down.length ? o.down.slice(0, 10).map((d) => `<div class="list-item">
      <span class="dot down"></span><span class="tag">${esc(siteLabel(d.site))}</span><b class="port">${d.port}</b>
      <span class="grow mono">${esc(d.upstream)}</span><span class="cell-sub">${esc(d.note)}</span></div>`).join("")
    : `<div class="list-empty">${o.checked ? "Tất cả BMC đều kết nối được." : "Chưa có kết quả kiểm tra."}</div>`;

  $("#ov-denied").innerHTML = o.top_denied.length ? o.top_denied.map((d) => `<div class="list-item">
      <span class="tag">${esc(siteLabel(d.site))}</span><b class="port">${d.port}</b>
      <span class="grow cell-sub">${esc(d.note)}</span><span class="tag bad">${fmtNum(d.deny)} lần</span></div>`).join("")
    : '<div class="list-empty">Chưa có lượt bị chặn.</div>';

  const c = o.cert;
  $("#ov-system").innerHTML = [
    ["Chứng chỉ (trên web)", c.ok ? `${c.expires} (còn ${c.days} ngày)` : "không đọc được file trên máy web — xem cảnh báo từng site"],
    ["Site chờ áp dụng", String(o.sites.filter((s) => ["pending", "failed"].includes(s.phase)).length)],
    ["Web chạy từ", fmtTs(o.started)],
    ["Phiên bản", state.settings ? state.settings.version : ""],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("");
}

// ------------------------------------------------------------------ Site
function renderSites() {
  const grid = $("#site-grid");
  $("#site-empty").classList.toggle("hidden", state.sites.length > 0);
  grid.innerHTML = state.sites.map((s) => {
    const rep = s.last_report || {};
    const edit = canEdit(s.key);
    const warns = (s.warnings || []).slice(0, 3).map((w) =>
      `<div><span class="sev ${w.level}"></span><span>${esc(w.text)}</span></div>`).join("");
    return `<article class="site-card ${s.online || !s.token_set ? "" : "offline"}">
      <header>${siteDot(s)}<div class="grow"><h3>${esc(s.label)} <span class="cell-sub mono">${esc(s.key)}</span></h3>
        <p class="sub mono">${esc(s.domain)}</p></div>${phaseTag(s)}</header>
      <div class="stats">
        <div><b>${s.enabled}</b><span>BMC</span></div>
        <div class="${s.down ? "bad" : ""}"><b>${s.down}</b><span>mất kết nối</span></div>
        <div><b>${s.traefik.routers ?? "—"}</b><span>router</span></div>
        <div class="${s.traefik.errors ? "bad" : ""}"><b>${s.traefik.errors}</b><span>router lỗi</span></div>
      </div>
      <div class="body">
        <div class="row"><span>Agent</span><span>${s.online ? `trực tuyến · ${esc(s.hostname || "")} ${s.remote_ip ? `(${esc(s.remote_ip)})` : ""}`
        : s.token_set ? `<b class="tag bad">mất liên lạc</b> ${s.last_seen ? `từ ${esc(fmtTs(s.last_seen))}` : "chưa từng kết nối"}` : '<span class="tag warn">chưa có token</span>'}</span></div>
        <div class="row"><span>Traefik</span><span>${s.traefik.reachable ? `v${esc(s.traefik.version)} · ${s.traefik.entrypoints} cổng` : "—"}</span></div>
        ${s.online && s.sysinfo && s.sysinfo.os ? `<div class="row"><span>Server</span><span>${sysLine(s.sysinfo)}</span></div>` : ""}
        <div class="row"><span>Bản cấu hình</span><span class="mono">${esc(s.applied_rev || "—")}${s.desired_rev !== s.applied_rev ? ` → ${esc(s.desired_rev)}` : ""}</span></div>
        <div class="row"><span>Áp dụng gần nhất</span><span>${rep.at ? `${rep.ok ? '<span class="tag ok">thành công</span>' : '<span class="tag bad">lỗi</span>'} ${esc(fmtTs(rep.at))}` : "—"}
          ${rep.log ? ` · <a href="#sites" data-report="${esc(s.key)}">xem chi tiết</a>` : ""}</span></div>
        <div class="row"><span>Dashboard</span><span>${s.dashboard && s.dashboard.enabled
        ? `<a href="${esc(s.dashboard.url)}" target="_blank" rel="noopener">${esc(s.dashboard.url)}</a> ${(s.dashboard.allow_ips || []).length ? `<span class="cell-sub">(${esc(s.dashboard.allow_ips.join(", "))})</span>`
          : '<span class="tag bad" title="Ai biết link + mật khẩu đều vào được - nên khai IP được xem">mọi IP</span>'}`
        : '<span class="cell-sub">tắt</span>'}</span></div>
        ${s.legacy_active ? `<div class="row"><span>nginx cũ</span><span><span class="tag warn">${s.legacy_active} file</span> sẽ tắt khi áp dụng</span></div>` : ""}
        ${Object.keys(s.overrides || {}).length ? `<div class="row"><span>Ghi đè</span><span>${Object.keys(s.overrides).map((k) => `<span class="tag">${esc(k)}</span>`).join("")}</span></div>` : ""}
        ${warns ? `<div class="warns">${warns}</div>` : ""}
      </div>
      <footer>
        ${edit && ["pending", "failed"].includes(s.phase) ? `<button class="btn small primary" data-site-act="apply" data-site="${esc(s.key)}">Áp dụng</button>` : ""}
        ${edit && s.phase === "failed" ? `<button class="btn small" data-site-act="retry" data-site="${esc(s.key)}">Thử lại</button>` : ""}
        <a class="btn small ghost" href="#bmcs" data-goto-site="${esc(s.key)}">BMC</a>
        ${edit ? `<button class="btn small ghost" data-site-act="import" data-site="${esc(s.key)}">Nhập từ nginx</button>` : ""}
        ${edit ? `<button class="btn small ghost" data-site-act="recheck" data-site="${esc(s.key)}">Kiểm tra</button>` : ""}
        ${edit && s.online ? `<button class="btn small ghost" data-site-act="diagnose" data-site="${esc(s.key)}" title="Ping / thử cổng / thử TLS mọi BMC từ server site">Kiểm tra BMC</button>` : ""}
        <button class="btn small ghost" data-site-act="history" data-site="${esc(s.key)}">Lịch sử${s.history_count ? ` (${s.history_count})` : ""}</button>
        ${isAdmin() && s.online ? `<button class="btn small ghost" data-site-act="server" data-site="${esc(s.key)}" title="Log agent / Traefik, restart từ xa">Server</button>` : ""}
        ${isAdmin() && !s.online ? `<button class="btn small" data-site-act="install" data-site="${esc(s.key)}">Cài agent</button>` : ""}
        ${isAdmin() ? `<span class="grow"></span>
          <button class="btn small ghost" data-site-act="edit" data-site="${esc(s.key)}">Sửa</button>
          <button class="btn small ghost" data-site-act="token" data-site="${esc(s.key)}">Token</button>
          <button class="btn small danger-ghost" data-site-act="delete" data-site="${esc(s.key)}">Xoá</button>` : ""}
      </footer></article>`;
  }).join("");
}

$("#site-grid").addEventListener("click", async (e) => {
  const rep = e.target.closest("[data-report]");
  if (rep) {
    e.preventDefault();
    const s = state.sites.find((x) => x.key === rep.dataset.report);
    infoBox(`Kết quả áp dụng · ${s.label}`, renderLog(s.last_report));
    return;
  }
  const b = e.target.closest("[data-site-act]");
  if (!b) return;
  const key = b.dataset.site;
  const s = state.sites.find((x) => x.key === key);
  try {
    switch (b.dataset.siteAct) {
      case "apply": return openPlan([key]);
      case "retry":
        await api("POST", "apply", { sites: [key], retry: true });
        toast(`Đã yêu cầu ${s.label} áp dụng lại`);
        return watchApply([key]);
      case "import":
        await api("POST", `sites/${key}/command`, { name: "import" });
        toast(`Đã gửi lệnh nhập nginx tới ${s.label}. BMC sẽ hiện sau vài giây.`);
        setTimeout(() => refreshAll().catch(() => { }), 12000);
        return;
      case "recheck": return recheck(key);
      case "diagnose": return siteDiagnose(s);
      case "history": return siteHistory(s);
      case "server": return siteServer(s);
      case "install": return showInstall(s);
      case "edit": return editSite(s);
      case "token":
        if (!await confirmBox("Đổi token agent", `Token cũ của ${s.label} sẽ hết hiệu lực ngay. Phải cập nhật agent.json trên server rồi restart agent.`, "Đổi token")) return;
        return showToken(s, await api("POST", `sites/${key}/token`));
      case "delete":
        if (!await confirmBox("Xoá site", `Xoá site ${s.label}? Chỉ xoá được khi site không còn BMC.`, "Xoá")) return;
        await api("DELETE", `sites/${key}`);
        toast("Đã xoá site");
        return refreshAll();
    }
  } catch (err) { toast(err.message, true); }
});

function siteFields(s) {
  const ov = (s && s.overrides) || {};
  const dash = (s && s.dashboard) || {};
  const g = state.settings.settings;
  return [
    ...(s ? [] : [{ name: "key", label: "Mã site (a-z, 0-9, -)", placeholder: "vd: hn, hcm, dn", span: false }]),
    { name: "label", label: "Tên hiển thị", value: s ? s.label : "", placeholder: "vd: Hà Nội", span: false },
    { name: "domain", label: "Tên miền của server", value: s ? s.domain : "", placeholder: "proxybb-hn.longvan.net" },
    {
      name: "allowed_ips", label: "IP được phép kết nối agent (cách nhau bởi dấu phẩy)", value: s ? s.allowed_ips.join(", ") : "",
      placeholder: "để trống = mọi IP (chỉ dùng khi thử)", help: "Nên khai IP public của server để token bị lộ cũng không dùng được."
    },
    { type: "html", html: '<h3 class="mt">Ghi đè cài đặt chung (để trống = dùng cài đặt chung)</h3>' },
    { name: "auth_url", label: "URL auth-token", value: ov.auth_url || "", placeholder: g.auth_url },
    { name: "cert_file", label: "File chứng chỉ", value: ov.cert_file || "", placeholder: g.cert_file, span: false },
    { name: "key_file", label: "File khoá", value: ov.key_file || "", placeholder: g.key_file, span: false },
    { name: "access_log", label: "Access log", value: ov.access_log || "", placeholder: g.access_log, span: false },
    {
      type: "select", name: "log_level", label: "Mức log", value: ov.log_level || "", span: false,
      options: [["", `mặc định (${g.log_level})`], ["DEBUG", "DEBUG"], ["INFO", "INFO"], ["WARN", "WARN"], ["ERROR", "ERROR"]]
    },
    { type: "html", html: '<h3 class="mt">Dashboard Traefik</h3><p class="hint">Mở trang dashboard của Traefik qua HTTPS, chỉ cho IP được phép và có mật khẩu.</p>' },
    {
      type: "select", name: "dash_enabled", label: "Trạng thái", value: dash.enabled ? "1" : "", span: false,
      options: [["", "Tắt"], ["1", "Bật"]]
    },
    { name: "dash_port", label: "Cổng", type: "number", value: dash.port || 18443, span: false },
    {
      name: "dash_ips", label: "IP / dải mạng được xem (cách nhau bởi dấu phẩy)", value: (dash.allow_ips || []).join(", "),
      placeholder: "vd 113.161.1.2, 10.10.0.0/24", help: "Bắt buộc khi bật. Nên chỉ để IP văn phòng / VPN."
    },
    { name: "dash_user", label: "Tài khoản", value: (dash.users || [])[0] || "admin", span: false },
    {
      name: "dash_password", label: dash.users && dash.users.length ? "Mật khẩu mới (để trống = giữ)" : "Mật khẩu (≥ 10 ký tự)",
      type: "password", span: false
    },
  ];
}

function siteBody(d) {
  const overrides = {};
  for (const k of ["auth_url", "cert_file", "key_file", "access_log", "log_level"]) if (d[k]) overrides[k] = d[k];
  const dashboard = {
    enabled: !!d.dash_enabled, port: Number(d.dash_port) || 18443, user: d.dash_user, password: d.dash_password,
    allow_ips: d.dash_ips.split(",").map((x) => x.trim()).filter(Boolean),
  };
  return {
    ...(d.key ? { key: d.key } : {}), label: d.label, domain: d.domain, overrides, dashboard,
    allowed_ips: d.allowed_ips.split(",").map((x) => x.trim()).filter(Boolean)
  };
}

function addSite() {
  formBox("Thêm site", siteFields(null), async (d) => {
    const r = await api("POST", "sites", siteBody(d));
    await refreshAll();
    showInstall(state.sites.find((x) => x.key === r.site.key) || r.site, r);
  }, "Tạo site");
}

function editSite(s) {
  formBox(`Sửa site ${s.label}`, siteFields(s), async (d) => {
    await api("PUT", `sites/${s.key}`, siteBody(d));
    toast("Đã lưu. Bấm Áp dụng để đẩy thay đổi xuống server.");
    await refreshAll();
  });
}

function showToken(site, r) {
  const cfg = JSON.stringify(r.agent_config, null, 2);
  infoBox(`Token agent · ${site.label}`, `
    <p>Token chỉ hiện <b>một lần</b>. Lưu vào <code>/opt/bmcproxy/agent.json</code> trên server của site này:</p>
    <div class="copy-block"><pre class="code" id="agent-json">${esc(cfg)}</pre>
      <button class="btn small" id="btn-copy-agent" type="button">Sao chép</button></div>
    <p class="hint mt">Sửa <code>controller_url</code> thành địa chỉ mà server này gọi tới được, rồi chạy
      <code>systemctl restart bmcproxy-agent</code>.</p>`);
  $("#btn-copy-agent").onclick = async () => {
    try { await navigator.clipboard.writeText(cfg); toast("Đã sao chép"); } catch { toast("Không sao chép được, hãy bôi đen để copy", true); }
  };
}

// ------------------------------------------------------------------ Danh sách BMC
const isDown = (b) => b.health && b.health.web && b.health.web.up === false;
const isOpen = (b) => !b.auth || (b.console_port && !b.console_auth);
const isJavaBmc = (b) => !!(b.java_web || (b.tcp_ports || []).length);
const FILTERS = {
  "": () => true,
  java: isJavaBmc,
  down: isDown,
  noauth: isOpen,
  changed: (b) => b.imported_auth === false || b.imported_console_auth === false,
  legacy: (b) => b.legacy_tls,
  disabled: (b) => !b.enabled,
  expiring: (b) => expDays(b) !== null && expDays(b) <= 7,
};
/** So ngay con lai toi han su dung (am = da het han), null = khong co han. */
function expDays(b) {
  if (!b.expires) return null;
  return Math.floor((new Date(b.expires + "T00:00:00") - new Date(new Date().toDateString())) / 86400000);
}
const SORTERS = {
  site: (b) => siteLabel(b.site), port: (b) => b.port, upstream: (b) => b.upstream, note: (b) => (b.note || "") + (b.tags || []).join(" "),
  health: (b) => (b.health && b.health.web ? (b.health.web.up ? 2 : 0) : 1),
  access: (b) => (b.auth_stats ? (b.auth_stats.ok || 0) + (b.auth_stats.deny || 0) : 0),
};

function setFilter(f) {
  state.filter = f;
  $$("#chips .chip").forEach((c) => c.classList.toggle("active", c.dataset.filter === f));
  renderBmcs();
}
$("#chips").addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (c) setFilter(c.dataset.filter); });
$("#search").addEventListener("input", renderBmcs);
$("#filter-site").addEventListener("input", renderBmcs);

function healthDot(h, siteOnline) {
  if (!siteOnline) return '<span class="dot" title="agent mất liên lạc"></span>';
  if (!h) return '<span class="dot" title="chưa kiểm tra"></span>';
  return h.up ? `<span class="dot up" title="kết nối được (${h.ms} ms)"></span>` : '<span class="dot down" title="không kết nối được"></span>';
}

function consoleCell(b) {
  if (!b.console_port) return '<span class="cell-sub">—</span>';
  return `<div>${healthDot(b.health && b.health.console, b.site_online)} <span class="port">${b.console_port}</span></div>
    <div class="mono cell-sub">${esc(b.console_upstream || "")}</div>`;
}

function routerCell(b) {
  if (!b.site_online || !b.traefik_reachable) return '<span class="cell-sub">—</span>';
  if (!b.enabled) return '<span class="tag">đã tắt</span>';
  const rs = Object.entries(b.traefik || {});
  if (!rs.length) return '<span class="tag warn">chưa áp dụng</span>';
  const bad = rs.filter(([, r]) => r.status !== "enabled" || r.error);
  return bad.length ? `<span class="tag bad" title="${esc(bad.map(([n, r]) => `${n}: ${r.error || r.status}`).join("\n"))}">lỗi</span>`
    : '<span class="tag ok">hoạt động</span>';
}

function accessCell(b) {
  const s = b.auth_stats;
  if (!s) return '<span class="cell-sub">—</span>';
  const total = s.ok + s.deny + s.error || 1;
  return `<div class="cell-sub">${fmtNum(s.ok)} ok · ${fmtNum(s.deny)} chặn</div>
    <div class="bar"><i class="b-ok" style="width:${(s.ok / total) * 100}%"></i><i class="b-deny" style="width:${(s.deny / total) * 100}%"></i><i class="b-err" style="width:${(s.error / total) * 100}%"></i></div>`;
}

function renderBmcs() {
  const q = $("#search").value.trim().toLowerCase();
  const site = $("#filter-site").value;
  const pass = FILTERS[state.filter] || FILTERS[""];
  const tag = $("#filter-tag").value;
  fillTagFilter();
  const inSite = state.bmcs.filter((b) => (!site || b.site === site) && (!tag || (b.tags || []).includes(tag)));
  const rows = inSite.filter((b) => pass(b) && (!q || [b.port, b.console_port, b.upstream, b.console_upstream, b.note, b.site, b.expected_target, ...(b.tags || [])]
    .join(" ").toLowerCase().includes(q)));
  if (state.sort && SORTERS[state.sort.key]) {
    const f = SORTERS[state.sort.key];
    rows.sort((x, y) => { const a = f(x), b2 = f(y); return (a < b2 ? -1 : a > b2 ? 1 : 0) * state.sort.dir; });
  }
  $$("#bmc-table th.sortable").forEach((th) => {
    th.classList.toggle("sorted", !!state.sort && th.dataset.sort === state.sort.key);
    th.dataset.dir = state.sort && th.dataset.sort === state.sort.key ? (state.sort.dir > 0 ? "▲" : "▼") : "";
  });
  state.visibleRows = rows;
  $("#bmc-table tbody").innerHTML = rows.map((b) => {
    const sec = [
      b.auth ? '<span class="tag ok">web</span>' : '<span class="tag bad">web mở</span>',
      b.console_port ? (b.console_auth ? '<span class="tag ok">console</span>' : '<span class="tag bad">console mở</span>') : "",
      (b.imported_auth === false || b.imported_console_auth === false) ? '<span class="tag warn" title="Trước đây không có xác thực">mới bật</span>' : "",
      b.expected_target ? `<span class="tag info" title="Target bắt buộc">⌖ ${esc(b.expected_target)}</span>` : "",
    ].join("");
    const opts = [
      b.legacy_tls ? '<span class="tag warn">TLS cũ</span>' : "", b.jsesp_cache ? '<span class="tag">jsesp</span>' : "",
      b.host_header === "upstream" ? '<span class="tag">Host = IP</span>' : "",
      b.java_web ? '<span class="tag info" title="Console Java mở trên web (noVNC)">Java web</span>' : "",
      b.max_conns ? `<span class="tag" title="Tối đa ${b.max_conns} kết nối tới BMC">≤${b.max_conns} kết nối</span>` : "",
      (b.tcp_ports || []).length ? `<span class="tag ${b.tcp_allow_ips && b.tcp_allow_ips.length ? "info" : "bad"}" title="${esc(fmtTcp(b.tcp_ports))}">Java · ${b.tcp_ports.length} TCP</span>` : "",
      b.template && state.templates[b.template] ? `<span class="tag info">${esc(state.templates[b.template].label)}</span>` : "",
    ].join("");
    const ed = expDays(b);
    const expTag = ed === null ? "" : ed < 0 ? `<span class="tag bad" title="Hết hạn ${esc(b.expires)} - tắt ở lần Áp dụng">hết hạn</span>`
      : ed <= 7 ? `<span class="tag warn" title="Hạn ${esc(b.expires)}">còn ${ed} ngày</span>` : `<span class="tag" title="Hạn sử dụng">hạn ${esc(b.expires)}</span>`;
    const tagHtml = (b.tags || []).map((t) => `<span class="tag label-tag" data-tag="${esc(t)}" title="Lọc theo nhãn này">${esc(t)}</span>`).join("");
    const key = `${b.site}:${b.port}`;
    const sel = state.selected.has(key);
    return `<tr class="clickable ${b.enabled ? "" : "off"} ${sel ? "selected" : ""}" data-site="${esc(b.site)}" data-port="${b.port}" tabindex="0">
      <td class="check">${canEdit(b.site) ? `<input type="checkbox" data-select="${esc(key)}" ${sel ? "checked" : ""} aria-label="Chọn BMC ${b.port}">` : ""}</td>
      <td>${healthDot(b.health && b.health.web, b.site_online)}</td>
      <td><span class="tag">${esc(siteLabel(b.site))}</span></td>
      <td><div class="port">${b.port}</div></td>
      <td class="links">${linkCell(b)}</td>
      <td><div class="mono cell-main">${esc(b.upstream)}</div><div>${opts}</div></td>
      <td>${consoleCell(b)}</td>
      <td>${sec}</td><td>${routerCell(b)}</td><td>${accessCell(b)}</td>
      <td class="cell-sub">${esc(b.note)}${tagHtml || expTag ? `<div class="tag-row">${tagHtml}${expTag}</div>` : ""}</td></tr>`;
  }).join("");
  renderBulkBar();
  $("#bmc-empty").classList.toggle("hidden", state.bmcs.length > 0);
  $("#bmc-nomatch").classList.toggle("hidden", !state.bmcs.length || rows.length > 0);
  $("#bmc-table").classList.toggle("hidden", !state.bmcs.length);
  $("#nav-bmc-count").textContent = state.bmcs.length || "";
  $$("#chips .chip").forEach((c) => {
    const n = inSite.filter(FILTERS[c.dataset.filter]).length;
    const label = c.textContent.replace(/\s*\d+$/, "");
    c.innerHTML = `${esc(label)}${c.dataset.filter ? ` <span class="n">${n}</span>` : ""}`;
  });
}

const findBmc = (tr) => state.bmcs.find((b) => b.site === tr.dataset.site && b.port === Number(tr.dataset.port));
$("#bmc-table").addEventListener("click", (e) => {
  const cb = e.target.closest("[data-select]");
  if (cb) {
    if (cb.checked) state.selected.add(cb.dataset.select); else state.selected.delete(cb.dataset.select);
    cb.closest("tr").classList.toggle("selected", cb.checked);
    renderBulkBar();
    return;
  }
  if (e.target.closest("td.check")) return;
  const cp = e.target.closest("[data-copy]");
  if (cp) { copyText(cp.dataset.copy); return; }
  if (e.target.closest("a")) return;
  const tr = e.target.closest("tr[data-port]");
  if (tr) openDrawer(findBmc(tr));
});
$("#bmc-table").addEventListener("keydown", (e) => {
  const tr = e.target.closest("tr[data-port]");
  if (tr && e.key === "Enter") openDrawer(findBmc(tr));
});

// ------------------------------------------------------------------ Ngăn sửa BMC
const BOOL_FIELDS = ["auth", "console_auth", "legacy_tls", "jsesp_cache", "enabled", "jnlp_rewrite", "java_web"];
function fmtTcp(list) {
  if (!list) return "";
  if (typeof list === "string") return list;
  if (!Array.isArray(list)) return String(list);
  return list.map((t) => {
    if (t == null) return "";
    if (typeof t === "object") {
      const p = t.proxy != null ? t.proxy : t.port;
      const b = t.bmc != null ? t.bmc : (t.proxy != null ? t.bmc : t.port);
      if (p != null && b != null && p !== b) return `${p}:${b}`;
      if (p != null) return String(p);
      if (b != null) return String(b);
      return "";
    }
    return String(t).trim();
  }).filter(Boolean).join(", ");
}
const TEXT_FIELDS = ["site", "port", "upstream", "console_port", "console_upstream", "expected_target", "host_header", "note", "template", "jnlp_path", "tags", "expires"];

const selJnlpPreset = $("#sel-jnlp-preset");
if (selJnlpPreset) {
  selJnlpPreset.addEventListener("change", (e) => {
    if (e.target.value) {
      $("#bmc-form").jnlp_path.value = e.target.value;
      e.target.value = "";
    }
  });
}

function openDrawer(b) {
  const editable = b ? canEdit(b.site) : editableSites().length > 0;
  state.editing = b ? { site: b.site, port: b.port } : null;
  const f = $("#bmc-form");
  f.reset();
  $("#drawer-title").textContent = b ? `BMC ${b.port} · ${siteLabel(b.site)}` : "Thêm BMC";
  const dl = $("#drawer-links");
  dl.classList.toggle("hidden", !b);
  dl.innerHTML = b ? `<div class="hint">Link truy cập</div>${linkCell(b, true)}` : "";
  $("#drawer-sub").textContent = b
    ? [b.updated_by && `sửa lần cuối bởi ${b.updated_by}`, b.updated_at && fmtTs(b.updated_at), b.imported_from && `nhập từ ${b.imported_from}`].filter(Boolean).join(" · ")
    : "Khai báo một BMC mới";
  $("#bmc-form-error").textContent = editable ? "" : "Bạn chỉ có quyền xem BMC này.";
  $("#preview").textContent = "";
  $("#preview-wrap").open = false;
  const choices = b && !canEdit(b.site) ? state.sites.filter((s) => s.key === b.site) : editableSites();
  f.site.innerHTML = choices.map((s) => `<option value="${esc(s.key)}">${esc(s.label)} — ${esc(s.domain)}</option>`).join("");
  const d = b || { auth: true, console_auth: true, enabled: true, jnlp_rewrite: true, host_header: "client", site: $("#filter-site").value || (choices[0] || {}).key };
  fillTemplateSelect(f.template);
  TEXT_FIELDS.forEach((k) => { if (d[k] != null) f[k].value = d[k]; });
  f.tpl_ip.value = ((d.upstream || "").match(/^https?:\/\/([^:/]+)/) || [])[1] || "";
  BOOL_FIELDS.forEach((k) => { f[k].checked = k === "jnlp_rewrite" ? d[k] !== false : !!d[k]; });
  f.tcp_ports.value = fmtTcp(d.tcp_ports);
  f.max_conns.value = d.max_conns || "";
  f.tcp_allow_ips.value = (d.tcp_allow_ips || []).join(", ");
  const jq = $("#drawer-java-quick");
  if (jq) {
    const jurl = b ? javaOpenUrl(b) : "";
    if (b && jurl && (b.java_web || (b.tcp_ports || []).length)) {
      const host = (bmcLinks(b)?.web.match(/^https?:\/\/([^:/]+)/) || [])[1] || "";
      const jfile = javaJnlpPath(b, host).split("?")[0].split("/").pop() || "viewer.jnlp";
      jq.classList.remove("hidden");
      jq.style.display = "flex";
      jq.innerHTML = `<span style="font-size:12.5px;color:var(--text-2);font-weight:500;">Thử mở console:</span> ` + (b.java_web
        ? `<a class="btn small primary" href="${esc(jurl)}" target="_blank" rel="noopener">Mở console web ngay</a>`
        : `<a class="btn small" href="${esc(jurl)}" target="_blank" rel="noopener" download="${esc(jfile)}">Tải ${esc(jfile)}</a>`);
    } else {
      jq.classList.add("hidden");
      jq.style.display = "none";
      jq.innerHTML = "";
    }
  }
  $$("input, select", f).forEach((el) => { el.disabled = !editable; });
  $("#btn-delete").classList.toggle("hidden", !b || !editable);
  $("#btn-bmc-check").classList.toggle("hidden", !b || !editable);
  $("#btn-bmc-history").classList.toggle("hidden", !b);
  $("#btn-bmc-clone").classList.toggle("hidden", !b || !editable);
  $("#btn-save-bmc").classList.toggle("hidden", !editable);
  $("#drawer").classList.add("open");
  $("#drawer").setAttribute("aria-hidden", "false");
  $("#drawer-backdrop").classList.remove("hidden");
  setTimeout(() => (editable ? f.port : $("[data-close-drawer]", f)).focus(), 50);
}

function closeDrawer() {
  $("#drawer").classList.remove("open");
  $("#drawer").setAttribute("aria-hidden", "true");
  $("#drawer-backdrop").classList.add("hidden");
}
$$("[data-close-drawer]").forEach((b) => b.addEventListener("click", closeDrawer));
$("#drawer-backdrop").addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#drawer").classList.contains("open")) closeDrawer(); });

function formData() {
  const f = $("#bmc-form");
  const d = {};
  TEXT_FIELDS.forEach((k) => { d[k] = f[k].value.trim(); });
  BOOL_FIELDS.forEach((k) => { d[k] = f[k].checked; });
  d.port = d.port ? Number(d.port) : null;
  d.console_port = d.console_port ? Number(d.console_port) : null;
  if (!d.console_port) d.console_upstream = "";
  d.tcp_ports = f.tcp_ports.value.trim();
  d.max_conns = Number(f.max_conns.value || 0);
  d.tcp_allow_ips = f.tcp_allow_ips.value.trim();
  return d;
}

$("#bmc-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = formData();
  try {
    if (!state.editing) await api("POST", "bmcs", d);
    else await api("PUT", `bmcs/${state.editing.site}/${state.editing.port}`, d);
    closeDrawer();
    toast(`Đã lưu BMC ${d.port}`);
    await refreshAll();
  } catch (err) { $("#bmc-form-error").textContent = err.message; }
});

$("#btn-delete").addEventListener("click", async () => {
  const { site, port } = state.editing;
  if (!await confirmBox("Xoá BMC", `Xoá BMC cổng ${port} của ${siteLabel(site)}? Server chỉ gỡ cổng này khi bạn bấm Áp dụng.`, "Xoá")) return;
  try {
    await api("DELETE", `bmcs/${site}/${port}`);
    closeDrawer();
    toast(`Đã xoá BMC ${port}`);
    await refreshAll();
  } catch (err) { toast(err.message, true); }
});

$("#preview-wrap").addEventListener("toggle", async (e) => {
  if (!e.target.open) return;
  try {
    $("#preview").textContent = await api("POST", "render", { ...formData(), _orig: state.editing });
  } catch (err) { $("#preview").textContent = "Lỗi: " + err.message; }
});

// ------------------------------------------------------------------ Áp dụng
function renderPending() {
  const mine = state.sites.filter((s) => canEdit(s.key));
  const pend = mine.filter((s) => s.phase === "pending").length;
  const failed = mine.filter((s) => s.phase === "failed").length;
  const applying = mine.filter((s) => s.phase === "applying").length;
  const parts = [];
  if (pend) parts.push(`${pend} site có thay đổi chưa áp dụng`);
  if (failed) parts.push(`${failed} site áp dụng lỗi`);
  if (applying) parts.push(`${applying} site đang áp dụng`);
  $("#pending-bar").classList.toggle("hidden", !parts.length);
  $("#pending-text").textContent = parts.join(" · ");
}

function renderDiff(diff) {
  return diff.split("\n").map((ln) => {
    const cls = ln.startsWith("+") && !ln.startsWith("+++") ? "a" : ln.startsWith("-") && !ln.startsWith("---") ? "d" : ln.startsWith("@@") ? "h" : "";
    return cls ? `<span class="${cls}">${esc(ln)}</span>` : esc(ln) + "\n";
  }).join("");
}

function renderLog(rep) {
  if (!rep || !rep.log) return '<p class="hint">Chưa có kết quả.</p>';
  return `<div class="result-banner ${rep.ok ? "ok" : "bad"}">${rep.ok ? "Áp dụng thành công" : "Áp dụng thất bại — server đã khôi phục cấu hình cũ"} · ${esc(fmtTs(rep.at))} · bản ${esc(rep.rev)}</div>` +
    rep.log.map((s) => `<div class="step ${s.ok ? "ok" : "bad"}"><span class="mark">${s.ok ? "✓" : "✕"}</span>
      <b>${esc(s.step)}</b><pre class="code">${esc(s.output || "")}</pre></div>`).join("");
}

const KIND = { add: ["ok", "thêm"], modify: ["warn", "sửa"], delete: ["bad", "xoá"], disable: ["bad", "tắt"] };
const AREA = { static: "traefik.yml (restart Traefik)", dynamic: "Router (tự nạp, không gián đoạn)", nginx: "File nginx cũ sẽ tắt" };

async function openPlan(only) {
  const cands = state.sites.filter((s) => canEdit(s.key) && (only ? only.includes(s.key) : ["pending", "failed"].includes(s.phase)));
  const box = $("#plan-sites");
  if (!cands.length) {
    box.innerHTML = '<p class="hint">Mọi site đã đồng bộ.</p>';
    $("#btn-apply").disabled = true;
    return $("#dlg-plan").showModal();
  }
  box.innerHTML = cands.map((s) => `<section class="plan-site" data-plan-site="${esc(s.key)}">
    <header><input type="checkbox" checked aria-label="Chọn ${esc(s.label)}">${siteDot(s)}<h3>${esc(s.label)}</h3>${phaseTag(s)}
      <span class="grow"></span><span class="hint" data-plan-count>đang tải…</span></header>
    ${s.online ? "" : '<div class="plan-body"><p class="form-error">Agent đang mất liên lạc — thay đổi sẽ được áp dụng khi agent kết nối lại.</p></div>'}
    <div class="plan-body" data-plan-body></div></section>`).join("");
  $("#btn-apply").disabled = false;
  $("#dlg-plan").showModal();
  await Promise.all(cands.map(async (s) => {
    const sec = $(`[data-plan-site="${s.key}"]`, box);
    try {
      const plan = await api("GET", `sites/${s.key}/plan`);
      const counts = {};
      plan.forEach((c) => { counts[c.kind] = (counts[c.kind] || 0) + 1; });
      $("[data-plan-count]", sec).innerHTML = Object.entries(counts).map(([k, n]) => `<span class="tag ${KIND[k][0]}">${n} ${KIND[k][1]}</span>`).join("") || "không đổi file (áp dụng lại)";
      $("[data-plan-body]", sec).innerHTML = (s.phase === "failed" ? `<details class="plan-item"><summary><span class="tag bad">lỗi lần trước</span> xem chi tiết</summary><div class="plan-body">${renderLog(s.last_report)}</div></details>` : "") +
        Object.keys(AREA).map((area) => {
          const items = plan.filter((c) => c.area === area);
          if (!items.length) return "";
          return `<div class="plan-group"><h3>${AREA[area]}</h3>${items.map((c) => c.diff
            ? `<details class="plan-item"><summary><span class="tag ${KIND[c.kind][0]}">${KIND[c.kind][1]}</span><span class="mono">${esc(c.file)}</span></summary><pre class="code diff">${renderDiff(c.diff)}</pre></details>`
            : `<div class="plan-item plain-item"><span class="tag ${KIND[c.kind][0]}">${KIND[c.kind][1]}</span><span class="mono">${esc(c.file)}</span></div>`).join("")}</div>`;
        }).join("");
    } catch (err) { $("[data-plan-count]", sec).textContent = err.message; }
  }));
}
$("#btn-review").addEventListener("click", () => openPlan());

$("#btn-apply").addEventListener("click", async (e) => {
  const sites = $$("#plan-sites [data-plan-site]").filter((s) => $("input", s).checked).map((s) => s.dataset.planSite);
  if (!sites.length) return toast("Chưa chọn site nào", true);
  e.target.disabled = true;
  try {
    const failedSites = state.sites.filter((s) => sites.includes(s.key) && s.phase === "failed").map((s) => s.key);
    await api("POST", "apply", { sites, retry: failedSites.length > 0 });
    watchApply(sites);
  } catch (err) { toast(err.message, true); e.target.disabled = false; }
});

/** Theo dõi tiến độ áp dụng trên từng site (agent kéo cấu hình mỗi ~10 giây). */
async function watchApply(sites) {
  const dlg = $("#dlg-plan");
  if (!dlg.open) dlg.showModal();
  const box = $("#plan-sites");
  box.innerHTML = sites.map((k) => `<section class="plan-site" data-watch="${esc(k)}"><header><h3>${esc(siteLabel(k))}</h3>
    <span class="grow"></span><span data-watch-state><span class="tag info">đang chờ agent…</span></span></header><div class="plan-body" data-watch-log></div></section>`).join("");
  $("#btn-apply").disabled = true;
  const deadline = Date.now() + 120000;
  const done = new Set();
  while (Date.now() < deadline && done.size < sites.length && dlg.open) {
    await sleep(2500);
    let list;
    try { list = await api("GET", "sites"); } catch { continue; }
    for (const k of sites) {
      if (done.has(k)) continue;
      const s = list.find((x) => x.key === k);
      if (!s) continue;
      const sec = $(`[data-watch="${k}"]`, box);
      if (s.phase === "synced" || s.phase === "failed") {
        done.add(k);
        $("[data-watch-state]", sec).innerHTML = phaseTag(s);
        $("[data-watch-log]", sec).innerHTML = renderLog(s.last_report);
      } else if (!s.online) {
        $("[data-watch-state]", sec).innerHTML = '<span class="tag bad">agent mất liên lạc — sẽ áp dụng khi kết nối lại</span>';
      }
    }
  }
  await refreshAll();
}

// ------------------------------------------------------------------ Traefik
$("#traefik-site").addEventListener("input", loadTraefik);
async function loadTraefik() {
  const box = $("#traefik-body");
  const toolbar = $("#traefik-toolbar") || $("#traefik-site")?.closest(".toolbar");
  if (!state.sites || !state.sites.length) {
    if (toolbar) toolbar.classList.add("hidden");
    box.innerHTML = `<div class="panel empty" style="text-align:center; padding: 48px 24px;">
      <div style="width:48px; height:48px; margin:0 auto 16px; border-radius:50%; background:var(--panel-2); display:grid; place-items:center; color:var(--side-muted);">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16V4m0 0L3 8m4-4l4 4m10 4v12m0 0l4-4m-4 4l-4-4"/></svg>
      </div>
      <h3 style="margin-bottom:8px;">Chưa có server Traefik (Site) nào</h3>
      <p class="hint" style="max-width:480px; margin:0 auto 20px;">
        Mỗi site là một server Traefik chạy Agent (HN, HCM, DN, CT). Bạn hãy vào mục <b>Site</b> để thêm server mới và nhận mã kết nối agent.
      </p>
      <a class="btn primary" href="#sites">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        Đi tới trang Quản lý Site
      </a>
    </div>`;
    return;
  }
  if (toolbar) toolbar.classList.remove("hidden");
  const site = $("#traefik-site").value || (state.sites[0] || {}).key;
  if (!site) return;
  $("#traefik-site").value = site;
  let t;
  try { t = await api("GET", `traefik?site=${encodeURIComponent(site)}`); } catch (err) {
    box.innerHTML = `<div class="panel"><p class="form-error">${esc(err.message)}</p></div>`;
    return;
  }
  if (!t.online) { box.innerHTML = '<div class="panel"><h2>Agent mất liên lạc</h2><p class="hint mt">Không có dữ liệu mới từ server này.</p></div>'; return; }
  if (!t.reachable) {
    box.innerHTML = `<div class="panel"><h2>Agent không gọi được API Traefik</h2><p class="mt">${t.api ? `<code>${esc(t.api)}</code> ${t.error ? `(${esc(t.error)})` : ""}` : "Chưa cấu hình traefik_api trong agent.json"}</p>
      <p class="hint">Trên server: <code>systemctl status traefik</code></p></div>`;
    return;
  }
  const routers = t.routers || [];
  const bad = routers.filter((r) => r.status !== "enabled" || r.error);
  box.innerHTML = `<div class="kpis">
      <div class="kpi accent"><div class="lbl">Phiên bản</div><div class="num" style="font-size:20px">${esc(t.version || "?")}</div><div class="foot">${esc(siteLabel(site))}</div></div>
      <div class="kpi"><div class="lbl">EntryPoint</div><div class="num">${t.entrypoints}</div><div class="foot">cổng đang mở</div></div>
      <div class="kpi ok"><div class="lbl">Router BMC</div><div class="num">${routers.length}</div><div class="foot">do bmcproxy tạo</div></div>
      <div class="kpi ${bad.length ? "bad" : "ok"}"><div class="lbl">Router lỗi</div><div class="num">${bad.length}</div><div class="foot"></div></div>
    </div>
    <div class="panel flush"><div class="table-wrap"><table class="table">
      <thead><tr><th>Router</th><th>EntryPoint</th><th>Rule</th><th>Trạng thái</th></tr></thead>
      <tbody>${routers.map((r) => `<tr><td class="mono">${esc(r.name)}</td><td class="mono">${esc((r.entryPoints || []).join(", "))}</td>
        <td class="mono cell-sub">${esc(r.rule)}</td>
        <td>${r.status === "enabled" && !r.error ? '<span class="tag ok">enabled</span>' : `<span class="tag bad">${esc(r.status)}</span> <span class="cell-sub">${esc(r.error)}</span>`}</td></tr>`).join("")
    || '<tr><td colspan="4" class="hint" style="padding:20px">Chưa có router nào.</td></tr>'}</tbody></table></div></div>`;
}

// ------------------------------------------------------------------ Nhật ký
$("#audit-site").addEventListener("input", loadAudit);
async function loadAudit() {
  const site = $("#audit-site").value;
  const list = (await api("GET", "audit")).filter((a) => !site || a.site === site);
  $("#audit-list").innerHTML = list.map((a) => `<tr><td class="mono">${esc(fmtTs(a.ts))}</td><td>${esc(a.user)}</td>
    <td>${a.site ? `<span class="tag">${esc(siteLabel(a.site))}</span>` : ""}</td>
    <td><span class="tag ${/failed|delete/.test(a.action) ? "bad" : /ok|online/.test(a.action) ? "ok" : ""}">${esc(a.action)}</span></td>
    <td class="cell-sub">${esc(a.detail)}</td></tr>`).join("") || '<tr><td colspan="5" class="hint" style="padding:24px">Chưa có.</td></tr>';
}

// ------------------------------------------------------------------ Sao lưu
const BLABEL = { import: "Trước khi nhập nginx", "before-restore": "Trước khi khôi phục", "site-delete": "Trước khi xoá site" };
async function loadBackups() {
  const list = await api("GET", "backups");
  $("#backup-list").innerHTML = list.length ? list.map((b) => `<tr><td>${esc(fmtTs(b.ts))}</td><td>${esc(BLABEL[b.label] || b.label)}</td>
    <td>${Object.entries(b.sites || {}).map(([k, n]) => `<span class="tag">${esc(k)}: ${n}</span>`).join("")}</td>
    <td style="text-align:right"><button class="btn small" data-restore="${esc(b.name)}">Khôi phục</button></td></tr>`).join("")
    : '<tr><td colspan="4" class="hint" style="padding:24px">Chưa có bản sao lưu.</td></tr>';
}
$("#backup-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-restore]");
  if (!btn) return;
  if (!await confirmBox("Khôi phục dữ liệu", "Đưa danh sách BMC, site và cài đặt về bản này? Trạng thái hiện tại sẽ được sao lưu trước. Sau đó bấm Áp dụng để đẩy xuống server.", "Khôi phục")) return;
  try {
    await api("POST", `backups/${encodeURIComponent(btn.dataset.restore)}/restore`);
    toast("Đã khôi phục. Kiểm tra rồi bấm Áp dụng.");
    await refreshAll();
    await loadBackups();
  } catch (err) { toast(err.message, true); }
});

// ------------------------------------------------------------------ Người dùng
async function loadUsers() {
  const list = await api("GET", "users");
  state.users = list;
  const STATUS = { active: '<span class="tag ok">hoạt động</span>', disabled: '<span class="tag bad">đã khoá</span>',
    expired: '<span class="tag bad">hết hạn</span>' };
  $("#user-list").innerHTML = list.map((u) => {
    const ll = u.last_login;
    const sess = (u.sessions || []).length;
    return `<tr><td><b>${esc(u.name)}</b>${u.name === state.me.name ? ' <span class="tag">bạn</span>' : ""}
      ${u.full_name ? `<div class="cell-sub">${esc(u.full_name)}</div>` : ""}
      ${u.email ? `<div class="cell-sub">${esc(u.email)}</div>` : ""}${u.note ? `<div class="cell-sub">${esc(u.note)}</div>` : ""}</td>
    <td><span class="tag ${u.role === "admin" ? "info" : ""}">${ROLE_LABEL[u.role] || u.role}</span></td>
    <td>${u.role === "admin" || !u.sites.length ? '<span class="cell-sub">mọi site</span>' : u.sites.map((s) => `<span class="tag">${esc(siteLabel(s))}</span>`).join("")}</td>
    <td>${STATUS[u.status] || ""} ${u.source === "ldap" ? `<span class="tag info" title="${esc((u.ldap_groups || []).join("\n") || "Đăng nhập bằng AD")}">AD</span>` : ""}
      ${u.totp ? '<span class="tag info" title="Đã bật xác thực 2 lớp">2FA</span>' : ""}
      ${u.must_change ? '<span class="tag warn">phải đổi MK</span>' : ""}
      ${u.expires ? `<div class="cell-sub">hết hạn ${esc(u.expires)}</div>` : ""}</td>
    <td>${ll ? `<div class="mono cell-sub">${esc(fmtTime(ll.ts))}</div><div class="mono cell-sub">${esc(ll.ip || "")}</div>` : '<span class="cell-sub">chưa đăng nhập</span>'}</td>
    <td>${sess ? `<span class="tag ok" title="${esc((u.sessions || []).map((s) => s.ip + " từ " + fmtTime(s.since) + (s.remember ? " (ghi nhớ 30 ngày)" : "")).join("\n"))}">${sess} đang mở</span>` : '<span class="cell-sub">-</span>'}</td>
    <td style="text-align:right;white-space:nowrap"><button class="btn small" data-user-edit="${esc(u.name)}">Sửa</button>
      <button class="btn small" data-user-hist="${esc(u.name)}">Lịch sử</button>
      ${sess && u.name !== state.me.name ? `<button class="btn small" data-user-logout="${esc(u.name)}" title="Đăng xuất mọi phiên của tài khoản này">Đăng xuất</button>` : ""}
      ${u.name === state.me.name ? "" : `<button class="btn small danger-ghost" data-user-del="${esc(u.name)}">Xoá</button>`}</td></tr>`;
  }).join("");
}
const fmtTime = (iso) => (iso ? String(iso).replace("T", " ").slice(0, 16) : "");
$("#user-list").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-user-edit]");
  if (ed) return editUser(state.users.find((u) => u.name === ed.dataset.userEdit));
  const lo = e.target.closest("[data-user-logout]");
  if (lo && await confirmBox("Đăng xuất mọi phiên", `Đăng xuất ${lo.dataset.userLogout} khỏi mọi trình duyệt đang mở?`, "Đăng xuất")) {
    try { const r = await api("POST", `users/${encodeURIComponent(lo.dataset.userLogout)}/logout`); toast(`Đã đăng xuất ${r.dropped} phiên`); loadUsers(); }
    catch (err) { toast(err.message, true); }
    return;
  }
  const hi = e.target.closest("[data-user-hist]");
  if (hi) {
    try {
      const rows = await api("GET", `users/${encodeURIComponent(hi.dataset.userHist)}/history`);
      const LBL = { login: '<span class="tag ok">đăng nhập</span>', "login-fail": '<span class="tag bad">thất bại</span>',
        password: '<span class="tag">đổi mật khẩu</span>', "2fa-on": '<span class="tag info">bật 2FA</span>', "2fa-off": '<span class="tag warn">tắt 2FA</span>' };
      infoBox(`Lịch sử đăng nhập · ${hi.dataset.userHist}`, rows.length
        ? `<div class="table-wrap"><table class="table"><thead><tr><th>Thời điểm</th><th>Sự kiện</th><th>Chi tiết</th></tr></thead><tbody>${rows.map((r) =>
          `<tr><td class="mono">${esc(fmtTime(r.ts))}</td><td>${LBL[r.action] || esc(r.action)}</td><td class="mono cell-sub">${esc(r.detail || "")}</td></tr>`).join("")}</tbody></table></div>`
        : '<p class="hint">Chưa có lần đăng nhập nào được ghi lại.</p>');
    } catch (err) { toast(err.message, true); }
    return;
  }
  const del = e.target.closest("[data-user-del]");
  if (del && await confirmBox("Xoá tài khoản", `Xoá tài khoản ${del.dataset.userDel}?`, "Xoá")) {
    try { await api("DELETE", `users/${encodeURIComponent(del.dataset.userDel)}`); toast("Đã xoá"); loadUsers(); } catch (err) { toast(err.message, true); }
  }
});
function editUser(u) {
  const ad = u && u.source === "ldap";
  formBox(u ? `Sửa tài khoản ${u.name}` + (ad ? " (AD)" : "") : "Thêm tài khoản", [
    ...(u ? [] : [{ name: "name", label: "Tên đăng nhập", span: false },
      { type: "select", name: "source", label: "Loại tài khoản", value: "", span: false,
        options: [["", "Tài khoản riêng của web (có mật khẩu)"], ["ldap", "Tài khoản AD (mật khẩu theo AD, bỏ qua ô mật khẩu)"]] }]),
    ...(ad ? [{ type: "html", html: `<p class="hint">Đăng nhập bằng AD. Vai trò / site được cập nhật theo nhóm AD mỗi lần đăng nhập
      (nếu thuộc nhóm đã khai báo ở Cài đặt → AD). Nhóm hiện tại: ${(u.ldap_groups || []).map((g) => `<span class="tag">${esc(g.replace(/^cn=([^,]+).*/i, "$1"))}</span>`).join(" ") || "chưa có"}</p>` }] : []),
    {
      type: "select", name: "role", label: "Vai trò", value: u ? u.role : "operator", span: false,
      options: Object.entries(ROLE_LABEL)
    },
    {
      type: "checks", name: "sites", label: "Phạm vi site (để trống = mọi site; quản trị luôn là mọi site)", value: u ? u.sites : [],
      options: state.sites.map((s) => [s.key, s.label])
    },
    { name: "full_name", label: "Họ tên", value: u ? u.full_name : "", span: false },
    { name: "email", label: "Email / điện thoại", value: u ? u.email : "", span: false },
    { name: "note", label: "Ghi chú", value: u ? u.note : "", placeholder: "vd nhà thầu, phòng NOC" },
    { type: "select", name: "disabled", label: "Trạng thái", value: u && u.disabled ? "1" : "", span: false,
      options: [["", "Hoạt động"], ["1", "Khoá (không đăng nhập được, đăng xuất ngay)"]] },
    { name: "expires", label: "Hết hạn ngày (để trống = không hết hạn)", type: "date", value: u ? u.expires : "", span: false },
    ...(ad ? [] : [
      { name: "password", label: u ? "Đặt lại mật khẩu (để trống nếu không đổi)" : "Mật khẩu (≥ 10 ký tự, bỏ trống nếu là tài khoản AD)", type: "password", span: false },
      { type: "select", name: "must_change", label: "Khi đăng nhập lần sau", value: "1", span: false,
        options: [["1", "Bắt đổi mật khẩu"], ["", "Không bắt đổi"]] }]),
    ...(u && u.totp ? [{ type: "select", name: "reset_2fa", label: "Xác thực 2 lớp", value: "", span: false,
      options: [["", "Giữ nguyên (đang bật)"], ["1", "Tắt 2FA (người dùng mất điện thoại)"]] }] : []),
    ...(u ? [{ type: "html", html: `<p class="hint">Tạo ${esc(fmtTime(u.created_at)) || "?"}${u.created_by ? " bởi " + esc(u.created_by) : ""}
      · đổi mật khẩu gần nhất ${esc(fmtTime(u.password_changed)) || "chưa rõ"}</p>` }] : []),
  ], async (d) => {
    if (u) await api("PUT", `users/${encodeURIComponent(u.name)}`, d);
    else await api("POST", "users", d);
    toast("Đã lưu tài khoản");
    loadUsers();
  });
}

// ------------------------------------------------------------------ Cài đặt
function renderTwofa() {
  const on = !!state.me.totp;
  $("#twofa-state").className = "tag " + (on ? "ok" : "");
  $("#twofa-state").textContent = on ? "đang bật" : "chưa bật";
  $("#twofa-body").innerHTML = on
    ? '<button class="btn" id="btn-2fa-off" type="button">Tắt 2FA</button>'
    : '<button class="btn primary" id="btn-2fa-on" type="button">Bật 2FA</button>';
}
$("#twofa-body").addEventListener("click", async (e) => {
  if (e.target.closest("#btn-2fa-on")) {
    try {
      const r = await api("POST", "2fa", { action: "setup" });
      const key = r.secret.replace(/(.{4})/g, "$1 ").trim();
      formBox("Bật xác thực 2 lớp", [
        { type: "html", html: `<ol class="hint" style="margin:0 0 8px 18px">
          <li>Mở ứng dụng Authenticator trên điện thoại → <b>Thêm tài khoản</b> → <b>Nhập khoá thiết lập</b> (setup key).</li>
          <li>Tên tài khoản: <b>Treafix Proxy BB (${esc(state.me.name)})</b> · Khoá: <code class="mono" style="font-size:15px">${esc(key)}</code> · loại: theo thời gian.</li>
          <li>Nhập mã 6 số ứng dụng hiện ra rồi bấm <b>Bật</b>.</li></ol>
          <p class="hint">Link cho ứng dụng hỗ trợ: <code class="mono" style="word-break:break-all">${esc(r.uri)}</code></p>` },
        { name: "code", label: "Mã 6 số", placeholder: "123456", span: false },
      ], async (d) => {
        await api("POST", "2fa", { action: "enable", code: d.code });
        state.me.totp = true;
        renderTwofa();
        toast("Đã bật xác thực 2 lớp");
      }, "Bật");
    } catch (err) { toast(err.message, true); }
  }
  if (e.target.closest("#btn-2fa-off")) {
    formBox("Tắt xác thực 2 lớp", [{ name: "password", label: state.me.source === "ldap" ? "Nhập mật khẩu AD để xác nhận" : "Nhập mật khẩu để xác nhận", type: "password" }], async (d) => {
      await api("POST", "2fa", { action: "disable", password: d.password });
      state.me.totp = false;
      renderTwofa();
      toast("Đã tắt xác thực 2 lớp");
    }, "Tắt 2FA");
  }
});

const LDAP_TEXT = ["mode", "domain", "servers", "ca_file", "base_dn", "bind_dn", "user_filter", "user_dn_template",
  "group_admin", "group_operator", "group_viewer", "site_groups", "default_role", "timeout"];
const LDAP_BOOL = ["enabled", "verify_tls", "starttls", "nested"];
async function loadLdap() {
  const f = $("#ldap-form");
  f.classList.toggle("hidden", !isAdmin());
  if (!isAdmin()) return;
  const c = await api("GET", "ldap");
  LDAP_TEXT.forEach((k) => { f[k].value = c[k] ?? ""; });
  LDAP_BOOL.forEach((k) => { f[k].checked = !!c[k]; });
  f.bind_password.value = "";
  f.bind_password.placeholder = c.has_bind_password ? "đã lưu - để trống = giữ nguyên" : "";
  $("#ldap-missing").classList.toggle("hidden", c.available);
  $("#ldap-state").className = "tag " + (c.enabled ? "ok" : "");
  $("#ldap-state").textContent = c.enabled ? "đang bật" : "đang tắt";
}
function ldapBody() {
  const f = $("#ldap-form");
  const b = {};
  LDAP_TEXT.forEach((k) => { b[k] = f[k].value; });
  LDAP_BOOL.forEach((k) => { b[k] = f[k].checked; });
  b.timeout = Number(b.timeout) || 5;
  if (f.bind_password.value) b.bind_password = f.bind_password.value;
  return b;
}
$("#ldap-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#ldap-msg");
  try {
    await api("PUT", "ldap", ldapBody());
    msg.className = "form-msg ok";
    msg.textContent = "Đã lưu (có hiệu lực ngay, không cần Áp dụng).";
    await loadLdap();
  } catch (err) { msg.className = "form-msg error"; msg.textContent = err.message; }
});
$("#btn-ldap-test").addEventListener("click", async () => {
  const f = $("#ldap-form");
  const out = $("#ldap-result");
  const msg = $("#ldap-msg");
  msg.textContent = "";
  out.innerHTML = '<p class="hint">Đang kiểm tra…</p>';
  try {
    const r = await api("POST", "ldap/test", { ...ldapBody(), test_user: f.test_user.value, test_password: f.test_password.value });
    f.test_password.value = "";
    if (!r.ok) { out.innerHTML = `<p class="form-msg error">✗ ${esc(r.error)}</p>`; return; }
    if (!r.user) { out.innerHTML = `<p class="form-msg ok">✓ ${esc(r.message)}</p>`; return; }
    out.innerHTML = `<p class="form-msg ok">✓ Đăng nhập AD đúng: <b>${esc(r.user.full_name || r.user.name)}</b> (${esc(r.user.name)})</p>
      <dl class="kv"><dt>DN</dt><dd class="mono">${esc(r.user.dn)}</dd><dt>Email</dt><dd>${esc(r.user.email || "-")}</dd>
      <dt>Nhóm (${r.user.groups.length})</dt><dd>${r.user.groups.map((g) => `<span class="tag" title="${esc(g)}">${esc(g.replace(/^cn=([^,]+).*/i, "$1"))}</span>`).join(" ") || "-"}</dd>
      <dt>Vào web với vai trò</dt><dd>${r.role ? `<b>${esc(ROLE_LABEL[r.role] || r.role)}</b> · ${r.role === "admin" || !r.sites.length ? "mọi site" : esc(r.sites.join(", "))}` : "-"}</dd></dl>
      ${r.verdict ? `<p class="form-msg error">${esc(r.verdict)}</p>` : ""}`;
  } catch (err) { out.innerHTML = `<p class="form-msg error">✗ ${esc(err.message)}</p>`; }
});

function renderSettings() {
  renderTwofa();
  loadLdap().catch((err) => { $("#ldap-msg").textContent = err.message; });
  $("#password-form").classList.toggle("hidden", state.me.source === "ldap");
  const r = state.settings;
  const s = r.settings;
  const f = $("#settings-form");
  ["auth_url", "auth_cache_seconds", "auth_timeout", "cert_file", "key_file", "access_log", "log_level", "cert_warn_days"]
    .forEach((k) => { f[k].value = s[k]; });
  f.auth_verify_tls.checked = !!s.auth_verify_tls;
  $$("input, select", f).forEach((el) => { el.disabled = !isAdmin(); });
  $("#settings-ro").textContent = isAdmin() ? "" : "chỉ quản trị viên được sửa";
  $("#settings-msg").textContent = "";
  $("#server-info").innerHTML = [
    ["Phiên bản", r.version], ["Tài khoản", `${state.me.name} (${ROLE_LABEL[state.me.role]})`],
    ["Agent mất liên lạc sau", `${r.offline_after} giây không báo về`],
    ...(r.storage ? [["Lưu dữ liệu", r.storage.kind === "json"
      ? "file JSON trên server (chưa dùng DB - chạy install.sh db)"
      : `${r.storage.describe}${r.storage.kind === "mysql" ? (r.storage.tls ? " · TLS" : " · chưa mã hoá") : ""}`],
    ...(r.storage.kind !== "json" ? [["Trong DB", `${r.storage.docs ?? "?"} bảng dữ liệu · ${r.storage.audit ?? "?"} dòng nhật ký · `
      + `${(r.storage.blobs || {}).release || 0} bản cấu hình · ${(r.storage.blobs || {}).backup || 0} bản sao lưu · `
      + `${(r.storage.blobs || {}).session ? "có" : "chưa có"} phiên đăng nhập`]] : []),
    ...(r.storage.error ? [["Lỗi DB", r.storage.error]] : [])] : []),
    ["API Zabbix", r.zabbix_enabled ? "/api/zabbix · /api/zabbix?type=sites (header X-Api-Token)" : "tắt — đặt zabbix_token trong config.json"],
  ].map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
}

$("#settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const body = {
    auth_url: f.auth_url.value, auth_cache_seconds: Number(f.auth_cache_seconds.value), auth_timeout: Number(f.auth_timeout.value),
    auth_verify_tls: f.auth_verify_tls.checked, cert_file: f.cert_file.value, key_file: f.key_file.value,
    access_log: f.access_log.value, log_level: f.log_level.value, cert_warn_days: Number(f.cert_warn_days.value) || 30,
  };
  const msg = $("#settings-msg");
  try {
    await api("PUT", "settings", body);
    state.settings = await api("GET", "settings");
    msg.className = "form-msg ok";
    msg.textContent = "Đã lưu. Mọi site sẽ cần Áp dụng.";
    await refreshAll();
  } catch (err) { msg.className = "form-msg error"; msg.textContent = err.message; }
});

$("#password-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const msg = $("#password-msg");
  try {
    await api("POST", "password", { old: f.old.value, new: f.new.value });
    f.reset();
    msg.className = "form-msg ok";
    msg.textContent = "Đã đổi mật khẩu.";
  } catch (err) { msg.className = "form-msg error"; msg.textContent = err.message; }
});

// ------------------------------------------------------------------ Khởi động
(async () => {
  try { await showApp(await api("GET", "me")); } catch { showLogin(); }
  setInterval(() => {
    if (!$("#app").classList.contains("hidden") && !document.hidden && !$("#dlg-plan").open) refreshAll().catch(() => { });
  }, 15000);
})();


// ------------------------------------------------------------------ Mẫu BMC
function tplText(v, kind) {
  if (kind === "upstream") return v === "default" ? "https://IP" : v === "same" ? "https://IP:<cổng proxy>" : `https://IP:${v}`;
  return v === "none" ? "không có" : v === "same" ? "https://IP:<cổng console>" : `https://IP:${v} (cố định)`;
}

function fillTemplateSelect(sel) {
  const cur = sel.value;
  sel.innerHTML = '<option value="">— không dùng mẫu —</option>' +
    Object.entries(state.templates).map(([k, t]) => `<option value="${esc(k)}">${esc(t.label)}${t.builtin ? "" : " (riêng)"}</option>`).join("");
  sel.value = cur;
}

async function applyTemplate(quiet) {
  const f = $("#bmc-form");
  const key = f.template.value;
  if (!key) { if (!quiet) toast("Chọn loại máy trước", true); return; }
  if (!f.tpl_ip.value.trim()) { if (!quiet) toast("Gõ IP của BMC trước", true); return; }
  try {
    const r = await api("POST", `templates/${encodeURIComponent(key)}/apply`,
      { port: f.port.value, ip: f.tpl_ip.value, console_port: f.console_port.value || null });
    f.upstream.value = r.upstream;
    f.console_port.value = r.console_port || "";
    f.console_upstream.value = r.console_upstream || "";
    f.legacy_tls.checked = r.legacy_tls;
    f.jsesp_cache.checked = r.jsesp_cache;
    f.java_web.checked = !!r.java_web;
    f.max_conns.value = r.max_conns || "";
    f.host_header.value = r.host_header;
    f.jnlp_path.value = r.jnlp_path || "";
    $("#bmc-form-error").textContent = "";
    toast(`Đã điền theo mẫu ${state.templates[key].label}: ${r.upstream}`);
  } catch (err) { $("#bmc-form-error").textContent = err.message; }
}
$("#btn-apply-tpl").addEventListener("click", () => applyTemplate(false));
// Doi loai may / go xong IP -> tu dien; khong co mau -> chi thay IP trong Dia chi BMC
$("#bmc-form").template.addEventListener("change", () => applyTemplate(true));
$("#bmc-form").tpl_ip.addEventListener("change", () => {
  const f = $("#bmc-form");
  const ip = f.tpl_ip.value.trim();
  if (!ip) return;
  if (f.template.value) return applyTemplate(true);
  const m = f.upstream.value.match(/^(https?:\/\/)([^:/]+)(.*)$/);
  f.upstream.value = m ? m[1] + ip + m[3] : `https://${ip}`;
});
// Sua tay Dia chi BMC -> o IP dong bo theo (2 o khong bao gio lech nhau)
$("#bmc-form").upstream.addEventListener("input", () => {
  const f = $("#bmc-form");
  f.tpl_ip.value = (f.upstream.value.match(/^https?:\/\/([^:/]+)/) || [])[1] || "";
});

$("#btn-free-port").addEventListener("click", async () => {
  const f = $("#bmc-form");
  if (!f.site.value) return;
  try {
    const r = await api("GET", `sites/${f.site.value}/free-ports`);
    if (r.port) f.port.value = r.port;
    const tpl = state.templates[f.template.value];
    if (r.console_port && (!tpl || tpl.console !== "none")) f.console_port.value = r.console_port;
    toast(`Cổng trống: ${r.port}${r.console_port ? `, console ${r.console_port}` : ""}`);
  } catch (err) { toast(err.message, true); }
});

async function openTemplates() {
  state.templates = await api("GET", "templates");
  const used = {};
  state.bmcs.forEach((b) => { if (b.template) used[b.template] = (used[b.template] || 0) + 1; });
  $("#tpl-list").innerHTML = Object.entries(state.templates).map(([k, t]) => `<tr>
    <td class="mono">${esc(k)}</td><td><b>${esc(t.label)}</b> ${t.builtin ? '<span class="tag">có sẵn</span>' : '<span class="tag info">riêng</span>'}</td>
    <td class="mono cell-sub">${esc(tplText(t.upstream, "upstream"))}</td><td class="mono cell-sub">${esc(tplText(t.console, "console"))}</td>
    <td>${t.legacy_tls ? '<span class="tag warn">TLS cũ</span>' : ""}${t.jsesp_cache ? '<span class="tag">jsesp</span>' : ""}${t.host_header === "upstream" ? '<span class="tag">Host = IP</span>' : ""}${t.java_web ? '<span class="tag info">Java web</span>' : ""}</td>
    <td>${used[k] || 0}</td>
    <td style="text-align:right">${!t.builtin && isAdmin() ? `<button class="btn small" data-tpl-edit="${esc(k)}">Sửa</button>
      <button class="btn small danger-ghost" data-tpl-del="${esc(k)}">Xoá</button>` : ""}</td></tr>`).join("");
  $$("[data-admin-only]", $("#dlg-templates")).forEach((x) => x.classList.toggle("hidden", !isAdmin()));
  if (!$("#dlg-templates").open) $("#dlg-templates").showModal();
}

function editTemplate(key) {
  const t = key ? state.templates[key] : { upstream: "default", console: "none", host_header: "client" };
  const mode = (v, a, b) => (v === a || v === b ? v : "fixed");
  formBox(key ? `Sửa mẫu ${key}` : "Thêm mẫu BMC", [
    ...(key ? [] : [{ name: "key", label: "Mã mẫu (a-z, 0-9, - _)", placeholder: "vd idrac9-custom", span: false }]),
    { name: "label", label: "Tên loại máy", value: t.label || "", placeholder: "vd Dell R750 iDRAC 9", span: false },
    {
      type: "select", name: "upstream_mode", label: "Địa chỉ BMC", value: mode(t.upstream, "default", "same"), span: false,
      options: [["default", "https://IP (cổng 443)"], ["same", "https://IP:<cổng proxy>"], ["fixed", "https://IP:<cổng cố định>"]]
    },
    { name: "upstream_port", label: "Cổng cố định tới BMC", type: "number", value: typeof t.upstream === "number" ? t.upstream : "", span: false },
    {
      type: "select", name: "console_mode", label: "Console", value: mode(t.console, "none", "same"), span: false,
      options: [["none", "Không có"], ["same", "https://IP:<cổng console>"], ["fixed", "https://IP:<cổng cố định>"]]
    },
    { name: "console_port", label: "Cổng console cố định trên BMC", type: "number", value: typeof t.console === "number" ? t.console : "", span: false },
    { type: "select", name: "legacy_tls", label: "BMC đời cũ (TLS cũ)", value: t.legacy_tls ? "1" : "", span: false, options: [["", "Không"], ["1", "Có"]] },
    { type: "select", name: "jsesp_cache", label: "Cache .jsesp", value: t.jsesp_cache ? "1" : "", span: false, options: [["", "Không"], ["1", "Có"]] },
    { type: "select", name: "host_header", label: "Host header", value: t.host_header || "client", options: [["client", "Tên miền proxy"], ["upstream", "IP của BMC"]] },
    { type: "select", name: "java_web", label: "Console Java trên web", value: t.java_web ? "1" : "", span: false, options: [["", "Không"], ["1", "Có"]] },
  ], async (d) => {
    const k = key || d.key;
    const body = {
      label: d.label, legacy_tls: !!d.legacy_tls, jsesp_cache: !!d.jsesp_cache, host_header: d.host_header, java_web: !!d.java_web,
      upstream: d.upstream_mode === "fixed" ? Number(d.upstream_port) : d.upstream_mode,
      console: d.console_mode === "fixed" ? Number(d.console_port) : d.console_mode,
    };
    await api("PUT", `templates/${encodeURIComponent(k)}`, body);
    toast("Đã lưu mẫu");
    await openTemplates();
  });
}

$("#btn-tpl-add").addEventListener("click", () => editTemplate(null));
$("#tpl-list").addEventListener("click", async (e) => {
  const ed = e.target.closest("[data-tpl-edit]");
  if (ed) return editTemplate(ed.dataset.tplEdit);
  const del = e.target.closest("[data-tpl-del]");
  if (del && await confirmBox("Xoá mẫu", `Xoá mẫu ${del.dataset.tplDel}?`, "Xoá")) {
    try { await api("DELETE", `templates/${encodeURIComponent(del.dataset.tplDel)}`); await openTemplates(); } catch (err) { toast(err.message, true); }
  }
});

// ------------------------------------------------------------------ Thêm hàng loạt
function openBulk() {
  $("#bulk-result").innerHTML = "";
  $("#bulk-summary").textContent = "";
  $("#btn-bulk-save").disabled = true;
  $("#dlg-bulk").showModal();
  $("#bulk-text").focus();
}

$("#btn-bulk-example").addEventListener("click", () => {
  const sites = editableSites().map((x) => x.key);
  const a = sites[0] || "hn", b = sites[1] || a;
  $("#bulk-text").value = `# site, cổng, ip, cổng console, mẫu, ghi chú
${a}, 8200, 10.3.7.201, 5200, idrac7-8, KH 1942xxxx
${a}, 8201, 10.3.7.202, , idrac9, KH 1943xxxx
${b}, 8202, 10.2.7.15, 5202, supermicro, KH 2001xxxx
${b}, 8203, 10.2.7.16, , ilo4-5, KH 2002xxxx`;
});

async function runBulk(commit) {
  const body = { text: $("#bulk-text").value, update_existing: $("#bulk-update").checked, commit };
  const box = $("#bulk-result");
  try {
    const r = await api("POST", "bmcs/bulk", body);
    box.innerHTML = `<div class="table-wrap"><table class="table bulk-table"><thead><tr><th>Dòng</th><th>Site</th><th>Cổng</th><th>Kết quả</th><th>Địa chỉ BMC</th><th>Console</th><th>Mẫu</th></tr></thead><tbody>
      ${r.rows.map((x) => `<tr class="${x.ok ? "" : "err"}"><td>${x.line}</td><td>${esc(x.site)}</td><td>${esc(x.port)}</td>
        <td>${x.ok ? `<span class="tag ok">${esc(x.action)}</span>` : `<span class="tag bad">lỗi</span> ${esc(x.error)}`}</td>
        <td class="mono cell-sub">${esc(x.upstream || "")}</td><td>${esc(x.console_port || "")}</td><td>${esc(x.template || "")}</td></tr>`).join("")}
      </tbody></table></div>`;
    const okN = r.rows.length - r.errors;
    if (commit && r.saved) {
      toast(`Đã lưu ${r.saved} BMC. Bấm “Xem & áp dụng” để đẩy xuống server.`);
      $("#dlg-bulk").close();
      await refreshAll();
      return;
    }
    $("#bulk-summary").textContent = r.errors ? `${r.errors} dòng lỗi - sửa rồi Kiểm tra lại` : `${okN} dòng hợp lệ`;
    $("#btn-bulk-save").disabled = r.errors > 0 || okN === 0;
  } catch (err) {
    box.innerHTML = `<p class="form-error">${esc(err.message)}</p>`;
    $("#btn-bulk-save").disabled = true;
  }
}
$("#btn-bulk-check").addEventListener("click", () => runBulk(false));
$("#btn-bulk-save").addEventListener("click", () => runBulk(true));
$("#bulk-text").addEventListener("input", () => { $("#btn-bulk-save").disabled = true; });

// ------------------------------------------------------------------ Chọn nhiều / sửa hàng loạt
function renderBulkBar() {
  const known = new Set(state.bmcs.map((b) => `${b.site}:${b.port}`));
  [...state.selected].forEach((k) => { if (!known.has(k)) state.selected.delete(k); });
  const n = state.selected.size;
  $("#bulk-bar").classList.toggle("hidden", !n);
  $("#bulk-count").textContent = n;
  const vis = (state.visibleRows || []).filter((b) => canEdit(b.site));
  const all = $("#check-all");
  all.checked = vis.length > 0 && vis.every((b) => state.selected.has(`${b.site}:${b.port}`));
  all.indeterminate = !all.checked && vis.some((b) => state.selected.has(`${b.site}:${b.port}`));
}

$("#check-all").addEventListener("click", (e) => {
  const vis = (state.visibleRows || []).filter((b) => canEdit(b.site));
  vis.forEach((b) => { const k = `${b.site}:${b.port}`; if (e.target.checked) state.selected.add(k); else state.selected.delete(k); });
  renderBmcs();
});

$("#bulk-bar").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-bulk]");
  if (!btn) return;
  const act = btn.dataset.bulk;
  if (act === "clear") { state.selected.clear(); return renderBmcs(); }
  const keys = [...state.selected].map((k) => { const i = k.lastIndexOf(":"); return { site: k.slice(0, i), port: Number(k.slice(i + 1)) }; });
  const n = keys.length;
  const presets = {
    "auth-on": { auth: true, console_auth: true }, "auth-off": { auth: false }, "console-off": { console_auth: false },
    disable: { enabled: false }, enable: { enabled: true },
  };
  try {
    if (act === "delete") {
      if (!await confirmBox("Xoá BMC", `Xoá ${n} BMC đã chọn? Server chỉ gỡ khi bạn bấm Áp dụng.`, "Xoá")) return;
      await api("POST", "bmcs/batch", { keys, action: "delete" });
    } else if (act === "tags" || act === "expires") {
      return formBox(act === "tags" ? `Đặt nhãn cho ${n} BMC` : `Hạn sử dụng cho ${n} BMC`, act === "tags"
        ? [{ name: "tags", label: "Nhãn (cách nhau bởi dấu phẩy, thay cho nhãn cũ; để trống = xoá nhãn)", placeholder: "vd KH-ABC, tủ A3" }]
        : [{ name: "expires", label: "Hạn sử dụng (để trống = bỏ hạn)", type: "date" }], async (d) => {
        await api("POST", "bmcs/batch", { keys, action: "set", fields: act === "tags" ? { tags: d.tags } : { expires: d.expires } });
        state.selected.clear();
        toast(`Đã cập nhật ${n} BMC`);
        await refreshAll();
      });
    } else if (act === "template") {
      return formBox(`Đổi mẫu cho ${n} BMC`, [
        { type: "select", name: "template", label: "Mẫu", value: "", options: Object.entries(state.templates).map(([k, t]) => [k, t.label]) },
        { type: "html", html: '<p class="hint">Chỉ đổi nhãn loại máy và TLS cũ / .jsesp / console Java trên web theo mẫu. Địa chỉ BMC và cổng giữ nguyên.</p>' },
      ], async (d) => {
        const t = state.templates[d.template];
        await api("POST", "bmcs/batch", { keys, action: "set", fields: { template: d.template, legacy_tls: t.legacy_tls, jsesp_cache: t.jsesp_cache, java_web: !!t.java_web, max_conns: t.max_conns || 0 } });
        state.selected.clear();
        toast(`Đã đổi mẫu cho ${n} BMC`);
        await refreshAll();
      }, "Đổi mẫu");
    } else {
      if ((act === "auth-off" || act === "console-off") &&
        !await confirmBox("Tắt xác thực", `Tắt xác thực cho ${n} BMC? Ai biết địa chỉ cũng vào được.`, "Tắt xác thực")) return;
      await api("POST", "bmcs/batch", { keys, action: "set", fields: presets[act] });
    }
    state.selected.clear();
    toast(`Đã cập nhật ${n} BMC. Bấm “Xem & áp dụng” để đẩy xuống server.`);
    await refreshAll();
  } catch (err) { toast(err.message, true); }
});

// ------------------------------------------------------------------ Xuất CSV
function exportCsv() {
  const site = $("#filter-site").value;
  window.location.href = BASE + "api/bmcs/export" + (site ? `?site=${encodeURIComponent(site)}` : "");
}


// ------------------------------------------------------------------ Link truy cập
function bmcLinks(b) {
  const s = state.sites.find((x) => x.key === b.site);
  const host = s && s.domain ? s.domain : "";
  if (!host) return null;
  const web = b.port === 443 ? `https://${host}/` : `https://${host}:${b.port}/`;
  const con = b.console_port ? `https://${host}:${b.console_port}/` : "";
  return { web, con };
}

function javaJnlpPath(b, host) {
  if (b.jnlp_path) return b.jnlp_path.replace(/\{host\}/g, host);
  const tpl = (b.template || "").toLowerCase();
  if (/supermicro/.test(tpl)) {
    return "cgi/url_redirect.cgi?url_name=man_ikvm&url_type=jwsk";
  }
  if (/idrac|dell|cisco|lenovo|ilo/.test(tpl)) {
    return "viewer.jnlp";
  }
  return `Java/jviewer.jnlp?EXTRNIP=${encodeURIComponent(host)}&JNLPSTR=JViewer`;
}

function javaOpenUrl(b) {
  const l = bmcLinks(b);
  if (!l) return "";
  const host = (l.web.match(/^https?:\/\/([^:/]+)/) || [])[1] || "";
  const path = javaJnlpPath(b, host);
  return l.web.replace(/\/$/, "") + "/" + path;
}

function linkCell(b, full) {
  const l = bmcLinks(b);
  if (!l) return '<span class="cell-sub">site chưa có tên miền</span>';
  const one = (url, label) => `<div class="link-row"><span class="link-kind">${label}</span>
    <a href="${esc(url)}" target="_blank" rel="noopener" class="mono">${esc(full ? url : url.replace(/^https:\/\//, "").replace(/\/$/, ""))}</a>
    <button type="button" class="btn icon-btn copy-btn" data-copy="${esc(url)}" title="Sao chép link" aria-label="Sao chép link">⧉</button></div>`;
  const java = (b.tcp_ports || []).length
    ? `<div class="link-row"><span class="link-kind">java</span><span class="mono cell-sub">${esc(fmtTcp(b.tcp_ports).replace(/:/g, "→"))}</span></div>` : "";
  const host = (l.web.match(/^https?:\/\/([^:/]+)/) || [])[1] || "";
  const jpath = javaJnlpPath(b, host);
  const jfile = jpath.split("?")[0].split("/").pop() || ".jnlp";
  const jweb = b.java_web ? `<div class="link-row"><span class="link-kind">java</span>
    <a href="${esc(l.web.replace(/\/$/, "") + "/" + jpath)}" target="_blank" rel="noopener"
       title="Đăng nhập BMC trước, rồi bấm để mở console Java ngay trên web">Mở console (${esc(jfile)})</a></div>` : "";
  return one(l.web, "web") + (l.con ? one(l.con, "console") : "") + jweb + java + (b.enabled ? "" : '<div class="cell-sub">BMC đang tắt</div>');
}

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast(`Đã sao chép ${t}`); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast(`Đã sao chép ${t}`); } catch { toast("Không sao chép được", true); }
    ta.remove();
  }
}

$("#drawer-links").addEventListener("click", (e) => {
  const cp = e.target.closest("[data-copy]");
  if (cp) copyText(cp.dataset.copy);
});


// ------------------------------------------------------------------ Console Java: gợi ý cổng
$("#btn-java-ports").addEventListener("click", async () => {
  const f = $("#bmc-form");
  const tpl = state.templates[f.template.value];
  let bmcPorts = (tpl && tpl.java_ports) || [];
  if (!bmcPorts.length) {
    const cur = f.tcp_ports.value.split(/[,;\s]+/).map((x) => x.split(/[:>=]/).pop()).filter((x) => /^\d+$/.test(x));
    bmcPorts = cur.length ? cur.map(Number) : [];
  }
  if (!bmcPorts.length) {
    const ans = prompt("Cổng console Java trên BMC (cách nhau bởi dấu phẩy), vd QCT/AMI: 7578, 5120, 5123", "7578, 5120, 5123");
    if (!ans) return;
    bmcPorts = ans.split(/[,;\s]+/).filter((x) => /^\d+$/.test(x)).map(Number);
  }
  if (!f.site.value || !bmcPorts.length) return;
  try {
    const r = await api("GET", `sites/${f.site.value}/free-ports?tcp=${bmcPorts.length}`);
    const own = new Set(f.tcp_ports.value.split(/[,;\s]+/).map((x) => Number(x.split(/[:>=]/)[0])).filter(Boolean));
    const free = [...own, ...r.tcp].filter((v, i, a) => a.indexOf(v) === i);
    f.tcp_ports.value = bmcPorts.map((bp, i) => `${free[i]}:${bp}`).join(", ");
    toast(`Gợi ý cổng Java: ${f.tcp_ports.value}`);
  } catch (err) { toast(err.message, true); }
});



// Nút thêm nhanh khi danh sách trống
document.addEventListener("click", (e) => {
  if (e.target.closest("#btn-empty-add-site")) addSite();
  if (e.target.closest("#btn-empty-add-bmc")) openDrawer(null);
});


// ------------------------------------------------------------------ Site: tinh nang mo rong
function sysLine(x) {
  const parts = [esc(x.os || "")];
  if (x.cpus) parts.push(`${x.cpus} CPU`);
  if (x.load) parts.push(`tải ${x.load[0].toFixed(2)}`);
  const pct = (v, label) => (v == null ? "" : `<span class="${v >= 90 ? "tag bad" : v >= 75 ? "tag warn" : ""}">${label} ${v}%</span>`);
  if (x.mem_used_pct != null) parts.push(pct(x.mem_used_pct, "RAM"));
  if (x.disk_used_pct != null) parts.push(pct(x.disk_used_pct, "đĩa"));
  if (x.uptime_s != null) parts.push(`bật ${x.uptime_s >= 86400 ? Math.floor(x.uptime_s / 86400) + " ngày" : Math.floor(x.uptime_s / 3600) + " giờ"}`);
  return parts.filter(Boolean).join(" · ");
}

/** Gui lenh cho agent roi cho ket qua (agent hoi web moi 10 giay). */
async function siteCommandWait(s, cmd, kind, onWait) {
  const before = await api("GET", `sites/${s.key}/${kind}`).catch(() => ({}));
  await api("POST", `sites/${s.key}/command`, { name: cmd });
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    if (onWait) onWait(i);
    const r = await api("GET", `sites/${s.key}/${kind}`);
    if (r && r.at && r.at !== before.at) return r;
  }
  throw new Error("Agent chưa gửi kết quả sau 90 giây (agent có đang trực tuyến không?)");
}

const DIAG = {
  down: ["bad", "mất kết nối"], port: ["bad", "web IPMI treo"], tls: ["warn", "lỗi TLS"],
  drop: ["warn", "đóng kết nối"], bad: ["bad", "sai cấu hình"],
};
async function siteDiagnose(s) {
  infoBox(`Kiểm tra BMC · ${s.label}`, '<p class="hint" id="diag-wait">Đang gửi lệnh tới agent… (agent hỏi web mỗi 10 giây)</p>');
  try {
    const r = await siteCommandWait(s, "diagnose", "diag", (i) => {
      const w = $("#diag-wait");
      if (w) w.textContent = `Agent đang ping / thử cổng / thử TLS từng BMC… ${2 * (i + 1)} giây`;
    });
    const rows = r.rows || [];
    const bad = rows.filter((x) => x.code !== "drop" || false).length;
    const okRow = (x) => x.tcp && (x.tls !== false);
    const mark = (v) => (v === true ? '<span class="tag ok">OK</span>' : v === false ? '<span class="tag bad">lỗi</span>' : "-");
    $("#info-body").innerHTML = `<p class="hint">Kiểm tra lúc ${esc(fmtTs(r.at))} từ server ${esc(s.hostname || s.key)} ·
      ${rows.length} BMC · <b>${rows.filter((x) => !okRow(x)).length}</b> lỗi</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Cổng</th><th>BMC</th><th>Ping</th><th>Cổng BMC</th><th>TLS</th><th>Kết luận</th></tr></thead><tbody>
      ${rows.map((x) => {
        const [cls, label] = okRow(x) ? ["ok", "hoạt động"] : (DIAG[x.code] || ["bad", x.code]);
        return `<tr><td class="mono">${esc(x.port)}</td><td><div class="mono">${esc(x.upstream)}</div><div class="cell-sub">${esc(x.note || "")}</div></td>
          <td>${mark(x.ping)}</td><td>${mark(x.tcp)} <span class="cell-sub">${esc(x.ms != null ? x.ms + " ms" : x.tcp_error || "")}</span></td>
          <td>${x.tls === undefined || x.tls === null ? "-" : mark(x.tls)} <span class="cell-sub">${esc(x.tls_info || "")}</span></td>
          <td><span class="tag ${cls}">${esc(label)}</span>${x.code === "tls" && !x.legacy_tls ? '<div class="cell-sub">bật “BMC đời cũ”</div>' : ""}</td></tr>`;
      }).join("")}</tbody></table></div>`;
    void bad;
  } catch (err) { $("#info-body").innerHTML = `<p class="form-error">${esc(err.message)}</p>`; }
}

async function siteHistory(s) {
  try {
    const r = await api("GET", `sites/${s.key}/history`);
    const edit = canEdit(s.key);
    infoBox(`Lịch sử áp dụng · ${s.label}`, r.rows.length ? `<p class="hint">Mỗi lần bấm Áp dụng là một bản cấu hình. <b>Quay về</b> = đặt lại danh sách BMC của site
      như bản đó (có sao lưu trước), sau đó bấm <b>Áp dụng</b> để đẩy xuống server.</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Thời điểm</th><th>Kết quả</th><th>Bản</th><th>Người áp dụng</th><th>BMC</th><th></th></tr></thead><tbody>
      ${r.rows.map((h) => {
        const failed = (h.steps || []).filter((x) => !x.ok).map((x) => x.step).join(", ");
        return `<tr><td class="mono">${esc(fmtTs(h.at))}</td>
          <td>${h.ok ? '<span class="tag ok">thành công</span>' : `<span class="tag bad">lỗi</span><div class="cell-sub">${esc(failed)}</div>`}</td>
          <td class="mono">${esc(h.rev)} <span class="cell-sub">lần ${esc(h.attempt)}</span>
            ${h.applied ? '<span class="tag ok">đang chạy</span>' : ""}${h.desired && !h.applied ? '<span class="tag info">bản hiện tại</span>' : ""}</td>
          <td>${esc(h.by || "-")}</td><td>${h.bmcs ?? "-"}</td>
          <td style="text-align:right">${edit && h.available && !h.desired ? `<button class="btn small" data-rollback="${esc(h.rev)}" data-site="${esc(s.key)}">Quay về</button>` : ""}</td></tr>`;
      }).join("")}</tbody></table></div>` : '<p class="hint">Site chưa áp dụng lần nào.</p>');
  } catch (err) { toast(err.message, true); }
}

async function siteServer(s) {
  infoBox(`Server · ${s.label}`, `<dl class="kv" id="srv-info">${[
    ["Máy", `${s.hostname || "?"} (${s.remote_ip || "?"})`], ["Hệ điều hành", (s.sysinfo || {}).os || "?"],
    ["Agent", s.agent_version || "?"], ["Traefik", s.traefik.reachable ? "v" + s.traefik.version : "không chạy"],
  ].map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}<dt>Tài nguyên</dt><dd>${sysLine(s.sysinfo || {})}</dd></dl>
    <div class="form-foot" style="justify-content:flex-start;gap:8px;margin-top:12px">
      <button class="btn small" data-srv="logs" data-site="${esc(s.key)}">Tải log</button>
      <button class="btn small" data-srv="restart_traefik" data-site="${esc(s.key)}">Restart Traefik</button>
      <button class="btn small danger-ghost" data-srv="restart_agent" data-site="${esc(s.key)}">Restart agent</button>
      <span class="hint" id="srv-msg"></span></div>
    <div id="srv-logs"></div>`);
}

function siteInstallGuide(s) {
  const web = location.origin;
  const cmd = (t) => `<div class="code-row"><pre class="code">${esc(t)}</pre><button type="button" class="btn icon-btn copy-btn" data-copy="${esc(t)}" title="Sao chép">⧉</button></div>`;
  infoBox(`Cài agent cho ${s.label}`, `<p class="hint">Làm trên <b>server của site ${esc(s.key)}</b> (Ubuntu 22.04, quyền root). IP được phép của site:
    <b>${esc((s.allowed_ips || []).join(", ") || "chưa khai - Sửa site để khai")}</b>.</p>
    <ol class="steps">
      <li><b>Lấy agent.json:</b> bấm <b>Token</b> trên thẻ site → Sao chép, dán vào <code>/root/agent.json</code> trên server:${cmd("sudo nano /root/agent.json")}
        Kiểm tra <code>controller_url</code> = <code>${esc(web)}</code> (địa chỉ server site gọi tới được web).
        Web dùng chứng chỉ tự ký thì thêm <code>"verify_tls": false</code>.</li>
      <li><b>Chép gói agent lên server</b> (PowerShell trên máy Windows):${cmd(`scp "C:\\Users\\FIX NHANH\\Downloads\\Monitor-Treafix-Proxy\\bmcproxy\\dist\\bmc-gateway-agent-2.0.0.zip" root@<ip-server-${s.key}>:/home/`)}</li>
      <li><b>Thử kết nối web</b> (phải ra HTTP 200):${cmd(`curl -sk -o /dev/null -w "HTTP %{http_code}\\n" ${web}/`)}</li>
      <li><b>Giải nén và cài:</b>${cmd("cd /home && rm -rf bmc-gateway-agent && python3 -m zipfile -e bmc-gateway-agent-2.0.0.zip /home && sudo bash /home/bmc-gateway-agent/install.sh agent")}
        Cuối phải thấy <b>agent đã kết nối web</b>; thẻ site này chuyển chấm xanh trong ~10 giây.</li>
      <li><b>Tuỳ chọn - console Java trên web:</b>${cmd("sudo bash /home/bmc-gateway-agent/install.sh kvm")}</li>
      <li>Tiếp theo trên web: <b>Nhập từ nginx</b> → kiểm tra BMC → <b>Áp dụng</b>.</li>
    </ol>
    <p class="hint">Không lên chấm xanh: trên máy web chạy <code>journalctl -u bmcproxy | grep "agent bị từ chối"</code> để thấy IP thật của server,
      rồi Sửa site → IP được phép.</p>`);
}

$("#info-body").addEventListener("click", async (e) => {
  const cp = e.target.closest("[data-copy]");
  if (cp && cp.closest(".code-row")) return copyText(cp.dataset.copy);
  const rb = e.target.closest("[data-rollback]");
  if (rb) {
    const s = state.sites.find((x) => x.key === rb.dataset.site);
    if (!await confirmBox("Quay về bản cũ", `Đặt lại danh sách BMC của ${s.label} như bản ${rb.dataset.rollback}? Danh sách hiện tại được sao lưu trước. Sau đó cần bấm Áp dụng.`, "Quay về")) return;
    try {
      const r = await api("POST", `sites/${s.key}/rollback`, { rev: rb.dataset.rollback });
      $("#dlg-info").close();
      toast(`Đã khôi phục ${r.bmcs} BMC. Bấm Áp dụng để đẩy xuống server.`);
      await refreshAll();
    } catch (err) { toast(err.message, true); }
    return;
  }
  const sv = e.target.closest("[data-srv]");
  if (!sv) return;
  const s = state.sites.find((x) => x.key === sv.dataset.site);
  const act = sv.dataset.srv;
  const msg = $("#srv-msg");
  if (act !== "logs" && !await confirmBox(act === "restart_traefik" ? "Restart Traefik" : "Restart agent",
    act === "restart_traefik" ? `Mọi BMC của ${s.label} gián đoạn khoảng 2-5 giây.` : `Agent ${s.label} khởi động lại (BMC không bị gián đoạn).`, "Restart")) return;
  $$("[data-srv]").forEach((b) => { b.disabled = true; });
  try {
    if (act === "logs") {
      const r = await siteCommandWait(s, "logs", "logs", (i) => { msg.textContent = `đang chờ agent… ${2 * (i + 1)}s`; });
      msg.textContent = `log lúc ${fmtTs(r.at)}`;
      $("#srv-logs").innerHTML = Object.entries(r).filter(([k]) => k !== "at").map(([k, v]) =>
        `<h4 style="margin:14px 0 6px">${esc(k)}</h4><pre class="code log-box">${esc(v)}</pre>`).join("");
    } else {
      const r = await siteCommandWait(s, act, "action", (i) => { msg.textContent = `đang chờ agent… ${2 * (i + 1)}s`; });
      msg.textContent = `${r.ok ? "xong" : "lỗi"}: ${r.output || ""}`.slice(0, 200);
      setTimeout(() => refreshAll().catch(() => { }), 3000);
    }
  } catch (err) { msg.textContent = err.message; }
  $$("[data-srv]").forEach((b) => { b.disabled = false; });
});


// ------------------------------------------------------------------ Lenh cai agent 1 dong
async function showInstall(s, created) {
  let r;
  try { r = await api("POST", `sites/${s.key}/install`); } catch (err) { return toast(err.message, true); }
  const line = `curl -fsSk ${location.origin}${r.path} | sudo bash`;
  const manual = created && created.agent_config ? `<details class="mt"><summary>Cài thủ công (dán agent.json)</summary>
      <pre class="code">${esc(JSON.stringify(created.agent_config, null, 2))}</pre>
      <p class="hint">Lưu vào <code>/root/agent.json</code> rồi <code>sudo bash install.sh agent</code>. Dùng lệnh 1 dòng ở trên thì không cần.</p></details>` : "";
  infoBox(`Cài agent · ${s.label}`, `
    <p>Chạy <b>1 dòng</b> này trên <b>server của site ${esc(s.key)}</b> (Ubuntu 22.04, SSH bằng root hoặc user có sudo):</p>
    <div class="code-row"><pre class="code install-line">${esc(line)}</pre>
      <button type="button" class="btn small primary" data-copy="${esc(line)}">Sao chép</button></div>
    <ul class="hint" style="margin:10px 0 0 18px">
      <li>Lệnh dùng <b>1 lần</b>, hết hạn sau <b>${Math.round(r.expires_in / 60)} phút</b>. Cần lại thì bấm <b>Cài agent</b> trên thẻ site.</li>
      <li>Script tự: tải gói agent từ web → tạo token + <code>agent.json</code> → cài Traefik + agent → kết nối web.
        IP của server được tự thêm vào <b>IP được phép</b>.</li>
      <li>Server phải gọi tới được <code>${esc(location.origin)}</code>. Địa chỉ này server không vào được thì mở web bằng địa chỉ server vào được (vd IP public) rồi tạo lại lệnh.</li>
      <li>Server cần chứng chỉ <code>*.longvan.net</code> cho Traefik (script tự tìm trong <code>/etc/nginx</code>). Chưa có:
        <code>curl … | sudo CERT=/duong/dan.cer KEY=/duong/dan.key bash</code>.</li>
      ${r.online ? '<li><b class="tag warn">Site đang trực tuyến</b>: chạy lệnh sẽ đổi token, agent cũ trên server khác sẽ mất kết nối.</li>' : ""}
      ${r.package ? "" : '<li><b class="tag bad">Web chưa có gói agent</b>: cài lại web bằng gói bmc-gateway-web mới (có thư mục agent-package).</li>'}
    </ul>
    <p class="hint mt">Đợi thẻ site chuyển <b>chấm xanh</b> (~10 giây sau khi script báo Xong), rồi <b>Nhập từ nginx</b> → <b>Áp dụng</b>.</p>
    ${manual}`);
  const until = Date.now() + 15 * 60 * 1000;
  const timer = setInterval(async () => {  // tu bao khi agent ket noi
    if (!$("#dlg-info").open || Date.now() > until) return clearInterval(timer);
    try {
      const st = (await api("GET", "sites")).find((x) => x.key === s.key);
      if (st && st.online) {
        clearInterval(timer);
        toast(`Agent ${s.label} đã kết nối (${st.hostname || ""} ${st.remote_ip || ""})`);
        $("#info-body").insertAdjacentHTML("afterbegin", `<div class="result-banner ok">Agent đã kết nối: ${esc(st.hostname || "")} ${esc(st.remote_ip || "")}</div>`);
        refreshAll().catch(() => { });
      }
    } catch { /* bo qua */ }
  }, 4000);
}


// ------------------------------------------------------------------ BMC: nhan, sap xep, kiem tra, lich su, nhan ban
function allTags() {
  const set = new Map();
  state.bmcs.forEach((b) => (b.tags || []).forEach((t) => set.set(t, (set.get(t) || 0) + 1)));
  return [...set.entries()].sort((a, b) => a[0].localeCompare(b[0], "vi"));
}
function fillTagFilter() {
  const sel = $("#filter-tag");
  const tags = allTags();
  const keep = sel.value;
  const html = '<option value="">Mọi nhãn</option>' + tags.map(([t, n]) => `<option value="${esc(t)}">${esc(t)} (${n})</option>`).join("");
  if (sel.dataset.html !== html) { sel.innerHTML = html; sel.dataset.html = html; sel.value = keep; }
  sel.classList.toggle("hidden", !tags.length && !keep);
  $("#tag-list").innerHTML = tags.map(([t]) => `<option value="${esc(t)}">`).join("");
}
$("#filter-tag").addEventListener("change", renderBmcs);
$("#bmc-table thead").addEventListener("click", (e) => {
  const th = e.target.closest("th.sortable");
  if (!th) return;
  const key = th.dataset.sort;
  state.sort = state.sort && state.sort.key === key ? (state.sort.dir > 0 ? { key, dir: -1 } : null) : { key, dir: 1 };
  renderBmcs();
});
$("#bmc-table tbody").addEventListener("click", (e) => {
  const t = e.target.closest("[data-tag]");
  if (!t) return;
  e.stopPropagation();
  $("#filter-tag").value = t.dataset.tag;
  renderBmcs();
}, true);

function editingBmc() {
  return state.editing && state.bmcs.find((b) => b.site === state.editing.site && b.port === state.editing.port);
}
const DIAG_HINT = {
  down: "Không ping được, cổng không phản hồi: kiểm tra điện / cáp IPMI / IP, hoặc server site không có đường tới mạng BMC.",
  port: "Ping được nhưng cổng đóng: web BMC treo hoặc đang khởi động lại - đợi vài phút hoặc reset BMC (ipmitool … mc reset cold).",
  tls: "Mở cổng nhưng lỗi TLS: bật “BMC đời cũ (TLS cũ)”. Vẫn lỗi thì BMC chỉ có DHE - cần nâng firmware.",
  drop: "Mạng và TLS bình thường - BMC hoạt động. Vẫn lỗi qua proxy thì thử Host header = IP của BMC, hoặc đặt Số kết nối tối đa = 4.",
  bad: "Địa chỉ BMC không hợp lệ.",
};
$("#btn-bmc-check").addEventListener("click", async () => {
  const b = editingBmc();
  if (!b) return;
  const s = state.sites.find((x) => x.key === b.site);
  if (!s || !s.online) return toast("Agent của site đang mất liên lạc - không kiểm tra được", true);
  infoBox(`Kiểm tra BMC ${b.port} · ${s.label}`, '<p class="hint" id="diag-wait">Đang gửi lệnh tới agent…</p>');
  try {
    const before = await api("GET", `sites/${s.key}/diag`).catch(() => ({}));
    await api("POST", `sites/${s.key}/command`, { name: "diagnose", port: b.port });
    let r = null;
    for (let i = 0; i < 45 && !r; i++) {
      await new Promise((res) => setTimeout(res, 2000));
      const w = $("#diag-wait");
      if (w) w.textContent = `Agent đang kiểm tra từ server ${s.hostname || s.key}… ${2 * (i + 1)} giây`;
      const x = await api("GET", `sites/${s.key}/diag`);
      if (x && x.at && x.at !== before.at) r = x;
    }
    if (!r) throw new Error("Agent chưa trả kết quả sau 90 giây");
    const x = (r.rows || []).find((y) => y.port === b.port) || {};
    const ok = x.tcp && x.tls !== false;
    const mark = (v) => (v === true ? '<b class="tag ok">OK</b>' : v === false ? '<b class="tag bad">LỖI</b>' : "-");
    $("#info-body").innerHTML = `<div class="result-banner ${ok ? "ok" : "bad"}">${ok ? "BMC trả lời bình thường" : "BMC có vấn đề"} · ${esc(fmtTs(r.at))}</div>
      <dl class="kv"><dt>Địa chỉ</dt><dd class="mono">${esc(b.upstream)}</dd>
        <dt>Ping ${esc(x.host || "")}</dt><dd>${mark(x.ping)}</dd>
        <dt>Cổng</dt><dd>${mark(x.tcp)} ${esc(x.ms != null ? x.ms + " ms" : x.tcp_error || "")}</dd>
        <dt>HTTPS / TLS</dt><dd>${x.tls == null ? "-" : mark(x.tls)} ${esc(x.tls_info || "")}</dd></dl>
      <p class="hint mt"><b>Gợi ý:</b> ${esc(DIAG_HINT[x.code] || "")}</p>`;
  } catch (err) { $("#info-body").innerHTML = `<p class="form-error">${esc(err.message)}</p>`; }
});

$("#btn-bmc-history").addEventListener("click", async () => {
  const b = editingBmc();
  if (!b) return;
  try {
    const rows = await api("GET", `bmcs/${b.site}/${b.port}/history`);
    const LBL = { "bmc-add": "thêm", "bmc-edit": "sửa", "bmc-delete": "xoá", "bmc-bulk": "hàng loạt", rollback: "quay về", import: "nhập nginx", apply: "áp dụng" };
    infoBox(`Lịch sử BMC ${b.port} · ${siteLabel(b.site)}`, rows.length
      ? `<div class="table-wrap"><table class="table"><thead><tr><th>Thời điểm</th><th>Người</th><th>Thao tác</th><th>Chi tiết</th></tr></thead><tbody>${rows.map((r) =>
        `<tr><td class="mono">${esc(fmtTs(r.ts))}</td><td>${esc(r.user)}</td><td><span class="tag">${esc(LBL[r.action] || r.action.replace(/^bmc-batch-/, "chọn nhiều: "))}</span></td>
          <td class="mono cell-sub">${esc(r.detail || "")}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="hint">Chưa có thay đổi nào được ghi lại${b.updated_by ? ` (sửa lần cuối: ${esc(b.updated_by)} ${esc(fmtTs(b.updated_at))})` : ""}.</p>`);
  } catch (err) { toast(err.message, true); }
});

$("#btn-bmc-clone").addEventListener("click", () => {
  const b = editingBmc();
  if (!b) return;
  openDrawer({ ...b });
  state.editing = null;  // luu se tao BMC moi
  const f = $("#bmc-form");
  f.port.value = "";
  if (f.console_port.value) { f.console_port.value = ""; f.console_upstream.value = ""; }
  f.tcp_ports.value = "";
  $("#drawer-title").textContent = `Nhân bản từ BMC ${b.port}`;
  $("#drawer-sub").textContent = "Đổi cổng proxy + IP BMC (ô IP ở phần Mẫu → Điền theo mẫu), rồi Lưu để tạo BMC mới";
  $("#drawer-links").classList.add("hidden");
  ["btn-delete", "btn-bmc-check", "btn-bmc-history", "btn-bmc-clone"].forEach((id) => $("#" + id).classList.add("hidden"));
  setTimeout(() => f.port.focus(), 60);
});


// Khung sua BMC: nut mo rong / thu lai (nho theo trinh duyet)
function setDrawerWide(on) {
  $("#drawer").classList.toggle("wide", on);
  const b = $("#btn-drawer-wide");
  b.textContent = on ? "⤡" : "⤢";
  b.title = on ? "Thu nhỏ" : "Mở rộng";
  try { localStorage.setItem("bmcgw.drawerWide", on ? "1" : "0"); } catch { /* bo qua */ }
}
$("#btn-drawer-wide").addEventListener("click", () => setDrawerWide(!$("#drawer").classList.contains("wide")));
try { if (localStorage.getItem("bmcgw.drawerWide") === "1") setDrawerWide(true); } catch { /* bo qua */ }

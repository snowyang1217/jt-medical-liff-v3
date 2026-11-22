import { CONFIG } from './config.js?v=20261123a';
import { machines, products, hospitals, employees } from './mock-data.js';

const html = String.raw;
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
const select = (id, label, options, required = true) => html`<label class="field"><span>${label}${required ? '<b>＊</b>' : ''}</span><select id="${id}" ${required ? 'required' : ''}><option value="">請選擇</option>${options.map((x) => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('')}</select></label>`;

export function shell(profile, page, content, availablePages) {
  return html`
    <main class="app-shell">
      <header class="topbar">
        <button class="brand" data-page="home" aria-label="回首頁"><span class="brand-mark">J</span><span>捷旭醫療</span></button>
        <div class="user-chip"><span>${escapeHtml(profile.company)}</span><strong>${escapeHtml(profile.name)}</strong></div>
      </header>
      <section class="page">${content}</section>
      <nav class="tabbar">${CONFIG.navigation.filter(({ id }) => availablePages.has(id)).map((item) => `<button class="tab ${page === item.id ? 'active' : ''}" data-page="${item.id}"><i>${item.icon}</i><span>${item.label}</span></button>`).join('')}</nav>
    </main>`;
}

export function homeView(profile, availablePages) {
  const modules = [
    ['machine','產品／庫存查詢','依品名或料號查詢庫存','▣'],
    ['forecast','我的訂貨預估','填寫預估月份、產品與數量','▱'],
    ['tender','標案查詢','搜尋標案名稱或編號','◫'],
    ['transfer','機台交接','提出交接、確認接收','⇄'],
    ['report','我的業績','查詢本月業績與紀錄','▤'],
    ['performance','跟刀業績輸入','登錄產品、數量與業績','◈']
  ];
  return html`
    <div class="greeting"><p>您好，${escapeHtml(profile.name)}</p><h1>今天要處理什麼？</h1><small>${escapeHtml(profile.role)} · ${escapeHtml(profile.company)}</small></div>
    <section class="module-grid">${modules.map(([id,title,desc,icon]) => availablePages.has(id)
      ? html`<button class="module-card" data-page="${id}"><i>${icon}</i><strong>${title}</strong><small>${desc}</small><span>→</span></button>`
      : html`<button class="module-card" disabled><i>${icon}</i><strong>${title}</strong><small>本次測試暫未開放</small></button>`).join('')}</section>
    <section class="notice"><strong>客戶測試版</strong><p>可查詢標案與產品庫存。</p></section>`;
}

export function inventoryView() {
  return html`
    <div class="page-head"><button class="back" data-page="home" aria-label="回首頁">‹</button><div><h1>產品／庫存查詢</h1></div></div>
    <form id="inventorySearch" role="search">
      <label class="field"><span>品名或料號</span><input name="keyword" type="search" placeholder="輸入品名或料號" maxlength="80" required /></label>
      <button class="primary" type="submit">查詢庫存</button>
    </form>
    <p id="inventoryStatus" class="empty" role="status"></p>
    <section class="list" id="inventoryResults" aria-label="產品庫存查詢結果"></section>`;
}

const stockQuantityFormat = new Intl.NumberFormat('zh-TW', { maximumSignificantDigits: 12 });

export function inventoryResults(records) {
  return records.map(({ name, default_code: code, uom_id: unit, qty_available: onHand, free_qty: free }) => {
    const unitName = Array.isArray(unit) && typeof unit[1] === 'string' && unit[1].trim() ? ` ${escapeHtml(unit[1])}` : '';
    const format = (quantity) => Number.isFinite(quantity) ? `${stockQuantityFormat.format(quantity)}${unitName}` : '無資料';

    return html`<article class="record-card"><div>
      <strong>${escapeHtml(name)}</strong>
      <p>料號　${typeof code === 'string' && code.trim() ? escapeHtml(code) : '未填寫'}</p>
      <p>庫存量　${format(onHand)}</p>
      <p>可用量　${format(free)}</p>
    </div></article>`;
  }).join('');
}

export function tenderView() {
  return html`
    <div class="page-head"><button class="back" data-page="home" aria-label="回首頁">‹</button><div><p>標案管理</p><h1>標案查詢</h1></div></div>
    <form id="tenderSearch" role="search">
      <label class="field"><span>標案名稱或編號</span><input name="keyword" type="search" placeholder="輸入關鍵字" required /></label>
      <button class="primary" type="submit">查詢標案</button>
    </form>
    <p id="tenderStatus" class="empty" role="status"></p>
    <section class="list" id="tenderResults" aria-label="標案查詢結果"></section>`;
}

const tenderAmountFormat = new Intl.NumberFormat('zh-TW');

export function tenderResults(records) {
  return records.map(({
    x_name: name,
    x_studio_date_1: deadline,
    x_studio_selection_1: status,
    x_studio_twd: amount
  }) => {
    const deadlineText = typeof deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(deadline)
      ? deadline.replaceAll('-', '/')
      : '未填寫';
    const statusText = typeof status === 'string' && status.trim() ? status : '未填寫';
    const amountText = Number.isFinite(amount) ? `NT$ ${tenderAmountFormat.format(amount)}` : '未填寫';

    return html`<article class="record-card">
      <strong>${escapeHtml(name)}</strong>
      <p>截止日期　${deadlineText}</p>
      <p>標案狀態　${escapeHtml(statusText)}</p>
      <p>預估金額　${amountText}</p>
    </article>`;
  }).join('');
}

export function formView(kind, profile) {
  const forms = {
    forecast: ['我的訂貨預估','提交預估採購需求', html`${select('company','所屬公司',CONFIG.companyOptions)}${select('month','預估月份',['2026-12','2027-01','2027-02'])}${select('product','產品',products)}<label class="field"><span>預估數量<b>＊</b></span><input id="quantity" type="number" min="1" placeholder="請輸入數量" required /></label><label class="field"><span>備註</span><textarea id="note" placeholder="可補充採購需求或原因"></textarea></label>`],
    transfer: ['機台交接','提出機台交接申請', html`${select('company','所屬公司',CONFIG.companyOptions)}${select('machine','交接機台',machines.map((m)=>m.code))}${select('receiver','接收人',employees)}<label class="field"><span>預計交接日期<b>＊</b></span><input id="plannedDate" type="date" required /></label><label class="field"><span>備註</span><textarea id="note" placeholder="交接地點或其他說明"></textarea></label>`],
    performance: ['跟刀業績輸入','登錄本次跟刀業績', html`${select('company','所屬公司',CONFIG.companyOptions)}${select('hospital','客戶／醫院',hospitals)}${select('product','產品',products)}<label class="field"><span>跟刀日期<b>＊</b></span><input id="serviceDate" type="date" required /></label><label class="field"><span>數量<b>＊</b></span><input id="quantity" type="number" min="1" required /></label><label class="field"><span>業績金額（TWD）<b>＊</b></span><input id="amount" type="number" min="0" required /></label>`]
  };
  const [title, subtitle, fields] = forms[kind];
  return html`<div class="page-head"><button class="back" data-page="home">‹</button><div><p>${subtitle}</p><h1>${title}</h1></div></div><form id="dataForm" data-kind="${kind}">${fields}<div class="fixed-submit"><button class="primary" type="submit">確認送出</button></div></form>`;
}

export function productView() { return html`<div class="page-head"><button class="back" data-page="home">‹</button><div><p>產品資訊</p><h1>產品介紹</h1></div></div><section class="product-stack">${products.map((p,i) => `<article><span>0${i+1}</span><div><strong>${p}</strong><p>提供產品規格、適用情境與聯絡窗口。</p></div><b>›</b></article>`).join('')}</section>`; }

export function reportView() { return html`<div class="page-head"><button class="back" data-page="home">‹</button><div><p>業績管理</p><h1>我的業績</h1></div></div><section class="list"><article class="record-card"><div><strong>本月業績</strong><p>串接 Odoo 後顯示本月累計金額</p><small>依登入業務人員自動篩選</small></div><span class="pill blue">即將串接</span></article><article class="record-card"><div><strong>我的跟刀紀錄</strong><p>查看本月已輸入的跟刀業績</p><small>可依日期與產品篩選</small></div><span class="pill blue">查詢</span></article></section>`; }

export function profileView(profile) { return html`<div class="profile-card"><span class="avatar">${escapeHtml(profile.name.slice(0,1))}</span><h1>${escapeHtml(profile.name)}</h1><p>${escapeHtml(profile.role)} · ${escapeHtml(profile.company)}</p></div><section class="profile-list"><button>個人資料 <b>›</b></button><button>我的送出紀錄 <b>›</b></button><button>系統說明 <b>›</b></button></section>`; }

export function recordView() { return html`<div class="page-head"><div><p>資料輸入</p><h1>選擇功能</h1></div></div><section class="action-list"><button data-page="forecast"><span>▱</span><div><strong>我的訂貨預估</strong><small>提交採購預估需求</small></div><b>›</b></button><button data-page="transfer"><span>⇄</span><div><strong>機台交接</strong><small>提出機台交接申請</small></div><b>›</b></button><button data-page="performance"><span>◈</span><div><strong>跟刀業績輸入</strong><small>登錄產品、數量與業績</small></div><b>›</b></button></section>`; }

export function loadingView() { return '<div class="loading"><span></span><p>正在載入系統…</p></div>'; }
export function toast(message, type='success') { return `<div class="toast ${type}">${escapeHtml(message)}</div>`; }

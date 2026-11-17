import { CONFIG } from './config.js?v=20261118c';
import { machines, tenders, products, hospitals, employees } from './mock-data.js';

const html = String.raw;
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
const statusClass = (status) => status === '在庫' ? 'green' : status === '維修中' ? 'orange' : status === '已拒絕' ? 'red' : 'blue';
const select = (id, label, options, required = true) => html`<label class="field"><span>${label}${required ? '<b>＊</b>' : ''}</span><select id="${id}" ${required ? 'required' : ''}><option value="">請選擇</option>${options.map((x) => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join('')}</select></label>`;

export function shell(profile, page, content) {
  return html`
    <main class="app-shell">
      <header class="topbar">
        <button class="brand" data-page="home" aria-label="回首頁"><span class="brand-mark">J</span><span>捷旭醫療</span></button>
        <div class="user-chip"><span>${escapeHtml(profile.company)}</span><strong>${escapeHtml(profile.name)}</strong></div>
      </header>
      <section class="page">${content}</section>
      <nav class="tabbar">${CONFIG.navigation.map((item) => `<button class="tab ${page === item.id ? 'active' : ''}" data-page="${item.id}"><i>${item.icon}</i><span>${item.label}</span></button>`).join('')}</nav>
    </main>`;
}

export function homeView(profile) {
  const modules = [
    ['visit','拜訪紀錄','記錄客戶拜訪與後續追蹤','▤'],
    ['machine','機台查詢','查詢機台狀態與保管人','▣'],
    ['forecast','訂貨預估','填寫預估月份、產品與數量','▱'],
    ['tender','我的標案','掌握標案狀態與截止日','◫'],
    ['transfer','機台交接','提出交接、確認接收','⇄'],
    ['performance','跟刀業績','登錄產品、數量與業績','◈'],
    ['product','產品介紹','查閱重點產品資訊','◇']
  ];
  return html`
    <div class="greeting"><p>您好，${escapeHtml(profile.name)}</p><h1>今天要處理什麼？</h1><small>${escapeHtml(profile.role)} · ${escapeHtml(profile.company)}</small></div>
    <section class="module-grid">${modules.map(([id,title,desc,icon]) => html`<button class="module-card" data-page="${id}"><i>${icon}</i><strong>${title}</strong><small>${desc}</small><span>→</span></button>`).join('')}</section>
    <section class="notice"><strong>今日提醒</strong><p>請確認需要交接的機台與本月訂貨預估是否已送出。</p></section>`;
}

export function machineView() {
  return html`<div class="page-head"><button class="back" data-page="home">‹</button><div><p>機台管理</p><h1>機台查詢</h1></div></div>
  <input class="search" id="machineSearch" placeholder="搜尋機台編號或保管人" />
  <div class="filter-row"><button class="filter active" data-filter="all">全部</button><button class="filter" data-filter="在庫">在庫</button><button class="filter" data-filter="保管中">保管中</button><button class="filter" data-filter="維修中">維修中</button></div>
  <section class="list" id="machineList">${machines.map(machineCard).join('')}</section>`;
}
function machineCard(m) { return html`<article class="record-card" data-machine="${escapeHtml(m.code)}" data-status="${m.status}"><div><strong>${escapeHtml(m.code)}</strong><p>${escapeHtml(m.company)} · 目前保管人：${escapeHtml(m.keeper)}</p><small>開始日期 ${m.startedAt}</small></div><span class="pill ${statusClass(m.status)}">${escapeHtml(m.status)}</span></article>`; }

export function tenderView() { return html`<div class="page-head"><button class="back" data-page="home">‹</button><div><p>標案管理</p><h1>我的標案</h1></div></div><section class="list">${tenders.map((t) => html`<article class="record-card"><div><strong>${t.name}</strong><p>截止日 ${t.deadline}</p><small>預估金額 NT$ ${t.amount.toLocaleString()}</small></div><span class="pill ${statusClass(t.status)}">${t.status}</span></article>`).join('')}</section>`; }

export function formView(kind, profile) {
  const forms = {
    forecast: ['訂貨預估','提交預估採購需求', html`${select('company','所屬公司',CONFIG.companyOptions)}${select('month','預估月份',['2026-12','2027-01','2027-02'])}${select('product','產品',products)}<label class="field"><span>預估數量<b>＊</b></span><input id="quantity" type="number" min="1" placeholder="請輸入數量" required /></label><label class="field"><span>備註</span><textarea id="note" placeholder="可補充採購需求或原因"></textarea></label>`],
    transfer: ['機台交接','提出機台交接申請', html`${select('company','所屬公司',CONFIG.companyOptions)}${select('machine','交接機台',machines.map((m)=>m.code))}${select('receiver','接收人',employees)}<label class="field"><span>預計交接日期<b>＊</b></span><input id="plannedDate" type="date" required /></label><label class="field"><span>備註</span><textarea id="note" placeholder="交接地點或其他說明"></textarea></label>`],
    performance: ['跟刀業績','登錄本次跟刀業績', html`${select('company','所屬公司',CONFIG.companyOptions)}${select('hospital','客戶／醫院',hospitals)}${select('product','產品',products)}<label class="field"><span>跟刀日期<b>＊</b></span><input id="serviceDate" type="date" required /></label><label class="field"><span>數量<b>＊</b></span><input id="quantity" type="number" min="1" required /></label><label class="field"><span>業績金額（TWD）<b>＊</b></span><input id="amount" type="number" min="0" required /></label>`],
    visit: ['拜訪紀錄','填寫客戶拜訪資訊', html`${select('hospital','醫院',hospitals)}<label class="field"><span>拜訪日期與時間<b>＊</b></span><input id="visitAt" type="datetime-local" required /></label><label class="field"><span>客戶姓名<b>＊</b></span><input id="customerName" placeholder="請輸入客戶姓名" required /></label><label class="field"><span>拜訪事由<b>＊</b></span><textarea id="reason" placeholder="請簡述本次拜訪目的" required></textarea></label>`]
  };
  const [title, subtitle, fields] = forms[kind];
  return html`<div class="page-head"><button class="back" data-page="home">‹</button><div><p>${subtitle}</p><h1>${title}</h1></div></div><form id="dataForm" data-kind="${kind}">${fields}<div class="fixed-submit"><button class="primary" type="submit">確認送出</button></div></form>`;
}

export function productView() { return html`<div class="page-head"><button class="back" data-page="home">‹</button><div><p>產品資訊</p><h1>產品介紹</h1></div></div><section class="product-stack">${products.map((p,i) => `<article><span>0${i+1}</span><div><strong>${p}</strong><p>提供產品規格、適用情境與聯絡窗口。</p></div><b>›</b></article>`).join('')}</section>`; }

export function profileView(profile) { return html`<div class="profile-card"><span class="avatar">${escapeHtml(profile.name.slice(0,1))}</span><h1>${escapeHtml(profile.name)}</h1><p>${escapeHtml(profile.role)} · ${escapeHtml(profile.company)}</p></div><section class="profile-list"><button>個人資料 <b>›</b></button><button>我的送出紀錄 <b>›</b></button><button>系統說明 <b>›</b></button></section>`; }

export function recordView() { return html`<div class="page-head"><div><p>快速填報</p><h1>選擇功能</h1></div></div><section class="action-list"><button data-page="visit"><span>▤</span><div><strong>拜訪紀錄</strong><small>填寫客戶拜訪內容</small></div><b>›</b></button><button data-page="forecast"><span>▱</span><div><strong>訂貨預估</strong><small>提交採購預估需求</small></div><b>›</b></button><button data-page="transfer"><span>⇄</span><div><strong>機台交接</strong><small>提出機台交接申請</small></div><b>›</b></button><button data-page="performance"><span>◈</span><div><strong>跟刀業績</strong><small>登錄業績資料</small></div><b>›</b></button></section>`; }

export function loadingView() { return '<div class="loading"><span></span><p>正在載入系統…</p></div>'; }
export function toast(message, type='success') { return `<div class="toast ${type}">${escapeHtml(message)}</div>`; }

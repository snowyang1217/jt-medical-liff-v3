import { getProfile, callApi } from './api.js?v=20261122c';
import { shell, homeView, machineView, tenderView, tenderResults, formView, reportView, profileView, recordView, loadingView, toast } from './views.js?v=20261122d';
import { machines } from './mock-data.js';

const app = document.querySelector('#app');
let profile = null;
let currentPage = 'home';
const availablePages = new Set(['home', 'tender']);

function launchedPage() {
  const directPage = new URLSearchParams(location.search).get('page');
  const liffState = new URLSearchParams(location.search).get('liff.state');
  let statePage = '';
  if (liffState) {
    try {
      const stateUrl = new URL(liffState, location.origin);
      statePage = stateUrl.searchParams.get('page') || stateUrl.hash.replace('#', '');
    } catch { /* Use the default page if LINE sends an unreadable state. */ }
  }
  const page = directPage || statePage || location.hash.replace('#', '') || 'home';
  return availablePages.has(page) ? page : 'home';
}

function contentFor(page) {
  if (page === 'home') return homeView(profile, availablePages);
  if (page === 'machine') return machineView();
  if (page === 'tender') return tenderView();
  if (page === 'report') return reportView();
  if (page === 'profile') return profileView(profile);
  if (page === 'record') return recordView();
  if (['forecast','transfer','performance'].includes(page)) return formView(page, profile);
  return homeView(profile, availablePages);
}

function render(page = currentPage) {
  currentPage = availablePages.has(page) ? page : 'home';
  app.innerHTML = shell(profile, currentPage, contentFor(currentPage), availablePages);
  bindEvents();
}

function navigate(page) { window.location.hash = page === 'home' ? '' : `#${page}`; render(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }

function bindEvents() {
  app.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
  app.querySelector('#machineSearch')?.addEventListener('input', (event) => filterMachines(event.target.value));
  app.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
    app.querySelectorAll('[data-filter]').forEach((x) => x.classList.remove('active')); button.classList.add('active'); filterMachines('', button.dataset.filter);
  }));
  app.querySelector('#tenderSearch')?.addEventListener('submit', searchTenders);
  app.querySelector('#dataForm')?.addEventListener('submit', submitForm);
}

function filterMachines(query = '', status = document.querySelector('.filter.active')?.dataset.filter || 'all') {
  const list = app.querySelector('#machineList');
  const keyword = query.toLowerCase();
  const filtered = machines.filter((m) => (status === 'all' || m.status === status) && `${m.code} ${m.keeper} ${m.company}`.toLowerCase().includes(keyword));
  list.innerHTML = filtered.length ? filtered.map((m) => `<article class="record-card"><div><strong>${m.code}</strong><p>${m.company} · 目前保管人：${m.keeper}</p><small>開始日期 ${m.startedAt}</small></div><span class="pill">${m.status}</span></article>`).join('') : '<p class="empty">沒有符合的機台資料。</p>';
}

async function searchTenders(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  if (submit.disabled) return;

  const status = app.querySelector('#tenderStatus');
  const results = app.querySelector('#tenderResults');
  const keyword = form.elements.namedItem('keyword').value.trim();
  results.replaceChildren();
  if (!keyword) {
    status.textContent = '請輸入標案名稱或編號。';
    return;
  }

  submit.disabled = true;
  status.textContent = '查詢中…';
  try {
    const { tenders } = await callApi('SEARCH_TENDER', {
      auth: { idToken: profile.idToken, lineUserId: profile.lineUserId },
      data: { keyword }
    });
    if (!Array.isArray(tenders) || tenders.some((record) => typeof record?.x_name !== 'string')) {
      throw new Error('系統回傳的標案資料格式不正確，請稍後再試。');
    }
    results.innerHTML = tenderResults(tenders);
    status.textContent = tenders.length ? `找到 ${tenders.length} 筆標案。` : '找不到符合的標案。';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
}

async function submitForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submit = form.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = '送出中…';
  const values = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('input, select, textarea').forEach((input) => { if (input.id) values[input.id] = input.value; });
  try {
    await callApi('CREATE_RECORD', {
      model: form.dataset.kind,
      auth: { idToken: profile.idToken, lineUserId: profile.lineUserId },
      data: values
    });
    document.body.insertAdjacentHTML('beforeend', toast('資料已送出，稍後可在 Odoo 查閱。'));
    setTimeout(() => document.querySelector('.toast')?.remove(), 2600);
    form.reset();
  } catch (error) {
    document.body.insertAdjacentHTML('beforeend', toast(error.message, 'error'));
  } finally { submit.disabled = false; submit.textContent = '確認送出'; }
}

async function start() {
  app.innerHTML = loadingView();
  try {
    profile = await getProfile();
    if (profile) render(launchedPage());
  } catch (error) {
    app.innerHTML = '<div class="fatal"><h1>無法啟動系統</h1><p></p><button type="button">重新整理</button></div>';
    app.querySelector('.fatal p').textContent = error.message;
    app.querySelector('.fatal button').addEventListener('click', () => location.reload());
  }
}
window.addEventListener('hashchange', () => {
  const page = location.hash.slice(1) || 'home';
  if (profile && page !== currentPage) render(page);
});
start();

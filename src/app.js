import { CONFIG } from './config.js?v=20261122e';
import { getProfile, callApi } from './api.js?v=20261122e';
import { shell, homeView, inventoryView, inventoryResults, tenderView, tenderResults, formView, reportView, profileView, recordView, loadingView, toast } from './views.js?v=20261122e';

const app = document.querySelector('#app');
let profile = null;
let currentPage = 'home';
const availablePages = new Set(['home', 'tender', 'machine']);

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
  if (page === 'machine') return inventoryView();
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
  app.querySelector('#inventorySearch')?.addEventListener('submit', (event) => searchRecords(event, {
    prefix: 'inventory',
    action: 'SEARCH_INVENTORY',
    key: 'products',
    nameField: 'name',
    label: '產品',
    prompt: '請輸入有效的品名或料號。',
    renderResults: inventoryResults
  }));
  app.querySelector('#tenderSearch')?.addEventListener('submit', (event) => searchRecords(event, {
    prefix: 'tender',
    action: 'SEARCH_TENDER',
    key: 'tenders',
    nameField: 'x_name',
    label: '標案',
    prompt: '請輸入標案名稱或編號。',
    renderResults: tenderResults
  }));
  app.querySelector('#dataForm')?.addEventListener('submit', submitForm);
}

async function searchRecords(event, { prefix, action, key, nameField, label, prompt, renderResults }) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  if (submit.disabled) return;

  const status = app.querySelector(`#${prefix}Status`);
  const results = app.querySelector(`#${prefix}Results`);
  const keyword = form.elements.namedItem('keyword').value.trim();
  const inventory = action === 'SEARCH_INVENTORY';
  const warehouse = inventory ? form.elements.namedItem('warehouse').value : null;
  results.replaceChildren();
  if (inventory && !CONFIG.inventoryWarehouses.some(({ code }) => code === warehouse)) {
    status.textContent = '請選擇要查詢的倉庫。';
    return;
  }
  if (!keyword || (inventory && (keyword.length > 80 || !/[^%_\s]/u.test(keyword)))) {
    status.textContent = prompt;
    return;
  }

  submit.disabled = true;
  status.textContent = '查詢中…';
  try {
    const response = await callApi(action, {
      auth: { idToken: profile.idToken, lineUserId: profile.lineUserId },
      data: inventory ? { keyword, warehouse } : { keyword }
    });
    const records = response[key];
    if (!Array.isArray(records) || records.some((record) => typeof record?.[nameField] !== 'string')) {
      throw new Error(`系統回傳的${label}資料格式不正確，請稍後再試。`);
    }
    if (inventory && (response.warehouse?.code !== warehouse ||
      typeof response.warehouse.name !== 'string' || !response.warehouse.name.trim())) {
      throw new Error('系統回傳的倉庫與查詢不符，請稍後再試。');
    }

    results.innerHTML = renderResults(records);
    const count = records.length ? `找到 ${records.length} 筆${label}。` : `找不到符合的${label}。`;
    status.textContent = inventory ? `倉庫：${response.warehouse.name} · ${count}` : count;
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

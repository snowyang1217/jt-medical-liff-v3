import { getProfile, callApi } from './api.js?v=20261123b';
import { shell, homeView, inventoryView, inventoryResults, tenderView, tenderResults, loadingView } from './views.js?v=20261124a';

import { CONFIG } from './config.js?v=20261123g';
import { operationView, bindOperation } from './operations.js?v=20261124d';

const app = document.querySelector('#app');
let profile = null;
let currentPage = 'home';
const operationPages = new Set(CONFIG.operationPages);
const availablePages = new Set(['home', 'tender', 'machine', ...operationPages]);

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
  if (operationPages.has(page)) return operationView(page, profile, { allowTransferWrites: page === 'transfer' });
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
  bindOperation(app.querySelector('[data-operation]'), profile);
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
  results.replaceChildren();
  if (!keyword || (inventory && (keyword.length > 80 || !/[^%_\s]/u.test(keyword)))) {
    status.textContent = prompt;
    return;
  }

  submit.disabled = true;
  status.textContent = '查詢中…';
  try {
    const response = await callApi(action, {
      auth: { idToken: profile.idToken, lineUserId: profile.lineUserId },
      data: { keyword }
    });
    const records = response[key];
    if (!Array.isArray(records) || records.some((record) => typeof record?.[nameField] !== 'string')) {
      throw new Error(`系統回傳的${label}資料格式不正確，請稍後再試。`);
    }
    results.innerHTML = renderResults(records);
    status.textContent = records.length ? `找到 ${records.length} 筆${label}。` : `找不到符合的${label}。`;
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
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

import { getProfile, callApi } from './api.js?v=20261125-liff-reliability';
import { shell, homeView, inventoryView, inventoryResults, tenderView, tenderResults, loadingView } from './views.js?v=20261125-team-monthly';

import { CONFIG } from './config.js?v=20261125-ai-assistant';
import { operationView, bindOperation } from './operations.js?v=20261125-report-scope';

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
  const hashPage = location.hash.slice(1);
  const page = (availablePages.has(hashPage) ? hashPage : '') || directPage || statePage || 'home';
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

function navigate(page) {
  window.location.hash = page;
  render(page);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function sendFunctionName(label, page) {
  const liff = window.liff;
  try {
    if (!liff?.isInClient() || liff.getContext()?.type !== 'utou') {
      showChatNotice(page, '若要在對話留下功能名稱，請在手機 LINE 的一對一對話裡點開 LIFF 連結。');
      return;
    }

    const notice = showChatNotice(page, '正在傳送功能名稱到 LINE 對話…');
    const timeout = window.setTimeout(() => {
      if (notice) notice.textContent = 'LINE 尚未回覆傳送結果。功能已開啟，請回原對話確認。';
    }, 8000);
    try {
      await liff.sendMessages([{ type: 'text', text: label }]);
      notice?.remove();
    } finally {
      window.clearTimeout(timeout);
    }
  } catch {
    let permission;
    try {
      permission = (await liff?.permission?.query('chat_message.write'))?.state;
    } catch {
      // The send can fail before the current session's permission is readable.
    }
    if (permission === 'prompt') {
      showChatNotice(page, '這個 LINE 帳號尚未同意傳送訊息。請從聊天訊息重開 LIFF，並在授權畫面選擇允許。');
    } else if (permission === 'unavailable') {
      showChatNotice(page, '這次開啟的 LIFF 尚未取得聊天傳送權限。請關閉頁面後，從原對話重開。');
    } else {
      showChatNotice(page, '功能已開啟，但 LINE 未能送出功能名稱。請從原對話中的 LIFF 連結重開。');
    }
  }
}

function showChatNotice(page, message) {
  if (currentPage !== page) return;
  const content = app.querySelector('.page');
  if (!content) return;
  let notice = content.querySelector('[data-chat-notice]');
  if (!notice) {
    notice = document.createElement('p');
    notice.className = 'notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('data-chat-notice', '');
    content.prepend(notice);
  }
  notice.textContent = message;
  return notice;
}

function bindEvents() {
  app.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => {
    const { page, chatLabel } = button.dataset;
    navigate(page);
    if (chatLabel) void sendFunctionName(chatLabel, page);
  }));
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
  const page = launchedPage();
  if (profile && page !== currentPage) render(page);
});
start();

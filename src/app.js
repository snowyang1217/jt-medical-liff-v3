import { getProfile, callApi } from './api.js?v=20261118c';
import { shell, homeView, machineView, tenderView, formView, productView, profileView, recordView, loadingView, toast } from './views.js?v=20261118c';
import { machines } from './mock-data.js';

const app = document.querySelector('#app');
let profile = null;
let currentPage = 'home';

function contentFor(page) {
  if (page === 'home') return homeView(profile);
  if (page === 'machine') return machineView();
  if (page === 'tender') return tenderView();
  if (page === 'product') return productView();
  if (page === 'profile') return profileView(profile);
  if (page === 'record') return recordView();
  if (['visit','forecast','transfer','performance'].includes(page)) return formView(page, profile);
  return homeView(profile);
}

function render(page = currentPage) {
  currentPage = page;
  app.innerHTML = shell(profile, page, contentFor(page));
  bindEvents();
}

function navigate(page) { window.location.hash = page === 'home' ? '' : `#${page}`; render(page); window.scrollTo({ top: 0, behavior: 'smooth' }); }

function bindEvents() {
  app.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
  app.querySelector('#machineSearch')?.addEventListener('input', (event) => filterMachines(event.target.value));
  app.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
    app.querySelectorAll('[data-filter]').forEach((x) => x.classList.remove('active')); button.classList.add('active'); filterMachines('', button.dataset.filter);
  }));
  app.querySelector('#dataForm')?.addEventListener('submit', submitForm);
}

function filterMachines(query = '', status = document.querySelector('.filter.active')?.dataset.filter || 'all') {
  const list = app.querySelector('#machineList');
  const keyword = query.toLowerCase();
  const filtered = machines.filter((m) => (status === 'all' || m.status === status) && `${m.code} ${m.keeper} ${m.company}`.toLowerCase().includes(keyword));
  list.innerHTML = filtered.length ? filtered.map((m) => `<article class="record-card"><div><strong>${m.code}</strong><p>${m.company} · 目前保管人：${m.keeper}</p><small>開始日期 ${m.startedAt}</small></div><span class="pill">${m.status}</span></article>`).join('') : '<p class="empty">沒有符合的機台資料。</p>';
}

async function submitForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const submit = form.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = '送出中…';
  const values = Object.fromEntries(new FormData(form).entries());
  form.querySelectorAll('input, select, textarea').forEach((input) => { if (input.id) values[input.id] = input.value; });
  try {
    await callApi('CREATE_RECORD', { model: form.dataset.kind, profile, data: values });
    document.body.insertAdjacentHTML('beforeend', toast('資料已送出，稍後可在 Odoo 查閱。'));
    setTimeout(() => document.querySelector('.toast')?.remove(), 2600);
    form.reset();
  } catch (error) {
    document.body.insertAdjacentHTML('beforeend', toast(error.message, 'error'));
  } finally { submit.disabled = false; submit.textContent = '確認送出'; }
}

async function start() {
  app.innerHTML = loadingView();
  try { profile = await getProfile(); render(location.hash.slice(1) || 'home'); }
  catch (error) { app.innerHTML = `<div class="fatal"><h1>無法啟動系統</h1><p>${error.message}</p><button onclick="location.reload()">重新整理</button></div>`; }
}
window.addEventListener('hashchange', () => render(location.hash.slice(1) || 'home'));
start();

import { callApi } from './api.js?v=20261123b';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[char]);
const quantityFormat = new Intl.NumberFormat('zh-TW', { maximumSignificantDigits: 12 });
const amountFormat = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 2 });
const isId = (value) => Number.isSafeInteger(value) && value > 0;
const isMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && !value.startsWith('0000');
const currentMonth = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit'
}).format();

const titles = {
  forecast: '我的訂貨預估',
  transfer: '機台交接',
  report: '我的業績',
  performance: '跟刀業績輸入'
};

function lookup(name, label) {
  return `<div data-lookup="${name}">
    <label class="field"><span>搜尋${label}</span><input type="search" maxlength="80" /></label>
    <button class="secondary" type="button" data-search>查詢</button>
    <label class="field"><span>${label}<b>＊</b></span><select name="${name}" required>
      <option value="">請先搜尋再選擇</option>
    </select></label>
    <p class="empty" role="status"></p>
  </div>`;
}

function input(name, label, type, properties = '') {
  return `<label class="field"><span>${label}<b>＊</b></span>
    <input name="${name}" type="${type}" ${properties} required /></label>`;
}

function recordsView(page) {
  if (page === 'performance') return '';
  const title = page === 'transfer' ? '我的交接紀錄' : page === 'forecast' ? '我的預估紀錄' : '跟刀業績紀錄';
  const monthField = page === 'transfer' ? '' : input('month', '查詢月份', 'month', `value="${currentMonth()}"`);
  return `<section aria-label="${title}"><h2>${title}</h2>
    <form data-records>${monthField}<button class="primary" type="submit">${page === 'transfer' ? '更新交接紀錄' : '查詢'}</button></form>
    <p class="empty" data-list-status role="status"></p>
    <div class="list" data-results></div>
    <button class="secondary" type="button" data-next hidden>載入更多</button>
  </section>`;
}

function pendingTransfersView() {
  return `<section class="pending-transfers" aria-labelledby="pending-transfer-heading" data-pending-transfers>
    <h2 id="pending-transfer-heading">待我接收</h2>
    <p role="status" data-pending-status></p>
    <div class="list" data-pending-results></div>
  </section>`;
}

function custodyView() {
  return `<section aria-labelledby="custody-heading" data-custody>
    <h2 id="custody-heading">我目前保管的機台</h2>
    <button class="secondary" type="button" data-custody-refresh>更新保管機台</button>
    <p class="empty" role="status"></p>
    <div class="list" data-custody-results></div>
    <button class="secondary" type="button" data-custody-next hidden>載入更多保管機台</button>
  </section>`;
}

export function operationView(page, profile, { allowTransferWrites = false } = {}) {
  const readOnly = page === 'transfer' && !allowTransferWrites;
  const fields = {
    forecast: input('month', '預估月份', 'month', `value="${currentMonth()}"`)
      + lookup('productId', '產品') + input('quantity', '預估數量', 'number', 'min="0" step="any"'),
    transfer: `<label class="field"><span>交接機台<b>＊</b></span>
      <select name="machineId" required><option value="">請選擇目前保管的機台</option></select>
    </label>` + lookup('receiverId', '接收人')
      + input('plannedDate', '預計交接日期', 'date'),
    performance: input('serviceDate', '跟刀日期', 'date')
      + lookup('hospitalId', '客戶／醫院') + lookup('productId', '產品')
      + input('quantity', '數量', 'number', 'min="0" step="any"')
      + input('amount', '業績金額（TWD）', 'number', 'min="0" step="0.01"')
  };
  return `<section data-operation="${page}"${readOnly ? ' data-read-only' : ''}>
    <div class="page-head"><button class="back" data-page="home" aria-label="回首頁">‹</button><div><h1>${titles[page]}</h1></div></div>
    ${page === 'transfer' ? '<a class="notice pending-transfer-link" href="#pending-transfer-heading" data-pending-link hidden></a>'
      + custodyView() + pendingTransfersView() + recordsView(page) : ''}
    ${page === 'report' || readOnly ? '' : `<form data-entry${page === 'transfer' ? ' hidden' : ''}>
      ${page === 'transfer' ? '<h2>新增交接申請</h2>' : ''}
      <p>${page === 'transfer' ? '交接人　<span data-transfer-sender></span>' : `填報人　${escapeHtml(profile.name)}`}</p>
      ${fields[page]}
      <label class="field"><span>備註</span><textarea name="note" maxlength="1000"></textarea></label>
      <button class="primary" type="submit">${page === 'transfer' ? '送出交接申請' : '確認送出'}</button>
      <p class="empty" role="status"></p>
    </form>`}
    ${page === 'transfer' ? '' : recordsView(page)}
  </section>`;
}

export function entryValues(page, values) {
  const note = values.note.trim();
  if (page === 'forecast' && !isMonth(values.month)) throw new Error('請選擇正確的預估月份。');
  if (page === 'transfer') {
    const date = values.plannedDate;
    const timestamp = Date.parse(date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp)
      || new Date(timestamp).toISOString().slice(0, 10) !== date || date.startsWith('0000')) {
      throw new Error('請選擇正確的預計交接日期。');
    }
  }
  const data = { note };
  for (const [name, value] of Object.entries(values)) {
    if (name.endsWith('Id')) {
      const id = Number(value);
      if (!isId(id)) throw new Error('請從查詢結果選擇資料。');
      data[name] = id;
    } else if (name === 'quantity' || name === 'amount') {
      const number = Number(value);
      if (!value || !Number.isFinite(number) || number < 0 || (name === 'quantity' && number === 0)) {
        throw new Error(name === 'quantity' ? '數量須大於零。' : '請輸入有效的業績金額。');
      }
      data[name] = number;
    } else if (name !== 'note') {
      data[name] = value;
    }
  }
  return data;
}

function createRequestId(previous, data) {
  const values = JSON.stringify(data);
  return previous?.values === values ? previous : { values, id: crypto.randomUUID() };
}

async function withStatus(button, status, message, run) {
  if (button.disabled) return;
  button.disabled = true;
  status.textContent = message;
  try {
    await run();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function bindCustody(root, request) {
  const section = root.querySelector('[data-custody]');
  const list = section.querySelector('[data-custody-results]');
  const status = section.querySelector('[role="status"]');
  const refresh = section.querySelector('[data-custody-refresh]');
  const next = section.querySelector('[data-custody-next]');
  const select = root.querySelector('select[name="machineId"]');
  const ownedIds = new Set();
  let cursor = null;
  let requestVersion = 0;

  const load = async (more = false) => {
    if (more && (next.disabled || !cursor)) return;
    const version = ++requestVersion;
    const previousSelection = select?.value;
    const after = more ? cursor : 0;
    if (!more) {
      list.replaceChildren();
      ownedIds.clear();
      if (select) select.length = 1;
      next.hidden = true;
      cursor = null;
    }
    refresh.disabled = next.disabled = true;
    status.textContent = '查詢中…';
    try {
      const result = await request('SEARCH_REFERENCES', {
        model: 'transfer', data: { field: 'machineId', keyword: '', ...(more ? { cursor: after } : {}) }
      });
      if (version !== requestVersion) return;
      const rows = Array.isArray(result.references)
        ? result.references.map((row) => ({ id: row?.id, label: row?.x_name || row?.name }))
        : result.options;
      if (!Array.isArray(rows) || rows.length > 51 || rows.some((row, index) =>
        !isId(row?.id) || row.id <= (index ? rows[index - 1].id : after)
        || typeof row.label !== 'string' || !row.label.trim())) {
        throw new Error('保管機台資料格式不正確，請稍後再試。');
      }
      const machines = rows.slice(0, 50);
      for (const { id, label } of machines) {
        ownedIds.add(id);
        select?.add(new Option(label, id));
      }
      if (select && ownedIds.has(Number(previousSelection))) select.value = previousSelection;
      list.insertAdjacentHTML('beforeend', machines.map(({ label }) =>
        `<article class="record-card"><strong>${escapeHtml(label)}</strong></article>`).join(''));
      cursor = rows.length > 50 ? machines.at(-1).id : null;
      next.hidden = cursor === null;
      status.textContent = ownedIds.size ? '' : '你目前沒有保管機台。';
    } catch (error) {
      if (version === requestVersion) status.textContent = error.message;
    } finally {
      if (version === requestVersion) refresh.disabled = next.disabled = false;
    }
  };

  refresh.addEventListener('click', () => void load());
  next.addEventListener('click', () => void load(true));
  void load();
  return { refresh: load, owns: (id) => ownedIds.has(id) };
}

function bindLookup(box, request, page) {
  const search = box.querySelector('input');
  const button = box.querySelector('[data-search]');
  const select = box.querySelector('select');
  const status = box.querySelector('[role="status"]');
  const clear = () => { select.length = 1; select.value = ''; };
  const find = () => {
    if (button.disabled) return;
    clear();
    const keyword = search.value.trim();
    if (!keyword || keyword.length > 80 || !/[^%_\s]/u.test(keyword)) {
      status.textContent = '請輸入有效的搜尋關鍵字。';
      return;
    }
    void withStatus(button, status, '查詢中…', async () => {
      const result = await request('SEARCH_REFERENCES', { model: page, data: { field: box.dataset.lookup, keyword } });
      if (search.value.trim() !== keyword) return;
      const options = page === 'forecast' && Array.isArray(result.products)
        ? result.products.map((product) => ({
          id: product?.id,
          label: typeof product?.name === 'string'
            ? [product.name, product.default_code || ''].filter(Boolean).join(' · ')
            : null
        }))
        : page === 'transfer' && Array.isArray(result.references)
          ? result.references.map((item) => ({ id: item?.id, label: item?.name || item?.x_name }))
          : result.options;
      if (!Array.isArray(options) || options.some((item) => !isId(item?.id) || typeof item.label !== 'string')) {
        throw new Error('查詢結果格式不正確，請稍後再試。');
      }
      for (const { id, label } of options) select.add(new Option(label, id));
      status.textContent = options.length ? '請從查詢結果選擇。' : '查無符合資料。';
    });
  };
  button.addEventListener('click', find);
  search.addEventListener('input', () => { clear(); status.textContent = ''; });
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      find();
    }
  });
  return () => { clear(); status.textContent = ''; };
}

function recordCard(page, row, readOnly) {
  const title = escapeHtml(row.label);
  const date = escapeHtml(row.date || '');
  const note = row.note ? `<p>${escapeHtml(row.note)}</p>` : '';
  if (page === 'forecast') return `<article class="record-card"><div><strong>${title}</strong>
    <p>預估月份　${escapeHtml(row.date?.slice(0, 7))}</p><p>預估數量　${quantityFormat.format(row.quantity)}</p>
    <p>狀態　${escapeHtml(row.status)}</p>${note}</div></article>`;
  if (page === 'report') return `<article class="record-card"><div><strong>${title}</strong>
    <p>${date}　${escapeHtml(row.hospital)}</p><p>數量　${quantityFormat.format(row.quantity)}</p>
    <p>業績金額　${amountFormat.format(row.amount)}</p></div></article>`;
  return `<article class="record-card"><div><strong>${title}</strong><p>預計交接日期　${date}</p>
    <p>交接人　${escapeHtml(row.sender)}　接收人　${escapeHtml(row.receiver)}</p>
    ${row.custodian ? `<p>目前保管人　${escapeHtml(row.custodian)}</p>` : ''}
    <p data-transfer-status>交接狀態　${escapeHtml(row.status)}</p>${note}
    ${row.rejectionReason ? `<p>拒絕原因　${escapeHtml(row.rejectionReason)}</p>` : ''}
    ${!readOnly && row.canRespond === true && row.status === '待確認' ? `<form data-response="${row.id}">
      <label class="field"><span>拒絕原因</span><textarea name="reason" maxlength="1000"></textarea></label>
      <button type="submit" class="secondary" name="decision" value="accept">確認接收</button>
      <button type="submit" class="secondary" name="decision" value="reject">拒絕交接</button>
      <p class="empty" role="status"></p>
    </form>` : row.awaitingMe ? '<p>待接收 · 這筆尚未開放在 LINE 確認</p>' : ''}</div></article>`;
}

function validRow(page, row) {
  if (!isId(row?.id) || typeof row.label !== 'string' || (row.date && typeof row.date !== 'string')) return false;
  if (page === 'transfer') return typeof row.status === 'string';
  return Number.isFinite(row.quantity) && (page !== 'report' || Number.isFinite(row.amount));
}

function forecastRecords(result) {
  if (!Array.isArray(result.forecasts)) return result;
  const records = result.forecasts.slice(0, 50).map((row) => ({
    id: row?.id,
    label: row?.x_studio_many2one_4?.[1] || row?.x_name,
    date: row?.x_studio_date_1,
    quantity: row?.x_studio_float_1,
    status: row?.x_studio_selection_1,
    note: row?.x_studio_text_1
  }));
  return { records, nextCursor: result.forecasts.length > 50 ? String(records[49].id) : null };
}

function transferRecords(result) {
  if (!Array.isArray(result.transfers)) return result;
  const respondableIds = new Set(Array.isArray(result.respondableIds) ? result.respondableIds.filter(isId) : []);
  const records = result.transfers.slice(0, 50).map((row) => ({
    awaitingMe: isId(result.employeeId) && row?.x_studio_many2one_3?.[0] === result.employeeId
      && row.x_studio_selection_2 === '待確認',
    canRespond: respondableIds.has(row?.id),
    id: row?.id,
    label: row?.x_studio_many2one_1?.[1] || row?.x_name,
    date: row?.x_studio_date_3,
    sender: row?.x_studio_many2one_2?.[1],
    receiver: row?.x_studio_many2one_3?.[1],
    custodian: row?.x_studio_many2one_4?.[1],
    status: row?.x_studio_selection_2 || '未設定',
    rejectionReason: row?.x_studio_text_1,
    note: row?.x_studio_text_2
  }));
  return { records, nextCursor: result.transfers.length > 50 ? String(records[49].id) : null };
}

function bindRecords(root, request, page, refreshCustody) {
  const readOnly = root.hasAttribute('data-read-only');
  const form = root.querySelector('[data-records]');
  if (!form) return;
  const submit = form.querySelector('button');
  const status = root.querySelector('[data-list-status]');
  const list = root.querySelector('[data-results]');
  const next = root.querySelector('[data-next]');
  const pending = root.querySelector('[data-pending-results]');
  const pendingStatus = root.querySelector('[data-pending-status]');
  const pendingLink = root.querySelector('[data-pending-link]');
  let pendingCount = 0;
  let cursor = null;
  let loadedMonth = '';
  let loading = false;
  const model = page === 'report' ? 'performance' : page;

  const load = async (more = false) => {
    if (loading) return;
    const month = form.elements.namedItem('month')?.value || '';
    if (model !== 'transfer' && !isMonth(month)) {
      status.textContent = '請選擇查詢月份。';
      return;
    }
    if (more && (!cursor || month !== loadedMonth)) return;
    if (!more) {
      list.replaceChildren();
      pending?.replaceChildren();
      pendingCount = 0;
      if (pendingLink) pendingLink.hidden = true;
      if (pendingStatus) pendingStatus.textContent = '查詢中…';
      cursor = null;
      next.hidden = true;
    }
    loading = true;
    submit.disabled = true;
    next.disabled = true;
    status.textContent = '查詢中…';
    try {
      const result = await request('LIST_OWN_RECORDS', {
        model, data: { ...(month ? { month } : {}), ...(more ? { cursor } : {}) }
      });
      const { records, nextCursor, totalAmount } = page === 'forecast' ? forecastRecords(result)
        : page === 'transfer' ? transferRecords(result) : result;
      if (!Array.isArray(records) || records.some((row) => !validRow(page, row))
        || (nextCursor != null && (typeof nextCursor !== 'string' || !nextCursor))
        || (page === 'report' && !Number.isFinite(totalAmount))) {
        throw new Error('查詢結果格式不正確，請稍後再試。');
      }
      if (page === 'transfer' && typeof result.senderName === 'string' && result.senderName.trim()) {
        const entry = root.querySelector('[data-entry]');
        if (entry) {
          entry.querySelector('[data-transfer-sender]').textContent = result.senderName;
          entry.hidden = false;
        }
      }
      loadedMonth = month;
      cursor = nextCursor || null;
      next.hidden = !cursor;
      const summary = page === 'report' && !more
        ? `<p class="notice">${escapeHtml(month)} 跟刀業績合計　<strong>${amountFormat.format(totalAmount)}</strong></p>`
        : '';
      const incoming = pending ? records.filter((row) => row.awaitingMe === true) : [];
      const history = pending ? records.filter((row) => row.awaitingMe !== true) : records;
      if (pending) {
        pending.insertAdjacentHTML('beforeend', incoming.map((row) =>
          recordCard(page, row, readOnly)).join(''));
        pendingCount += incoming.length;
        pendingLink.hidden = pendingCount === 0;
        pendingLink.textContent = pendingCount ? `${pendingCount} 筆交接待你接收` : '';
        pendingStatus.textContent = !isId(result.employeeId) ? '目前無法辨識待接收交接，請查看下方紀錄。'
          : pendingCount ? (cursor ? '下方可載入較早的紀錄。' : '')
          : cursor ? '目前載入的紀錄沒有待接收交接。' : '目前沒有待接收的交接。';
      }
      list.insertAdjacentHTML('beforeend', summary + history.map((row) => recordCard(page, row, readOnly)).join(''));
      status.textContent = !more && !history.length
        ? (page === 'transfer' ? '目前沒有其他交接紀錄。' : '查無紀錄。') : '';
    } catch (error) {
      status.textContent = error.message;
      if (pendingStatus && !more) pendingStatus.textContent = '目前無法載入待接收交接。';
    } finally {
      loading = false;
      submit.disabled = false;
      next.disabled = false;
    }
  };

  form.addEventListener('submit', (event) => { event.preventDefault(); void load(); });
  next.addEventListener('click', () => { void load(true); });
  form.elements.namedItem('month')?.addEventListener('change', () => { next.hidden = true; });
  (pending ? root : list).addEventListener('submit', async (event) => {
    const action = event.target.closest('[data-response]');
    if (!action || readOnly) return;
    event.preventDefault();
    if (action.dataset.pending || loading || !event.submitter) return;
    const decision = event.submitter.value;
    if (decision !== 'accept' && decision !== 'reject') return;
    const recordId = Number(action.dataset.response);
    if (!isId(recordId)) return;
    const reason = action.elements.namedItem('reason').value.trim();
    const feedback = action.querySelector('[role="status"]');
    if (decision === 'reject' && (!reason || reason.length > 1000)) {
      feedback.textContent = '請填寫拒絕原因，最多 1,000 字。';
      return;
    }
    if (decision === 'accept' && !window.confirm('確認接收後，機台保管人將改為你。確定接收嗎？')) return;
    action.dataset.pending = 'true';
    const buttons = [...action.querySelectorAll('button')];
    buttons.forEach((button) => { button.disabled = true; });
    feedback.textContent = '處理中…';
    try {
      const result = await request('RESPOND_TRANSFER', {
        model: 'transfer', data: { recordId, decision, ...(decision === 'reject' ? { reason } : {}) }
      });
      if (result.recordId !== recordId || result.status !== (decision === 'accept' ? '已確認' : '已拒絕')) {
        throw new Error('目前無法確認處理結果，請更新交接紀錄確認。');
      }
      action.closest('article').querySelector('[data-transfer-status]').textContent = `交接狀態　${result.status}`;
      action.remove();
      void load();
      if (decision === 'accept') void refreshCustody?.();
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      delete action.dataset.pending;
      buttons.forEach((button) => { button.disabled = false; });
    }
  });
  void load();
  return load;
}

async function submitForecast(send, values) {
  const result = await send(values);
  if (result.outcome !== 'confirm_quantity') return result;

  const { recordId, existingQuantity, revision } = result;
  if (!isId(recordId) || !Number.isFinite(existingQuantity) || typeof revision !== 'string' || !revision) {
    throw new Error('目前無法確認原預估資料，請重新查詢。');
  }

  const current = quantityFormat.format(existingQuantity);
  const proposed = quantityFormat.format(values.quantity);
  const confirmed = window.confirm(
    `你曾送出相同產品與月份的訂貨預估。\n原數量：${current}\n新數量：${proposed}\n確定要修正原紀錄嗎？`
  );
  if (!confirmed) return null;

  const updated = await send({
    ...values,
    replaceRecordId: recordId,
    expectedQuantity: existingQuantity,
    expectedRevision: revision
  });
  if (updated.outcome === 'confirm_quantity') {
    throw new Error('原預估在確認期間已變更，請重新送出並確認最新數量。');
  }
  return updated;
}

export function bindOperation(root, profile, api = callApi) {
  if (!root) return;
  const page = root.dataset.operation;
  const auth = { idToken: profile.idToken, lineUserId: profile.lineUserId };
  const request = (action, payload) => api(action, { auth, ...payload });
  const custody = page === 'transfer' ? bindCustody(root, request) : null;
  const reloadRecords = bindRecords(root, request, page, custody?.refresh);
  const form = root.querySelector('[data-entry]');
  if (!form) return;
  const resetLookups = [...form.querySelectorAll('[data-lookup]')].map((box) => bindLookup(box, request, page));
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector(':scope > [role="status"]');
  let requestId;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void withStatus(button, status, '送出中…', async () => {
      const values = entryValues(page, Object.fromEntries(new FormData(form)));
      if (custody && !custody.owns(values.machineId)) throw new Error('請選擇你目前保管的機台。');
      requestId = createRequestId(requestId, values);
      const send = (data) => request('CREATE_RECORD', { model: page, data: { ...data, requestId: requestId.id } });
      const result = page === 'forecast' ? await submitForecast(send, values) : await send(values);
      if (result === null) {
        status.textContent = '已取消修正，表單內容已保留。';
        return;
      }
      const { recordId, outcome } = result;
      if (!isId(recordId)) throw new Error('目前無法確認是否寫入，請先查詢紀錄再重送。');
      requestId = undefined;
      form.reset();
      resetLookups.forEach((reset) => reset());
      const message = page === 'transfer' ? '已送出交接申請'
        : outcome === 'unchanged' ? '已有相同數量的預估'
        : outcome === 'quantity_updated' ? '已修正原預估數量' : '已送出';
      status.textContent = `${message}，紀錄編號 ${recordId}。`;
      void reloadRecords?.();
    });
  });
}

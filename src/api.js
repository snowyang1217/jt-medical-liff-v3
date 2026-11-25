import { CONFIG } from './config.js?v=20261123b';

const wait = (ms = 280) => new Promise((resolve) => setTimeout(resolve, ms));

export async function callApi(action, payload = {}) {
  if (CONFIG.demoMode) {
    await wait();
    return { ok: true, demo: true, action, payload };
  }

  if (!CONFIG.makeWebhookUrl) throw new Error('系統連線尚未設定，請聯絡管理者。');

  const isWrite = action === 'CREATE_RECORD' || action === 'RESPOND_TRANSFER';
  const unavailable = isWrite
    ? '目前無法確認是否處理成功，請先更新紀錄再重試。'
    : '系統暫時無法連線，請稍後再試。';
  const response = await fetch(CONFIG.makeWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  }).catch(() => {
    throw new Error(unavailable);
  });

  if (response.status === 401) {
    throw new Error('LINE 登入已失效，請從官方帳號重新開啟系統。');
  }
  if (action === 'SEARCH_INVENTORY' && response.status === 403) {
    throw new Error('這個 LINE 帳號尚未取得庫存查詢權限。');
  }
  if (action === 'SEARCH_TENDER' && response.status === 403) {
    throw new Error('這個 LINE 帳號尚未取得標案查詢權限。');
  }
  if (response.status === 403) throw new Error('這個 LINE 帳號尚未取得此功能的使用權限。');
  if (!response.ok) throw new Error(unavailable);
  const data = await response.json().catch(() => {
    throw new Error(unavailable);
  });
  if (data?.ok === false) {
    const message = typeof data.message === 'string' ? data.message.trim() : '';
    throw new Error(message || '資料處理失敗。');
  }
  if (data?.ok !== true) throw new Error(unavailable);
  return data;
}

export async function getProfile() {
  if (CONFIG.demoMode) {
    return { id: 'demo-sales', name: '示範業務', role: '業務', company: '捷旭', lineUserId: 'demo-user', idToken: null };
  }
  if (!CONFIG.liffId || !window.liff) {
    throw new Error('無法啟動 LINE 登入，請從官方帳號重新開啟系統。');
  }
  await window.liff.init({ liffId: CONFIG.liffId });
  if (!window.liff.isLoggedIn()) {
    window.liff.login();
    return null;
  }
  const lineProfile = await window.liff.getProfile();
  const idToken = window.liff.getIDToken();
  if (!idToken) throw new Error('無法取得 LINE 身分驗證，請重新開啟系統。');

  const result = await callApi('GET_PROFILE', { auth: { idToken, lineUserId: lineProfile.userId } });
  if (typeof result.profile?.name !== 'string') {
    throw new Error('無法載入登入資料，請稍後再試。');
  }
  return { ...result.profile, lineUserId: lineProfile.userId, idToken };
}

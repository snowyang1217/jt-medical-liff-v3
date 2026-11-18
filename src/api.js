import { CONFIG } from './config.js?v=20261118d';

const wait = (ms = 280) => new Promise((resolve) => setTimeout(resolve, ms));

export async function callApi(action, payload = {}) {
  if (CONFIG.demoMode || !CONFIG.makeWebhookUrl) {
    await wait();
    return { ok: true, demo: true, action, payload };
  }

  const response = await fetch(CONFIG.makeWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });

  if (!response.ok) throw new Error('系統暫時無法連線，請稍後再試。');
  const data = await response.json();
  if (!data.ok) throw new Error(data.message || '資料處理失敗。');
  return data;
}

export async function getProfile() {
  if (CONFIG.demoMode || !CONFIG.liffId || !window.liff) {
    return { id: 'demo-sales', name: '示範業務', role: '業務', company: '捷旭', lineUserId: 'demo-user', idToken: null };
  }
  await window.liff.init({ liffId: CONFIG.liffId });
  if (!window.liff.isLoggedIn()) window.liff.login();
  const lineProfile = await window.liff.getProfile();
  const idToken = window.liff.getIDToken();
  if (!idToken) throw new Error('無法取得 LINE 身分驗證，請重新開啟系統。');

  if (!CONFIG.makeWebhookUrl) {
    return { id: lineProfile.userId, name: lineProfile.displayName, role: '業務', company: '捷旭', lineUserId: lineProfile.userId, idToken };
  }

  const result = await callApi('GET_PROFILE', { auth: { idToken, lineUserId: lineProfile.userId } });
  return { ...result.profile, lineUserId: lineProfile.userId, idToken };
}

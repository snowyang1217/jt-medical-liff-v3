export const CONFIG = {
  appName: '捷旭醫療 業務行動系統',
  liffId: '2010246946-vgITecru', // LIFF ID；不可放任何 Odoo Key。
  makeWebhookUrl: '', // 建立新版 Make Webhook 後填入。
  demoMode: false,
  companyOptions: ['捷旭', '聯友泰'],
  navigation: [
    { id: 'home', label: '首頁', icon: '⌂' },
    { id: 'machine', label: '機台', icon: '▣' },
    { id: 'record', label: '填報', icon: '+' },
    { id: 'profile', label: '我的', icon: '◉' }
  ]
};

export const MODELS = {
  machine: 'x_1212',
  transfer: 'x_1213',
  forecast: 'x_1214',
  tender: 'x_1215',
  performance: 'x_1216'
};

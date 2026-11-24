export const CONFIG = {
  appName: '捷旭醫療 業務行動系統',
  liffId: '2010246946-vgITecru', // LIFF ID；不可放任何 Odoo Key。
  // Public Worker gateway only. The actual Make webhook stays encrypted in Cloudflare.
  makeWebhookUrl: 'https://jt-medical-gateway.snowyang1217.workers.dev',
  demoMode: false,
  // Performance routes use the employee authorization enforced by the gateway and Make.
  operationPages: ['forecast', 'transfer', 'performance', 'report'],
  companyOptions: ['捷旭', '聯友泰'],
  navigation: [
    { id: 'home', label: '首頁', icon: '⌂' },
    { id: 'machine', label: '庫存', icon: '▣' },
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

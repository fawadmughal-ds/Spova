'use client';

import { createLocalStore } from './settings';

/** Languages offered in the rail's picker. `flag` is the ISO country used for the flag emoji. */
export const LANGUAGES = [
  { code: 'en', native: 'English', flag: 'GB' },
  { code: 'hi', native: 'हिन्दी', flag: 'IN' },
  { code: 'ur', native: 'اردو', flag: 'PK' },
  { code: 'ar', native: 'العربية', flag: 'AE' },
  { code: 'es', native: 'Español', flag: 'ES' },
  { code: 'pt', native: 'Português', flag: 'BR' },
  { code: 'fr', native: 'Français', flag: 'FR' },
  { code: 'de', native: 'Deutsch', flag: 'DE' },
  { code: 'ru', native: 'Русский', flag: 'RU' },
  { code: 'zh', native: '中文', flag: 'CN' },
] as const;
export type Lang = (typeof LANGUAGES)[number]['code'];
const CODES = LANGUAGES.map((l) => l.code) as readonly string[];

export const langStore = createLocalStore<{ code: Lang }>('wt-lang', { code: 'en' }, (v) => (CODES.includes(v.code) ? v : { code: 'en' }));
export const useLang = () => langStore.use().code;
export const setLang = (code: Lang) => {
  langStore.set({ code });
  if (typeof document !== 'undefined') document.documentElement.lang = code;
};

/** Regional-indicator flag for an ISO 3166-1 alpha-2 code ("IN" -> 🇮🇳). */
export const flagEmoji = (cc: string) => (cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '🌐');

type Entry = Partial<Record<Lang, string>> & { en: string };
/** Terminal chrome strings. Table-level content (prices, symbols, numbers) is not translated. */
const STRINGS = {
  dashboard: { en: 'Dashboard', hi: 'डैशबोर्ड', ur: 'ڈیش بورڈ', ar: 'لوحة التحكم', es: 'Panel', pt: 'Painel', fr: 'Tableau de bord', de: 'Dashboard', ru: 'Панель', zh: '控制台' },
  darkMode: { en: 'Dark mode', hi: 'डार्क मोड', ur: 'ڈارک موڈ', ar: 'الوضع الداكن', es: 'Modo oscuro', pt: 'Modo escuro', fr: 'Mode sombre', de: 'Dunkelmodus', ru: 'Тёмная тема', zh: '深色模式' },
  deposit: { en: 'Deposit', hi: 'जमा करें', ur: 'ڈپازٹ', ar: 'إيداع', es: 'Depositar', pt: 'Depositar', fr: 'Dépôt', de: 'Einzahlen', ru: 'Пополнить', zh: '入金' },
  accounts: { en: 'Trading accounts', hi: 'ट्रेडिंग खाते', ur: 'ٹریڈنگ اکاؤنٹس', ar: 'حسابات التداول', es: 'Cuentas', pt: 'Contas', fr: 'Comptes', de: 'Konten', ru: 'Счета', zh: '交易账户' },
  payments: { en: 'Payments', hi: 'भुगतान', ur: 'ادائیگیاں', ar: 'المدفوعات', es: 'Pagos', pt: 'Pagamentos', fr: 'Paiements', de: 'Zahlungen', ru: 'Платежи', zh: '付款' },
  documents: { en: 'Documents', hi: 'दस्तावेज़', ur: 'دستاویزات', ar: 'المستندات', es: 'Documentos', pt: 'Documentos', fr: 'Documents', de: 'Dokumente', ru: 'Документы', zh: '文件' },
  statement: { en: 'Statement', hi: 'स्टेटमेंट', ur: 'اسٹیٹمنٹ', ar: 'كشف الحساب', es: 'Extracto', pt: 'Extrato', fr: 'Relevé', de: 'Kontoauszug', ru: 'Выписка', zh: '对账单' },
  help: { en: 'Help', hi: 'सहायता', ur: 'مدد', ar: 'مساعدة', es: 'Ayuda', pt: 'Ajuda', fr: 'Aide', de: 'Hilfe', ru: 'Помощь', zh: '帮助' },
  logout: { en: 'Logout', hi: 'लॉग आउट', ur: 'لاگ آؤٹ', ar: 'تسجيل الخروج', es: 'Salir', pt: 'Sair', fr: 'Déconnexion', de: 'Abmelden', ru: 'Выйти', zh: '退出' },
  profile: { en: 'Profile', hi: 'प्रोफ़ाइल', ur: 'پروفائل', ar: 'الملف الشخصي', es: 'Perfil', pt: 'Perfil', fr: 'Profil', de: 'Profil', ru: 'Профиль', zh: '个人资料' },
  language: { en: 'Language', hi: 'भाषा', ur: 'زبان', ar: 'اللغة', es: 'Idioma', pt: 'Idioma', fr: 'Langue', de: 'Sprache', ru: 'Язык', zh: '语言' },
  trade: { en: 'Trade', hi: 'ट्रेड', ur: 'ٹریڈ', ar: 'تداول', es: 'Operar', pt: 'Negociar', fr: 'Trader', de: 'Handel', ru: 'Торговля', zh: '交易' },
  analytics: { en: 'Analytics', hi: 'विश्लेषण', ur: 'تجزیات', ar: 'التحليلات', es: 'Análisis', pt: 'Análises', fr: 'Analyses', de: 'Analysen', ru: 'Аналитика', zh: '分析' },
  explore: { en: 'Explore', hi: 'एक्सप्लोर', ur: 'دریافت کریں', ar: 'استكشاف', es: 'Explorar', pt: 'Explorar', fr: 'Explorer', de: 'Entdecken', ru: 'Обзор', zh: '探索' },
  profit: { en: 'Profit', hi: 'लाभ', ur: 'منافع', ar: 'الربح', es: 'Beneficio', pt: 'Lucro', fr: 'Profit', de: 'Gewinn', ru: 'Прибыль', zh: '盈亏' },
  favorites: { en: 'Favorites', hi: 'पसंदीदा', ur: 'پسندیدہ', ar: 'المفضلة', es: 'Favoritos', pt: 'Favoritos', fr: 'Favoris', de: 'Favoriten', ru: 'Избранное', zh: '自选' },
  topMovers: { en: 'Top Movers', hi: 'टॉप मूवर्स', ur: 'ٹاپ موورز', ar: 'الأكثر تحركاً', es: 'Más movidos', pt: 'Maiores variações', fr: 'Plus fortes variations', de: 'Top-Bewegungen', ru: 'Лидеры движения', zh: '涨跌榜' },
  symbol: { en: 'Symbol', hi: 'सिंबल', ur: 'سمبل', ar: 'الرمز', es: 'Símbolo', pt: 'Símbolo', fr: 'Symbole', de: 'Symbol', ru: 'Символ', zh: '品种' },
  price: { en: 'Price', hi: 'मूल्य', ur: 'قیمت', ar: 'السعر', es: 'Precio', pt: 'Preço', fr: 'Prix', de: 'Preis', ru: 'Цена', zh: '价格' },
  daily: { en: 'Daily', hi: 'दैनिक', ur: 'روزانہ', ar: 'يومي', es: 'Diario', pt: 'Diário', fr: 'Quotidien', de: 'Täglich', ru: 'За день', zh: '日涨跌' },
  spread: { en: 'Spread', hi: 'स्प्रेड', ur: 'اسپریڈ', ar: 'الفارق', es: 'Spread', pt: 'Spread', fr: 'Spread', de: 'Spread', ru: 'Спред', zh: '点差' },
  sell: { en: 'SELL', hi: 'बेचें', ur: 'بیچیں', ar: 'بيع', es: 'VENDER', pt: 'VENDER', fr: 'VENDRE', de: 'VERKAUFEN', ru: 'ПРОДАТЬ', zh: '卖出' },
  buy: { en: 'BUY', hi: 'खरीदें', ur: 'خریدیں', ar: 'شراء', es: 'COMPRAR', pt: 'COMPRAR', fr: 'ACHETER', de: 'KAUFEN', ru: 'КУПИТЬ', zh: '买入' },
  advancedOrder: { en: 'Advanced Order', hi: 'एडवांस्ड ऑर्डर', ur: 'ایڈوانسڈ آرڈر', ar: 'أمر متقدم', es: 'Orden avanzada', pt: 'Ordem avançada', fr: 'Ordre avancé', de: 'Erweiterte Order', ru: 'Расширенный ордер', zh: '高级订单' },
  calendar: { en: 'Calendar', hi: 'कैलेंडर', ur: 'کیلنڈر', ar: 'التقويم', es: 'Calendario', pt: 'Calendário', fr: 'Calendrier', de: 'Kalender', ru: 'Календарь', zh: '日历' },
  market: { en: 'Market', hi: 'बाज़ार', ur: 'مارکیٹ', ar: 'السوق', es: 'Mercado', pt: 'Mercado', fr: 'Marché', de: 'Markt', ru: 'Рынок', zh: '市场' },
  symbolInfo: { en: 'Symbol info', hi: 'सिंबल जानकारी', ur: 'سمبل کی معلومات', ar: 'معلومات الرمز', es: 'Info del símbolo', pt: 'Info do símbolo', fr: 'Infos symbole', de: 'Symbol-Info', ru: 'О символе', zh: '品种信息' },
  openPositions: { en: 'Open Positions', hi: 'खुली पोज़िशन', ur: 'کھلی پوزیشنز', ar: 'الصفقات المفتوحة', es: 'Posiciones abiertas', pt: 'Posições abertas', fr: 'Positions ouvertes', de: 'Offene Positionen', ru: 'Открытые позиции', zh: '持仓' },
  pendingOrders: { en: 'Pending Orders', hi: 'लंबित ऑर्डर', ur: 'زیر التواء آرڈرز', ar: 'الأوامر المعلقة', es: 'Órdenes pendientes', pt: 'Ordens pendentes', fr: 'Ordres en attente', de: 'Offene Orders', ru: 'Отложенные ордера', zh: '挂单' },
  closedPositions: { en: 'Closed Positions', hi: 'बंद पोज़िशन', ur: 'بند پوزیشنز', ar: 'الصفقات المغلقة', es: 'Posiciones cerradas', pt: 'Posições fechadas', fr: 'Positions clôturées', de: 'Geschlossene Positionen', ru: 'Закрытые позиции', zh: '历史持仓' },
  finance: { en: 'Finance', hi: 'वित्त', ur: 'فنانس', ar: 'المالية', es: 'Finanzas', pt: 'Finanças', fr: 'Finances', de: 'Finanzen', ru: 'Финансы', zh: '资金' },
  portfolio: { en: 'Portfolio', hi: 'पोर्टफोलियो', ur: 'پورٹ فولیو', ar: 'المحفظة', es: 'Cartera', pt: 'Carteira', fr: 'Portefeuille', de: 'Portfolio', ru: 'Портфель', zh: '投资组合' },
  chart: { en: 'Chart', hi: 'चार्ट', ur: 'چارٹ', ar: 'الرسم البياني', es: 'Gráfico', pt: 'Gráfico', fr: 'Graphique', de: 'Chart', ru: 'График', zh: '图表' },
  positions: { en: 'Positions', hi: 'पोज़िशन', ur: 'پوزیشنز', ar: 'الصفقات', es: 'Posiciones', pt: 'Posições', fr: 'Positions', de: 'Positionen', ru: 'Позиции', zh: '持仓' },
  more: { en: 'More', hi: 'और', ur: 'مزید', ar: 'المزيد', es: 'Más', pt: 'Mais', fr: 'Plus', de: 'Mehr', ru: 'Ещё', zh: '更多' },
  today: { en: 'Today', hi: 'आज', ur: 'آج', ar: 'اليوم', es: 'Hoy', pt: 'Hoje', fr: "Aujourd'hui", de: 'Heute', ru: 'Сегодня', zh: '今天' },
  tomorrow: { en: 'Tomorrow', hi: 'कल', ur: 'کل', ar: 'غداً', es: 'Mañana', pt: 'Amanhã', fr: 'Demain', de: 'Morgen', ru: 'Завтра', zh: '明天' },
  highImpact: { en: 'High impact', hi: 'उच्च प्रभाव', ur: 'زیادہ اثر', ar: 'تأثير عالٍ', es: 'Alto impacto', pt: 'Alto impacto', fr: 'Fort impact', de: 'Hohe Auswirkung', ru: 'Высокая важность', zh: '高影响' },
  all: { en: 'All', hi: 'सभी', ur: 'سب', ar: 'الكل', es: 'Todo', pt: 'Tudo', fr: 'Tout', de: 'Alle', ru: 'Все', zh: '全部' },
  holiday: { en: 'Holiday', hi: 'अवकाश', ur: 'چھٹی', ar: 'عطلة', es: 'Festivo', pt: 'Feriado', fr: 'Férié', de: 'Feiertag', ru: 'Выходной', zh: '假期' },
  noEvents: { en: 'No scheduled releases for this filter.', hi: 'इस फ़िल्टर के लिए कोई निर्धारित रिलीज़ नहीं।', ur: 'اس فلٹر کے لیے کوئی شیڈول شدہ ریلیز نہیں۔', ar: 'لا توجد إصدارات مجدولة لهذا المرشح.', es: 'No hay publicaciones programadas para este filtro.', pt: 'Sem publicações agendadas para este filtro.', fr: 'Aucune publication prévue pour ce filtre.', de: 'Keine geplanten Veröffentlichungen für diesen Filter.', ru: 'Нет запланированных публикаций по этому фильтру.', zh: '此筛选条件下没有预定发布。' },
  calendarDown: { en: 'Calendar feed unavailable right now.', hi: 'कैलेंडर फ़ीड अभी उपलब्ध नहीं है।', ur: 'کیلنڈر فیڈ ابھی دستیاب نہیں۔', ar: 'تغذية التقويم غير متاحة الآن.', es: 'Calendario no disponible ahora.', pt: 'Calendário indisponível agora.', fr: 'Calendrier indisponible pour le moment.', de: 'Kalender derzeit nicht verfügbar.', ru: 'Календарь сейчас недоступен.', zh: '日历数据暂时不可用。' },
} satisfies Record<string, Entry>;
export type StringKey = keyof typeof STRINGS;

export const translate = (lang: Lang, key: StringKey): string => (STRINGS[key] as Entry)[lang] ?? STRINGS[key].en;
/** `const t = useT(); t('deposit')` re-renders when the language changes. */
export function useT() {
  const lang = useLang();
  return (key: StringKey) => translate(lang, key);
}

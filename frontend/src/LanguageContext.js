/**
 * LanguageContext — bilingual UI support (English + Urdu).
 *
 * Keys use dotted notation ("settings.title"). t() does a flat lookup.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();
const LS_KEY = 'sentinelzone-language';

const TRANSLATIONS = {
  en: {
    // === App / Brand ===
    'app.name': 'SentinelZone',
    'nav.brand': 'SentinelZone',

    // === Navigation ===
    'nav.dashboard': 'Dashboard',
    'nav.onboarding': 'Onboarding',
    'nav.connect': 'Connect Sources',
    'nav.checker': 'AI Checker',
    'nav.vault': 'Evidence Vault',
    'nav.timeline': 'Timeline',
    'nav.report': 'Reports',
    'nav.reports': 'Reports',
    'nav.settings': 'Settings',
    'nav.profile': 'Profile',
    'nav.logout': 'Logout',
    'nav.search': 'Search',

    // === Global Search ===
    'search.placeholder': 'Search pages, evidence, platforms...',
    'search.hint': 'Type to search. Press Esc to close.',
    'search.noResults': 'No results found.',
    'search.pages': 'Pages',
    'search.evidence': 'Evidence',
    'search.platforms': 'Platforms',

    // === Auth ===
    'auth.login': 'Log In',
    'auth.signup': 'Sign Up',
    'auth.login.subtitle': 'Log in to your account',
    'auth.signup.subtitle': 'Create a new account',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.name': 'Full Name',
    'auth.phone': 'Phone Number',
    'auth.gender': 'Gender',
    'auth.dob': 'Date of Birth',
    'auth.forgot': 'Forgot Password?',
    'auth.noAccount': "Don't have an account?",
    'auth.haveAccount': 'Already have an account?',
    'auth.switchToSignup': 'Sign Up',
    'auth.switchToLogin': 'Log In',
    'auth.name.placeholder': 'Your name',
    'auth.email.placeholder': 'you@example.com',
    'auth.password.placeholder': '••••••••',
    'auth.phone.placeholder': '03XXXXXXXXX',
    'auth.gender.select': 'Select Gender',
    'auth.gender.male': 'Male',
    'auth.gender.female': 'Female',
    'auth.gender.other': 'Other',
    'auth.login.loading': 'Logging In...',
    'auth.signup.loading': 'Signing Up...',
    'auth.error.fillAll': 'Please fill in all fields.',
    'auth.error.phone': 'Enter a valid phone number (e.g., 03001234567).',
    'auth.error.password': 'Password must be 8+ characters with uppercase, lowercase, number, and special character.',
    'auth.error.generic': 'Something went wrong. Please try again.',

    // === Dashboard ===
    'dashboard.title': 'Live Dashboard',
    'dashboard.subtitle': "Here's an overview of your recent activity.",
    'dashboard.overallRisk': 'Overall Risk Level',
    'dashboard.riskTrend': 'Risk Trend (Last 7 Days)',
    'dashboard.weeklySummary': 'Weekly Summary',
    'dashboard.recentAlerts': 'Recent Alerts',
    'dashboard.noAlerts': "No alerts yet. You're all caught up!",
    'dashboard.clearAlerts': 'Clear All Alerts',
    'dashboard.alertsThisWeek': 'Alerts this week',
    'dashboard.riskBreakdown': 'Risk breakdown',
    'dashboard.busiestDay': 'Busiest day',
    'dashboard.evidenceSaved': 'Evidence saved',
    'dashboard.risk.high': 'High',
    'dashboard.risk.medium': 'Medium',
    'dashboard.risk.low': 'Low',

    // === Settings ===
    'settings.title': 'Settings',
    'settings.subtitle': 'Manage your notifications, connected accounts, and data.',
    'settings.appearance': 'Appearance',
    'settings.theme': 'Theme',
    'settings.theme.dark': 'Dark mode',
    'settings.theme.light': 'Light mode',
    'settings.language': 'Language',
    'settings.language.desc': 'Choose the interface language',
    'settings.language.en': 'English',
    'settings.language.ur': 'اردو',
    'settings.notifications': 'Notifications',
    'settings.liveAlerts': 'Live Alerts',
    'settings.liveAlerts.desc': 'Receive real-time popups for new alerts.',
    'settings.emailAlerts': 'Email Alerts',
    'settings.emailAlerts.desc': 'Send a summary of alerts to your email.',
    'settings.connectedAccounts': 'Connected Accounts',
    'settings.connected': 'Connected',
    'settings.notConnected': 'Not Connected',
    'settings.dangerZone': 'Danger Zone',
    'settings.deleteData': 'Delete All Data',
    'settings.deleteData.desc': 'Permanently remove all your evidence, cases, and alerts.',
    'settings.deleteButton': 'Delete Data',
    'settings.confirm.title': 'Are you absolutely sure?',
    'settings.confirm.text': 'This will permanently delete all your data. This action cannot be undone.',
    'settings.confirm.cancel': 'Cancel',
    'settings.confirm.delete': 'Yes, delete everything',
    'settings.confirm.deleting': 'Deleting...',
    'settings.deleteFailed': 'Could not delete data. Please try again.',

    // === Evidence Vault ===
    'vault.title': 'Evidence Vault',
    'vault.subtitle': 'All saved evidence is tamper-proof, hashed and timestamped.',
    'vault.verify': 'Verify Integrity',
    'vault.verified': 'Verified',
    'vault.tampered': 'Tampered — Hash Mismatch',
    'vault.export': 'Export',
    'vault.noEvidence': 'No evidence saved yet',
    'vault.emptyText': 'Flagged alerts, checked files, and analyzed conversations will appear here automatically.',

    // === AI Checker ===
    'checker.title': 'AI Content Checker',
    'checker.subtitle': "Upload an image, video, or audio file to check if it's AI-generated.",
    'checker.upload': 'Click to upload a file',
    'checker.analyzing': 'Analyzing content, please wait...',
    'checker.another': 'Check Another File',
    'checker.saved': 'Saved to Evidence Vault',

    // === Timeline ===
    'timeline.title': 'Conversation Timeline',
    'timeline.subtitle': 'Paste a conversation below to analyze it for escalation and threats.',
    'timeline.contact': 'Contact Label',
    'timeline.platform': 'Platform',
    'timeline.analyze': 'Analyze Conversation',
    'timeline.clear': 'Clear',
    'timeline.escalation': 'Escalation Level',
    'timeline.flagged': 'Flagged Messages',

    // === Reports ===
    'reports.title': 'Report Generator',
    'reports.subtitle': 'Select a case to generate a complaint-ready report for FIA Cybercrime Wing or platform submission.',
    'reports.selectCase': 'Select a Case',
    'reports.newCase': '+ New Case',
    'reports.cancel': 'Cancel',
    'reports.caseTitlePlaceholder': 'Case title',
    'reports.creating': 'Creating...',
    'reports.createCase': 'Create Case',
    'reports.loadingCases': 'Loading cases...',
    'reports.noCases': 'No cases yet. Create one to start building a report.',
    'reports.flaggedMessages': 'flagged messages',
    'reports.selectPrompt': 'Select a case from the left to preview the report.',
    'reports.preview': 'Report Preview',
    'reports.caseLabel': 'Case:',
    'reports.dateRange': 'Date Range:',
    'reports.flaggedMessagesLabel': 'Flagged Messages:',
    'reports.evidenceHash': 'Evidence Hash:',
    'reports.chainOfCustody': 'Chain of Custody:',
    'reports.recommendedAction': 'Recommended Action:',
    'reports.recommendation': 'Submit to FIA Cybercrime Wing',
    'reports.included': 'Included ✅',
    'reports.verified': 'Verified ✅',
    'reports.generating': 'Generating Report...',
    'reports.generate': 'Generate PDF Report',
    'reports.success': 'Report generated successfully!',
    'reports.download': 'Download PDF',

    // === Common ===
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.confirm': 'Confirm',
    'common.loading': 'Loading...',
    'common.error': 'Something went wrong',
    'common.retry': 'Try again',
    'common.close': 'Close',
    'common.yes': 'Yes',
    'common.no': 'No',
  },

  ur: {
    // === App / Brand ===
    'app.name': 'سینٹینل زون',
    'nav.brand': 'سینٹینل زون',

    // === Navigation ===
    'nav.dashboard': 'ڈیش بورڈ',
    'nav.onboarding': 'شروعات',
    'nav.connect': 'ذریعے جوڑیں',
    'nav.checker': 'اے آئی چیکر',
    'nav.vault': 'ثبوت خانہ',
    'nav.timeline': 'ٹائم لائن',
    'nav.report': 'رپورٹس',
    'nav.reports': 'رپورٹس',
    'nav.settings': 'ترتیبات',
    'nav.profile': 'پروفائل',
    'nav.logout': 'لاگ آؤٹ',
    'nav.search': 'تلاش',

    // === Global Search ===
    'search.placeholder': 'صفحات، ثبوت، پلیٹ فارم تلاش کریں...',
    'search.hint': 'تلاش کے لیے ٹائپ کریں۔ بند کرنے کے لیے Esc دبائیں۔',
    'search.noResults': 'کوئی نتیجہ نہیں ملا۔',
    'search.pages': 'صفحات',
    'search.evidence': 'ثبوت',
    'search.platforms': 'پلیٹ فارم',

    // === Auth ===
    'auth.login': 'لاگ ان',
    'auth.signup': 'سائن اپ',
    'auth.login.subtitle': 'اپنے اکاؤنٹ میں لاگ ان کریں',
    'auth.signup.subtitle': 'نیا اکاؤنٹ بنائیں',
    'auth.email': 'ای میل',
    'auth.password': 'پاس ورڈ',
    'auth.name': 'پورا نام',
    'auth.phone': 'فون نمبر',
    'auth.gender': 'جنس',
    'auth.dob': 'تاریخ پیدائش',
    'auth.forgot': 'پاس ورڈ بھول گئے؟',
    'auth.noAccount': 'اکاؤنٹ نہیں ہے؟',
    'auth.haveAccount': 'پہلے سے اکاؤنٹ ہے؟',
    'auth.switchToSignup': 'سائن اپ کریں',
    'auth.switchToLogin': 'لاگ ان کریں',
    'auth.name.placeholder': 'آپ کا نام',
    'auth.email.placeholder': 'you@example.com',
    'auth.password.placeholder': '••••••••',
    'auth.phone.placeholder': '03XXXXXXXXX',
    'auth.gender.select': 'جنس منتخب کریں',
    'auth.gender.male': 'مرد',
    'auth.gender.female': 'عورت',
    'auth.gender.other': 'دیگر',
    'auth.login.loading': 'لاگ ان ہو رہا ہے...',
    'auth.signup.loading': 'سائن اپ ہو رہا ہے...',
    'auth.error.fillAll': 'براہ کرم تمام خانے پُر کریں۔',
    'auth.error.phone': 'درست فون نمبر درج کریں (مثلاً 03001234567)۔',
    'auth.error.password': 'پاس ورڈ کم از کم 8 حروف پر مشتمل ہو، جس میں بڑا حرف، چھوٹا حرف، نمبر اور خاص نشان شامل ہوں۔',
    'auth.error.generic': 'کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔',

    // === Dashboard ===
    'dashboard.title': 'لائیو ڈیش بورڈ',
    'dashboard.subtitle': 'آپ کی حالیہ سرگرمی کا جائزہ۔',
    'dashboard.overallRisk': 'مجموعی خطرے کی سطح',
    'dashboard.riskTrend': 'خطرے کا رجحان (آخری 7 دن)',
    'dashboard.weeklySummary': 'ہفتہ وار خلاصہ',
    'dashboard.recentAlerts': 'حالیہ انتباہات',
    'dashboard.noAlerts': 'ابھی تک کوئی انتباہ نہیں۔ سب کچھ محفوظ ہے!',
    'dashboard.clearAlerts': 'تمام انتباہات صاف کریں',
    'dashboard.alertsThisWeek': 'اس ہفتے کے انتباہات',
    'dashboard.riskBreakdown': 'خطرے کی تقسیم',
    'dashboard.busiestDay': 'مصروف ترین دن',
    'dashboard.evidenceSaved': 'محفوظ شدہ ثبوت',
    'dashboard.risk.high': 'زیادہ',
    'dashboard.risk.medium': 'درمیانہ',
    'dashboard.risk.low': 'کم',

    // === Settings ===
    'settings.title': 'ترتیبات',
    'settings.subtitle': 'اپنی اطلاعات، منسلک اکاؤنٹس اور ڈیٹا کا انتظام کریں۔',
    'settings.appearance': 'ظاہری شکل',
    'settings.theme': 'تھیم',
    'settings.theme.dark': 'ڈارک موڈ',
    'settings.theme.light': 'لائٹ موڈ',
    'settings.language': 'زبان',
    'settings.language.desc': 'انٹرفیس کی زبان منتخب کریں',
    'settings.language.en': 'English',
    'settings.language.ur': 'اردو',
    'settings.notifications': 'اطلاعات',
    'settings.liveAlerts': 'لائیو انتباہات',
    'settings.liveAlerts.desc': 'نئے انتباہات کے لیے فوری اطلاعات حاصل کریں۔',
    'settings.emailAlerts': 'ای میل انتباہات',
    'settings.emailAlerts.desc': 'انتباہات کا خلاصہ اپنی ای میل پر بھیجیں۔',
    'settings.connectedAccounts': 'منسلک اکاؤنٹس',
    'settings.connected': 'منسلک',
    'settings.notConnected': 'منسلک نہیں',
    'settings.dangerZone': 'خطرناک زون',
    'settings.deleteData': 'تمام ڈیٹا حذف کریں',
    'settings.deleteData.desc': 'اپنے تمام ثبوت، کیسز اور انتباہات مستقل طور پر حذف کریں۔',
    'settings.deleteButton': 'ڈیٹا حذف کریں',
    'settings.confirm.title': 'کیا آپ واقعی یقین رکھتے ہیں؟',
    'settings.confirm.text': 'یہ آپ کا تمام ڈیٹا مستقل طور پر حذف کر دے گا۔ یہ عمل واپس نہیں ہو سکتا۔',
    'settings.confirm.cancel': 'منسوخ کریں',
    'settings.confirm.delete': 'ہاں، سب کچھ حذف کریں',
    'settings.confirm.deleting': 'حذف ہو رہا ہے...',
    'settings.deleteFailed': 'ڈیٹا حذف نہیں ہو سکا۔ دوبارہ کوشش کریں۔',

    // === Evidence Vault ===
    'vault.title': 'ثبوت خانہ',
    'vault.subtitle': 'تمام محفوظ ثبوت چھیڑ چھاڑ سے محفوظ، ہیش اور وقت کے ساتھ محفوظ ہیں۔',
    'vault.verify': 'صداقت کی تصدیق کریں',
    'vault.verified': 'تصدیق شدہ',
    'vault.tampered': 'چھیڑ چھاڑ — ہیش میچ نہیں',
    'vault.export': 'برآمد کریں',
    'vault.noEvidence': 'ابھی تک کوئی ثبوت محفوظ نہیں',
    'vault.emptyText': 'نشان زد انتباہات، چیک شدہ فائلیں اور تجزیہ شدہ گفتگو خود بخود یہاں ظاہر ہوں گی۔',

    // === AI Checker ===
    'checker.title': 'اے آئی مواد چیکر',
    'checker.subtitle': 'یہ جاننے کے لیے کوئی تصویر، ویڈیو یا آڈیو فائل اپ لوڈ کریں کہ یہ اے آئی سے بنی ہے یا نہیں۔',
    'checker.upload': 'فائل اپ لوڈ کرنے کے لیے کلک کریں',
    'checker.analyzing': 'مواد کا تجزیہ جاری ہے، انتظار کریں...',
    'checker.another': 'دوسری فائل چیک کریں',
    'checker.saved': 'ثبوت خانے میں محفوظ',

    // === Timeline ===
    'timeline.title': 'گفتگو ٹائم لائن',
    'timeline.subtitle': 'شدت اور دھمکیوں کے تجزیے کے لیے نیچے گفتگو پیسٹ کریں۔',
    'timeline.contact': 'رابطے کا لیبل',
    'timeline.platform': 'پلیٹ فارم',
    'timeline.analyze': 'گفتگو کا تجزیہ کریں',
    'timeline.clear': 'صاف کریں',
    'timeline.escalation': 'شدت کی سطح',
    'timeline.flagged': 'نشان زد پیغامات',

    // === Reports ===
    'reports.title': 'رپورٹ جنریٹر',
    'reports.subtitle': 'ایف آئی اے سائبر کرائم ونگ یا پلیٹ فارم جمع کرانے کے لیے شکایت کی رپورٹ بنانے کے لیے کیس منتخب کریں۔',
    'reports.selectCase': 'کیس منتخب کریں',
    'reports.newCase': '+ نیا کیس',
    'reports.cancel': 'منسوخ کریں',
    'reports.caseTitlePlaceholder': 'کیس کا عنوان',
    'reports.creating': 'بنایا جا رہا ہے...',
    'reports.createCase': 'کیس بنائیں',
    'reports.loadingCases': 'کیسز لوڈ ہو رہے ہیں...',
    'reports.noCases': 'ابھی تک کوئی کیس نہیں۔ رپورٹ بنانے کے لیے نیا کیس بنائیں۔',
    'reports.flaggedMessages': 'نشان زد پیغامات',
    'reports.selectPrompt': 'رپورٹ کا پیش منظر دیکھنے کے لیے بائیں طرف سے کیس منتخب کریں۔',
    'reports.preview': 'رپورٹ پیش منظر',
    'reports.caseLabel': 'کیس:',
    'reports.dateRange': 'تاریخ کی حد:',
    'reports.flaggedMessagesLabel': 'نشان زد پیغامات:',
    'reports.evidenceHash': 'ثبوت ہیش:',
    'reports.chainOfCustody': 'تحویل کا سلسلہ:',
    'reports.recommendedAction': 'تجویز کردہ کارروائی:',
    'reports.recommendation': 'ایف آئی اے سائبر کرائم ونگ کو جمع کرائیں',
    'reports.included': 'شامل ✅',
    'reports.verified': 'تصدیق شدہ ✅',
    'reports.generating': 'رپورٹ بن رہی ہے...',
    'reports.generate': 'پی ڈی ایف رپورٹ بنائیں',
    'reports.success': 'رپورٹ کامیابی سے بن گئی!',
    'reports.download': 'پی ڈی ایف ڈاؤن لوڈ کریں',

    // === Common ===
    'common.save': 'محفوظ کریں',
    'common.cancel': 'منسوخ کریں',
    'common.delete': 'حذف کریں',
    'common.confirm': 'تصدیق کریں',
    'common.loading': 'لوڈ ہو رہا ہے...',
    'common.error': 'کچھ غلط ہو گیا',
    'common.retry': 'دوبارہ کوشش کریں',
    'common.close': 'بند کریں',
    'common.yes': 'ہاں',
    'common.no': 'نہیں',
  },
};

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const stored = localStorage.getItem(LS_KEY);
    return stored === 'ur' ? 'ur' : 'en';
  });

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ur' ? 'rtl' : 'ltr';
    localStorage.setItem(LS_KEY, language);
  }, [language]);

  const setLanguage = (lang) => {
    setLanguageState(lang === 'ur' ? 'ur' : 'en');
  };

  const t = (key) => {
    const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
    return dict[key] ?? TRANSLATIONS.en[key] ?? key;
  };

  const isRTL = language === 'ur';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
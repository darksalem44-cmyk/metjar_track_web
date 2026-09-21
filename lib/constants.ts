import type {
  AccountFilter,
  ActivityAction,
  ActivityEntityType,
  CurrencyCode,
  PeriodKey,
  UserRole,
} from './types';

export const AppConstants = {
  supabaseUrl: 'https://edbzutvunzkfujsatuwb.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkYnp1dHZ1bnprZnVqc2F0dXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNjQwMzgsImV4cCI6MjEwMzc0MDAzOH0.aYarD6soflFbVeaBeyYmXiW_53DUX_tRDDNHGYGnCcU',
  appName: 'متجر تراك',
  appNameEn: 'Metjar Track',
  passwordResetRedirect: '/reset-password',
  imageBucket: 'store-images',
  pageSize: 20,
  pageSizeAccounts: 20,
  defaultTimeZone: 'Asia/Damascus',
};

export const STORE_IMAGE_PREFIX = 'stores/';
export const BRANCH_IMAGE_PREFIX = 'branches/';
export const PRODUCT_IMAGE_PREFIX = 'products/';
export const DEFAULT_CONFIRM_NAME = 'موافق';

export const storeCategories: string[] = [
  // المطاعم والمواد الغذائية
  'مطعم',
  'مطعم مأكولات شرقية',
  'مطعم مأكولات غربية',
  'مأكولات شعبية',
  'مأكولات بحرية',
  'وجبات سريعة',
  'برغر',
  'شاورما',
  'فلافل',
  'بيتزا',
  'سمبوسة وسندويش',
  'مخبز وحلويات',
  'مخبز',
  'فرن',
  'كافتيريا',
  'كافيه',
  'مقهى',
  'بوفيه',
  'مطبخ',
  'تمور وقهوة',
  'معجنات',
  'حلويات غربية',
  'آيس كريم',
  'كسروات',

  // البيع بالتجزئة
  'ملابس وأحذية',
  'ملابس نسائية',
  'ملابس رجالية',
  'ملابس أطفال',
  'مفروشات',
  'أحذية',
  'حقائب',
  'إكسسوارات',
  'عطور ومستحضرات تجميل',
  'مستحضرات تجميل',
  'عطور',
  'أدوات التجميل',
  'صيدلية',
  'مستلزمات طبية',
  'مجوهرات',
  'ساعات',
  'نظارات',
  'هدايا وديكور',
  'ديكور',
  'متجر أطفال',
  'ألعاب أطفال',
  'طعام أطفال',
  'حفاضات',
  'ملابس داخلية',
  'نظارات شمسية',

  // الالكترونيات والأجهزة
  'إلكترونيات',
  'أجهزة كهربائية منزلية',
  'موبايلات',
  'هواتف',
  'أجهزة ذكية',
  'أجهزة لوحية',
  'كمبيوترات',
  'إكسسوارات جوال',
  'أجهزة مكتبية',
  'كاميرات',
  'أجهزة صوتية',
  'شاشات',
  'برمجة وأنظمة',
  'أنواع الالكترون',

  // المنزل والحديقة والأدوات
  'أدوات منزلية',
  'أدوات كهربائية',
  'أثاث',
  'زجاجيات',
  'أدوات مطبخ',
  'صيانة منزلية',
  'أدوات سباكة',
  'أدوات كهرباء',
  'أصباغ ودهانات',
  'حدائق',
  'نباتات',
  'مستلزمات زراعية',
  'أثاث مكتبي',
  'أدوات نجارة',
  'معدات البناء',

  // الجمال والعناية
  'صالون نسائي',
  'صالون رجالي',
  'كوافير',
  'حمام',
  'مشتل',
  'زينة',

  // الخدمات
  'خدمات',
  'غسيل سيارات',
  'تصليح هواتف',
  'مكتب حجوزات',
  'نقل وتوصيل',
  'تعليم خصوصي',
  'محاماة',
  'مكاتب عامة',
  'مكتب عقاري',
  'تصوير فوتوغرافي',
  'تجارة جملة',
  'تجارة مفرق',
  'توزيع',
  'تصدير واستيراد',

  // السيارات والوقود
  'محطة وقود',
  'بيت سيارات',
  'صيانة سيارات',
  'إكسسوارات سيارات',
  'قطع غيار سيارات',
  'تأجير سيارات',

  // أخرى
  'قرطاسية ومكتبة',
  'قرطاسية',
  'مكتبة',
  'طباعة',
  'مستلزمات مدرسية',
  'مستلزمات مكتبية',
  'ألعاب وحرف',
  'مستلزمات الحيوانات',
  'متجر حيوانات',
  'مصرف',
  'صرافة',
  'بورصة',

  // التعليم والتدريب
  'مدرسة',
  'معهد',
  'روضة',
  'حضانة',
  'جامعة',
  'تدريب وتأهيل',
  'دورات',
  'تدريب لغات',

  // الصحة والرياضة
  'رياضة',
  'معدات رياضية',
  'نادي رياضي',
  'رياضة مغامرة',
  'لباس رياضي',
  'صحة وتجميل',
  'طب أسنان',
  'عيادة',
  'مختبر طبي',
  'مستشفى',
];

export const currencyOptions: { value: 'SYP' | 'USD' | 'TRY'; label: string }[] = [
  { value: 'SYP', label: 'ليرة سورية' },
  { value: 'USD', label: 'دولار أمريكي' },
  { value: 'TRY', label: 'ليرة تركية' },
];

export const periodOptions: { value: PeriodKey; label: string }[] = [
  { value: 'today', label: 'اليوم' },
  { value: 'yesterday', label: 'أمس' },
  { value: 'last7', label: 'آخر 7 أيام' },
  { value: 'last30', label: 'آخر 30 يوماً' },
  { value: 'custom', label: 'مخصص' },
];

export const activityActionLabels: Record<ActivityAction, string> = {
  created: 'إضافة',
  updated: 'تعديل',
  deleted: 'حذف',
};

export const activityEntityLabels: Record<ActivityEntityType, string> = {
  store: 'متاجر',
  branch: 'فروع',
  product: 'منتجات',
};

export const accountFilterOptions: { value: AccountFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'active', label: 'نشط' },
  { value: 'disabled', label: 'معطّل' },
  { value: 'withPermissions', label: 'بصلاحيات' },
];

export const roleLabels: Record<UserRole, string> = {
  merchant: 'تاجر',
  employee: 'موظف',
  manager: 'المدير',
};

export const currencyLabels: Record<CurrencyCode, string> = {
  SYP: 'ل.س',
  USD: 'دولار',
  TRY: 'ل.ت',
};

// رسائل الخطأ العربية الموحّدة
export const errorMessages: Record<string, string> = {
  'Invalid login credentials': 'بيانات الدخول غير صحيحة',
  'Email not confirmed': 'البريد الإلكتروني غير مفعّل بعد',
  'User already registered': 'هذا البريد الإلكتروني مسجّل مسبقاً',
  'Password should be at least 6 characters': 'كلمة المرور يجب أن تكون 6 محارف على الأقل',
  'Signup requires email and password': 'يرجى تعبئة البريد الإلكتروني وكلمة المرور',
  'For security purposes, you can only request this after 60 seconds': 'لأسباب أمنية، يمكنك طلب استعادة كلمة المرور مرة أخرى بعد 60 ثانية',
  'For security purposes, you can only request this once every 60 seconds': 'لأسباب أمنية، يمكنك طلب استعادة كلمة المرور مرة أخرى بعد 60 ثانية',
  'For security purposes, you can only request this after 120 seconds': 'لأسباب أمنية، يمكنك طلب استعادة كلمة المرور مرة أخرى بعد دقيقتين',
  'The email confirmation link is invalid or has expired': 'رابط تأكيد البريد غير صالح أو منتهي',
  'User not found': 'المستخدم غير موجود',
  'Invalid password': 'كلمة المرور غير صحيحة',
  'Password should be at least 8 characters': 'كلمة المرور يجب أن تكون 8 محارف على الأقل',
  'New password should be different from the old password': 'كلمة المرور الجديدة يجب أن تختلف عن القديمة',
  'The phone number is invalid': 'رقم الهاتف غير صحيح',
  'Phone number already registered': 'رقم الهاتف مسجّل مسبقاً',
  'database does not allow nulls': 'تعذّر إتمام العملية',
  'Invalid recovery token': 'رابط الاستعادة غير صالح',
  'Failed to fetch': 'تعذّر الاتصال بالخادم',
  'Network error': 'خطأ في الشبكة',
  '410 Gone': 'انتهت صلاحية الرابط',
  '42501': 'المدير قام بتعطيل حسابك',
  // رموز أخطاء edge function إعادة تعيين كلمة المرور
  UNAUTHORIZED: 'يجب تسجيل الدخول أولاً',
  FORBIDDEN: 'صلاحيات غير كافية — المدير فقط يستطيع تنفيذ هذا الإجراء',
  SELF_RESET_NOT_ALLOWED: 'لا يمكنك تغيير كلمة مرور حسابك',
  SELF_RESET: 'لا يمكنك تغيير كلمة مرور حسابك',
  INVALID_USER_ID: 'معرف المستخدم غير صالح',
  USER_NOT_FOUND: 'المستخدم غير موجود',
  INVALID_ROLE: 'الحساب ليس موظفاً أو تاجراً',
  ACCOUNT_DISABLED: 'هذا الحساب معطّل ولا يمكن تعديله',
  WEAK_PASSWORD: 'كلمة المرور لا تفي بسياسة المشروع',
  INVALID_PASSWORD: 'كلمة المرور لا تفي بسياسة المشروع',
  PASSWORD_UPDATE_FAILED: 'تعذّر تحديث كلمة المرور',
};

export function translateError(error: any): string {
  if (!error) return 'حدث خطأ غير متوقع';
  const raw = typeof error === 'string' ? error : error?.message || '';
  for (const key of Object.keys(errorMessages)) {
    if (raw.includes(key)) return errorMessages[key];
  }
  if (/^4\d{2}/.test(raw.trim()) || /^5\d{2}/.test(raw.trim())) {
    const code = raw.trim().split(' ')[0];
    if (errorMessages[code]) return errorMessages[code];
  }
  if (raw.includes('duplicate key')) return 'العنصر موجود مسبقاً';
  return raw || 'حدث خطأ غير متوقع';
}
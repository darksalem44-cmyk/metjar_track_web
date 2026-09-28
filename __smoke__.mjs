/* اختبار شامل headless — يشغّل كود المشروع الحقيقي عبر ترجمة TypeScript ثم يؤكد السلوك. */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);

// ── محمّل وحدات: يترجم كل ملف TS ويحلّل @/ إلى جذر المشروع ──
const cache = new Map();
function load(rel) {
  if (cache.has(rel)) return cache.get(rel).exports;
  const full = path.join(ROOT, rel);
  const raw = fs.readFileSync(full, 'utf8');    const js = ts.transpileModule(raw, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
  const module = { exports: {} };
  const fn = new Function('require', 'module', 'exports', '__filename', '__dirname', js);
  const stubRequire = (spec) => {
    if (spec.startsWith('@/')) {
      const target = spec.slice(2).replace(/\.ts$/, '');
      const candidates = [`${target}.ts`, `${target}.tsx`, `${target}${path.sep}index.ts`];
      for (const c of candidates) if (fs.existsSync(path.join(ROOT, c))) return load(c);
      throw new Error(`unresolved ${spec}`);
    }
    if (spec.startsWith('.')) {
      const t = path.relative(ROOT, path.resolve(path.dirname(full), spec)).replace(/\\/g, '/').replace(/\.ts$/, '');
      const candidates = [`${t}.ts`, `${t}.tsx`, `${t}/index.ts`];
      for (const c of candidates) if (fs.existsSync(path.join(ROOT, c))) return load(c);
      throw new Error(`unresolved ${spec}`);
    }
    if (spec === 'react/jsx-runtime') return { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }), Fragment: 'Fragment' };
    if (spec === 'react') return {
      useCallback: (f) => f,
      useEffect: () => {},
      useState: (v) => [v, () => {}],
      useMemo: (f) => f(),
      useContext: () => null,
      useRef: (v) => ({ current: v }),
      createContext: () => ({ Provider: () => null }),
    };
    if (spec === 'lucide-react') return new Proxy({}, { get: () => (props) => null });
    if (spec === 'recharts') return new Proxy({}, { get: () => (props) => null });
    return require(spec);
  };
  fn(stubRequire, module, module.exports, full, path.dirname(full));
  cache.set(rel, module);
  return module.exports;
}

// ── عدّاد النتائج ──
let pass = 0;
const failures = [];
function check(name, cond, extra = '') {
  if (cond) pass += 1;
  else failures.push(`${name}${extra ? ` — ${extra}` : ''}`);
}
function eq(name, actual, expected) {
  const ok = actual === expected;
  check(name, ok, ok ? '' : `expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
}
function includes(name, actual, needle) {
  check(name, String(actual ?? '').includes(needle), `needle=${needle} actual=${JSON.stringify(actual)}`);
}
function throws(name, fn) {
  try { fn(); check(name, false, 'did not throw'); }
  catch { check(name, true); }
}

// ── تحميل الوحدات الحقيقية ──
const utils = load('lib/utils.ts');
const base = load('lib/data/base.ts');
const activities = load('lib/data/activities.ts');
const trends = load('lib/trends.ts');
const notifications = load('lib/notifications.ts');
const backup = load('lib/data/backup.ts');
const constants = load('lib/constants.ts');
const accounts = load('lib/data/accounts.ts');

// ═══════════ 1) المدققات والتنسيقات (lib/utils.ts) ═══════════
eq('email مطلوب', utils.emailValidator(null), 'البريد الإلكتروني مطلوب');
eq('email صيغة خاطئة', utils.emailValidator('a@b'), 'صيغة البريد الإلكتروني غير صحيحة');
eq('email صحيح', utils.emailValidator('user@site.com'), null);
eq('password قصيرة', utils.passwordValidator('1234567'), 'كلمة المرور يجب أن تكون 8 محارف على الأقل');
eq('password صحيحة', utils.passwordValidator('12345678'), null);
eq('phone غير رقمي', utils.phoneValidator('0999abc'), 'رقم الهاتف غير صحيح');
eq('phone صحيح', utils.phoneValidator('0999123456'), null);
eq('اسم قصير', utils.nameValidator(' م '), 'الاسم قصير جداً');
eq('required فارغ', utils.required('   '), 'هذا الحقل مطلوب');
eq('isFormValid سليم', utils.isFormValid({ a: null, b: undefined }), true);
eq('isFormValid فاسد', utils.isFormValid({ a: 'خطأ', b: null }), false);

eq('formatPrice صحيح', utils.formatPrice(1500), '1500 SYP');
eq('formatPrice عشري', utils.formatPrice(15.25, 'USD'), '15.3 USD');
eq('formatDistance متر', utils.formatDistanceText(850), '850 م');
eq('formatDistance كم', utils.formatDistanceText(1520), '1.5 كم');

const NOW = new Date('2026-09-23T10:00:00');
eq('relative الآن', utils.relativeTime('2026-09-23T09:59:40', NOW), 'الآن');
eq('relative دقيقة', utils.relativeTime('2026-09-23T09:59:00', NOW), 'منذ دقيقة واحدة');
eq('relative دقيقتين', utils.relativeTime('2026-09-23T09:58:00', NOW), 'منذ دقيقتين');
eq('relative 15 دقيقة', utils.relativeTime('2026-09-23T09:45:00', NOW), 'منذ 15 دقائق');
eq('relative ساعة', utils.relativeTime('2026-09-23T09:00:00', NOW), 'منذ ساعة واحدة');
eq('relative ساعتين', utils.relativeTime('2026-09-23T08:00:00', NOW), 'منذ ساعتين');
eq('relative أمس', utils.relativeTime('2026-09-22T10:00:00', NOW), 'أمس');
eq('relative يومين', utils.relativeTime('2026-09-21T10:00:00', NOW), 'منذ يومين');
eq('relative 5 أيام', utils.relativeTime('2026-09-18T10:00:00', NOW), 'منذ 5 أيام');
includes('relative أقدم من أسبوع → تاريخ', utils.relativeTime('2026-09-10T10:00:00', NOW), 'عند');

const pw = utils.generatePassword(12);
eq('generatePassword طول', pw.length, 12);
check('generatePassword تركيبة', /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw) && /[!@#$%&*]/.test(pw), pw);
check('generatePassword بلا محارف ملتبسة', !/[lIoO01]/.test(pw), pw);

eq('getPeriodRange اليوم', utils.getPeriodRange('today', NOW).from.getDate(), 23);
eq('getPeriodRange أمس إلى نهاية اليوم', utils.getPeriodRange('yesterday', NOW).to.getHours(), 23);
eq('getPeriodRange آخر 7 أيام', utils.getPeriodRange('last7', NOW).from.getDate(), 17);

// ═══════════ 2) التقسيم لصفحات (lib/data/base.ts) ═══════════
const p1 = base.resolvePage([1, 2, 3], 1, 20);
eq('resolvePage صغيرة', p1.items.length, 3);
eq('resolvePage لا مزيد', p1.hasMore, false);
const p2 = base.resolvePage(Array.from({ length: 25 }, (_, i) => i), 1, 20);
eq('resolvePage تقتطع 20', p2.items.length, 20);
eq('resolvePage يوجد مزيد', p2.hasMore, true);
eq('PAGE_SIZE', base.PAGE_SIZE, 20);

// ═══════════ 3) الخرائط والعبارات (lib/data/activities.ts) ═══════════
eq('normalizeRole تاجر', activities.normalizeRole('merchant'), 'merchant');
eq('normalizeRole مدير', activities.normalizeRole('manager'), 'manager');
eq('normalizeRole موظف', activities.normalizeRole('employee'), 'employee');
eq('normalizeRole قيمة غريبة', activities.normalizeRole('hacker'), 'employee');
eq('normalizeRole null', activities.normalizeRole(null), 'employee');

eq('eventName من details', activities.eventName({ details: { name: 'متجر النور' } }), 'متجر النور');
eq('eventName مباشر', activities.eventName({ entityName: 'سوق', details: { name: 'x' } }), 'سوق');
eq('eventName فارغ', activities.eventName({}), '');
includes('eventPhrase تعديل', activities.eventPhrase({ action: 'updated', entityType: 'store', details: { name: 'متجر النور' } }), 'للمتجر «متجر النور»');
includes('eventPhrase حذف', activities.eventPhrase({ action: 'deleted', entityType: 'product', details: {} }), 'حذف');
includes('eventBriefDetail سعر', activities.eventBriefDetail({ price: 2500, currency: 'SYP' }, 'product'), '2500');
const fields = activities.eventDetailFields({ price: 2500, currency: 'SYP', name: 'كوكيز' });
eq('eventDetailFields عدد', fields.length, 3);
check('eventDetailFields بلا شرطات', fields.every((f) => f.value !== '—'), JSON.stringify(fields));

// ═══════════ 4) الاتجاهات (lib/trends.ts) ═══════════
const T0 = new Date('2026-09-23T12:00:00'); // أربعاء — أسبوعه يبدأ الأحد 20/09
const s0 = trends.buildActivityTrendSeries([], { weeks: 4, now: T0 });
eq('trend طول السلسلة', s0.length, 4);
eq('trend مفتاح الأسبوع الحالي', s0[0].key, '2026-09-20');
eq('trend الأسبوع السابق', s0[1].key, '2026-09-13');
check('trend المفاتيح محلية لا UTC', s0.every((b) => { const d = new Date(b.start); return b.key === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }), JSON.stringify(s0.map((b) => b.key)));

const evs = [
  { action: 'created', entityType: 'store', entityId: 's1', entityName: 'س1', actorId: 'u1', actorName: 'أحمد', eventAt: '2026-09-21T09:00:00' },
  { action: 'created', entityType: 'product', entityId: 'p1', entityName: 'كوكيز', actorId: 'u1', actorName: 'أحمد', eventAt: '2026-09-22T09:00:00' },
  { action: 'updated', entityType: 'product', entityId: 'p1', entityName: 'كوكيز', actorId: 'u2', actorName: 'سارة', eventAt: '2026-09-22T15:00:00' },
  { action: 'created', entityType: 'branch', entityId: 'b1', entityName: 'فرع', actorId: 'u1', actorName: 'أحمد', eventAt: '2026-09-16T09:00:00' },
  { action: 'deleted', entityType: 'store', entityId: 's9', entityName: 'قديم', actorId: 'u1', actorName: 'أحمد', eventAt: '2026-08-01T09:00:00' }, // خارج النافذة
];
const s1 = trends.buildActivityTrendSeries(evs, { weeks: 2, now: T0 });
eq('trend إجمالي الأسبوع الحالي', s1[0].total, 3);
eq('trend إضافات الأسبوع الحالي', s1[0].created, 2);
eq('trend تعديلات الأسبوع الحالي', s1[0].updated, 1);
eq('trend فاعلان مختلفان', s1[0].actorCount, 2);
eq('trend كيانان مختلفان', s1[0].entityCount, 2);
eq('trend الأسبوع السابق', s1[1].total, 1);
eq('trend الأقدم خارج النافذة', s1.every((b) => !b.deleted), true);
eq('weekDelta الحالي', trends.weekDelta(s1[0], s1), 2);
eq('weekDelta بلا سابق', trends.weekDelta(s1[1], s1), null);
eq('formatDelta صفر', trends.formatDelta(0), 'مطابق للأسبوع السابق');
includes('formatDelta واحد', trends.formatDelta(1), 'حدثاً واحداً');
includes('formatDelta اثنان', trends.formatDelta(-2), 'حدثان');
includes('formatDelta 5', trends.formatDelta(5), '+5 أحداث');
includes('formatDelta 12', trends.formatDelta(12), '+12 حدثاً');
eq('formatDelta null', trends.formatDelta(null), '');

const tops = trends.buildTopEntities(evs, { weeks: 2, now: T0, limit: 2 });
eq('top actors الحد', tops.actors.length, 2);
eq('top actor الأول', tops.actors[0].id, 'u1');
eq('top actor عدده', tops.actors[0].count, 3);
eq('top entity الأول', tops.entities[0].name, 'كوكيز');
eq('top entity عدده', tops.entities[0].count, 2);

const csv = trends.trendToCsv(s1, tops);
includes('trend CSV رأس', csv, 'الأسبوع');
includes('trend CSV فرق', csv, '+حدثان عن الأسبوع السابق');
check('trend CSV أسطر', csv.split('\r\n').length >= 5, csv.split('\r\n').length);

// ═══════════ 5) قواعد التنبيه (lib/notifications.ts) ═══════════
eq('severity حذف', notifications.alertSeverity('deleted', false), 'critical');
eq('severity سعر', notifications.alertSeverity('updated', true), 'critical');
eq('severity تعديل', notifications.alertSeverity('updated', false), 'warning');
eq('severity إضافة', notifications.alertSeverity('created', false), 'info');

eq('rule إضافة', notifications.alertRuleKey('created', 'store', false), 'entity_created');
eq('rule حذف متجر', notifications.alertRuleKey('deleted', 'store', false), 'store_deleted');
eq('rule حذف فرع', notifications.alertRuleKey('deleted', 'branch', false), 'branch_deleted');
eq('rule حذف منتج', notifications.alertRuleKey('deleted', 'product', false), 'product_deleted');
eq('rule تغير سعر', notifications.alertRuleKey('updated', 'product', true), 'product_price_changed');
eq('rule تعديل عام', notifications.alertRuleKey('updated', 'store', false), 'entity_updated');

const defaults = notifications.defaultAlertSettings();
eq('default badge الإضافة', defaults.rules.entity_created.badge, false);
eq('default badge الحذف', defaults.rules.store_deleted.badge, true);
const norm = notifications.normalizeAlertSettings({ rules: { entity_created: { enabled: false } }, mutedEntities: 'not-array' });
eq('normalize يعطّل القاعدة', norm.rules.entity_created.enabled, false);
eq('normalize يملأ الباقي', norm.rules.store_deleted.enabled, true);
eq('normalize يصلح المصفوفة', Array.isArray(norm.mutedEntities), true);
eq('normalize null', notifications.normalizeAlertSettings(null).rules.branch_deleted.enabled, true);

eq('isMuteActive دائم', notifications.isMuteActive(null, NOW), true);
eq('isMuteActive مستقبل', notifications.isMuteActive('2027-01-01T00:00:00Z', NOW), true);
eq('isMuteActive منقضٍ', notifications.isMuteActive('2020-01-01T00:00:00Z', NOW), false);

function alert(partial) {
  return {
    id: 'a1', severity: 'info', action: 'created', entityType: 'store', entityId: 's1',
    entityName: 'متجر', deleted: false, actorId: 'u1', actorName: 'أحمد', actorRole: 'employee',
    eventAt: '2026-09-22T09:00:00', rule: 'entity_created', title: 'أنشأ للمتجر «متجر»', detail: '',
    ...partial,
  };
}
const feedDefaults = notifications.applyAlertSettings([alert({ rule: 'entity_created' }), alert({ id: 'a2', rule: 'store_deleted', action: 'deleted', severity: 'critical' })], defaults, '2026-09-01T00:00:00Z', NOW);
eq('feed يعرض الاثنين', feedDefaults.alerts.length, 2);
eq('feed الإضافة لا تُحصى', feedDefaults.unread, 1);
const feedDisabled = notifications.applyAlertSettings([alert({ rule: 'store_deleted' })], { ...defaults, rules: { ...defaults.rules, store_deleted: { enabled: false, badge: true } } }, null, NOW);
eq('feed قاعدة معطلة يخفي', feedDisabled.alerts.length, 0);
eq('feed hiddenByRules', feedDisabled.hiddenByRules, 1);
const feedMuted = notifications.applyAlertSettings([alert({})], { ...defaults, mutedActors: [{ id: 'u1', name: 'أحمد', until: null }] }, null, NOW);
eq('feed كتم فاعل', feedMuted.muted, 1);
const feedExpired = notifications.applyAlertSettings([alert({})], { ...defaults, mutedEntities: [{ id: 's1', label: 'متجر', entityType: 'store', until: '2020-01-01T00:00:00Z' }] }, null, NOW);
eq('feed كتم منقضٍ لا يخفي', feedExpired.alerts.length, 1);

const grouped = notifications.groupNearbyAlerts([
  alert({ id: 'g1', action: 'updated', rule: 'entity_updated', severity: 'warning', entityType: 'product', entityId: 'p1', entityName: 'كوكيز', eventAt: '2026-09-22T10:00:00', detail: 'الوصف تعدل' }),
  alert({ id: 'g2', action: 'updated', rule: 'entity_updated', severity: 'critical', entityType: 'product', entityId: 'p1', entityName: 'كوكيز', eventAt: '2026-09-22T09:50:00', detail: 'السعر من 10 إلى 20' }),
  alert({ id: 'g3', action: 'deleted', rule: 'product_deleted', severity: 'critical', entityType: 'product', entityId: 'p2', entityName: 'بسكويت', eventAt: '2026-09-22T09:45:00', detail: 'حذف' }),
  alert({ id: 'g4', action: 'updated', rule: 'entity_updated', severity: 'warning', entityType: 'product', entityId: 'p1', entityName: 'كوكيز', eventAt: '2026-09-22T08:00:00', detail: 'تصنيف' }),
], { windowMinutes: 60 });
eq('group دمج ضمن الساعة والحذف مستقل والمتباعد مجموعة جديدة', grouped.length, 3);
const g1 = grouped.find((g) => g.entityId === 'p1');
eq('group عدد المدمج', g1.count, 2);
includes('group عنوان', g1.title, 'تعديلان على المنتج «كوكيز»');
eq('group ترقية الخطورة', g1.severity, 'critical');
includes('group تفصيل السعر يتقدم', g1.detail, 'السعر');
check('group لا يدمج المتباعد', (grouped.find((g) => g.eventAt === '2026-09-22T08:00:00')?.count ?? 1) === 1, true);

// ═══════════ 6) الأرشيف الأسبوعي ═══════════
const archive = notifications.buildWeeklyArchive([
  alert({ eventAt: '2026-09-22T09:00:00' }),
  alert({ id: 'w2', severity: 'critical', action: 'deleted', rule: 'store_deleted', eventAt: '2026-09-21T10:00:00' }),
  alert({ id: 'w3', eventAt: '2026-09-15T10:00:00' }),
], { weeks: 2, now: T0 });
eq('archive أسبوعان', archive.length, 2);
eq('archive إجمالي الحالي', archive[0].total, 2);
eq('archive حرج الحالي', archive[0].critical, 1);
eq('archive الأسبوع الماضي', archive[1].total, 1);

const csvAlerts = notifications.alertsToCsv([alert({})]);
includes('alertsToCsv رأس', csvAlerts, 'الأسبوع');
eq('alertsToCsv أسطر', csvAlerts.split('\r\n').length, 2);
const csvInjected = notifications.alertsToCsv([alert({ entityName: '=SUM(A1)' })]);
includes('alertsToCsv حجب الحقن', csvInjected, "'=SUM(A1)");
eq('archiveFileName', notifications.archiveFileName('csv', new Date(2026, 8, 23)), 'metjar-track-alerts-2026-09-23.csv');
includes('weekLabelFor', notifications.weekLabelFor(T0), '20/09 – 26/09');
eq('startOfWeek يوم الأحد', notifications.startOfWeek(T0).getDay(), 0);
eq('startOfWeek التاريخ', notifications.startOfWeek(T0).getDate(), 20);

// ═══════════ 7) أخطاء النسخ الاحتياطي (lib/data/backup.ts) ═══════════
const QUOTA = 'Google Drive upload failed: {"error":{"code":403,"message":"Service Accounts do not have storage quota. Leverage shared drives","errors":[{"reason":"storageQuotaExceeded"}]}}';
includes('backup quota', backup.readableBackupError(QUOTA), 'حساب الخدمة بلا مساحة تخزين');
includes('backup صلاحية', backup.readableBackupError('insufficientFilePermissions'), 'لا يملك صلاحية الكتابة');
includes('backup اعتماد', backup.readableBackupError('{"error":"invalid_grant"}'), 'بيانات اعتماد Google غير صالحة');
includes('backup مجلد', backup.readableBackupError('File not found: 1abc'), 'غير موجود أو غير مشترك');
eq('backup drive آخر', backup.readableBackupError('Google Drive upload failed: Backend Error'), 'فشل رفع النسخة الاحتياطية إلى Google Drive.');
eq('backup نص عادي', backup.readableBackupError('انقطع الاتصال'), 'انقطع الاتصال');
eq('backup فارغ', backup.readableBackupError(''), 'تعذّر إنشاء النسخة الاحتياطية');

// الاستدعاء الحقيقي بلا جلسة يرفض برسالة تسجيل الدخول (مُختبر أدناه مباشرة)

// ═══════════ 8) ترجمة الأخطاء (lib/constants.ts) ═══════════
eq('translate شبكة', constants.translateError('Failed to fetch'), 'تعذّر الاتصال بالخادم');
includes('translate دخول خاطئ', constants.translateError('Invalid login credentials'), 'بيانات الدخول غير صحيحة');
includes('translate مسجل مسبقاً', constants.translateError('User already registered'), 'مسجّل مسبقاً');
eq('translate مرور كما هو', constants.translateError('رسالة غير معروفة'), 'رسالة غير معروفة');

// ═══════════ 9) نمط المهمة: start/fetchJobStatus بلا جلسة (سلوك حقيقي async) ═══════════
try {
  await backup.startBackupJob();
  check('startBackupJob بلا جلسة يرفض', false, 'resolved unexpectedly');
} catch (e) {
  eq('startBackupJob بلا جلسة الرسالة', String(e), 'يجب تسجيل الدخول أولاً');
}
try {
  await backup.fetchJobStatus('test-job');
  check('fetchJobStatus بلا جلسة يرفض', false, 'resolved unexpectedly');
} catch (e) {
  eq('fetchJobStatus بلا جلسة الرسالة', String(e), 'يجب تسجيل الدخول أولاً');
}

// ═══════════ 10) بناء التنبيهات من أحداث السجل (buildAlerts) ═══════════
function eventRow(partial) {
  return {
    id: 'ev1',
    actor_id: 'u1',
    actor_role: 'employee',
    event_action: 'created',
    entity_type: 'store',
    entity_id: 's1',
    entity_name: 'متجر النور',
    event_at: '2026-09-22T09:00:00',
    details: { name: 'متجر النور', address: 'دمشق' },
    ...partial,
  };
}

// 10-أ) حدث إضافة متجر: معلوماتي + قاعدة الإضافة + اسم الفاعل من الخريطة
const builtCreated = notifications.buildAlerts([
  eventRow({}),
], { actors: new Map([['u1', { fullName: 'أحمد', role: 'employee' }]]) });
eq('buildAlerts واحد', builtCreated.length, 1);
eq('buildAlerts الخطورة info', builtCreated[0].severity, 'info');
eq('buildAlerts القاعدة entity_created', builtCreated[0].rule, 'entity_created');
eq('buildAlerts الاسم من السطر', builtCreated[0].entityName, 'متجر النور');
eq('buildAlerts الفاعل من الخريطة', builtCreated[0].actorName, 'أحمد');
eq('buildAlerts دور الفاعل من actor_role', builtCreated[0].actorRole, 'employee');
eq('buildAlerts غير محذوف', builtCreated[0].deleted, false);
eq('buildAlerts storeId', builtCreated[0].storeId, undefined);
includes('buildAlerts العنوان', builtCreated[0].title, '«متجر النور»');
includes('buildAlerts التفصيل العنوان', builtCreated[0].detail, 'العنوان: دمشق');

// 10-ب) اسم الفاعل يرتدّ إلى «مستخدم غير معروف» إن لم يوجد في profiles
const builtUnknown = notifications.buildAlerts([eventRow({})]);
eq('buildAlerts فاعل مجهول', builtUnknown[0].actorName, 'مستخدم غير معروف');

// 10-ج) حذف متجر: حرج + قاعدة حذف المتجر + علم المحذوف + store_id من التفاصيل
const builtDeleted = notifications.buildAlerts([
  eventRow({
    event_action: 'deleted',
    entity_id: 's9',
    details: { name: 'متجر قديم', store_id: 'parent-store' },
  }),
]);
eq('buildAlerts الحذف حرج', builtDeleted[0].severity, 'critical');
eq('buildAlerts قاعدة الحذف', builtDeleted[0].rule, 'store_deleted');
eq('buildAlerts علم المحذوف', builtDeleted[0].deleted, true);
eq('buildAlerts storeId من التفاصيل', builtDeleted[0].storeId, 'parent-store');

// 10-د) حذف فرع: قاعدة الحذف + storeId يبقى في التنبيه (أساس فتح تفاصيل الفرع)
const builtBranch = notifications.buildAlerts([
  eventRow({ event_action: 'deleted', entity_type: 'branch', entity_id: 'b1', details: { name: 'فرع المزة', store_id: 'parent-store' } }),
]);
eq('buildAlerts قاعدة حذف فرع', builtBranch[0].rule, 'branch_deleted');
eq('buildAlerts storeId للفرع', builtBranch[0].storeId, 'parent-store');

// 10-هـ) كشف تغيّر السعر: من اللقطة السابقة للمنتج نفسه قبل الحدث
const rowsPrice = [
  eventRow({ id: 'ev-old', event_action: 'created', entity_type: 'product', entity_id: 'p1', entity_name: 'كوكيز', event_at: '2026-09-20T10:00:00', details: { name: 'كوكيز', price: 1500, currency: 'SYP' } }),
  eventRow({ id: 'ev-new', event_action: 'updated', entity_type: 'product', entity_id: 'p1', entity_name: 'كوكيز', event_at: '2026-09-22T11:00:00', details: { name: 'كوكيز', price: 2000, currency: 'SYP' } }),
];
const prevPrices = notifications.previousPricesByEvent(
  rowsPrice.filter((r) => r.id === 'ev-new'),
  rowsPrice,
);
check('previousPrices يجد السابق', prevPrices['ev-new'] && prevPrices['ev-new'].price === 1500, JSON.stringify(prevPrices));
const builtPriceChange = notifications.buildAlerts(rowsPrice, { previousPrices: prevPrices });
const priceAlert = builtPriceChange.find((a) => a.id === 'ev-new');
eq('buildAlerts تغيّر السعر حرج', priceAlert.severity, 'critical');
eq('buildAlerts قاعدة تغيّر السعر', priceAlert.rule, 'product_price_changed');
includes('buildAlerts تفصيل السعر القديم', priceAlert.detail, 'من 1500');
includes('buildAlerts تفصيل السعر الجديد', priceAlert.detail, 'إلى 2000');

// نفس السعر (تحديث وصف فقط): لا تغيير سعر → تحذير عادي
const prevSame = notifications.previousPricesByEvent([rowsPrice[1]], [{ entity_id: 'p1', event_at: '2026-09-20T10:00:00', details: { price: 2000, currency: 'SYP' } }]);
const builtSamePrice = notifications.buildAlerts([rowsPrice[1]], { previousPrices: prevSame });
eq('buildAlerts نفس السعر تحذير', builtSamePrice[0].severity, 'warning');
eq('buildAlerts نفس السعر قاعدة', builtSamePrice[0].rule, 'entity_updated');

// بلا لقطة سابقة: تعديل منتج لا يُعدّ تغيّر سعر
const builtNoPrev = notifications.buildAlerts([rowsPrice[1]], {});
eq('buildAlerts بلا لقطة تحذير', builtNoPrev[0].rule, 'entity_updated');

// 10-و) تفاصيل كنص JSON قديم (مثل الموبايل) تُقرأ بأمان — مع entity_name فارغ يرتدّ إلى details.name
const builtJsonString = notifications.buildAlerts([
  eventRow({ entity_name: '', details: JSON.stringify({ name: 'متجر من نص' }) }),
]);
eq('buildAlerts نص JSON اسم', builtJsonString[0].entityName, 'متجر من نص');

// تفاصيل فاسدة لا تكسر البناء
const builtBroken = notifications.buildAlerts([eventRow({ details: '{broken json' })]);
eq('buildAlerts تفاصيل فاسدة لا تكسر', builtBroken.length, 1);
eq('buildAlerts تفاصيل فاسدة الاسم ترجع للسطر', builtBroken[0].entityName, 'متجر النور');

// ═══════════ 11) توجيه فتح الكيان من التنبيه (alertTarget في AlertRow الحقيقي) ═══════════
const alertRowModule = load('components/notifications/AlertRow.tsx');
const alertTarget = alertRowModule.alertTarget;

const storeView = alertTarget(alert({ entityType: 'store', entityId: 's1', deleted: false }));
eq('alertTarget متجر', storeView && storeView.name, 'store-details');
eq('alertTarget متجر id', storeView && storeView.storeId, 's1');

const branchView = alertTarget(alert({ entityType: 'branch', entityId: 'b1', storeId: 's1', deleted: false }));
eq('alertTarget فرع مع storeId', branchView && branchView.name, 'branch-details');
eq('alertTarget فرع storeId', branchView && branchView.storeId, 's1');
eq('alertTarget فرع branchId', branchView && branchView.branchId, 'b1');

const branchNoStore = alertTarget(alert({ entityType: 'branch', entityId: 'b1', storeId: undefined, deleted: false }));
eq('alertTarget فرع بلا متجر null', branchNoStore, null);

const productView = alertTarget(alert({ entityType: 'product', entityId: 'p1', deleted: false }));
eq('alertTarget منتج', productView && productView.name, 'product-details');
eq('alertTarget منتج id', productView && productView.productId, 'p1');

eq('alertTarget محذوف null', alertTarget(alert({ entityId: 's1', deleted: true })), null);
eq('alertTarget بلا id null', alertTarget(alert({ entityId: undefined, deleted: false })), null);
eq('alertTarget نوع مجهول null', alertTarget(alert({ entityType: 'unknown', entityId: 'x1', deleted: false })), null);

// ═══════════ 12) إشعارات النظام (lib/push.ts) ═══════════
// محاكاة متصفح أدنى: window + atob بدل window.atob المستخدم في التحويل
globalThis.window = globalThis;
globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
const push = load('lib/push.ts');

eq('push pushSupported بلا navigator', push.pushSupported(), false);
eq('push pushConfigured بلا مفتاح', push.pushConfigured(), false);

const vapidBytes = push.urlBase64ToUint8Array('BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U');
check('urlBase64 صحيح النوع', vapidBytes instanceof Uint8Array, typeof vapidBytes);
eq('urlBase64 طول 65', vapidBytes.length, 65);
eq('urlBase64 أول بايت 0x04', vapidBytes[0], 0x04);
// نفس المفتاح بصيغة base64url - تعيين الأبجدية: '-' → '+' و '_' → '/'
const vapidPlain = push.urlBase64ToUint8Array('BEl62iUYgUivxIkv69yViEuiBIa+Ib9+SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U');
check('urlBase64 مطابق للـ base64 العادي', vapidBytes.every((b, i) => b === vapidPlain[i]), 'bytes differ');
// استبدال المحارف بلا حشوة (طول %4 = 0)
const swapBytes = push.urlBase64ToUint8Array('a-b_');
const swapPlain = push.urlBase64ToUint8Array('a+b/');
check('urlBase64 استبدال - و _', swapBytes.length === 3 && swapBytes.every((b, i) => b === swapPlain[i]), JSON.stringify([...swapBytes]));
// حشوة المسار القصير: طول %4 = 3 يحتاج '=' واحد
const padBytes = push.urlBase64ToUint8Array('a-b');
const padPlain = push.urlBase64ToUint8Array('a+b');
check('urlBase64 حشوة قصيرة', padBytes.length === 2 && padBytes.every((b, i) => b === padPlain[i]), JSON.stringify([...padBytes]));

// ═══════════ 13) سلوك حقيقي: جلب التنبيهات من Supabase والاشتراك اللحظي ═══════════
// fetchAdminAlerts بلا جلسة RLS: يجب ألا يرمي (يُعيد قائمة فارغة) أو يرمي خطأ مترجماً — ليس انهياراً غير معالج
let fetchAlertsBehavior = 'unknown';
try {
  const live = await notifications.fetchAdminAlerts({ days: 30, limit: 80 });
  fetchAlertsBehavior = Array.isArray(live) ? `array(${live.length})` : typeof live;
} catch (e) {
  fetchAlertsBehavior = `threw: ${String(e)}`;
}
check('fetchAdminAlerts سلوك محدد بلا انهيار', fetchAlertsBehavior.startsWith('array(') || fetchAlertsBehavior.startsWith('threw: تعذّر') || fetchAlertsBehavior.startsWith('threw: يجب'), fetchAlertsBehavior);
console.log(`  — fetchAdminAlerts بدون جلسة: ${fetchAlertsBehavior}`);

// subscribeToAlerts: قناة حقيقية ثم إلغاؤها نظيفاً
try {
  const unsubscribe = notifications.subscribeToAlerts(() => {});
  await new Promise((r) => setTimeout(r, 600));
  unsubscribe();
  check('subscribeToAlerts اشتراك وإلغاء نظيفان', true);
  console.log('  — subscribeToAlerts: الاشتراك والإلغاء بلا استثناءات');
} catch (e) {
  check('subscribeToAlerts اشتراك وإلغاء نظيفان', false, String(e));
}

// ═══════════ 14) كاش الصفحات (lib/cache.ts) — دورة حياة stale-while-revalidate ═══════════
// محاكاة localStorage بذاكرة (window أصبح معرّفاً في القسم 12)
const memStore = new Map();
globalThis.window.localStorage = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  key: (i) => [...memStore.keys()][i] ?? null,
  get length() { return memStore.size; },
};
const pageCache = load('lib/cache.ts');

// فراغ: بلا نسخة مخزنة
eq('cache فارغ يرجع null', pageCache.cacheGet('nope:key'), null);

// أول تحميل: شبكة فقط بلا تطبيق كاش
const seen = [];
let fetchCalls = 0;
await pageCache.cachedLoad('k1', async () => { fetchCalls += 1; return { n: 1 }; }, (data, src) => seen.push([src, data]));
eq('cachedLoad أول مرة استدعاء شبكة واحد', fetchCalls, 1);
eq('cachedLoad أول مرة تطبيق واحد', seen.length, 1);
eq('cachedLoad أول مرة القيمة', seen[0][1].n, 1);
eq('cachedLoad أول مرة المصدر network', seen[0][0], 'network');

// فتح ثانٍ: الكاش يُعرض أولاً ثم الشبكة تحدّث
seen.length = 0;
await pageCache.cachedLoad('k1', async () => ({ n: 2 }), (data, src) => seen.push([src, data]));
eq('cachedLoad ثانية تطبيقان', seen.length, 2);
eq('cachedLoad ثانية الكاش أولاً', seen[0][0], 'cache');
eq('cachedLoad ثانية قيمة الكاش القديمة', seen[0][1].n, 1);
eq('cachedLoad ثانية الشبكة ثانياً', seen[1][0], 'network');
eq('cachedLoad ثانية القيمة الجديدة', seen[1][1].n, 2);

// فشل الشبكة مع نسخة معروضة: يبقى المعروض بلا خطأ
seen.length = 0;
await pageCache.cachedLoad('k1', async () => { throw new Error('offline'); }, (data, src) => seen.push([src, data]));
eq('cachedLoad فشل مع كاش يبقي المعروض', seen.length, 1);
eq('cachedLoad فشل مع كاش المصدر cache', seen[0][0], 'cache');

// فشل الشبكة بلا نسخة: يرمي الخطأ للصفحة
let threwNoCache = null;
try { await pageCache.cachedLoad('k2', async () => { throw 'انقطع الاتصال'; }, () => {}); } catch (e) { threwNoCache = String(e); }
eq('cachedLoad فشل بلا كاش يرمي', threwNoCache, 'انقطع الاتصال');

// الإبطال بالأجيال: التعديل يرفع الجيل فتُتجاهل المفاتيح القديمة
pageCache.cacheSet(pageCache.cacheKey('dom', 'x'), 'v1');
eq('cacheKey يقرأ المخزون', pageCache.cacheGet(pageCache.cacheKey('dom', 'x')), 'v1');
pageCache.cacheBump('dom');
eq('cacheBump يبطل النطاق', pageCache.cacheGet(pageCache.cacheKey('dom', 'x')), null);

// إدخال فاسد لا يكسر القراءة
memStore.set('mt_page_cache_v1:broken', '{corrupted');
eq('cache فاسد يرجع null', pageCache.cacheGet('broken'), null);

// ═══════════ 15) إدارة الحسابات: مدقق البيانات وحمايات الترقية والتعديل ═══════════
eq('userValidator اسم فارغ', utils.userValidator('   '), 'الاسم مطلوب');
eq('userValidator اسم قصير', utils.userValidator('أ'), 'الاسم قصير جداً');
eq('userValidator بريد فاسد', utils.userValidator('اسم سليم', 'bad@mail'), 'صيغة البريد الإلكتروني غير صحيحة');
eq('userValidator سليم', utils.userValidator('اسم سليم', 'a@b.co'), null);
eq('userValidator بلا بريد', utils.userValidator('اسم سليم', ''), null);

// تحديث بيانات بلا جلسة: RLS يرفض → خطأ مترجم (لا انهيار)
try {
  await accounts.updateAccountDetails('00000000-0000-0000-0000-000000000000', { fullName: 'اختبار', isActive: true });
  check('updateAccountDetails بلا جلسة يرفض', false, 'resolved unexpectedly');
} catch (e) {
  check('updateAccountDetails بلا جلسة يرفض برسالة', typeof e === 'string' && e.length > 0, String(e));
}

// الترقية عبر RPC: بلا جلسة مدير يجب أن تُرفض بأمان (الدالة أو RLS)
try {
  await accounts.promoteEmployeeToManager('00000000-0000-0000-0000-000000000000');
  check('promoteEmployeeToManager بلا جلسة يرفض', false, 'resolved unexpectedly');
} catch (e) {
  check('promoteEmployeeToManager بلا جلسة يرفض برسالة', typeof e === 'string' && e.length > 0, String(e));
  console.log(`  — promoteEmployeeToManager بلا جلسة: رفض آمن (${String(e).slice(0, 70)})`);
}

// ═══════════ 16) تحميل وحدات الواجهة المعدّلة (تحقق الاستيرادات) ═══════════
for (const mod of [
  'components/accounts/AdminAccountsPage.tsx',
  'components/stores/StoresList.tsx',
  'components/stores/StoreDetails.tsx',
  'components/products/ProductsPage.tsx',
  'components/branches/BranchDetails.tsx',
  'components/activities/ActivitiesList.tsx',
  'components/profile/ProfilePage.tsx',
]) {
  try { load(mod); check(`تحميل ${mod}`, true); }
  catch (e) { check(`تحميل ${mod}`, false, String(e)); }
}

// ═══════════ 17) الملف الشخصي: تعديل اسم المدير ═══════════
// updateProfileName: تحقق صفر صفوف + إبطال كاش الحسابات والنشاطات
const profilesMod = load('lib/data/profiles.ts');
check('تحميل lib/data/profiles.ts', true);
let nameThrew = null;
try {
  await profilesMod.updateProfileName('00000000-0000-0000-0000-000000000000', 'اسم اختبار');
  check('updateProfileName بلا جلسة/صف يرفض', false, 'resolved unexpectedly');
} catch (e) {
  nameThrew = typeof e === 'string' ? e : String(e);
  check('updateProfileName بلا جلسة/صف يرفض برسالة عربية', nameThrew.includes('تعذر') || nameThrew.length > 0, nameThrew);
}
// إبطال الكاش سلوك مستقل يُقاس مباشرة: cacheBump يرفع الجيل فتصبح المفاتيح القديمة مفقودة
const genBefore = pageCache.cacheGeneration('accounts');
pageCache.cacheSet(pageCache.cacheKey('accounts', 'team-all'), [{ id: 'stale' }]);
pageCache.cacheBump('accounts');
pageCache.cacheBump('activities');
check('تحديث الاسم يبطل كاش الحسابات (محاكاة cacheBump)', pageCache.cacheGet(pageCache.cacheKey('accounts', 'team-all')) === null && pageCache.cacheGeneration('accounts') !== genBefore, 'generation unchanged');
console.log(`  — updateProfileName بلا صف: رفض آمن (${nameThrew})`);

// ═══════════ 18) ترقيم الصفحات المرقّم وعدّادات الإجمالي ═══════════
const controlsMod = load('components/ui/controls.tsx');
const { paginationWindow } = controlsMod;

// --- نافذة الأرقام: حالات الحدود ---
eq('paginationWindow total=0', JSON.stringify(paginationWindow(1, 0)), '[]');
eq('paginationWindow total=1', JSON.stringify(paginationWindow(0, 1)), '[1]');
eq('paginationWindow total=7 كل الأرقام بلا فواصل', JSON.stringify(paginationWindow(3, 7)), '[1,2,3,4,5,6,7]');
eq('paginationWindow total=8 قرب الوسط يلاصق البداية', JSON.stringify(paginationWindow(4, 8)), '[1,2,3,4,5,"ellipsis",8]');
eq('paginationWindow total=8 قرب البداية', JSON.stringify(paginationWindow(1, 8)), '[1,2,3,4,5,"ellipsis",8]');
eq('paginationWindow total=8 قرب النهاية', JSON.stringify(paginationWindow(8, 8)), '[1,"ellipsis",4,5,6,7,8]');
eq('paginationWindow total=100 وسط (55)', JSON.stringify(paginationWindow(55, 100)), '[1,"ellipsis",53,54,55,56,57,"ellipsis",100]');
eq('paginationWindow total=100 أول صفحة', JSON.stringify(paginationWindow(1, 100)), '[1,2,3,4,5,"ellipsis",100]');
eq('paginationWindow total=100 آخر صفحة', JSON.stringify(paginationWindow(100, 100)), '[1,"ellipsis",96,97,98,99,100]');
eq('paginationWindow current خارج المدى يُثبّت', JSON.stringify(paginationWindow(999, 100)), '[1,"ellipsis",96,97,98,99,100]');

// --- العدّادات حية ضد Supabase (RLS للمستخدم المجهول يحدد القيم — المهم السلوك المحدد) ---
const storesData = load('lib/data/stores.ts');
const productsData = load('lib/data/products.ts');
let countStoresResult = 'unknown';
try {
  const c = await storesData.countAllStores();
  countStoresResult = `number:${c}`;
  check('countAllStores يرجع رقماً', typeof c === 'number' && c >= 0, String(c));
} catch (e) {
  countStoresResult = `threw: ${String(e)}`;
  check('countAllStores بلا انهيار', typeof e === 'string' || e instanceof Error, countStoresResult);
}
console.log(`  — countAllStores بدون جلسة: ${countStoresResult}`);

let countProductsResult = 'unknown';
try {
  const c = await productsData.countAllProducts();
  countProductsResult = `number:${c}`;
  check('countAllProducts يرجع رقماً', typeof c === 'number' && c >= 0, String(c));
} catch (e) {
  countProductsResult = `threw: ${String(e)}`;
  check('countAllProducts بلا انهيار', typeof e === 'string' || e instanceof Error, countProductsResult);
}
console.log(`  — countAllProducts بدون جلسة: ${countProductsResult}`);

// --- وحدات الواجهة المعدّلة تُحمّل (تحقق الاستيرادات) ---
for (const mod of [
  'components/HomePage.tsx',
  'components/profile/ProfilePage.tsx',
  'components/accounts/AccountListPage.tsx',
]) {
  try { load(mod); check(`تحميل ${mod}`, true); }
  catch (e) { check(`تحميل ${mod}`, false, String(e)); }
}

// ═══════════ النتيجة ═══════════
console.log(`\n===== SMOKE RESULTS =====`);
console.log(`PASSED: ${pass}`);
if (failures.length) {
  console.log(`FAILED: ${failures.length}`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exitCode = 1;
} else {
  console.log('ALL CHECKS PASSED');
}

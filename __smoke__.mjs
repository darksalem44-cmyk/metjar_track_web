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
  const raw = fs.readFileSync(full, 'utf8');
  const js = ts.transpileModule(raw, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  const fn = new Function('require', 'module', 'exports', '__filename', '__dirname', js);
  const stubRequire = (spec) => {
    if (spec.startsWith('@/')) {
      const target = spec.slice(2).replace(/\.ts$/, '');
      const candidates = [`${target}.ts`, `${target}${path.sep}index.ts`];
      for (const c of candidates) if (fs.existsSync(path.join(ROOT, c))) return load(c);
      throw new Error(`unresolved ${spec}`);
    }
    if (spec.startsWith('.')) {
      const t = path.relative(ROOT, path.resolve(path.dirname(full), spec)).replace(/\\/g, '/').replace(/\.ts$/, '');
      const candidates = [`${t}.ts`, `${t}/index.ts`];
      for (const c of candidates) if (fs.existsSync(path.join(ROOT, c))) return load(c);
      throw new Error(`unresolved ${spec}`);
    }
    if (spec === 'react') return { useCallback: (f) => f, useEffect: () => {}, useState: (v) => [v, () => {}] };
    if (spec === 'lucide-react') return new Proxy({}, { get: () => (props) => null });
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

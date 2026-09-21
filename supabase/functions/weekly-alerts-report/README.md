# تقرير التنبيهات الأسبوعي (Weekly Alerts Report)

دالة مجدولة تبني تقرير أحداث الأسبوع المنقضي، تحفظه، وترسل إشعار PWA لكل المديرين.

## خطوات التفعيل (مرة واحدة)

### 1) نفّذ ملف SQL
`supabase/migrations/20260921090000_weekly_alerts_report.sql` من Supabase → SQL Editor.
يضيف جدولين (`push_subscriptions`, `weekly_reports`) وسياساتهما وجدولة الأحد 09:00 بتوقيت دمشق.

### 2) ولّد مفاتيح VAPID
على جهازك (مرة واحدة، واحفظ المفاتيح للأبد — تغييرها يُبطل الاشتراكات القائمة):

```bash
npx web-push generate-vapid-keys
```

يُطبع مفتاح عام ومفتاح خاص.

### 3) اضبط الأسرار في Supabase
Project Settings → Edge Functions → Secrets (أو `supabase secrets set`):

| السر | القيمة |
|---|---|
| `VAPID_PUBLIC_KEY` | المفتاح العام من الخطوة 2 |
| `VAPID_PRIVATE_KEY` | المفتاح الخاص من الخطوة 2 |
| `VAPID_SUBJECT` | `mailto:بريدك@النطاق` |
| `CRON_SECRET` | نص عشوائي طويل يحمي نقطة النهاية |

ثم انسخ **المفتاح العام** إلى تطبيق الويب في متغيّر البيئة `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
(أو في `AppConstants.vapidPublicKey` داخل `lib/constants.ts`).

### 4) انشر الدالة

```bash
supabase functions deploy weekly-alerts-report --no-verify-jwt
```

### 5) اربط المجدول
في ملف SQL استبدل `<PROJECT_REF>` و`<CRON_SECRET>` بالقيم الحقيقية ثم نفّذ قسم الجدولة.

### 6) اختبار يدوي

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/weekly-alerts-report?week=2026-09-13" \
  -H "x-cron-secret: <CRON_SECRET>"
```

يعيد JSON فيه عدد الأحداث وعدد الإشعارات المرسلة. وتُحفظ النسخة في `weekly_reports`
فتظهر في تطبيق الويب (الأرشيف الأسبوعي → التقارير المحفوظة).

## ملاحظات

- بلا مفاتيح VAPID تعمل الدالة كالمعتاد وتحفظ التقرير، وتتخطى الإشعارات بهدوء.
- الاشتراكات التي أعاد المتصفح خطأ `404`/`410` لها تُحذف تلقائياً.
- `activity_events` لا بد أن تكون متاحة للقراءة لمفتاح الخدمة (وهي كذلك افتراضياً).

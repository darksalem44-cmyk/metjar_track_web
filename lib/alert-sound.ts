import type { AlertSeverity } from '@/lib/notifications';

/**
 * صوت تنبيه قصير مُولَّد بـ Web Audio — بلا ملف صوتي يُحمَّل.
 * التوليد عند الطلب أخف من تنزيل ملف صوت، ويتغيّر نغمته حسب خطورة الحدث.
 *
 * سياسة التشغيل التلقائي في المتصفحات (خاصة Chrome و Edge على الكمبيوتر) تمنع
 * أي صوت قبل أول تفاعل من المستخدم، ثم تمنعه أيضاً إن كان التبويب صامتاً.
 * لذلك نفتح السياق عند **أي** نقرة أو ضغطة مفتاح في الصفحة، لا عند زر الصوت فقط.
 *
 * كل الدوال آمنة عند غياب الدعم: ترجع نتيجة محدّدة بدل أن ترمي.
 */

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;

let context: AudioContext | null = null;
/** هل تفاعل المستخدم مع الصفحة مرة واحدة على الأقل؟ */
let userGestured = false;
/** هل اكتمل فتح سياق الصوت فعلاً (أو نحاول فتحه)؟ */
let unlocked = false;
/** هل حاولنا تثبيت الفتح على أول تفاعل؟ لتفادي تكرار محاولة فاشلة كل نقرة. */
let arming = false;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const g = globalThis as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/** هل الجهاز قادر على تشغيل الصوت؟ */
export function alertSoundSupported(): boolean {
  return audioContextCtor() !== null;
}

function getContext(): AudioContext | null {
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  if (!context || context.state === 'closed') {
    try {
      context = new Ctor({ latencyHint: 'interactive' });
    } catch {
      try {
        context = new Ctor();
      } catch {
        return null;
      }
    }
  }
  return context;
}

/**
 * يفتح سياق الصوت. يجب استدعاؤها **داخل** معالج حدث المستخدم (نقرة/ضغطة مفتاح)
 * وإلا رفضها المتصفح. آمنة للاستدعاء المتكرر.
 */
export function unlockAlertSound(): void {
  userGestured = true;
  const ctx = getContext();
  if (!ctx) return;
  unlocked = true;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  // نبضة صامتة تُثبّت فتح السياق في المتصفحات الأكثر تشدداً (Safari/iOS)
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // غير حرج — النغمة التالية قد تعمل على أي حال
  }
}

/**
 * يثبّت فتح الصوت عند أول تفاعل في الصفحة (أي نقرة أو ضغطة مفتاح).
 * يعيد دالة لإلغاء التثبيت — تُستدعى من `AlertsProvider` مع_cleanup_ عنصره.
 * يعمل على الكمبيوتر والجوال بلا تمييز.
 */
export function armAlertSoundOnFirstGesture(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (arming) return () => {};
  arming = true;

  const onGesture = () => {
    unlockAlertSound();
    // أول تفاعل يكفي — نفكّ المستمعين حتى لا نتركهم معلّقين
    cleanup();
  };
  const cleanup = () => {
    window.removeEventListener('pointerdown', onGesture, true);
    window.removeEventListener('keydown', onGesture, true);
    window.removeEventListener('touchstart', onGesture, true);
    arming = false;
  };

  window.addEventListener('pointerdown', onGesture, true);
  window.addEventListener('keydown', onGesture, true);
  window.addEventListener('touchstart', onGesture, true);
  return cleanup;
}

/** نغمتان قصيرتان: الأولى للحرج (أعلى وأسرع)، والثانية للتحذير/المعلوماتي. */
function toneSpec(severity: AlertSeverity): { freq: number[]; duration: number; gain: number } {
  if (severity === 'critical') return { freq: [880, 1174.7], duration: 0.18, gain: 0.18 };
  if (severity === 'warning') return { freq: [659.3, 880], duration: 0.15, gain: 0.14 };
  return { freq: [523.3], duration: 0.13, gain: 0.1 };
}

/** اهتزاز خفيف — يعمل على الجوال فقط، ويتجاهله الكمبيوتر بصمت. */
function vibrate(severity: AlertSeverity): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    if (severity === 'critical') navigator.vibrate([50, 70, 50]);
    else if (severity === 'warning') navigator.vibrate(40);
    else navigator.vibrate(25);
  } catch {
    // غير مدعوم — تجاهل
  }
}

export interface AlertSoundResult {
  played: boolean;
  reason: 'played' | 'locked' | 'unsupported' | 'error';
}

/**
 * يشغّل نغمة التنبيه إن كان الصوت مفعّلاً.
 * لا ترمي أبداً — الفشل الصامت أفضل من كسر واجهة التنبيهات.
 *
 * ملاحظة: أخطاء «لا يُسمح بالبدء داخل معالج الحدث» عابرة في Chrome، فإغفالها
 * يعني أن الصوت سيعمل من التنبيه التالي فحسب — وهذا أفضل من إظهار خطأ للمستخدم.
 */
export function playAlertSound(severity: AlertSeverity = 'info'): AlertSoundResult {
  const ctx = getContext();
  if (!ctx) {
    vibrate(severity);
    return { played: false, reason: 'unsupported' };
  }

  // قبل أول تفاعل: المتصفح سيمنع الصوت. نحاول الفتح مرة واحدة على أي حال —
  // بعض المتصفحات تسمح بجدولة النغمة لتُلعب فور تفاعل المستخدم التالي.
  if (ctx.state === 'suspended' && userGestured) {
    void ctx.resume().catch(() => {});
  }

  const { freq, duration, gain } = toneSpec(severity);
  try {
    // نبدأ من لحظة future صغيرة حتى لو كان السياق ما زال suspended
    const start = ctx.currentTime + 0.01;
    freq.forEach((hz, index) => {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz;
      const at = start + index * duration * 0.72;
      amp.gain.setValueAtTime(0.0001, at);
      // نتسلّق إلى ذروة ثم ننزل — منحنى ناعم يخلو من النقرات الطقطقة
      amp.gain.exponentialRampToValueAtTime(gain, at + 0.015);
      amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      osc.connect(amp).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + duration + 0.03);
    });
    vibrate(severity);
    // نُبلغ بالنتيجة الفعلية: التشغيل يعني أن السياق كان جاهزاً
    return { played: ctx.state === 'running', reason: ctx.state === 'running' ? 'played' : 'locked' };
  } catch {
    return { played: false, reason: 'error' };
  }
}

/**
 * إعادة فتح السياق إن أوقفه المتصفح (تصفح Intelligence يوقف الصوت الصامت).
 * تُستدعى عند العودة للتبويب.
 */
export function resumeAlertSound(): void {
  const ctx = getContext();
  if (!ctx || !unlocked) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
}

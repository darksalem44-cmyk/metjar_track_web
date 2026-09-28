/** أدوات تنزيل وطباعة في المتصفح — بلا أي حزم إضافية. */

/** ينزّل نصاً كملف (يُضاف BOM حتى يقرأ Excel العربية بشكل صحيح). */
export function downloadTextFile(
  filename: string,
  content: string,
  mime: string = 'text/csv;charset=utf-8',
): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([`\ufeff${content}`], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * يفتح مستند HTML مستقلاً ويطلب الطباعة (وهي الطريق المتاح للحفظ PDF بلا مكتبات).
 * تُغلق النافذة وتُلغى رابطتها بعد الطباعة حتى لا تتراكم نوافذ الطباعة.
 * تعيد false إذا منع المتصفح النافذة الجديدة.
 */
export function openPrintDocument(html: string): boolean {
  if (typeof window === 'undefined') return false;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const printWindow = window.open(url, '_blank', 'width=920,height=1040');
  if (!printWindow) {
    URL.revokeObjectURL(url);
    return false;
  }

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    URL.revokeObjectURL(url);
    try {
      printWindow.close();
    } catch {
      // المتصفح يمنع الإغلاق التلقائي — تبقى النافذة للطباعة اليدوية
    }
  };

  printWindow.addEventListener('afterprint', release);
  printWindow.addEventListener('pagehide', () => {
    if (!released) {
      released = true;
      URL.revokeObjectURL(url);
    }
  });
  // تأجيل الطباعة حتى يكتمل بناء الصفحة وتُحمَّل خطوطها
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 400);
  return true;
}

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
 * تعيد false إذا منع المتصفح النافذة الجديدة.
 */
export function openPrintDocument(html: string): boolean {
  if (typeof window === 'undefined') return false;
  const printWindow = window.open('', '_blank', 'width=920,height=1040');
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  // تأجيل الطباعة حتى يكتمل بناء الصفحة وتُحمَّل خطوطها
  setTimeout(() => printWindow.print(), 400);
  return true;
}

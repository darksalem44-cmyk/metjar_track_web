import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import ToastHost from "@/components/ui/ToastHost";
import PwaRegister from "@/components/pwa/PwaRegister";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import { AppConstants } from "@/lib/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: AppConstants.appName,
  description: "منصة متجر تراك لإدارة المتاجر والفروع والمنتجات مع تتبع النشاطات",
  manifest: "/manifest.webmanifest",
  applicationName: AppConstants.appName,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: AppConstants.appName,
  },
  icons: {
    icon: [
      { url: "/favicon.png?v=3", type: "image/png" },
      { url: "/icons/Icon-192.png?v=3", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/Icon-192.png?v=3", sizes: "192x192" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#984399",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const themeScript = `try{var t=localStorage.getItem('theme_mode');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* suppressHydrationWarning: إضافات المتصفح (مثل bis_register من إضافات الحماية) تُضاف
          إلى body قبل ترطيب React وتُسبب تحذير عدم تطابق وهمياً. */}
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} min-h-full antialiased`}
      >
        <ThemeProvider>
          {children}
          <ToastHost />
          <PwaRegister />
          <InstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}

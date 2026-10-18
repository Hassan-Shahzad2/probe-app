import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import SiteGuide from "./SiteGuide";

// Body + UI: a clean, professional, highly legible sans.
const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-probe",
  display: "swap",
});

// Headings: a classic, elegant serif — professional, not templated.
const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif-probe",
  display: "swap",
});

export const metadata = {
  title: "Probe — AI Interview Screener",
  description:
    "AI-run voice interviews that screen candidates against the role and their CV.",
};

// Applies the saved theme before first paint so there's no flash.
const themeInit = `try{var t=localStorage.getItem('probe_theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;}}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${serif.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        {children}
        <SiteGuide />
      </body>
    </html>
  );
}
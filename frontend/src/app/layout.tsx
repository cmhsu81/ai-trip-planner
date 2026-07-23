import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { Navbar } from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Trip Planner",
  description: "Plan your trips with an AI travel assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gradient-to-b from-slate-50 via-slate-50 to-teal-50/40">
        <LocaleProvider>
          <AuthProvider>
            <Navbar />
            <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-10 sm:py-12">
              {children}
            </main>
            <footer className="text-center text-xs text-slate-400 py-6">
              AI Trip Planner · Built with Next.js, Node.js &amp; Claude
            </footer>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

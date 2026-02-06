import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: CONFIG.title,
  description: CONFIG.description,
};

import { CountersProvider } from "./context/CountersContext";
import { FilterProvider } from "./context/FilterContext";
import { SelectionProvider } from "./context/SelectionContext";
import { ThemeProvider } from "../components/ThemeProvider";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "../components/ToasterProvider";
import { CONFIG } from "./helpers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased transition-colors duration-300`}
      >
        <ThemeProvider>
          <AuthProvider>
            <FilterProvider>
              <SelectionProvider>
                <Toaster />
                <CountersProvider>{children}</CountersProvider>
              </SelectionProvider>
            </FilterProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

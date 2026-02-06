"use client";

import Link from "next/link";

export default function AddLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header with Back Button */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 shadow-sm sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/list">
            <h2 className="text-xl font-bold text-foreground hover:text-primary transition-colors">
              Add Images
            </h2>
          </Link>
        </div>
      </header>
      {/* Main Area */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}

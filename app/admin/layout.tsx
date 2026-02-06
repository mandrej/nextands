"use client";

import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) {
      // router.push("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="p-8 rounded-xl bg-card shadow-2xl border border-border text-center space-y-6 max-w-sm w-full">
          <div className="w-20 h-20 mx-auto bg-destructive/10 rounded-xl flex items-center justify-center">
            <Lock className="w-10 h-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Access Denied
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Only administrators can access this page.
            </p>
          </div>
          <Button onClick={() => router.push("/")} className="w-full">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Toolbar */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 shadow-sm sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/">
            <h2 className="text-xl font-bold text-foreground hover:text-primary transition-colors">
              Administration
            </h2>
          </Link>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 overflow-auto bg-background p-4 md:p-6">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}

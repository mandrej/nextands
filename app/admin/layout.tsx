"use client";

import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "../_components/AppLayout";

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
            <h2 className="text-2xl font-bold text-foreground">
              Access Denied
            </h2>
            <p className="text-muted-foreground">
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

  return <AppLayout>{children}</AppLayout>;
}

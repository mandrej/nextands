"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "./ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex bg-muted p-1 rounded-xl w-fit border border-border">
        <div className="p-2 w-9 h-9" />
        <div className="p-2 w-9 h-9" />
        <div className="p-2 w-9 h-9" />
      </div>
    );
  }

  return (
    <div className="flex bg-muted p-1 rounded-xl w-fit border border-border">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme("light")}
        className={`rounded-lg transition-all ${
          theme === "light"
            ? "bg-background shadow-sm text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Light Mode"
      >
        <Sun className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme("dark")}
        className={`rounded-lg transition-all ${
          theme === "dark"
            ? "bg-background shadow-sm text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Dark Mode"
      >
        <Moon className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme("system")}
        className={`rounded-lg transition-all ${
          theme === "system"
            ? "bg-background shadow-sm text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="System Theme"
      >
        <Monitor className="h-4 w-4" />
      </Button>
    </div>
  );
}

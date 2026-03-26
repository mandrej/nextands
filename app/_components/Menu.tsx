"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { cn } from "@/lib/utils";

export function Menu() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isGallery = pathname === "/list";

  const navItems = [
    ...(isGallery ? [] : [{ href: "/", label: "Home" }]),
    ...(isGallery ? [] : [{ href: "/list", label: "List" }]),
    ...(user?.isAuthorized ? [{ href: "/add", label: "Add" }] : []),
    ...(user?.isAdmin && !isGallery
      ? [{ href: "/admin", label: "Admin" }]
      : []),
  ];

  if (
    pathname === "/" ||
    pathname.startsWith("/add") ||
    pathname.startsWith("/admin") ||
    navItems.length === 0
  )
    return null;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-semibold transition-colors hover:text-primary",
                  isActive
                    ? "text-primary border-b-2 border-primary pb-1"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

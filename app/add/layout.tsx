"use client";
import { AppLayout } from "../_components/AppLayout";

export default function AddLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}

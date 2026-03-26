"use client";
import { AppLayout } from "../_components/AppLayout";

export default function ListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}

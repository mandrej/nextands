"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase";
import { Plus, X, Menu, Settings, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { CONFIG, version, thumbName, sliceSlug } from "../helpers";
import { Button } from "@/components/ui/button";

import { GlobalSearch } from "@/components/GlobalSearch";
import { useCounters } from "../context/CountersContext";
import { useFilter } from "../context/FilterContext";
import { useSelection } from "../context/SelectionContext";
import { Trash2, Eraser, Loader2, Home } from "lucide-react";
import { doc, deleteDoc, getDoc, updateDoc } from "firebase/firestore";
import { storage } from "../firebase";
import { ref, deleteObject } from "firebase/storage";
import { photoCollection } from "../helpers/collections";
import { PhotoType } from "../helpers/models";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

export default function ListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const { values, setValues, updateCounter } = useCounters();
  const { triggerRefresh } = useFilter();
  const { selectedIds, clearSelection } = useSelection();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApplyingHeadline, setIsApplyingHeadline] = useState(false);
  const [isApplyingTags, setIsApplyingTags] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
  }, []);

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    setIsDeleting(true);

    try {
      for (const photoId of selectedIds) {
        const photoRef = doc(photoCollection, photoId);
        const photoSnap = await getDoc(photoRef);

        if (photoSnap.exists()) {
          const photo = photoSnap.data() as PhotoType;

          // 1. Delete Firestore Doc
          await deleteDoc(photoRef);

          // 2. Update Counters
          for (const filter of CONFIG.photo_filter) {
            if (filter === "nick") continue;
            if (filter === "tags") {
              if (photo.tags) {
                for (const tag of photo.tags) {
                  await updateCounter("tags", tag, -1);
                }
              }
            } else {
              const key = filter as keyof PhotoType;
              const val = photo[key];
              if (val) {
                await updateCounter(filter, String(val), -1);
              }
            }
          }

          // 3. Delete from Storage
          try {
            await deleteObject(ref(storage, photoId));
            const thumbnailName = thumbName(photoId);
            if (thumbnailName) {
              await deleteObject(ref(storage, thumbnailName));
            }
          } catch (e) {
            console.warn(`Storage cleanup failed for ${photoId}`, e);
          }
        }
      }

      toast.success(`Deleted ${selectedIds.length} photos`);
      clearSelection();
      triggerRefresh();
    } catch (error) {
      toast.error("Error deleting photos", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  const handleApplyHeadline = async () => {
    if (selectedIds.length === 0 || !values.headlineToApply) return;
    setIsApplyingHeadline(true);
    try {
      const text = sliceSlug(values.headlineToApply);
      for (const id of selectedIds) {
        await updateDoc(doc(photoCollection, id), {
          headline: values.headlineToApply,
          text,
        });
      }
      toast.success(`Applied headline to ${selectedIds.length} photos`);
      clearSelection();
      triggerRefresh();
    } catch (error) {
      toast.error("Error applying headline", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsApplyingHeadline(false);
    }
  };

  const handleApplyTags = async () => {
    if (selectedIds.length === 0) return;
    setIsApplyingTags(true);
    try {
      const newTags = values.tagsToApply || [];
      for (const id of selectedIds) {
        const photoRef = doc(photoCollection, id);
        const photoSnap = await getDoc(photoRef);

        if (photoSnap.exists()) {
          const photo = photoSnap.data() as PhotoType;
          const oldTags = photo.tags || [];

          // Counter updates
          const removed = oldTags.filter((t) => !newTags.includes(t));
          const added = newTags.filter((t) => !oldTags.includes(t));

          for (const t of removed) await updateCounter("tags", t, -1);
          for (const t of added) await updateCounter("tags", t, 1);

          await updateDoc(photoRef, { tags: newTags });
        }
      }
      toast.success(`Applied tags to ${selectedIds.length} photos`);
      clearSelection();
      triggerRefresh();
    } catch (error) {
      toast.error("Error applying tags", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsApplyingTags(false);
    }
  };

  return (
    <div className="flex h-screen bg-muted/40 font-sans">
      {/* Mobile Sidebar Overlay */}
      {user && isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {user && (
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-72 transform bg-background border-r border-border transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:z-0 flex flex-col",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-16 items-center justify-between px-6 border-b border-border shrink-0">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                {/* text-xl font-bold text-foreground hover:text-primary transition-colors */}
                <Image
                  className="opacity-80"
                  src="/apperture.svg"
                  width={32}
                  height={32}
                  alt="Logo"
                />
                <span className="ml-3 text-xl font-bold text-foreground hover:text-primary transition-colors truncate">
                  {CONFIG.title}
                </span>
              </Link>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 text-muted-foreground hover:bg-accent rounded-lg md:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="px-6 py-4 border-t border-border space-y-1">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary hover:bg-accent"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
            <Link
              href="/list"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary hover:bg-accent"
            >
              <LayoutGrid className="h-4 w-4" />
              List
            </Link>
            {user.email && CONFIG.familyMap.has(user.email) && (
              <Link
                href="/add"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary hover:bg-accent"
              >
                <Plus className="h-4 w-4" />
                Add Photos
              </Link>
            )}
            {user.email && CONFIG.adminMap.has(user.email) && (
              <Link
                href="/admin"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary hover:bg-accent"
              >
                <Settings className="h-4 w-4" />
                Administration
              </Link>
            )}
          </nav>

          <div className="flex-1" />

          <div className="px-6 py-4 space-y-3 border-t border-border">
            {selectedIds.length > 0 && (
              <div className="flex flex-col gap-2 mb-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground/70 px-1">
                  <span>{selectedIds.length} Selected</span>
                  <button
                    onClick={clearSelection}
                    className="hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <Eraser className="size-3" />
                    Clear
                  </button>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full h-9 rounded-lg gap-2"
                  onClick={() => setDeleteModalOpen(true)}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Delete Selected
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50">
                Apply Headline
              </label>
              <div className="relative">
                <Input
                  placeholder="to apply to all photos..."
                  value={values.headlineToApply}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      headlineToApply: e.target.value,
                    }))
                  }
                  className="h-9 text-sm rounded-lg"
                />
                {values.headlineToApply && (
                  <button
                    onClick={() =>
                      setValues((prev) => ({ ...prev, headlineToApply: "" }))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-md transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              {selectedIds.length > 0 && (
                <Button
                  variant="outline"
                  size="xs"
                  className="w-full h-8 text-[10px] font-bold uppercase tracking-tight"
                  onClick={handleApplyHeadline}
                  disabled={isApplyingHeadline || !values.headlineToApply}
                >
                  {isApplyingHeadline ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : null}
                  Apply to {selectedIds.length} selected
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50">
                Merge Tags
              </label>
              <div className="relative">
                <Combobox
                  value={values.tagsToApply || []}
                  onValueChange={(val) =>
                    setValues((prev) => ({ ...prev, tagsToApply: val }))
                  }
                  multiple
                >
                  <ComboboxChips className="min-h-9 py-1 px-2 rounded-lg border-border bg-transparent shadow-none">
                    {(values.tagsToApply || []).map((tag) => (
                      <ComboboxChip key={tag} className="h-6 text-[10px]">
                        {tag}
                      </ComboboxChip>
                    ))}
                    <ComboboxChipsInput
                      placeholder="to apply..."
                      className="text-sm h-7"
                    />
                  </ComboboxChips>
                  <ComboboxContent>
                    <ComboboxList>
                      <ComboboxEmpty>No tags found.</ComboboxEmpty>
                      {Object.keys(values.values.tags || {}).map((t) => (
                        <ComboboxItem key={t} value={t}>
                          {t}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {values.tagsToApply && values.tagsToApply.length > 0 && (
                  <button
                    onClick={() =>
                      setValues((prev) => ({ ...prev, tagsToApply: [] }))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-md transition-colors z-10"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              {selectedIds.length > 0 && (
                <Button
                  variant="outline"
                  size="xs"
                  className="w-full h-8 text-[10px] font-bold uppercase tracking-tight"
                  onClick={handleApplyTags}
                  disabled={isApplyingTags}
                >
                  {isApplyingTags ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : null}
                  Apply to {selectedIds.length} selected
                </Button>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border text-xs text-right text-muted-foreground">
            Build {version()}
          </div>
        </aside>
      )}

      {/* Main Content Wrapper */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 shadow-sm sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 flex-1">
            {user && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary md:hidden transition-colors"
              >
                <span className="sr-only">Open sidebar</span>
                <Menu className="h-6 w-6" />
              </button>
            )}

            {!user && (
              <Link
                href="/"
                className="p-2 text-muted-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors"
                title="Go to Home"
              >
                <Home className="h-6 w-6" />
              </Link>
            )}

            <div className={cn("flex-1 max-w-sm", user ? "ml-4" : "mx-auto")}>
              <GlobalSearch />
            </div>
          </div>
        </header>

        {/* Main Area */}
        <main className="relative flex-1 overflow-auto bg-muted/40 p-4 md:p-6">
          {children}
        </main>
      </div>

      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.length} photos?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              selected photos and their data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteSelected();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Photos"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

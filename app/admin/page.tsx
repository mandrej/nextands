"use client";

import { useCounters } from "../context/CountersContext";
import { useState, useEffect, useCallback } from "react";
import {
  getDocs,
  query,
  where,
  writeBatch,
  doc,
  getDoc,
} from "firebase/firestore";
import {
  photoCollection,
  counterCollection,
  bucketCollection,
} from "../helpers/collections";
import { PhotoType, BucketType } from "../helpers/models";
import { db, storage } from "../firebase";
import { counterId, thumbName } from "../helpers/index";
import { toast } from "sonner";
import {
  RefreshCw,
  Loader2,
  Database,
  HardDrive,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { setDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { ref, listAll, deleteObject } from "firebase/storage";
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

interface OrphanFile {
  name: string;
  fullPath: string;
}

export default function SettingsPage() {
  const { counts, refreshCounters } = useCounters();
  const [loadingField, setLoadingField] = useState<string | null>(null);
  const [bucket, setBucket] = useState<BucketType | null>(null);

  // Orphan detection state
  const [orphans, setOrphans] = useState<OrphanFile[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scanned, setScanned] = useState(false);

  const fetchBucket = useCallback(async () => {
    try {
      const docSnap = await getDoc(doc(bucketCollection, "total"));
      if (docSnap.exists()) {
        setBucket(docSnap.data() as BucketType);
      }
    } catch (error) {
      console.error("Error fetching bucket info:", error);
    }
  }, []);

  useEffect(() => {
    fetchBucket();
  }, [fetchBucket]);

  const scanOrphans = useCallback(async () => {
    setScanLoading(true);
    setScanned(false);
    try {
      // 1. List all files in storage root
      const storageRef = ref(storage);
      const listResult = await listAll(storageRef);

      // 2. Get all Photo doc IDs from Firestore
      const photoSnap = await getDocs(photoCollection);
      const photoIds = new Set(photoSnap.docs.map((d) => d.id));

      // 3. Find storage items with no matching Firestore doc
      //    Thumbnails live in a "thumbnails/" subfolder so listAll on root only returns originals
      const found: OrphanFile[] = [];
      for (const item of listResult.items) {
        const name = item.name;
        if (!photoIds.has(name)) {
          found.push({ name, fullPath: item.fullPath });
        }
      }

      setOrphans(found);
      setScanned(true);
      if (found.length === 0) {
        toast.success("No orphaned files found — storage is clean!");
      } else {
        toast.warning(
          `Found ${found.length} orphaned file${found.length > 1 ? "s" : ""} in storage`,
        );
      }
    } catch (error) {
      console.error("Error scanning storage:", error);
      toast.error("Failed to scan storage", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setScanLoading(false);
    }
  }, []);

  const deleteOrphans = async () => {
    setDeleteLoading(true);
    let deleted = 0;
    try {
      for (const orphan of orphans) {
        // Delete the original file
        await deleteObject(ref(storage, orphan.fullPath));
        deleted++;

        // Also delete the thumbnail if it exists
        const thumbPath = thumbName(orphan.name);
        if (thumbPath) {
          try {
            await deleteObject(ref(storage, thumbPath));
          } catch {
            // Thumbnail may not exist — ignore
          }
        }
      }
      setOrphans([]);
      setScanned(false);
      toast.success(
        `Deleted ${deleted} orphaned file${deleted > 1 ? "s" : ""} from storage`,
      );
    } catch (error) {
      console.error("Error deleting orphans:", error);
      toast.error("Failed to delete orphaned files", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setDeleteLoading(false);
      setConfirmOpen(false);
    }
  };

  const stats = [
    {
      name: "Total Photos",
      field: "bucket",
      value: bucket?.count || 0,
      size: bucket?.size,
    },
    { name: "Total Years", field: "year", value: counts["year"] || 0 },
    { name: "Unique Tags", field: "tags", value: counts["tags"] || 0 },
    { name: "Camera Models", field: "model", value: counts["model"] || 0 },
    { name: "Lens Used", field: "lens", value: counts["lens"] || 0 },
    { name: "Nicks", field: "nick", value: counts["nick"] || 0 },
    { name: "Emails", field: "email", value: counts["email"] || 0 },
  ];

  const recreateStat = async (fieldName: string) => {
    setLoadingField(fieldName);
    try {
      // 1. Fetch all photos
      const photoSnap = await getDocs(photoCollection);
      const newCounts = new Map<string, number>();

      photoSnap.forEach((doc) => {
        const data = doc.data() as PhotoType;
        if (fieldName === "tags") {
          data.tags?.forEach((tag) => {
            newCounts.set(tag, (newCounts.get(tag) || 0) + 1);
          });
        } else {
          const val = String(data[fieldName as keyof PhotoType] || "");
          if (val) {
            newCounts.set(val, (newCounts.get(val) || 0) + 1);
          }
        }
      });

      // 2. Fetch existing counters for this field
      const q = query(counterCollection, where("field", "==", fieldName));
      const counterSnap = await getDocs(q);

      const batch = writeBatch(db);

      counterSnap.forEach((doc) => {
        const val = doc.data().value;
        const newCount = newCounts.get(val);
        if (newCount) {
          batch.update(doc.ref, { count: newCount });
          newCounts.delete(val);
        } else {
          batch.delete(doc.ref);
        }
      });

      // 3. Add new values
      newCounts.forEach((count, value) => {
        const id = counterId(fieldName, value);
        batch.set(doc(counterCollection, id), {
          field: fieldName,
          value,
          count,
        });
      });

      await batch.commit();
      await refreshCounters();
      toast.success(`${fieldName} stats recalculated and updated`);
    } catch (error) {
      console.error(`Error recreating ${fieldName} stats:`, error);
      toast.error(`Failed to recreate ${fieldName} stats`, {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoadingField(null);
    }
  };

  const recreateBucket = async () => {
    setLoadingField("bucket");
    try {
      const photoSnap = await getDocs(photoCollection);
      let totalSize = 0;
      let totalCount = 0;

      photoSnap.forEach((doc) => {
        const data = doc.data() as PhotoType;
        totalSize += data.size || 0;
        totalCount += 1;
      });

      const bucketData: BucketType = {
        size: totalSize,
        count: totalCount,
      };

      await setDoc(doc(bucketCollection, "total"), bucketData);
      setBucket(bucketData);
      toast.success("Bucket metadata recalculated and updated");
    } catch (error) {
      console.error("Error recreating bucket stats:", error);
      toast.error("Failed to recreate bucket stats", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoadingField(null);
    }
  };

  return (
    <div className="w-full space-y-8 pb-20">
      {/* System Metadata */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          System Metadata
        </h3>
        <div className="overflow-hidden rounded-xl bg-card border border-border shadow-sm">
          <ul className="grid grid-cols-1 sm:grid-cols-2">
            {stats.map((item, index) => (
              <li
                key={item.name}
                className={cn(
                  "px-6 py-4 flex items-center justify-between hover:bg-accent/50 transition-colors border-b border-border",
                  index % 2 === 0 && "sm:border-r",
                )}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {item.name}
                  </span>
                  <span className="text-2xl font-semibold text-foreground flex items-baseline gap-2">
                    {item.value}
                    {"size" in item && item.size !== undefined && (
                      <span className="text-xl font-normal text-muted-foreground">
                        |{" "}
                        {new Intl.NumberFormat("en", {
                          notation: "compact",
                          style: "unit",
                          unit: "byte",
                          unitDisplay: "narrow",
                        }).format(item.size)}
                      </span>
                    )}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loadingField !== null}
                  onClick={() =>
                    item.field === "bucket"
                      ? recreateBucket()
                      : recreateStat(item.field)
                  }
                  className="gap-2"
                >
                  {loadingField === item.field ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {item.field === "bucket" ? "Calculate" : "Recreate"}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Storage Cleanup */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            Storage Cleanup
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={scanOrphans}
            disabled={scanLoading || deleteLoading}
            className="gap-2"
          >
            {scanLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Scan for Orphans
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl bg-card border border-border shadow-sm">
          {!scanned && !scanLoading && (
            <div className="px-6 py-10 flex flex-col items-center justify-center text-center gap-3">
              <HardDrive className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Scan storage to find files that have no matching record in the
                Photo collection.
              </p>
            </div>
          )}

          {scanLoading && (
            <div className="px-6 py-10 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Scanning storage…</p>
            </div>
          )}

          {scanned && !scanLoading && orphans.length === 0 && (
            <div className="px-6 py-10 flex flex-col items-center justify-center text-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <HardDrive className="h-5 w-5 text-green-500" />
              </div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                Storage is clean — no orphaned files found.
              </p>
            </div>
          )}

          {scanned && orphans.length > 0 && (
            <>
              <div className="px-6 py-3 border-b border-border bg-destructive/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-destructive">
                  <TriangleAlert className="h-4 w-4" />
                  <span className="text-sm font-semibold">
                    {orphans.length} orphaned file
                    {orphans.length > 1 ? "s" : ""} found
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                  disabled={deleteLoading}
                  className="gap-2"
                >
                  {deleteLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete All
                </Button>
              </div>
              <ul className="divide-y divide-border">
                {orphans.map((orphan) => (
                  <li
                    key={orphan.fullPath}
                    className="px-6 py-3 flex items-center gap-3 hover:bg-accent/40 transition-colors"
                  >
                    <div className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                    <span className="text-sm font-mono text-foreground truncate flex-1">
                      {orphan.name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      no Photo doc
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Confirm Delete Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {orphans.length} orphaned file
              {orphans.length > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove these files from Firebase Storage.
              This action cannot be undone. Thumbnail counterparts will also be
              removed if they exist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteOrphans();
              }}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? "Deleting…" : "Delete Files"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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
import { db } from "../firebase";
import { counterId } from "../helpers/index";
import { toast } from "sonner";
import { RefreshCw, Loader2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { counts, refreshCounters } = useCounters();
  const [loadingField, setLoadingField] = useState<string | null>(null);
  const [bucket, setBucket] = useState<BucketType | null>(null);

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

  const stats = [
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
    <div className="space-y-6">
      <div className="bg-card p-6 shadow rounded-lg border border-border">
        <h3 className="text-lg font-medium leading-6 text-foreground flex items-center gap-2">
          <Database className="h-5 w-5 text-muted-foreground" />
          System Metadata
        </h3>
        <div className="mt-4 max-w-sm">
          <div className="overflow-hidden rounded-lg bg-muted px-4 py-5 shadow sm:p-6 relative group">
            <dt className="truncate text-sm font-medium text-muted-foreground flex justify-between items-center">
              Total Bucket Size & Count
            </dt>
            <dd className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-foreground">
                {bucket?.count || 0}
              </span>
              <span className="text-sm text-muted-foreground">photos</span>
              <span className="mx-2 text-border">|</span>
              <span className="text-2xl font-semibold text-foreground">
                {bucket
                  ? new Intl.NumberFormat("en", {
                      notation: "compact",
                      style: "unit",
                      unit: "byte",
                      unitDisplay: "narrow",
                    }).format(bucket.size)
                  : "0 B"}
              </span>
            </dd>
            <dd className="mt-4 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                Total storage used by original images.
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={loadingField !== null}
                onClick={recreateBucket}
                className="gap-2"
              >
                {loadingField === "bucket" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Recompute
              </Button>
            </dd>
          </div>
        </div>
        <div className="mt-8">
          <h3 className="text-lg font-medium leading-6 text-foreground mb-4">
            Database Statistics
          </h3>
          <div className="overflow-hidden rounded-lg bg-muted/50 shadow border border-border">
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
                    <span className="text-2xl font-semibold text-foreground">
                      {item.value}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={loadingField !== null}
                    onClick={() => recreateStat(item.field)}
                    className="gap-2"
                  >
                    {loadingField === item.field ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Recreate</span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

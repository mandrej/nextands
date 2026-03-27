"use client";

import { useCounters } from "../../context/CountersContext";
import { useState, useMemo } from "react";
import {
  getDocs,
  query,
  where,
  writeBatch,
  getDoc,
  setDoc,
  doc,
} from "firebase/firestore";
import { photoCollection, counterCollection } from "../../helpers/collections";
import { PhotoType } from "../../helpers/models";
import { db } from "../../firebase";
import { counterId } from "../../helpers/index";
import { toast } from "sonner";
import { Tag, Loader2, Search, Edit2, CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function TagsPage() {
  const { values, refreshCounters } = useCounters();
  const [searchTerm, setSearchTerm] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingTag, setEditingTag] = useState<{ oldName: string; count: number } | null>(null);
  const [newName, setNewName] = useState("");
  const [addingTag, setAddingTag] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const allTags = useMemo(() => {
    const tags = values.values.tags || {};
    return Object.entries(tags)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [values.values.tags]);

  const filteredTags = allTags.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRename = async () => {
    if (!editingTag || !newName || newName.trim() === editingTag.oldName) return;

    setIsUpdating(true);
    const oldName = editingTag.oldName;
    const sanitizedNewName = newName.trim();

    try {
      // 1. Fetch all photos containing the old tag
      const q = query(photoCollection, where("tags", "array-contains", oldName));
      const photoSnap = await getDocs(q);

      if (photoSnap.empty) {
        toast.error("No photos found with this tag, but it exists in counters. Cleaning up...");
      } else {
        // Update photos in batches of 500 (Firestore limit)
        const docs = photoSnap.docs;
        for (let i = 0; i < docs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 500);
          
          chunk.forEach((photoDoc) => {
            const data = photoDoc.data() as PhotoType;
            const currentTags = data.tags || [];
            // Remove oldName, add sanitizedNewName if not already there
            const nextTags = [...currentTags.filter((t) => t !== oldName)];
            if (!nextTags.includes(sanitizedNewName)) {
              nextTags.push(sanitizedNewName);
            }
            batch.update(photoDoc.ref, { tags: nextTags });
          });
          
          await batch.commit();
        }
      }

      // 2. Recalculate tag counters (the "recreate tags" logic requested)
      // Standard recount logic to ensure counters are accurate after merge/rename
      await triggerRecount();

      toast.success(`Renamed "${oldName}" to "${sanitizedNewName}" and updated ${photoSnap.size} photos`);
      setEditingTag(null);
      setNewName("");
    } catch (error) {
      console.error("Error renaming tag:", error);
      toast.error(`Failed to rename tag`, {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const triggerRecount = async () => {
    const photoSnap = await getDocs(photoCollection);
    const newCounts = new Map<string, number>();

    photoSnap.forEach((doc) => {
      const data = doc.data() as PhotoType;
      data.tags?.forEach((tag) => {
        newCounts.set(tag, (newCounts.get(tag) || 0) + 1);
      });
    });

    const q = query(counterCollection, where("field", "==", "tags"));
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

    newCounts.forEach((count, value) => {
      batch.set(doc(counterCollection, counterId("tags", value)), {
        field: "tags",
        value,
        count,
      });
    });

    await batch.commit();
    await refreshCounters();
  };

  const handleAddTag = async () => {
    if (!addingTag || addingTag.trim() === "") return;
    setIsAdding(true);
    const tagName = addingTag.trim();

    try {
      const id = counterId("tags", tagName);
      const ref = doc(counterCollection, id);
      const snap = await getDoc(ref);
      
      if (snap.exists()) {
        setSearchTerm(tagName);
        toast.error(`Tag "${tagName}" already exists`);
      } else {
        await setDoc(ref, { field: "tags", value: tagName, count: 0 });
        await refreshCounters();
        toast.success(`Tag "${tagName}" added to system`);
        setAddingTag("");
      }
    } catch (error) {
      console.error("Error adding tag:", error);
      toast.error("Failed to add tag", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="w-full space-y-6 pb-20 text-foreground">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold tracking-tight flex items-center gap-2 px-1">
          <Tag className="h-5 w-5 text-primary" />
          Tag Management
        </h3>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-border">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Add new tag..."
              value={addingTag}
              onChange={(e) => setAddingTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
              className="pl-9 bg-background"
              disabled={isAdding}
            />
          </div>
          <Button onClick={handleAddTag} disabled={isAdding || !addingTag.trim()} className="shrink-0 gap-2">
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Tag
          </Button>
        </div>
        <div className="relative w-full lg:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-card border border-border shadow-sm">
        {filteredTags.length > 0 ? (
          <ul className="divide-y divide-border">
            {filteredTags.map((tag) => (
              <li
                key={tag.name}
                className="px-6 py-4 flex items-center justify-between hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Tag className="size-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">
                      {tag.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      {tag.count} {tag.count === 1 ? "photo" : "photos"}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingTag({ oldName: tag.name, count: tag.count });
                    setNewName(tag.name);
                  }}
                  className="gap-2"
                >
                  <Edit2 className="size-4" />
                  <span className="hidden sm:inline">Rename</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="size-12 rounded-full bg-muted mx-auto flex items-center justify-center">
              <Tag className="size-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No tags found matching your search.</p>
          </div>
        )}
      </div>

      <Dialog open={editingTag !== null} onOpenChange={(open) => !open && setEditingTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Tag: {editingTag?.oldName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Tag Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter new name..."
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                disabled={isUpdating}
              />
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg leading-relaxed">
              This will update <span className="font-bold text-foreground">{editingTag?.count}</span> photos. 
              If the new name exists, the tags will be merged.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingTag(null)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isUpdating || !newName || newName === editingTag?.oldName}>
              {isUpdating ? <Loader2 className="size-4 animate-spin mr-2" /> : <CheckCircle2 className="size-4 mr-2" />}
              {isUpdating ? "Updating..." : "Confirm Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

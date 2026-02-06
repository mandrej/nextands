"use client";

import { useState, useRef } from "react";
import { storage } from "@/app/firebase";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import {
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
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
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../context/AuthContext";
import { formatDatum, CONFIG, thumbName, sliceSlug } from "@/app/helpers";
import readExif from "@/app/helpers/exif";
import { PhotoType } from "@/app/helpers/models";
import { photoCollection } from "@/app/helpers/collections";
import { doc, setDoc } from "firebase/firestore";
import { Rocket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EditForm } from "../list/_components/EditForm";
import { useCounters } from "../context/CountersContext";
import { toast } from "sonner";

interface UploadingFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  downloadURL?: string;
  error?: string;
  storageName?: string;
  published?: boolean;
}

export default function AddPage() {
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { user, loading: loadingAuth } = useAuth();
  const { values, setValues } = useCounters();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit/Publish state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<UploadingFile | null>(null);
  const [editingPhotoData, setEditingPhotoData] = useState<PhotoType | null>(
    null,
  );

  const addFiles = (selectedFiles: FileList | null) => {
    if (selectedFiles) {
      const newFiles = Array.from(selectedFiles).map((file) => ({
        id: uuidv4(),
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: "pending" as const,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = async (id: string) => {
    const fileToRemove = files.find((f) => f.id === id);

    if (fileToRemove) {
      // Remove from storage if it exists
      if (fileToRemove.storageName) {
        try {
          // Delete original file
          const storageRef = ref(storage, fileToRemove.storageName);
          await deleteObject(storageRef).catch((e) =>
            console.error("Error deleting file:", e),
          );

          // Delete thumbnail
          const thumbnailName = thumbName(fileToRemove.storageName);
          if (thumbnailName) {
            const thumbRef = ref(storage, thumbnailName);
            await deleteObject(thumbRef).catch((e) =>
              console.error("Error deleting thumbnail:", e),
            );
          }
        } catch (error) {
          toast.error("Error deleting from storage", {
            description: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Cleanup preview
      URL.revokeObjectURL(fileToRemove.preview);

      // Remove from state
      setFiles((prev) => prev.filter((f) => f.id !== id));
    }
  };

  const uploadFile = (uploadingFile: UploadingFile) => {
    const prefix = uuidv4().substring(0, 8);
    const fileName = `${prefix}-${uploadingFile.file.name}`;
    const storageRef = ref(storage, `${fileName}`);
    const uploadTask = uploadBytesResumable(storageRef, uploadingFile.file);

    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadingFile.id
          ? { ...f, status: "uploading", storageName: fileName }
          : f,
      ),
    );

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setFiles((prev) =>
          prev.map((f) => (f.id === uploadingFile.id ? { ...f, progress } : f)),
        );
      },
      (error) => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadingFile.id
              ? { ...f, status: "error", error: error.message }
              : f,
          ),
        );
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadingFile.id
              ? { ...f, status: "completed", progress: 100, downloadURL }
              : f,
          ),
        );
      },
    );
  };

  const handlePublishClick = async (uploadingFile: UploadingFile) => {
    if (!uploadingFile.downloadURL || !user?.email) return;

    try {
      // 1. Read EXIF
      const exif = await readExif(uploadingFile.file);

      // 2. Map user to nick
      const nick = CONFIG.familyMap.get(user.email) || user.email.split("@")[0];

      // 3. Prepare initial PhotoType
      const photoData: PhotoType = {
        ...(exif || { model: "UNKNOWN", date: formatDatum(new Date()) }),
        filename: uploadingFile.storageName || uploadingFile.file.name,
        url: uploadingFile.downloadURL,
        size: uploadingFile.file.size,
        email: user.email,
        nick: nick,
        headline: values.headlineToApply,
        tags: values.tagsToApply,
      };

      // 4. Open editor instead of immediate publish
      setEditingFile(uploadingFile);
      setEditingPhotoData(photoData);
      setEditModalOpen(true);
    } catch (error) {
      toast.error("Error reading EXIF", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const { updateCounter } = useCounters();

  const handleFinalPublish = async (finalData: PhotoType) => {
    if (!editingFile || !editingPhotoData) return;

    const thumbRef = ref(storage, thumbName(editingFile.storageName || ""));
    const thumbURL = await getDownloadURL(thumbRef);
    const datum = finalData.date || formatDatum(new Date());
    const [year, month, day] = datum.split(" ")[0].split("-");
    const flash = finalData.flash;
    const tags = [...(finalData.tags || [])];
    if (flash && !tags.includes("flash")) {
      tags.push("flash");
    }
    const text = sliceSlug(finalData.headline || CONFIG.noTitle);

    const data: PhotoType = {
      ...editingPhotoData,
      thumb: thumbURL,
      headline: finalData.headline || CONFIG.noTitle,
      date: datum,
      year: +year,
      month: +month,
      day: +day,
      tags,
      flash,
      text,
    };

    try {
      // 1. Save to Firestore
      await setDoc(doc(photoCollection, editingFile.storageName), data);

      // 2. Update counters
      for (const filter of CONFIG.photo_filter) {
        if (filter === "nick") continue; // Handled by email sync in updateCounter
        if (filter === "tags") {
          if (data.tags) {
            for (const tag of data.tags) {
              await updateCounter("tags", tag, 1);
            }
          }
        } else {
          const key = filter as keyof PhotoType;
          const val = data[key];
          if (val) {
            await updateCounter(filter, String(val), 1);
          }
        }
      }

      // 3. Close modal
      setEditModalOpen(false);
      setEditingFile(null);
      setEditingPhotoData(null);

      // 4. Remove from list (as per user request)
      setFiles((prev) => prev.filter((f) => f.id !== editingFile.id));
      URL.revokeObjectURL(editingFile.preview);
    } catch (error) {
      toast.error("Error publishing photo", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const startUploads = () => {
    files.forEach((f) => {
      if (f.status === "pending" || f.status === "error") {
        uploadFile(f);
      }
    });
  };

  const clearCompleted = () => {
    setFiles((prev) => {
      prev
        .filter((f) => f.status === "completed")
        .forEach((f) => URL.revokeObjectURL(f.preview));
      return prev.filter((f) => f.status !== "completed");
    });
  };

  if (loadingAuth) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <div className="p-8 rounded-xl bg-card shadow-2xl border border-border text-center space-y-6 max-w-sm w-full animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 mx-auto bg-destructive/10 rounded-xl flex items-center justify-center">
            <Lock className="w-10 h-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              Access Denied
            </h2>
            <p className="text-muted-foreground">
              Please sign in with your account to upload images to the storage.
            </p>
          </div>
          <Link href="/" className="block">
            <Button className="w-full rounded-xl h-12 text-base font-semibold shadow-lg shadow-primary/20">
              Go to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalUploading = files.filter((f) => f.status === "uploading").length;
  const totalCompleted = files.filter((f) => f.status === "completed").length;
  const totalPending = files.filter((f) => f.status === "pending").length;

  return (
    <div className="mx-auto space-y-8 pb-20">
      {/* Dropzone Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative group cursor-pointer rounded-xl border-2 border-dashed transition-all duration-500 ease-in-out p-6 text-center",
          isDragging
            ? "border-primary bg-primary/5 scale-[0.99]"
            : "border-border hover:border-muted-foreground/50 bg-card",
          "backdrop-blur-xl shadow-xl hover:shadow-2xl",
        )}
      >
        {/* TODO maxFiles, maxSize */}
        <Input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          ref={fileInputRef}
        />
        <div className="flex flex-col items-center">
          <div className="pb-4 rounded-xl text-primary group-hover:scale-110 transition-transform duration-500">
            <Upload className="w-10 h-10" />
          </div>
          <p className="text-lg font-semibold text-foreground">
            Click or drag images here
          </p>
          <p className="mt-3 text-muted-foreground">
            Supports PNG, JPG, JPEG up to {CONFIG.fileSize / 1024 / 1024} MB
          </p>
        </div>
      </div>

      {/* Configuration Bar */}
      <div className="flex flex-col sm:flex-row gap-4 p-5 rounded-xl bg-card border border-border shadow-sm">
        <div className="flex-1 space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Default Headline
          </label>
          <div className="relative">
            <Input
              placeholder="Headline to apply to all photos..."
              value={values.headlineToApply}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  headlineToApply: e.target.value,
                }))
              }
              className="rounded-xl border-border pr-10"
            />
            {values.headlineToApply && (
              <button
                onClick={() =>
                  setValues((prev) => ({ ...prev, headlineToApply: "" }))
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-muted rounded-md transition-colors"
                title="Clear headline"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Default Tags
          </label>
          <div className="relative">
            <Combobox
              value={values.tagsToApply || []}
              onValueChange={(val) =>
                setValues((prev) => ({ ...prev, tagsToApply: val }))
              }
              multiple
            >
              <ComboboxChips>
                {(values.tagsToApply || []).map((tag) => (
                  <ComboboxChip key={tag}>{tag}</ComboboxChip>
                ))}
                <ComboboxChipsInput placeholder="Select tags to apply..." />
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
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-muted rounded-md transition-colors z-10"
                title="Clear tags"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      {files.length > 0 && (
        <div className="sticky top-4 flex items-center justify-between p-5 rounded-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-100 dark:border-gray-800 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">
                {files.length} {files.length === 1 ? "File" : "Files"}
              </span>
              <span className="text-xs text-gray-500">
                {totalPending} pending • {totalCompleted} completed
              </span>
            </div>
            {totalUploading > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Uploading
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {totalCompleted > 0 && totalUploading === 0 && (
              <Button
                variant="ghost"
                onClick={clearCompleted}
                size="sm"
                className="rounded-xl font-medium"
              >
                Clear All
              </Button>
            )}
            {totalPending > 0 && (
              <Button
                onClick={startUploads}
                disabled={totalUploading > 0}
                className="rounded-xl shadow-lg shadow-primary/20 px-8"
              >
                {totalUploading > 0 ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload All"
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Files List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {files.map((file) => (
          <div
            key={file.id}
            className="group relative aspect-square rounded-xl bg-card border border-border overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 animate-in fade-in zoom-in-50"
          >
            <Image
              src={file.preview}
              alt={file.file.name}
              fill
              className={cn(
                "object-cover transition-transform duration-500 group-hover:scale-110",
                file.status === "error" && "grayscale opacity-50",
              )}
            />

            {/* Status Overlays */}
            {file.status === "completed" && (
              <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center backdrop-blur-[2px]">
                <CheckCircle2 className="w-10 h-10 text-white drop-shadow-md animate-in zoom-in spin-in-12" />
              </div>
            )}

            <div className="absolute top-2 left-2 flex items-center gap-2 z-10">
              {file.status !== "uploading" && (
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full backdrop-blur-md transition-all shadow-lg"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Top Right Controls */}
            <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
              {file.status === "completed" && !file.published && (
                <button
                  onClick={() => handlePublishClick(file)}
                  className="p-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full backdrop-blur-md transition-all shadow-lg"
                  title="Publish to gallery"
                >
                  <Rocket className="w-4 h-4" />
                </button>
              )}
              {file.published && (
                <div className="p-1.5 bg-green-500 text-white rounded-full shadow-lg">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Always visible error icon if error */}
            {file.status === "error" && (
              <div className="absolute top-2 right-2">
                <div className="p-1.5 bg-red-500 text-white rounded-full shadow-lg">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
            )}

            {/* Bottom Info Bar */}
            <div className="absolute bottom-0 inset-x-0 p-3 bg-linear-to-t from-black/90 via-black/60 to-transparent text-white pt-8">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-medium truncate flex-1">
                  {file.file.name}
                </p>
                <span className="text-[10px] opacity-75 shrink-0 font-mono">
                  {(file.file.size / 1024 / 1024).toFixed(1)} MB
                </span>
              </div>

              {/* Progress / Status */}
              <div className="space-y-1">
                {(file.status === "uploading" ||
                  file.status === "completed") && (
                  <Progress
                    value={file.progress}
                    className={cn(
                      "h-1 bg-white/20",
                      file.status === "completed"
                        ? "[&>div]:bg-green-500"
                        : "[&>div]:bg-primary",
                    )}
                  />
                )}

                <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider opacity-80">
                  <span>
                    {file.status === "completed"
                      ? "Done"
                      : file.status === "uploading"
                        ? "Uploading"
                        : file.status === "error"
                          ? "Error"
                          : "Ready"}
                  </span>
                  {file.status === "uploading" && (
                    <span>{Math.round(file.progress)}%</span>
                  )}
                </div>

                {file.status === "error" && (
                  <p className="text-[10px] text-destructive truncate">
                    {file.error}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Before Publish Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Finalize Photo Details</DialogTitle>
          </DialogHeader>
          {editingPhotoData && (
            <EditForm photo={editingPhotoData} onSave={handleFinalPublish} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef, useCallback, memo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  QueryDocumentSnapshot,
  DocumentData,
  Query,
  doc,
  updateDoc,
} from "firebase/firestore";
import { photoCollection } from "../helpers/collections";
import { PhotoType, MyUserType } from "../helpers/models";
import { useFilter } from "../context/FilterContext";
import { useAuth } from "../context/AuthContext";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Captions from "yet-another-react-lightbox/plugins/captions";
import { Checkbox } from "@/components/ui/checkbox";
import { useSelection } from "../context/SelectionContext";
import { cn } from "@/lib/utils";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";

// Replaced Mantine imports
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EditForm } from "./_components/EditForm";
import { CONFIG, monthNameToNumber } from "../helpers";
import { useCounters } from "../context/CountersContext";
import { toast } from "sonner";

import { Suspense } from "react";

const PhotoCard = memo(
  ({
    photo,
    index,
    onOpen,
    onEdit,
    isSelected,
    toggleSelection,
    user,
  }: {
    photo: PhotoType & { id: string };
    index: number;
    onOpen: (index: number) => void;
    onEdit: (e: React.MouseEvent, photo: PhotoType & { id: string }) => void;
    isSelected: boolean;
    toggleSelection: (id: string) => void;
    user: MyUserType | null;
  }) => {
    const isAdmin = user?.isAdmin;
    const isOwner = user?.email && user.email === photo.email;
    const canManage = isAdmin || isOwner;

    return (
      <li
        onClick={() => onOpen(index)}
        className="relative w-full max-w-[400px] aspect-square rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group bg-card cursor-pointer transform-gpu"
      >
        {photo.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.thumb}
            alt={photo.headline || photo.filename}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground font-medium">
            No Thumb
          </div>
        )}

        {canManage && (
          <>
            <div
              className="absolute top-2 right-2 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleSelection(photo.id)}
                className="size-7 rounded-full bg-black/50 hover:bg-primary border-white/50 data-[state=checked]:bg-primary transition-all duration-200"
              />
            </div>
            <button
              onClick={(e) => onEdit(e, photo)}
              className="absolute left-2 top-2 p-2 rounded-full bg-black/50 hover:bg-primary border-white/50 text-white transition-all duration-200 z-10"
              title="Edit photo"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                />
              </svg>
            </button>
          </>
        )}

        <div className="absolute bottom-0 text-white p-4 w-full bg-linear-to-t from-black/70 to-transparent z-1">
          <p className="text-sm font-semibold truncate">
            {photo.headline || photo.filename}
          </p>
          <p className="text-xs opacity-75">
            {photo.date
              ? new Date(photo.date)
                  .toLocaleString(undefined, {
                    year: "numeric",
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  .replace(/\//g, ".")
              : ""}
          </p>
        </div>
      </li>
    );
  },
);

PhotoCard.displayName = "PhotoCard";

function ListPageContent() {
  const [photos, setPhotos] = useState<(PhotoType & { id: string })[]>([]);
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [index, setIndex] = useState(-1);
  const loader = useRef<HTMLDivElement>(null);
  const isUpdatingUrl = useRef(false);
  const { filters } = useFilter();
  const { updateCounter } = useCounters();
  const { user } = useAuth();
  const { isSelected, toggleSelection } = useSelection();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [photoToEdit, setPhotoToEdit] = useState<
    (PhotoType & { id: string }) | null
  >(null);

  const fetchPhotos = useCallback(
    async (doc?: QueryDocumentSnapshot<DocumentData>, isReset = false) => {
      setLoading(true);

      try {
        // Calculate dynamic limit based on filters
        let dynamicLimit = CONFIG.limit;

        // Multiply limit by number of tags when searching multiple tags
        if (filters.tags && filters.tags.length > 1) {
          dynamicLimit *= filters.tags.length;
        }

        // Multiply limit by number of text slices when searching part of headline
        if (filters.text && filters.text.length > 0) {
          dynamicLimit *= filters.text.length;
        }

        let q: Query<DocumentData> = query(
          photoCollection,
          orderBy("date", "desc"),
          limit(dynamicLimit),
        );

        // Apply filters
        if (filters.year) {
          q = query(q, where("year", "==", parseInt(filters.year)));
        }
        if (filters.month) {
          const monthNum = monthNameToNumber(filters.month);
          if (monthNum !== null) {
            q = query(q, where("month", "==", monthNum));
          }
        }
        if (filters.day) {
          q = query(q, where("day", "==", filters.day));
        }
        if (filters.model) {
          q = query(q, where("model", "==", filters.model));
        }
        if (filters.lens) {
          q = query(q, where("lens", "==", filters.lens));
        }
        if (filters.nick) {
          q = query(q, where("nick", "==", filters.nick));
        }
        if (filters.tags && filters.tags.length > 0) {
          q = query(q, where("tags", "array-contains-any", filters.tags));
        }

        if (filters.text && filters.text.length > 0) {
          q = query(q, where("text", "array-contains-any", filters.text));
        }

        if (doc && !isReset) {
          q = query(q, startAfter(doc));
        }

        const querySnapshot = await getDocs(q);
        let newPhotos = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as PhotoType),
        }));

        // Client-side filtering for multiple tags (AND logic)
        // Only filter if we have multiple tags - we need ALL tags to be present
        if (filters.tags && filters.tags.length > 1) {
          newPhotos = newPhotos.filter((photo) => {
            const photoTags = photo.tags || [];
            return filters.tags.every((tag) => photoTags.includes(tag));
          });
        }

        if (newPhotos.length < CONFIG.limit) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        if (isReset || !doc) {
          setPhotos(newPhotos);
        } else {
          setPhotos((prev) => [...prev, ...newPhotos]);
        }
        setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
      } catch (error) {
        toast.error("Error fetching photos", {
          description: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    fetchPhotos(undefined, true);
  }, [fetchPhotos]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && lastDoc) {
          fetchPhotos(lastDoc);
        }
      },
      { threshold: 1.0 },
    );

    if (loader.current) {
      observer.observe(loader.current);
    }

    return () => {
      if (loader.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        observer.unobserve(loader.current);
      }
    };
  }, [lastDoc, hasMore, loading, fetchPhotos]);

  // Handle URL parameter for direct photo linking
  useEffect(() => {
    const photoId = searchParams.get("photo");

    // If we're programmatically updating the URL, don't process it
    if (isUpdatingUrl.current) {
      isUpdatingUrl.current = false;
      return;
    }

    if (photoId && photos.length > 0) {
      const photoIndex = photos.findIndex((p) => p.id === photoId);
      if (photoIndex !== -1 && photoIndex !== index) {
        setIndex(photoIndex);
      }
    } else if (!photoId && index !== -1) {
      // URL has no photo param but lightbox is open - close it
      setIndex(-1);
    }
  }, [searchParams, photos, index]);

  const handleEditClick = useCallback(
    (e: React.MouseEvent, photo: PhotoType & { id: string }) => {
      e.stopPropagation();
      if (!(user?.isAdmin || (user?.email && user.email === photo.email))) {
        return;
      }
      setPhotoToEdit(photo);
      setEditModalOpen(true);
    },
    [user],
  );

  const handleEditSave = async (updates: PhotoType) => {
    if (photoToEdit) {
      try {
        // Update nick if email changed
        if (updates.email !== photoToEdit.email) {
          updates.nick =
            CONFIG.familyMap.get(updates.email) || updates.email.split("@")[0];
        }

        const photoRef = doc(photoCollection, photoToEdit.id);
        await updateDoc(photoRef, { ...updates });

        for (const filter of CONFIG.photo_filter) {
          if (filter === "nick") continue; // Handled by email sync in updateCounter
          const key = filter as keyof PhotoType;

          if (filter === "tags") {
            const oldTags = photoToEdit.tags || [];
            const newTags = updates.tags || [];

            const removed = oldTags.filter((t) => !newTags.includes(t));
            const added = newTags.filter((t) => !oldTags.includes(t));

            for (const t of removed) await updateCounter("tags", t, -1);
            for (const t of added) await updateCounter("tags", t, 1);
          } else {
            const oldVal = photoToEdit[key];
            const newVal = updates[key];

            if (oldVal !== newVal) {
              if (oldVal) await updateCounter(filter, String(oldVal), -1);
              if (newVal) await updateCounter(filter, String(newVal), 1);
            }
          }
        }

        setPhotos((prev) =>
          prev.map((p) => (p.id === photoToEdit.id ? { ...p, ...updates } : p)),
        );
      } catch (error) {
        toast.error("Error updating photo", {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    }
    setEditModalOpen(false);
    setPhotoToEdit(null);
  };

  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const openLightbox = useCallback(
    (photoIndex: number) => {
      setIndex(photoIndex);
      const photoId = photosRef.current[photoIndex]?.id;
      if (photoId) {
        isUpdatingUrl.current = true;
        const params = new URLSearchParams(window.location.search);
        params.set("photo", photoId);
        router.push(`?${params.toString()}`, { scroll: false });
      }
    },
    [router],
  );

  const closeLightbox = useCallback(() => {
    setIndex(-1);
    isUpdatingUrl.current = true;
    const params = new URLSearchParams(window.location.search);
    params.delete("photo");
    router.push(`?${params.toString()}`, { scroll: false });
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center">
      <div className="w-full">
        <ul
          className={cn(
            "grid gap-4 justify-items-center",
            user
              ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
          )}
        >
          {photos.map((photo, i) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              index={i}
              onOpen={openLightbox}
              onEdit={handleEditClick}
              isSelected={isSelected(photo.id)}
              toggleSelection={toggleSelection}
              user={user}
            />
          ))}
        </ul>

        <Lightbox
          index={index}
          open={index >= 0}
          close={closeLightbox}
          plugins={[Zoom, Captions]}
          carousel={{ spacing: 0, padding: 0 }}
          on={{
            view: ({ index: newIndex }) => {
              if (newIndex !== index) {
                setIndex(newIndex);
                const photoId = photos[newIndex]?.id;
                if (photoId) {
                  isUpdatingUrl.current = true;
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("photo", photoId);
                  router.push(`?${params.toString()}`, { scroll: false });
                }
              }
            },
          }}
          slides={photos.map((photo) => ({
            src: photo.url,
            title: photo.headline || photo.filename,
            description: photo.date as string,
            width: photo.dim?.[0],
            height: photo.dim?.[1],
          }))}
        />
        {hasMore && (
          <div ref={loader} className="p-4 text-center text-muted-foreground">
            {loading ? "Loading more..." : "Scroll to load more"}
          </div>
        )}
      </div>

      {/* Edit Photo Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="w-full max-w-full h-full sm:h-auto sm:max-w-3xl overflow-y-auto sm:rounded-lg rounded-none border-0 sm:border">
          <DialogHeader>
            <DialogTitle>
              Photo details
              {photoToEdit?.size
                ? ` ${(photoToEdit.size / (1024 * 1024)).toFixed(2)} MB`
                : ""}
              {photoToEdit?.dim ? ` ${photoToEdit.dim.join(" x ")}` : ""}
            </DialogTitle>
          </DialogHeader>
          {photoToEdit && (
            <EditForm photo={photoToEdit} onSave={handleEditSave} />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function ListPage() {
  return (
    <Suspense>
      <ListPageContent />
    </Suspense>
  );
}

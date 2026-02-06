"use client";

import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { bucketCollection, photoCollection } from "./helpers/collections";
import { BucketType, PhotoType } from "./helpers/models";
import { useCounters } from "./context/CountersContext";
import Link from "next/link";
import { useAuth } from "./context/AuthContext";
import { Button } from "@/components/ui/button";
import { CONFIG } from "./helpers";
import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  const [bucket, setBucket] = useState<BucketType | null>(null);
  const [lastPhoto, setLastPhoto] = useState<PhotoType | null>(null);
  const { values } = useCounters();
  const { user } = useAuth();
  const since = Object.keys(values.values.year)[0] || new Date().getFullYear();

  useEffect(() => {
    const bucketRef = doc(bucketCollection, "total");
    const fetchBucket = async () => {
      try {
        const docSnap = await getDoc(bucketRef);

        if (docSnap.exists()) {
          const bucketData = docSnap.data() as BucketType;
          setBucket(bucketData);
          localStorage.setItem("bucket", JSON.stringify(bucketData));
        } else {
          console.log("No such document!");
        }
      } catch (error) {
        console.error("Error getting document:", error);
      }
    };

    const fetchLastPhoto = async () => {
      try {
        const q = query(photoCollection, orderBy("date", "desc"), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const photoData = querySnapshot.docs[0].data() as PhotoType;
          setLastPhoto(photoData);
          localStorage.setItem("lastPhoto", JSON.stringify(photoData));
        } else {
          console.log("No photos found");
        }
      } catch (error) {
        console.error("Error getting last photo:", error);
      }
    };

    const savedBucket = localStorage.getItem("bucket");
    if (savedBucket) {
      try {
        setBucket(JSON.parse(savedBucket));
      } catch (e) {
        console.error("Error parsing bucket from localStorage", e);
      }
    }

    const savedLastPhoto = localStorage.getItem("lastPhoto");
    if (savedLastPhoto) {
      try {
        setLastPhoto(JSON.parse(savedLastPhoto));
      } catch (e) {
        console.error("Error parsing lastPhoto from localStorage", e);
      }
    }

    fetchBucket();
    fetchLastPhoto();
  }, []);

  return (
    <div className="relative grid grid-cols-1 md:grid-cols-2 grid-rows-2 md:grid-rows-1 h-screen">
      <Link
        href="/list"
        className="relative flex items-center justify-center bg-cover bg-center group"
        style={{
          backgroundImage: lastPhoto ? `url(${lastPhoto.url})` : undefined,
        }}
      >
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

        <Button
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const { getAuth, signInWithPopup, GoogleAuthProvider, signOut } =
              await import("firebase/auth");
            const auth = getAuth();
            if (auth.currentUser) {
              await signOut(auth);
            } else {
              await signInWithPopup(auth, new GoogleAuthProvider());
            }
          }}
          className="absolute top-4 left-4 z-20 px-4 py-3 rounded-full hover:opacity-80 transition-all font-medium"
        >
          {user ? `Sign Out ${user.name}` : "Sign In"}
        </Button>
      </Link>

      <div className="flex items-center justify-center p-4 bg-background">
        <div className="grid-cols-1 text-center w-full max-w-sm mx-auto">
          <Image
            className="mx-auto m-4 opacity-80 pointer-events-none"
            src="/apperture.svg"
            width={80}
            height={80}
            alt="Logo"
          />
          <h1 className="text-4xl font-thin">{CONFIG.title}</h1>
          {bucket && (
            <p className="mt-2 text-sm text-muted-foreground mb-6">
              {bucket.count} photos since {since} and counting
            </p>
          )}

          <div className="fixed bottom-4 right-4 z-20">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}

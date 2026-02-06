"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth } from "../firebase";
import { userCollection } from "../helpers/collections";
import { MyUserType } from "../helpers/models";
import { CONFIG } from "../helpers";

interface AuthContextType {
  user: MyUserType | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MyUserType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setLoading(true);
      if (authUser) {
        const userRef = doc(userCollection, authUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data() as MyUserType;
          userData.isAdmin = CONFIG.adminMap.has(userData.email);
          setUser(userData);
          await setDoc(
            userRef,
            { ...userData, timestamp: serverTimestamp() },
            { merge: true },
          );
        } else {
          const newUser: MyUserType = {
            uid: authUser.uid,
            name: authUser.displayName || "",
            email: authUser.email || "",
            nick: "",
            isAuthorized: false,
            isAdmin: authUser.email
              ? CONFIG.adminMap.has(authUser.email)
              : false,
            allowPush: false,
            timestamp: Timestamp.now(),
          };
          await setDoc(userRef, {
            ...newUser,
            timestamp: serverTimestamp(),
          });
          setUser(newUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

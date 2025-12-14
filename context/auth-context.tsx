'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { ADMIN_UID } from "@/lib/constants";
import { doc, getDoc } from "firebase/firestore";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error?: string;
  isAdmin: boolean;
  isAllowed: boolean;
  role?: "admin" | "staff";
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [isAllowed, setIsAllowed] = useState<boolean>(false);
  const [role, setRole] = useState<"admin" | "staff" | undefined>();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (current) => {
      setUser(current);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const checkWhitelist = async () => {
      if (!user) {
        setIsAllowed(false);
        setRole(undefined);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data() as { active?: boolean; role?: "admin" | "staff" };
          setIsAllowed(data.active !== false);
          setRole(data.role ?? "staff");
        } else {
          setIsAllowed(false);
          setRole(undefined);
        }
      } catch (err) {
        console.error(err);
        setIsAllowed(false);
        setRole(undefined);
      }
    };
    void checkWhitelist();
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(undefined);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      setError("Unable to sign in. Check credentials.");
      setLoading(false);
      throw err;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      isAdmin: (!!user && user.uid === ADMIN_UID) || role === "admin",
      isAllowed: !!user && isAllowed,
      role,
      signIn,
      signOut: signOutUser,
    }),
    [error, isAllowed, loading, role, signIn, signOutUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

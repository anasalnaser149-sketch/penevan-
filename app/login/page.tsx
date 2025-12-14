'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      router.replace("/");
    }
  }, [loading, router, user]);

  if (user) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-slate-100">
      <div className="flex items-center gap-3 text-slate-300">
        <Loader2 className="h-5 w-5 animate-spin text-red-500" />
        <span>Loading login...</span>
      </div>
    </div>
  );
}

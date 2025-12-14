'use client';

import { useState } from "react";
import { ShieldAlert, Loader2, Copy } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, isAllowed, signIn, signOut, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(undefined);
    try {
      await signIn(email, password);
    } catch (error) {
      console.error(error);
      setFormError("Login failed. Check your credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex items-center gap-3 text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-red-500" />
          <span>Checking access…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-white">
              Sign in to Penevan
            </CardTitle>
            <p className="text-sm text-slate-400">
              Admin access required. Your UID must match the configured admin UID.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {(formError || error) && (
                <p className="text-sm text-red-400">{formError || error}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !email || !password}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user && !isAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <Card className="max-w-lg space-y-4">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="rounded-full bg-red-900/60 p-2 text-red-300">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl text-white">Access Denied</CardTitle>
              <p className="text-sm text-slate-400">
                Your UID is not whitelisted. Share it with the admin to gain access.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <p className="text-xs uppercase text-slate-500">Your UID</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="break-all font-mono text-sm text-white">
                  {user.uid}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-800"
                  onClick={() => navigator.clipboard.writeText(user.uid)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => signOut()}>
                Switch account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <Card className="max-w-lg">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="rounded-full bg-red-900/60 p-2 text-red-300">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl text-white">Admin Only</CardTitle>
              <p className="text-sm text-slate-400">
                This app is restricted. Contact the admin for access.
              </p>
            </div>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Button variant="outline" onClick={() => signOut()}>
              Switch account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

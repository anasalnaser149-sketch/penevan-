'use client';

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addUserToWhitelist } from "@/lib/firestore-actions";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { resetTenantData } from "@/lib/functions-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function SettingsPage() {
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string>();
  const [resetStatus, setResetStatus] = useState<string>();
  const { tenantId, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  const handleAddUser = async () => {
    setSaving(true);
    setMessage(undefined);
    try {
      await addUserToWhitelist({ uid: uid.trim(), email: email.trim(), role });
      setMessage("User added to whitelist.");
      setUid("");
      setEmail("");
    } catch (err) {
      console.error(err);
      setMessage("Failed to add user.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (resetConfirm !== "RESET" || !tenantId) {
      setResetError("Type RESET to confirm.");
      return;
    }
    setResetLoading(true);
    setResetError(undefined);
    setResetStatus(undefined);
    try {
      await resetTenantData();
      setResetStatus("All tenant data has been cleared.");
      setResetConfirm("");
      setResetOpen(false);
    } catch (err: any) {
      console.error(err);
      const errorMessage = err?.message || "Failed to reset data. Please try again.";
      setResetError(errorMessage);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-4">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <h1 className="text-3xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-slate-400">Manage access for teammates.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage your account settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full border-slate-800 text-slate-100 hover:bg-slate-900 sm:w-auto"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Whitelisted User</CardTitle>
          <CardDescription>
            Paste a UID to grant access immediately. Role controls admin permissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>UID</Label>
            <Input
              placeholder="Firebase UID"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <select
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-base text-slate-100"
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "staff")}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button
            className="w-full sm:w-auto"
            disabled={saving || !uid || !email || !tenantId}
            onClick={handleAddUser}
          >
            {saving ? "Saving..." : "Add User"}
          </Button>
          {message && <p className="text-sm text-slate-300">{message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reset Data</CardTitle>
          <CardDescription>
            Permanently remove tenant data via secured Cloud Function.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Dialog
            open={resetOpen}
            onOpenChange={(open) => {
              setResetOpen(open);
              if (!open) {
                setResetError(undefined);
                setResetConfirm("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto">
                Reset All Data
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset All Data</DialogTitle>
                <DialogDescription>
                  This will permanently delete all stores, inventory, sales, and payments.
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-slate-300">Type RESET to confirm.</p>
              <Input
                placeholder="RESET"
                value={resetConfirm}
                onChange={(e) => {
                  setResetConfirm(e.target.value);
                  if (resetError) setResetError(undefined);
                }}
              />
              {resetError && <p className="text-sm text-red-400">{resetError}</p>}
              {resetStatus && <p className="text-sm text-emerald-300">{resetStatus}</p>}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setResetOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReset}
                  disabled={resetConfirm !== "RESET" || resetLoading || !tenantId}
                >
                  {resetLoading ? "Resetting..." : "Confirm Reset"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

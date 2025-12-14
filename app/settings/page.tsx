'use client';

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addUserToWhitelist } from "@/lib/firestore-actions";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();

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

  return (
    <div className="space-y-6 pb-4">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <h1 className="text-3xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-slate-400">Manage access for teammates.</p>
      </div>

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
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "staff")}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button
            className="w-full sm:w-auto"
            disabled={saving || !uid || !email}
            onClick={handleAddUser}
          >
            {saving ? "Saving..." : "Add User"}
          </Button>
          {message && <p className="text-sm text-slate-300">{message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

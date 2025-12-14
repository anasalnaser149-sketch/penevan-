'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Pencil, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { db } from "@/lib/firebase";
import { createStore, updateStore } from "@/lib/firestore-actions";
import { Store, StoreBalance } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [balances, setBalances] = useState<Record<string, StoreBalance>>({});
  const [storeForm, setStoreForm] = useState({
    name: "",
    phone: "",
    location: "",
    notes: "",
  });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { tenantId } = useAuth();

  useEffect(() => {
    if (!tenantId) return undefined;
    const storeQuery = query(collection(db, "stores"), where("tenantId", "==", tenantId));
    const unsubStores = onSnapshot(storeQuery, (snap) => {
      setStores(
        snap.docs.map((doc) => {
          const data = doc.data() as Omit<Store, "id"> & Partial<Store>;
          return { ...data, id: doc.id };
        }),
      );
    });
    const balanceQuery = query(
      collection(db, "store_balances"),
      where("tenantId", "==", tenantId),
    );
    const unsubBalances = onSnapshot(balanceQuery, (snap) => {
      const map: Record<string, StoreBalance> = {};
      snap.forEach((doc) => (map[doc.id] = doc.data() as StoreBalance));
      setBalances(map);
    });
    return () => {
      unsubStores();
      unsubBalances();
    };
  }, [tenantId]);

  const handleCreate = async () => {
    if (!tenantId) return;
    setSaving(true);
    await createStore({ ...storeForm, active: true, tenantId });
    setSaving(false);
    setOpen(false);
    setStoreForm({ name: "", phone: "", location: "", notes: "" });
  };

  const toggleActive = async (store: Store) => {
    if (!tenantId) return;
    await updateStore(store.id, { active: !store.active }, tenantId);
  };

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
            Stores
          </p>
          <h1 className="text-3xl font-semibold text-white">Store Directory</h1>
          <p className="text-sm text-slate-400">
            Manage locations and health.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full md:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Store
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Store</DialogTitle>
              <DialogDescription>
                Add a location you consign to.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Name"
                value={storeForm.name}
                onChange={(e) =>
                  setStoreForm((s) => ({ ...s, name: e.target.value }))
                }
              />
              <Input
                placeholder="Phone"
                value={storeForm.phone}
                onChange={(e) =>
                  setStoreForm((s) => ({ ...s, phone: e.target.value }))
                }
              />
              <Input
                placeholder="Location"
                value={storeForm.location}
                onChange={(e) =>
                  setStoreForm((s) => ({ ...s, location: e.target.value }))
                }
              />
              <Textarea
                placeholder="Notes"
                value={storeForm.notes}
                onChange={(e) =>
                  setStoreForm((s) => ({ ...s, notes: e.target.value }))
                }
              />
              <Button
                className="w-full"
                disabled={saving || !storeForm.name || !tenantId}
                onClick={handleCreate}
              >
                {saving ? "Saving..." : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {stores.map((store) => {
          const balance = balances[store.id]?.currentBalance ?? 0;
          const debt = balance > 0;
          return (
            <Card
              key={store.id}
              className="border border-slate-800 bg-slate-900/70 h-auto"
            >
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-white">{store.name}</CardTitle>
                  <CardDescription>{store.location}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-400 hover:text-white"
                  onClick={() => toggleActive(store)}
                >
                  {store.active ? (
                    <ToggleRight className="h-5 w-5" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Pencil className="h-4 w-4" />
                  {store.notes || "No notes"}
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                  <div className="text-sm uppercase text-slate-500">Balance</div>
                  <div
                    className={`text-lg font-semibold ${
                      debt ? "text-red-300" : "text-emerald-300"
                    }`}
                  >
                    {formatMoney(balance)}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                    <Link href={`/stores/${store.id}`}>Open</Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    className="w-full text-slate-300 sm:w-auto"
                  >
                    <a
                      href={`https://wa.me/${store.phone || ""}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

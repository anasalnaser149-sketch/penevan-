'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import {
  AlertCircle,
  Banknote,
  MessageCircle,
  Phone,
  Plus,
  Store as StoreIcon,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { createStore } from "@/lib/firestore-actions";
import { OWNER_PHONE } from "@/lib/constants";
import { Store as StoreType, StoreBalance, SalesRecord } from "@/lib/types";
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
import { startOfDay, endOfDay } from "date-fns";

export default function DashboardPage() {
  const [stores, setStores] = useState<StoreType[]>([]);
  const [balances, setBalances] = useState<Record<string, StoreBalance>>({});
  const [salesToday, setSalesToday] = useState<SalesRecord[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [storeForm, setStoreForm] = useState({
    name: "",
    phone: "",
    location: "",
    notes: "",
  });
  const { tenantId } = useAuth();

  useEffect(() => {
    if (!tenantId) return undefined;
    const storesQuery = query(collection(db, "stores"), where("tenantId", "==", tenantId));
    const unsubStores = onSnapshot(storesQuery, (snap) => {
      setStores(
        snap.docs.map((doc) => {
          const data = doc.data() as Omit<StoreType, "id"> & Partial<StoreType>;
          return { ...data, id: doc.id } as StoreType;
        }),
      );
    });

    const balanceQuery = query(
      collection(db, "store_balances"),
      where("tenantId", "==", tenantId),
    );
    const unsubBalances = onSnapshot(balanceQuery, (snap) => {
      const next: Record<string, StoreBalance> = {};
      snap.forEach((doc) => {
        next[doc.id] = { ...(doc.data() as StoreBalance) };
      });
      setBalances(next);
    });

    const todayStart = Timestamp.fromDate(startOfDay(new Date()));
    const todayEnd = Timestamp.fromDate(endOfDay(new Date()));
    const salesQuery = query(
      collection(db, "sales_records"),
      where("tenantId", "==", tenantId),
      where("date", ">=", todayStart),
      where("date", "<=", todayEnd),
    );
    const unsubSales = onSnapshot(salesQuery, (snap) => {
      setSalesToday(
        snap.docs.map((doc) => {
          const data = doc.data() as Omit<SalesRecord, "id"> & Partial<SalesRecord>;
          return { ...data, id: doc.id } as SalesRecord;
        }),
      );
    });

    return () => {
      unsubStores();
      unsubBalances();
      unsubSales();
    };
  }, [tenantId]);

  const totalOutstanding = useMemo(() => {
    return Object.values(balances).reduce(
      (sum, bal) => sum + Math.max(bal.currentBalance ?? 0, 0),
      0,
    );
  }, [balances]);

  const storesWithDebt = stores.filter(
    (store) => (balances[store.id]?.currentBalance ?? 0) > 0,
  );
  const storesClear = stores.filter(
    (store) => (balances[store.id]?.currentBalance ?? 0) <= 0,
  );

  const handleCreateStore = async () => {
    if (!tenantId) return;
    setCreating(true);
    await createStore({
      ...storeForm,
      active: true,
      tenantId,
    });
    setCreating(false);
    setDialogOpen(false);
    setStoreForm({ name: "", phone: "", location: "", notes: "" });
  };

  const dailyReportMessage = useMemo(() => {
    const validSales = salesToday.filter((sale) => !sale.voided);
    const totalSales = validSales.reduce((sum, sale) => sum + (sale.totalAmount ?? 0), 0);
    const totalTickets = validSales.length;
    return `Penevan daily report:
${new Date().toLocaleDateString()}
Sales tickets: ${totalTickets}
Total sales: ${formatMoney(totalSales)}`;
  }, [salesToday]);

  const sendDailyReport = () => {
    const url = `https://wa.me/${OWNER_PHONE}?text=${encodeURIComponent(
      dailyReportMessage,
    )}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
            Overview
          </p>
          <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            variant="outline"
            className="w-full border-slate-800 text-slate-100 sm:w-auto"
            onClick={sendDailyReport}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Send Daily Report
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" /> Add Store
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Store</DialogTitle>
                <DialogDescription>
                  Create a store to start tracking deliveries and balances.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="Store name"
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
                  onClick={handleCreateStore}
                  disabled={creating || !storeForm.name || !tenantId}
                  className="w-full"
                >
                  {creating ? "Saving..." : "Create Store"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-950">
          <CardHeader>
            <CardDescription>Total Outstanding</CardDescription>
            <CardTitle className="text-3xl text-red-400">
              {formatMoney(totalOutstanding)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Stores with Debt</CardDescription>
            <CardTitle className="text-xl text-red-300">
              {storesWithDebt.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Cleared Stores</CardDescription>
            <CardTitle className="text-xl text-emerald-300">
              {storesClear.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-red-500/30">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-red-200">
                Stores with Debt
              </CardTitle>
              <CardDescription>
                Active accounts that owe you money.
              </CardDescription>
            </div>
            <AlertCircle className="h-5 w-5 text-red-400" />
          </CardHeader>
          <CardContent className="space-y-3">
            {storesWithDebt.length === 0 && (
              <p className="text-sm text-slate-400">No outstanding balances.</p>
            )}
            {storesWithDebt.map((store) => {
              const balance = balances[store.id]?.currentBalance ?? 0;
              return (
                <Link
                  href={`/stores/${store.id}`}
                  key={store.id}
                  className="flex items-center justify-between rounded-xl border border-red-900/50 bg-red-950/30 p-4 transition hover:-translate-y-0.5 hover:border-red-500/60"
                >
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {store.name}
                    </p>
                    <p className="text-sm text-slate-400">{store.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase text-slate-500">Balance</p>
                    <p className="text-xl font-semibold text-red-300">
                      {formatMoney(balance)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-emerald-200">
                Stores with No Debt
              </CardTitle>
              <CardDescription>
                Accounts at zero or credit balance.
              </CardDescription>
            </div>
            <Banknote className="h-5 w-5 text-emerald-400" />
          </CardHeader>
          <CardContent className="space-y-3">
            {storesClear.length === 0 && (
              <p className="text-sm text-slate-400">No stores yet.</p>
            )}
            {storesClear.map((store) => {
              const balance = balances[store.id]?.currentBalance ?? 0;
              return (
                <Link
                  href={`/stores/${store.id}`}
                  key={store.id}
                  className="flex items-center justify-between rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 transition hover:-translate-y-0.5 hover:border-emerald-500/60"
                >
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {store.name}
                    </p>
                    <p className="text-sm text-slate-400">{store.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase text-slate-500">Balance</p>
                    <p className="text-xl font-semibold text-emerald-300">
                      {formatMoney(balance)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StoreIcon className="h-5 w-5 text-slate-400" />
            All Stores
          </CardTitle>
          <CardDescription>Quick actions and balances.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          {stores.length === 0 && (
            <p className="text-sm text-slate-400">
              Add your first store to begin tracking deliveries.
            </p>
          )}
          {stores.map((store) => {
            const balance = balances[store.id]?.currentBalance ?? 0;
            const debt = balance > 0;
            return (
              <div
                key={store.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {store.name}
                    </p>
                    <p className="text-sm text-slate-400">{store.location}</p>
                  </div>
                  <div
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      debt
                        ? "bg-red-900/40 text-red-200"
                        : "bg-emerald-900/30 text-emerald-200"
                    }`}
                  >
                    {debt ? "Owes" : "Clear"}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{store.phone || "N/A"}</span>
                  </div>
                  <p className={debt ? "text-red-300" : "text-emerald-300"}>
                    {formatMoney(balance)}
                  </p>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button
                    asChild
                    variant="outline"
                    className="w-full border-slate-800 sm:w-auto"
                  >
                    <Link href={`/stores/${store.id}`}>Open</Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    className="w-full text-slate-300 hover:text-white sm:w-auto"
                  >
                    <a
                      href={`https://wa.me/${store.phone || ""}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import {
  Archive,
  Banknote,
  Download,
  MessageCircle,
  Package,
  Plus,
  RefreshCcw,
  Wallet,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "@/lib/firebase";
import {
  recordDelivery,
  recordPayment,
  recordStockCount,
  setStorePricing,
  updateStore,
} from "@/lib/firestore-actions";
import {
  InventoryLog,
  Payment,
  Product,
  SalesRecord,
  Store,
  StoreBalance,
  StorePricing,
} from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  storeId: string;
};

const toDate = (value?: Timestamp) => (value ? value.toDate() : new Date());

export default function StoreDetailClient({ storeId }: Props) {
  const [store, setStore] = useState<Store | null>(null);
  const [balance, setBalance] = useState<StoreBalance | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [pricing, setPricing] = useState<StorePricing[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryProduct, setDeliveryProduct] = useState("");
  const [deliveryQty, setDeliveryQty] = useState(0);

  const [countValues, setCountValues] = useState<Record<string, number>>({});
  const [countMessage, setCountMessage] = useState<string>();

  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentNote, setPaymentNote] = useState<string>("");

  const [updatingStore, setUpdatingStore] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    const unsubStore = onSnapshot(doc(db, "stores", storeId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Omit<Store, "id"> & Partial<Store>;
        setStore({ ...data, id: snap.id });
      }
    });

    const unsubBalance = onSnapshot(doc(db, "store_balances", storeId), (snap) => {
      if (snap.exists()) {
        setBalance(snap.data() as StoreBalance);
      }
    });

    const unsubProducts = onSnapshot(collection(db, "products"), (snap) => {
      setProducts(
        snap.docs.map((doc) => {
          const data = doc.data() as Omit<Product, "id"> & Partial<Product>;
          return { ...data, id: doc.id };
        }),
      );
    });

    const pricingQuery = query(
      collection(db, "store_pricing"),
      where("storeId", "==", storeId),
    );
    const unsubPricing = onSnapshot(pricingQuery, (snap) => {
      setPricing(
        snap.docs.map((doc) => {
          const data = doc.data() as Omit<StorePricing, "id"> & Partial<StorePricing>;
          return { ...data, id: doc.id };
        }),
      );
    });

    const logsQuery = query(
      collection(db, "inventory_log"),
      where("storeId", "==", storeId),
      orderBy("date", "desc"),
    );
    const unsubLogs = onSnapshot(logsQuery, (snap) => {
      setInventoryLogs(
        snap.docs.map((doc) => {
          const data = doc.data() as Omit<InventoryLog, "id"> & Partial<InventoryLog>;
          return { ...data, id: doc.id };
        }),
      );
    });

    const salesQuery = query(
      collection(db, "sales_records"),
      where("storeId", "==", storeId),
      orderBy("date", "desc"),
    );
    const unsubSales = onSnapshot(salesQuery, (snap) => {
      setSalesRecords(
        snap.docs.map((doc) => {
          const data = doc.data() as Omit<SalesRecord, "id"> & Partial<SalesRecord>;
          return { ...data, id: doc.id };
        }),
      );
    });

    const paymentsQuery = query(
      collection(db, "payments"),
      where("storeId", "==", storeId),
      orderBy("date", "desc"),
    );
    const unsubPayments = onSnapshot(paymentsQuery, (snap) => {
      setPayments(
        snap.docs.map((doc) => {
          const data = doc.data() as Omit<Payment, "id"> & Partial<Payment>;
          return { ...data, id: doc.id };
        }),
      );
    });

    return () => {
      unsubStore();
      unsubBalance();
      unsubProducts();
      unsubPricing();
      unsubLogs();
      unsubSales();
      unsubPayments();
    };
  }, [storeId]);

  useEffect(() => {
    if (!balance?.currentStock) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountValues(balance.currentStock);
  }, [balance?.currentStock]);

  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    pricing.forEach((p) => map.set(p.productId, p.price));
    return map;
  }, [pricing]);

  const whatsappLink = useMemo(() => {
    if (!store) return "#";
    const amount = formatMoney(balance?.currentBalance ?? 0);
    const text = `Hello ${store.name}. Penevan update: Your total outstanding balance is ${amount}. Please arrange payment.`;
    return `https://wa.me/${store.phone || ""}?text=${encodeURIComponent(text)}`;
  }, [balance?.currentBalance, store]);

  const handleDelivery = async () => {
    if (!deliveryProduct || deliveryQty <= 0) return;
    await recordDelivery({
      storeId,
      productId: deliveryProduct,
      quantity: deliveryQty,
    });
    setDeliveryQty(0);
    setDeliveryOpen(false);
  };

  const handleCount = async () => {
    const counts = products.map((product) => ({
      productId: product.id,
      quantity: Number(
        countValues[product.id] ??
          balance?.currentStock?.[product.id] ??
          0,
      ),
    }));
    try {
      const res = await recordStockCount({
        storeId,
        counts,
        pricingMap: priceMap,
        products,
      });
      setCountMessage(
        res.totalAmount > 0
          ? `Sales recorded. Added ${formatMoney(res.totalAmount)} to balance.`
          : "Stock updated. No sales detected.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save count.";
      setCountMessage(message);
    }
  };

  const handlePayment = async () => {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) return;
    await recordPayment({ storeId, amount, note: paymentNote });
    setPaymentAmount("");
    setPaymentNote("");
  };

  const setPricingForProduct = async (productId: string, price: number) => {
    await setStorePricing({ storeId, productId, price });
  };

  const timeline = useMemo(() => {
    const entries = [
      ...inventoryLogs.map((log) => ({
        id: log.id,
        type: log.type === "DELIVERY" ? "Delivery" : "Count",
        date: log.date,
        amount: 0,
        detail: log.items.map((i) => `${i.productId}: ${i.quantity}`).join(", "),
      })),
      ...salesRecords.map((sale) => ({
        id: sale.id,
        type: "Sale",
        date: sale.date,
        amount: sale.totalAmount,
        detail: `${sale.items.length} items`,
      })),
      ...payments.map((p) => ({
        id: p.id,
        type: "Payment",
        date: p.date as Timestamp,
        amount: -Math.abs(p.amount),
        detail: p.note || "",
      })),
    ];
    return entries.sort(
      (a, b) => toDate(b.date).getTime() - toDate(a.date).getTime(),
    );
  }, [inventoryLogs, payments, salesRecords]);

  const downloadStatement = () => {
    if (!store) return;
    const docPdf = new jsPDF();
    docPdf.setTextColor(10);
    docPdf.setFontSize(16);
    docPdf.text("Penevan Statement", 14, 18);
    docPdf.setFontSize(11);
    docPdf.text(`${store.name}`, 14, 26);

    const rows: (string | number)[][] = [];
    let running = 0;
    const ordered = [...timeline].sort(
      (a, b) => toDate(a.date).getTime() - toDate(b.date).getTime(),
    );
    ordered.forEach((entry) => {
      running += entry.amount;
      rows.push([
        formatDate(toDate(entry.date)),
        entry.type,
        formatMoney(entry.amount),
        formatMoney(running),
      ]);
    });

    autoTable(docPdf, {
      head: [["Date", "Type", "Amount", "Running Balance"]],
      body: rows,
      styles: { fillColor: [10, 10, 10], textColor: 230 },
      headStyles: { fillColor: [20, 20, 20], textColor: 230 },
      startY: 34,
    });
    const finalY = (docPdf as any).lastAutoTable?.finalY as number | undefined;
    docPdf.text(
      `Total Due: ${formatMoney(balance?.currentBalance ?? running)}`,
      14,
      finalY ? finalY + 10 : 44,
    );
    docPdf.save(`${store.name}-statement.pdf`);
  };

  const currentBalance = balance?.currentBalance ?? 0;

  if (!store) {
    return <div className="text-slate-400">Loading store...</div>;
  }

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
            Store
          </p>
          <h1 className="text-3xl font-semibold text-white">{store.name}</h1>
          <p className="text-sm text-slate-400">{store.phone}</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <Button
            variant="outline"
            className="w-full border-slate-800 text-slate-100 sm:w-auto"
            asChild
          >
            <a href={whatsappLink} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp Store
            </a>
          </Button>
          <div className="rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-right">
            <p className="text-xs uppercase text-slate-500">Total Debt</p>
            <p className="text-3xl font-semibold text-red-300">
              {formatMoney(currentBalance)}
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="actions">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-slate-400" />
                  Deliver Stock
                </CardTitle>
                <CardDescription>
                  Add delivered quantities to tracked stock.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog open={deliveryOpen} onOpenChange={setDeliveryOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      New Delivery
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delivery</DialogTitle>
                      <DialogDescription>
                        Select a product and quantity delivered.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Label>Product</Label>
                      <select
                        className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                        value={deliveryProduct}
                        onChange={(e) => setDeliveryProduct(e.target.value)}
                      >
                        <option value="">Select product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={deliveryQty}
                        onChange={(e) => setDeliveryQty(Number(e.target.value))}
                      />
                      <Button
                        disabled={!deliveryProduct || deliveryQty <= 0}
                        onClick={handleDelivery}
                        className="w-full sm:w-auto"
                      >
                        Save Delivery
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCcw className="h-5 w-5 text-slate-400" />
                  Stock Check
                </CardTitle>
                <CardDescription>
                  Enter physical count to calculate sales and update balances.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                    >
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span>{product.name}</span>
                        <span className="text-xs text-slate-500">
                          On hand: {balance?.currentStock?.[product.id] ?? 0}
                        </span>
                      </div>
                      <Input
                        className="mt-2"
                        type="number"
                        value={countValues[product.id] ?? ""}
                        onChange={(e) =>
                          setCountValues((prev) => ({
                            ...prev,
                            [product.id]: Number(e.target.value),
                          }))
                        }
                        placeholder="Counted"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Unit price:{" "}
                        {formatMoney(priceMap.get(product.id) ?? product.defaultPrice)}
                      </p>
                    </div>
                  ))}
                </div>
                <Button variant="success" onClick={handleCount} className="w-full sm:w-auto">
                  Save Count
                </Button>
                {countMessage && (
                  <p className="text-sm text-slate-300">{countMessage}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-slate-400" />
                Add Payment
              </CardTitle>
              <CardDescription>Record a payment to reduce debt.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <Input
                type="number"
                placeholder="Amount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
              <Input
                placeholder="Note"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
              />
              <Button
                variant="outline"
                className="border-slate-800 w-full sm:w-auto"
                onClick={handlePayment}
                disabled={!paymentAmount}
              >
                Apply Payment
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
                Timeline
              </p>
              <h2 className="text-xl font-semibold text-white">History</h2>
            </div>
            <Button variant="outline" onClick={downloadStatement} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Download Statement
            </Button>
          </div>
          <Card>
            <CardContent className="space-y-3 py-4">
              {timeline.length === 0 && (
                <p className="text-sm text-slate-400">
                  No history yet. Run a delivery or count to begin.
                </p>
              )}
              {timeline.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-slate-900/80 p-2">
                      {entry.type === "Sale" && (
                        <Banknote className="h-5 w-5 text-emerald-300" />
                      )}
                      {entry.type === "Payment" && (
                        <Wallet className="h-5 w-5 text-red-300" />
                      )}
                      {entry.type === "Delivery" && (
                        <Package className="h-5 w-5 text-slate-300" />
                      )}
                      {entry.type === "Count" && (
                        <Archive className="h-5 w-5 text-slate-300" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">
                        {formatDate(toDate(entry.date))}
                      </p>
                      <p className="text-base font-semibold text-white">
                        {entry.type}
                      </p>
                      <p className="text-sm text-slate-400">{entry.detail}</p>
                    </div>
                  </div>
                  <div
                    className={`mt-2 text-lg font-semibold sm:mt-0 ${
                      entry.amount > 0
                        ? "text-emerald-300"
                        : entry.amount < 0
                          ? "text-red-300"
                          : "text-slate-200"
                    }`}
                  >
                    {formatMoney(entry.amount)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Store Details</CardTitle>
              <CardDescription>Update phone, location, or notes.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={store.phone}
                  onChange={(e) => setStore((s) => s && { ...s, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={store.location}
                  onChange={(e) =>
                    setStore((s) => s && { ...s, location: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={store.notes}
                  onChange={(e) =>
                    setStore((s) => s && { ...s, notes: e.target.value })
                  }
                />
              </div>
              <Button
                className="w-full sm:col-span-2 sm:w-auto"
                disabled={updatingStore}
                onClick={async () => {
                  if (!store) return;
                  setUpdatingStore(true);
                  await updateStore(store.id, {
                    phone: store.phone,
                    location: store.location,
                    notes: store.notes,
                  });
                  setUpdatingStore(false);
                }}
              >
                Save Store
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Store Pricing</CardTitle>
              <CardDescription>
                Override default prices per product for this store.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white">{product.name}</p>
                    <p className="text-xs text-slate-500">
                      Default {formatMoney(product.defaultPrice)}
                    </p>
                  </div>
                  <Input
                    className="mt-2"
                    type="number"
                    defaultValue={priceMap.get(product.id) ?? product.defaultPrice}
                    onBlur={(e) =>
                      setPricingForProduct(product.id, Number(e.target.value))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

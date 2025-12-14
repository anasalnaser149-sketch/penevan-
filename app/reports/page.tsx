'use client';

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { BarChart3, Download, MessageCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "@/lib/firebase";
import { OWNER_PHONE } from "@/lib/constants";
import { SalesRecord, Store, Payment } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RangeKey = "this-month" | "last-month";

function getRange(key: RangeKey) {
  const now = new Date();
  const start =
    key === "this-month"
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end =
    key === "this-month"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      : new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  return { start, end };
}

export default function ReportsPage() {
  const [range, setRange] = useState<RangeKey>("this-month");
  const [{ sales, payments }, setData] = useState<{
    sales: SalesRecord[];
    payments: Payment[];
  }>({ sales: [], payments: [] });
  const [stores, setStores] = useState<Store[]>([]);
  const { tenantId } = useAuth();

  useEffect(() => {
    if (!tenantId) return undefined;
    const { start, end } = getRange(range);
    const startTs = Timestamp.fromDate(start);
    const endTs = Timestamp.fromDate(end);

    const salesQ = query(
      collection(db, "sales_records"),
      where("tenantId", "==", tenantId),
      where("date", ">=", startTs),
      where("date", "<=", endTs),
    );
    const payQ = query(
      collection(db, "payments"),
      where("tenantId", "==", tenantId),
      where("date", ">=", startTs),
      where("date", "<=", endTs),
    );

    const unsubSales = onSnapshot(salesQ, (snap) => {
      const salesData = snap.docs
        .map((doc) => {
          const data = doc.data() as Omit<SalesRecord, "id"> & Partial<SalesRecord>;
          return { ...data, id: doc.id };
        })
        .sort((a, b) => {
          const aDate = a.date?.toMillis() ?? 0;
          const bDate = b.date?.toMillis() ?? 0;
          return bDate - aDate; // Descending order
        });
      setData((prev) => ({
        ...prev,
        sales: salesData,
      }));
    });
    const unsubPayments = onSnapshot(payQ, (snap) => {
      const paymentsData = snap.docs
        .map((doc) => {
          const data = doc.data() as Omit<Payment, "id"> & Partial<Payment>;
          return { ...data, id: doc.id };
        })
        .sort((a, b) => {
          const aDate = a.date?.toMillis() ?? 0;
          const bDate = b.date?.toMillis() ?? 0;
          return bDate - aDate; // Descending order
        });
      setData((prev) => ({
        ...prev,
        payments: paymentsData,
      }));
    });
    const storesQuery = query(collection(db, "stores"), where("tenantId", "==", tenantId));
    const unsubStores = onSnapshot(storesQuery, (snap) => {
      setStores(
        snap.docs.map((doc) => {
          const data = doc.data() as Omit<Store, "id"> & Partial<Store>;
          return { ...data, id: doc.id };
        }),
      );
    });

    return () => {
      unsubSales();
      unsubPayments();
      unsubStores();
    };
  }, [range, tenantId]);

  const totals = useMemo(() => {
    const activeSales = sales.filter((s) => !s.voided);
    const activePayments = payments.filter((p) => !p.voided);
    const revenue = activeSales.reduce((sum, s) => sum + (s.totalAmount ?? 0), 0);
    const collected = activePayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const perStore = activeSales.reduce<Record<string, number>>((acc, s) => {
      acc[s.storeId] = (acc[s.storeId] ?? 0) + (s.totalAmount ?? 0);
      return acc;
    }, {});
    return { revenue, collected, net: revenue - collected, perStore };
  }, [payments, sales]);

  const monthLabel = useMemo(() => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
    if (range === "this-month") return formatter.format(now);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return formatter.format(lastMonth);
  }, [range]);

  const whatsappText = `Monthly Report (${monthLabel}): Sales ${formatMoney(
    totals.revenue,
  )}, Collected ${formatMoney(totals.collected)}, Net ${formatMoney(totals.net)}.`;

  const sendWhatsApp = () => {
    const url = `https://wa.me/${OWNER_PHONE}?text=${encodeURIComponent(whatsappText)}`;
    window.open(url, "_blank");
  };

  const downloadPdf = () => {
    const docPdf = new jsPDF();
    docPdf.setFontSize(14);
    docPdf.text(`Penevan Monthly Report (${monthLabel})`, 14, 16);
    docPdf.setFontSize(11);
    docPdf.text(
      `Revenue: ${formatMoney(totals.revenue)} | Collected: ${formatMoney(
        totals.collected,
      )} | Net: ${formatMoney(totals.net)}`,
      14,
      24,
    );

    const rows = Object.entries(totals.perStore).map(([storeId, total]) => {
      const storeName = stores.find((s) => s.id === storeId)?.name ?? storeId;
      return [storeName, formatMoney(total)];
    });

    autoTable(docPdf, {
      head: [["Store", "Total Sales"]],
      body: rows,
      styles: { fillColor: [10, 10, 10], textColor: 230 },
      headStyles: { fillColor: [20, 20, 20], textColor: 230 },
      startY: 32,
    });

    docPdf.save(`penevan-report-${monthLabel.replace(" ", "-")}.pdf`);
  };

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Reports</p>
          <h1 className="text-3xl font-semibold text-white">Monthly Summary</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-base text-slate-100 sm:w-auto"
          >
            <option value="this-month">This Month</option>
            <option value="last-month">Last Month</option>
          </select>
          <Button
            variant="outline"
            className="w-full border-slate-800 text-slate-100 sm:w-auto"
            onClick={sendWhatsApp}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            WhatsApp Summary
          </Button>
          <Button className="w-full sm:w-auto" onClick={downloadPdf}>
            <Download className="mr-2 h-4 w-4" />
            PDF Summary
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Card className="bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-slate-200">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-emerald-300">
              {formatMoney(totals.revenue)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-slate-200">Cash Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-white">
              {formatMoney(totals.collected)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-slate-200">Net Change</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-3xl font-semibold ${
                totals.net >= 0 ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {formatMoney(totals.net)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-slate-400" />
          <CardTitle className="text-white">Sales by Store ({monthLabel})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead className="text-right">Total Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(totals.perStore).map(([storeId, total]) => (
                  <TableRow key={storeId}>
                    <TableCell className="font-semibold text-white">
                      {stores.find((s) => s.id === storeId)?.name ?? storeId}
                    </TableCell>
                    <TableCell className="text-right text-slate-200">
                      {formatMoney(total)}
                    </TableCell>
                  </TableRow>
                ))}
                {Object.keys(totals.perStore).length === 0 && (
                  <TableRow>
                    <TableCell className="text-slate-400" colSpan={2}>
                      No sales for this period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

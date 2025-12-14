'use client';

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Plus, Save } from "lucide-react";
import { db } from "@/lib/firebase";
import { createProduct, updateProduct } from "@/lib/firestore-actions";
import { Product } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ id: "", name: "", defaultPrice: "" });
  const [saving, setSaving] = useState(false);
  const { tenantId } = useAuth();

  useEffect(() => {
    if (!tenantId) return undefined;
    const productsQuery = query(
      collection(db, "products"),
      where("tenantId", "==", tenantId),
    );
    const unsub = onSnapshot(productsQuery, (snap) => {
      setProducts(
        snap.docs.map((doc) => {
          const data = doc.data() as Omit<Product, "id"> & Partial<Product>;
          return { ...data, id: doc.id };
        }),
      );
    });
    return () => unsub();
  }, [tenantId]);

  const handleCreate = async () => {
    if (!tenantId) return;
    setSaving(true);
    await createProduct({
      id: form.id || undefined,
      name: form.name,
      defaultPrice: Number(form.defaultPrice || 0),
      tenantId,
    });
    setSaving(false);
    setForm({ id: "", name: "", defaultPrice: "" });
  };

  const handlePriceChange = async (product: Product, value: number) => {
    if (!tenantId) return;
    await updateProduct(product.id, { defaultPrice: value }, tenantId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
            Catalog
          </p>
          <h1 className="text-3xl font-semibold text-white">Products</h1>
          <p className="text-sm text-slate-400">
            Set default consignment prices.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Product</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="ID (optional)"
            value={form.id}
            onChange={(e) => setForm((s) => ({ ...s, id: e.target.value }))}
          />
          <Input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          />
          <Input
            placeholder="Default price"
            type="number"
            value={form.defaultPrice}
            onChange={(e) =>
              setForm((s) => ({ ...s, defaultPrice: e.target.value }))
            }
          />
          <Button
            className="w-full"
            disabled={saving || !form.name || !tenantId}
            onClick={handleCreate}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Product List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="text-right">Default Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-semibold text-white">
                    {product.name}
                  </TableCell>
                  <TableCell className="text-slate-400">{product.id}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Input
                        type="number"
                        className="w-32"
                        defaultValue={product.defaultPrice}
                        onBlur={(e) =>
                          handlePriceChange(product, Number(e.target.value))
                        }
                      />
                      <span className="text-slate-500">
                        {formatMoney(product.defaultPrice)}
                      </span>
                      <Save className="h-4 w-4 text-slate-500" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  InventoryLogItem,
  Product,
  SalesRecordItem,
  Store,
  StoreBalance,
  StorePricing,
  AppUser,
  UserRole,
} from "./types";

export async function createStore(input: Omit<Store, "id">) {
  const id = crypto.randomUUID();
  const ref = doc(db, "stores", id);
  await setDoc(ref, { ...input, id, active: input.active ?? true });
  await setDoc(
    doc(db, "store_balances", id),
    { storeId: id, currentBalance: 0, currentStock: {} },
    { merge: true },
  );
  return id;
}

export async function updateStore(id: string, data: Partial<Store>) {
  const ref = doc(db, "stores", id);
  await setDoc(ref, { ...data, id }, { merge: true });
}

export async function createProduct(input: Omit<Product, "id"> & { id?: string }) {
  const id = input.id ?? crypto.randomUUID();
  await setDoc(doc(db, "products", id), { ...input, id });
  return id;
}

export async function updateProduct(id: string, data: Partial<Product>) {
  const ref = doc(db, "products", id);
  await setDoc(ref, { ...data, id }, { merge: true });
}

export async function setStorePricing(pricing: StorePricing) {
  const id = pricing.id ?? `${pricing.storeId}_${pricing.productId}`;
  await setDoc(doc(db, "store_pricing", id), { ...pricing, id });
}

export async function recordDelivery(params: {
  storeId: string;
  productId: string;
  quantity: number;
}) {
  const { storeId, productId, quantity } = params;
  const balanceRef = doc(db, "store_balances", storeId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(balanceRef);
    const data = (snap.data() as StoreBalance | undefined) ?? {
      storeId,
      currentBalance: 0,
      currentStock: {},
    };

    const updatedStock = {
      ...data.currentStock,
      [productId]: (data.currentStock?.[productId] ?? 0) + quantity,
    };

    tx.set(
      balanceRef,
      {
        storeId,
        currentBalance: data.currentBalance ?? 0,
        currentStock: updatedStock,
      },
      { merge: true },
    );
  });

  await addDoc(collection(db, "inventory_log"), {
    storeId,
    type: "DELIVERY",
    date: Timestamp.now(),
    items: [{ productId, quantity }],
  });
}

export async function recordStockCount(params: {
  storeId: string;
  counts: InventoryLogItem[];
  pricingMap: Map<string, number>;
  products: Product[];
}) {
  const { storeId, counts, pricingMap, products } = params;
  const balanceRef = doc(db, "store_balances", storeId);

  const getPrice = (productId: string) => {
    if (pricingMap.has(productId)) return pricingMap.get(productId)!;
    const product = products.find((p) => p.id === productId);
    return product?.defaultPrice ?? 0;
  };

  let salesItems: SalesRecordItem[] = [];
  let totalAmount = 0;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(balanceRef);
    const data = (snap.data() as StoreBalance | undefined) ?? {
      storeId,
      currentBalance: 0,
      currentStock: {},
    };
    const currentStock = data.currentStock ?? {};
    const nextStock: Record<string, number> = { ...currentStock };

    salesItems = [];
    totalAmount = 0;

    counts.forEach(({ productId, quantity }) => {
      const previous = currentStock[productId] ?? 0;
      const sold = previous - quantity;
      if (sold < 0) {
        throw new Error(
          `Count for product ${productId} exceeds tracked stock (${previous}).`,
        );
      }
      nextStock[productId] = quantity;
      if (sold > 0) {
        const unitPrice = getPrice(productId);
        const total = unitPrice * sold;
        salesItems.push({ productId, quantitySold: sold, unitPrice, total });
        totalAmount += total;
      }
    });

    tx.set(
      balanceRef,
      {
        storeId,
        currentStock: nextStock,
        currentBalance: (data.currentBalance ?? 0) + totalAmount,
      },
      { merge: true },
    );
  });

  await addDoc(collection(db, "inventory_log"), {
    storeId,
    type: "COUNT",
    date: Timestamp.now(),
    items: counts,
  });

  let salesRecordId: string | undefined;
  if (salesItems.length) {
    const salesDoc = await addDoc(collection(db, "sales_records"), {
      storeId,
      date: Timestamp.now(),
      items: salesItems,
      totalAmount,
    });
    salesRecordId = salesDoc.id;
  }

  return { salesRecordId, totalAmount };
}

export async function recordPayment(params: {
  storeId: string;
  amount: number;
  note?: string;
}) {
  const { storeId, amount, note } = params;
  const balanceRef = doc(db, "store_balances", storeId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(balanceRef);
    const data = (snap.data() as StoreBalance | undefined) ?? {
      storeId,
      currentBalance: 0,
      currentStock: {},
    };
    const newBalance = (data.currentBalance ?? 0) - amount;
    tx.set(
      balanceRef,
      { storeId, currentBalance: newBalance, currentStock: data.currentStock },
      { merge: true },
    );
  });

  await addDoc(collection(db, "payments"), {
    storeId,
    amount,
    note,
    date: Timestamp.now(),
  });
}

export async function addUserToWhitelist(user: {
  uid: string;
  email: string;
  role?: UserRole;
}) {
  const payload: AppUser = {
    id: user.uid,
    email: user.email,
    role: user.role ?? "staff",
    active: true,
  };
  await setDoc(doc(db, "users", user.uid), payload, { merge: true });
}

export async function fetchUser(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<AppUser, "id"> & Partial<AppUser>;
  return { ...data, id: snap.id };
}

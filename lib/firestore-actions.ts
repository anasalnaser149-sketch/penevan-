import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  ActivityActionType,
  InventoryLogItem,
  Product,
  SalesRecordItem,
  Store,
  StoreBalance,
  StorePricing,
  AppUser,
  UserRole,
} from "./types";

function assertTenantMatch(existingTenantId: string | undefined, tenantId: string) {
  if (existingTenantId && existingTenantId !== tenantId) {
    throw new Error("Unauthorized access to another tenant's data.");
  }
}

async function logActivity(params: {
  tenantId: string;
  storeId: string;
  actionId: string;
  actionType: ActivityActionType;
  amount: number;
  items?: SalesRecordItem[];
}) {
  const { tenantId, storeId, actionId, actionType, amount, items } = params;
  await addDoc(collection(db, "activityLog"), {
    tenantId,
    storeId,
    actionId,
    actionType,
    amount,
    items: items ?? [],
    voided: false,
    createdAt: Timestamp.now(),
  });
}

export async function createStore(input: Omit<Store, "id">) {
  const id = crypto.randomUUID();
  const ref = doc(db, "stores", id);
  await setDoc(ref, {
    ...input,
    id,
    active: input.active ?? true,
    tenantId: input.tenantId,
  });
  await setDoc(
    doc(db, "store_balances", id),
    { storeId: id, tenantId: input.tenantId, currentBalance: 0, currentStock: {} },
    { merge: true },
  );
  return id;
}

export async function updateStore(id: string, data: Partial<Store>, tenantId: string) {
  const ref = doc(db, "stores", id);
  const snap = await getDoc(ref);
  const existing = snap.data() as Partial<Store> | undefined;
  assertTenantMatch(existing?.tenantId, tenantId);
  await setDoc(ref, { ...data, id, tenantId }, { merge: true });
}

export async function createProduct(input: Omit<Product, "id"> & { id?: string }) {
  const id = input.id ?? crypto.randomUUID();
  await setDoc(doc(db, "products", id), { ...input, id, tenantId: input.tenantId });
  return id;
}

export async function updateProduct(id: string, data: Partial<Product>, tenantId: string) {
  const ref = doc(db, "products", id);
  const snap = await getDoc(ref);
  const existing = snap.data() as Partial<Product> | undefined;
  assertTenantMatch(existing?.tenantId, tenantId);
  await setDoc(ref, { ...data, id, tenantId }, { merge: true });
}

export async function setStorePricing(pricing: StorePricing) {
  const id = pricing.id ?? `${pricing.storeId}_${pricing.productId}`;
  await setDoc(doc(db, "store_pricing", id), { ...pricing, id, tenantId: pricing.tenantId });
}

export async function recordDelivery(params: {
  storeId: string;
  productId: string;
  quantity: number;
  tenantId: string;
}) {
  const { storeId, productId, quantity, tenantId } = params;
  const balanceRef = doc(db, "store_balances", storeId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(balanceRef);
    const data = (snap.data() as StoreBalance | undefined) ?? {
      storeId,
      tenantId,
      currentBalance: 0,
      currentStock: {},
    };
    assertTenantMatch(data.tenantId, tenantId);

    const updatedStock = {
      ...data.currentStock,
      [productId]: (data.currentStock?.[productId] ?? 0) + quantity,
    };

    tx.set(
      balanceRef,
      {
        storeId,
        tenantId,
        currentBalance: data.currentBalance ?? 0,
        currentStock: updatedStock,
      },
      { merge: true },
    );
  });

  await addDoc(collection(db, "inventory_log"), {
    storeId,
    tenantId,
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
  tenantId: string;
}) {
  const { storeId, counts, pricingMap, products, tenantId } = params;
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
      tenantId,
      currentBalance: 0,
      currentStock: {},
    };
    assertTenantMatch(data.tenantId, tenantId);
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
        tenantId,
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
    tenantId,
  });

  let salesRecordId: string | undefined;
  if (salesItems.length) {
    const salesDoc = await addDoc(collection(db, "sales_records"), {
      storeId,
      tenantId,
      date: Timestamp.now(),
      items: salesItems,
      totalAmount,
      voided: false,
    });
    salesRecordId = salesDoc.id;
    await logActivity({
      tenantId,
      storeId,
      actionId: salesDoc.id,
      actionType: "SALE",
      amount: totalAmount,
      items: salesItems,
    });
  }

  return { salesRecordId, totalAmount };
}

export async function recordPayment(params: {
  storeId: string;
  amount: number;
  note?: string;
  tenantId: string;
}) {
  const { storeId, amount, note, tenantId } = params;
  const balanceRef = doc(db, "store_balances", storeId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(balanceRef);
    const data = (snap.data() as StoreBalance | undefined) ?? {
      storeId,
      tenantId,
      currentBalance: 0,
      currentStock: {},
    };
    assertTenantMatch(data.tenantId, tenantId);
    const newBalance = (data.currentBalance ?? 0) - amount;
    tx.set(
      balanceRef,
      { storeId, tenantId, currentBalance: newBalance, currentStock: data.currentStock },
      { merge: true },
    );
  });

  const paymentDoc = await addDoc(collection(db, "payments"), {
    storeId,
    amount,
    note,
    date: Timestamp.now(),
    tenantId,
    voided: false,
  });
  await logActivity({
    tenantId,
    storeId,
    actionId: paymentDoc.id,
    actionType: "PAYMENT",
    amount,
  });
}

export async function voidEntry(params: {
  entryId: string;
  entryType: "SALE" | "PAYMENT";
  storeId: string;
  tenantId: string;
  amount: number;
  items?: SalesRecordItem[];
}) {
  const { entryId, entryType, storeId, tenantId, amount, items } = params;
  const balanceRef = doc(db, "store_balances", storeId);

  await runTransaction(db, async (tx) => {
    const balanceSnap = await tx.get(balanceRef);
    const balanceData = (balanceSnap.data() as StoreBalance | undefined) ?? {
      storeId,
      tenantId,
      currentBalance: 0,
      currentStock: {},
    };
    assertTenantMatch(balanceData.tenantId, tenantId);

    let newBalance = balanceData.currentBalance ?? 0;
    const updatedStock = { ...(balanceData.currentStock || {}) };

    if (entryType === "SALE") {
      // Reverse sale: subtract from balance, add back to stock
      newBalance = newBalance - amount;
      if (items) {
        items.forEach((item) => {
          const qty = item.quantitySold || 0;
          updatedStock[item.productId] = (updatedStock[item.productId] || 0) + qty;
        });
      }
      const saleRef = doc(db, "sales_records", entryId);
      tx.update(saleRef, { voided: true, voidedAt: Timestamp.now() });
    } else if (entryType === "PAYMENT") {
      // Reverse payment: add back to balance
      newBalance = newBalance + amount;
      const paymentRef = doc(db, "payments", entryId);
      tx.update(paymentRef, { voided: true, voidedAt: Timestamp.now() });
    }

    tx.set(
      balanceRef,
      {
        storeId,
        tenantId,
        currentBalance: newBalance,
        currentStock: updatedStock,
      },
      { merge: true },
    );
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

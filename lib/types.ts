import { Timestamp } from "firebase/firestore";

export interface Product {
  id: string;
  name: string;
  defaultPrice: number;
}

export interface Store {
  id: string;
  name: string;
  phone: string;
  location?: string;
  notes?: string;
  active: boolean;
}

export interface StorePricing {
  id?: string;
  storeId: string;
  productId: string;
  price: number;
}

export type InventoryLogType = "DELIVERY" | "COUNT";

export interface InventoryLogItem {
  productId: string;
  quantity: number;
}

export interface InventoryLog {
  id: string;
  storeId: string;
  type: InventoryLogType;
  date: Timestamp;
  items: InventoryLogItem[];
}

export interface SalesRecordItem {
  productId: string;
  quantitySold: number;
  unitPrice: number;
  total: number;
}

export interface SalesRecord {
  id: string;
  storeId: string;
  date: Timestamp;
  items: SalesRecordItem[];
  totalAmount: number;
}

export interface Payment {
  id: string;
  storeId: string;
  amount: number;
  date: Timestamp;
  note?: string;
}

export interface StoreBalance {
  storeId: string;
  currentBalance: number;
  currentStock: Record<string, number>;
}

export interface StoreWithBalance extends Store {
  balance?: StoreBalance;
}

export type UserRole = "admin" | "staff";

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  active: boolean;
}

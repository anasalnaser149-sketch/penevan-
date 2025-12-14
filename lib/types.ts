import { Timestamp } from "firebase/firestore";

export interface Product {
  id: string;
  name: string;
  defaultPrice: number;
  tenantId: string;
}

export interface Store {
  id: string;
  name: string;
  phone: string;
  location?: string;
  notes?: string;
  active: boolean;
  tenantId: string;
}

export interface StorePricing {
  id?: string;
  storeId: string;
  productId: string;
  price: number;
  tenantId: string;
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
  tenantId: string;
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
  tenantId: string;
  voided?: boolean;
}

export interface Payment {
  id: string;
  storeId: string;
  amount: number;
  date: Timestamp;
  note?: string;
  tenantId: string;
  voided?: boolean;
}

export interface StoreBalance {
  storeId: string;
  currentBalance: number;
  currentStock: Record<string, number>;
  tenantId: string;
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

export type ActivityActionType = "SALE" | "PAYMENT";

export interface ActivityLogEntry {
  id: string;
  tenantId: string;
  storeId: string;
  actionId: string;
  actionType: ActivityActionType;
  amount: number;
  createdAt: Timestamp;
  voided: boolean;
  items?: SalesRecordItem[];
}

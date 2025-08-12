// contexts/CartContext.tsx
'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';

export type CartItem = {
  id: string;                 // unique: productId__branchId__variantId__dotCode
  productId: string;
  productName: string;
  specification: string;
  variantId: string;          // ใช้ต่อ path Firestore ตอนชำระเงิน
  dotCode: string;
  quantity: number;
  unitPrice: number;
  sellerBranch: string;       // ชื่อสาขาผู้ขาย
  sellerBranchId: string;     // id สาขาผู้ขาย
  maxQuantity: number;        // จำกัดจำนวนตามสต็อก
};

type CartContextType = {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getItemsByBranch: () => Map<string, CartItem[]>; // key = sellerBranch (ชื่อร้าน)
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart: CartContextType['addToCart'] = (item) => {
    setItems((prev) => {
      const i = prev.findIndex((p) => p.id === item.id);
      if (i >= 0) {
        const copy = [...prev];
        const nextQty = Math.min(copy[i].quantity + item.quantity, copy[i].maxQuantity);
        copy[i] = { ...copy[i], quantity: nextQty };
        return copy;
      }
      return [...prev, item];
    });
  };

  const removeFromCart: CartContextType['removeFromCart'] = (id) =>
    setItems((prev) => prev.filter((p) => p.id !== id));

  const updateQuantity: CartContextType['updateQuantity'] = (id, quantity) =>
    setItems((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, quantity: Math.max(1, Math.min(quantity, p.maxQuantity)) }
          : p
      )
    );

  const clearCart = () => setItems([]);

  const getTotalItems = () => items.reduce((sum, i) => sum + i.quantity, 0);

  const getTotalPrice = () => items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const getItemsByBranch = () => {
    const m = new Map<string, CartItem[]>();
    items.forEach((i) => {
      const key = i.sellerBranch; // หรือใช้ i.sellerBranchId ถ้าต้องการ
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(i);
    });
    return m;
  };

  const value = useMemo<CartContextType>(
    () => ({
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getTotalItems,
      getTotalPrice,
      getItemsByBranch,
    }),
    [items]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { subscribeWithSelector } from "zustand/middleware";
import type { CartItem, CartState } from "@mindscript/schemas";
import { calculateCartTotal, getCartExpiryDate } from "@mindscript/schemas";

interface CartStore extends CartState {
  // State
  isSyncing: boolean;
  error: string | null;
  
  // Actions
  addItem: (item: Omit<CartItem, "addedAt" | "quantity">) => void;
  removeItem: (trackId: string) => void;
  clearCart: () => void;
  updateQuantity: (trackId: string, quantity: number) => void;
  
  // Calculations
  getTotal: () => number;
  getItemCount: () => number;
  
  // Sync
  syncWithServer: () => Promise<void>;
  mergeWithServerCart: (serverItems: CartItem[]) => void;
  setSessionId: (sessionId: string) => void;
  setError: (error: string | null) => void;
  setSyncing: (syncing: boolean) => void;
  
  // Validation
  validateCart: () => Promise<boolean>;
  removeInvalidItems: (invalidTrackIds: string[]) => void;
}

// localStorage key
const STORAGE_KEY = "mindscript-cart";
const MAX_CART_ITEMS = 10;

// Create BroadcastChannel for cross-tab sync
let channel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  channel = new BroadcastChannel("mindscript-cart-sync");
}

export const useCartStore = create<CartStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        items: [],
        sessionId: undefined,
        lastSyncedAt: undefined,
        expiresAt: undefined,
        isSyncing: false,
        error: null,

        // Add item to cart
        addItem: (item) => {
          const state = get();
          
          // Check if item already exists
          if (state.items.find(i => i.trackId === item.trackId)) {
            return;
          }
          
          // Check max cart size
          if (state.items.length >= MAX_CART_ITEMS) {
            set({ error: "Cart is full (maximum 10 items)" });
            return;
          }

          const newItem: CartItem = {
            ...item,
            quantity: 1,
            addedAt: new Date(),
          };

          const newItems = [...state.items, newItem];
          
          set({
            items: newItems,
            expiresAt: getCartExpiryDate(),
            error: null,
          });

          // Broadcast to other tabs
          if (channel) {
            channel.postMessage({
              type: "cart-update",
              items: newItems,
            });
          }
        },

        // Remove item from cart
        removeItem: (trackId) => {
          const state = get();
          const newItems = state.items.filter(item => item.trackId !== trackId);
          
          set({
            items: newItems,
            error: null,
          });

          // Broadcast to other tabs
          if (channel) {
            channel.postMessage({
              type: "cart-update",
              items: newItems,
            });
          }
        },

        // Clear all items
        clearCart: () => {
          set({
            items: [],
            expiresAt: undefined,
            error: null,
          });

          // Broadcast to other tabs
          if (channel) {
            channel.postMessage({
              type: "cart-clear",
            });
          }
        },

        // Update quantity (always 1 for digital tracks)
        updateQuantity: (trackId, quantity) => {
          // For digital tracks, quantity is always 1
          // This method exists for future extensibility
          return;
        },

        // Calculate total
        getTotal: () => {
          const state = get();
          return calculateCartTotal(state.items);
        },

        // Get item count
        getItemCount: () => {
          const state = get();
          return state.items.length;
        },

        // Sync with server
        syncWithServer: async () => {
          const state = get();
          
          if (state.isSyncing) return;
          
          set({ isSyncing: true, error: null });

          try {
            const response = await fetch("/api/cart/sync", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                items: state.items,
                sessionId: state.sessionId,
              }),
            });

            if (!response.ok) {
              throw new Error("Failed to sync cart");
            }

            const data = await response.json();
            
            set({
              items: data.items,
              lastSyncedAt: new Date(),
              isSyncing: false,
              error: null,
            });
          } catch (error) {
            set({
              isSyncing: false,
              error: error instanceof Error ? error.message : "Failed to sync cart",
            });
          }
        },

        // Merge with server cart (for login)
        mergeWithServerCart: (serverItems) => {
          const state = get();
          const localItems = state.items;
          
          // Create a map of existing items by trackId
          const itemMap = new Map<string, CartItem>();
          
          // Add local items first
          localItems.forEach(item => {
            itemMap.set(item.trackId, item);
          });
          
          // Add server items (will override local if duplicate)
          serverItems.forEach(item => {
            if (!itemMap.has(item.trackId)) {
              itemMap.set(item.trackId, item);
            }
          });
          
          // Convert back to array and limit to MAX_CART_ITEMS
          const mergedItems = Array.from(itemMap.values()).slice(0, MAX_CART_ITEMS);
          
          set({
            items: mergedItems,
            lastSyncedAt: new Date(),
            error: null,
          });

          // Broadcast to other tabs
          if (channel) {
            channel.postMessage({
              type: "cart-update",
              items: mergedItems,
            });
          }
        },

        // Set session ID
        setSessionId: (sessionId) => {
          set({ sessionId });
        },

        // Set error
        setError: (error) => {
          set({ error });
        },

        // Set syncing state
        setSyncing: (syncing) => {
          set({ isSyncing: syncing });
        },

        // Validate cart
        validateCart: async () => {
          const state = get();
          
          if (state.items.length === 0) return true;

          try {
            const response = await fetch("/api/cart/validate", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                items: state.items,
              }),
            });

            if (!response.ok) {
              throw new Error("Failed to validate cart");
            }

            const data = await response.json();
            
            if (!data.valid && data.errors) {
              // Remove invalid items
              const invalidTrackIds = data.errors.map((e: any) => e.trackId);
              get().removeInvalidItems(invalidTrackIds);
            }

            return data.valid;
          } catch (error) {
            set({
              error: error instanceof Error ? error.message : "Failed to validate cart",
            });
            return false;
          }
        },

        // Remove invalid items
        removeInvalidItems: (invalidTrackIds) => {
          const state = get();
          const newItems = state.items.filter(
            item => !invalidTrackIds.includes(item.trackId)
          );
          
          set({
            items: newItems,
            error: null,
          });

          // Broadcast to other tabs
          if (channel) {
            channel.postMessage({
              type: "cart-update",
              items: newItems,
            });
          }
        },
      }),
      {
        name: STORAGE_KEY,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          items: state.items,
          sessionId: state.sessionId,
        }),
      }
    )
  )
);

// Listen for cross-tab updates
if (channel) {
  channel.onmessage = (event) => {
    const { type, items } = event.data;
    
    if (type === "cart-update" && items) {
      useCartStore.setState({ items });
    } else if (type === "cart-clear") {
      useCartStore.setState({ items: [] });
    }
  };
}

// Auto-sync with server every 30 seconds for authenticated users
if (typeof window !== "undefined") {
  setInterval(() => {
    const state = useCartStore.getState();
    if (state.sessionId && !state.isSyncing) {
      state.syncWithServer();
    }
  }, 30000);
}

// Export for use in server components
export const getCartServerState = () => {
  if (typeof window === "undefined") {
    return { items: [], sessionId: undefined };
  }
  return useCartStore.getState();
};
import { create } from "zustand";

/** Shared open state so the PWA bottom bar's "Menu" tab can open the same drawer as the top bar. */
export const useMobileNavDrawer = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

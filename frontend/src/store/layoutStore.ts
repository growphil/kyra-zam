import { create } from "zustand";

export type SidebarPosition = "left" | "right";
export type SidebarWidth = "compact" | "standard" | "wide";
export type SidebarFontSize = "standard" | "medium" | "large";

interface LayoutState {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  sidebarPosition: SidebarPosition;
  sidebarWidth: SidebarWidth;
  sidebarFontSize: SidebarFontSize;
  isDragReorderMode: boolean;
  groupOrder: string[];
  itemOrder: Record<string, string[]>;
  recentOpenedItems: string[];

  toggleSidebarCollapse: () => void;
  setSidebarCollapsed: (val: boolean) => void;
  toggleMobileSidebar: () => void;
  setMobileSidebar: (val: boolean) => void;
  setSidebarPosition: (pos: SidebarPosition) => void;
  toggleSidebarPosition: () => void;
  setSidebarWidth: (width: SidebarWidth) => void;
  setSidebarFontSize: (size: SidebarFontSize) => void;
  setDragReorderMode: (val: boolean) => void;
  toggleDragReorderMode: () => void;
  setGroupOrder: (order: string[]) => void;
  setItemOrder: (groupId: string, items: string[]) => void;
  setItemOrderMap: (map: Record<string, string[]>) => void;
  resetGroupItemsOrder: (groupId: string) => void;
  recordRecentOpenedItem: (name: string) => void;
  setRecentOpenedItems: (items: string[]) => void;
  resetLayoutSettings: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isSidebarCollapsed: false,
  isMobileSidebarOpen: false,
  sidebarPosition: "left",
  sidebarWidth: "standard",
  sidebarFontSize: "standard",
  isDragReorderMode: false,
  groupOrder: [],
  itemOrder: {},
  recentOpenedItems: [],

  setRecentOpenedItems: (items) => set({ recentOpenedItems: items }),

  toggleSidebarCollapse: () => set((state) => {
    const nextVal = !state.isSidebarCollapsed;
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-collapsed", String(nextVal));
    }
    return { isSidebarCollapsed: nextVal };
  }),
  setSidebarCollapsed: (val) => set({ isSidebarCollapsed: val }),
  toggleMobileSidebar: () => set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
  setMobileSidebar: (val) => set({ isMobileSidebarOpen: val }),

  setSidebarPosition: (pos) => set(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-position", pos);
    }
    return { sidebarPosition: pos };
  }),
  toggleSidebarPosition: () => set((state) => {
    const next = state.sidebarPosition === "left" ? "right" : "left";
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-position", next);
    }
    return { sidebarPosition: next };
  }),
  setSidebarWidth: (width) => set(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-width", width);
    }
    return { sidebarWidth: width };
  }),
  setSidebarFontSize: (size) => set(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-font-size", size);
    }
    return { sidebarFontSize: size };
  }),
  setDragReorderMode: (val) => set({ isDragReorderMode: val }),
  toggleDragReorderMode: () => set((state) => ({ isDragReorderMode: !state.isDragReorderMode })),
  setGroupOrder: (order) => set(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-group-order", JSON.stringify(order));
    }
    return { groupOrder: order };
  }),
  setItemOrder: (groupId, items) => set((state) => {
    const next = { ...state.itemOrder, [groupId]: items };
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-item-order", JSON.stringify(next));
    }
    return { itemOrder: next };
  }),
  setItemOrderMap: (map) => set(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-item-order", JSON.stringify(map));
    }
    return { itemOrder: map };
  }),
  resetGroupItemsOrder: (groupId) => set((state) => {
    const next = { ...state.itemOrder };
    delete next[groupId];
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-item-order", JSON.stringify(next));
    }
    return { itemOrder: next };
  }),
  recordRecentOpenedItem: (name: string) => set((state) => {
    if (!name) return state;
    // Keep most recent first, filter duplicates, max 8 items
    const updated = [name, ...state.recentOpenedItems.filter(n => n.toLowerCase() !== name.toLowerCase())].slice(0, 8);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("sidebar-recent-openings", JSON.stringify(updated));
      } catch (e) {}
    }
    return { recentOpenedItems: updated };
  }),
  resetLayoutSettings: () => set(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("sidebar-position");
      localStorage.removeItem("sidebar-width");
      localStorage.removeItem("sidebar-font-size");
      localStorage.removeItem("sidebar-group-order");
      localStorage.removeItem("sidebar-item-order");
      localStorage.removeItem("sidebar-collapsed");
      localStorage.removeItem("sidebar-recent-openings");
    }
    return {
      sidebarPosition: "left",
      sidebarWidth: "standard",
      sidebarFontSize: "standard",
      isSidebarCollapsed: false,
      isDragReorderMode: false,
      groupOrder: [],
      itemOrder: {},
      recentOpenedItems: []
    };
  })
}));

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSession, signOut } from "next-auth/react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useLayoutStore } from "@/store/layoutStore";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { 
  Building2,
  LayoutDashboard, 
  PlusSquare, 
  Microscope, 
  Package, 
  CheckCircle2, 
  Calendar, 
  ShoppingCart, 
  Wrench, 
  FileBarChart, 
  Users, 
  Settings,
  Zap,
  Layers,
  Boxes,
  Archive,
  ClipboardList,
  Truck,
  Trash2,
  BarChart3,
  RefreshCw,
  IndianRupee,
  FileText,
  MapPin,
  ShieldCheck,
  Activity,
  Search,
  LogOut,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  FlaskConical,
  SlidersHorizontal,
  GripVertical,
  RotateCcw,
  PanelLeft,
  PanelRight,
  ArrowLeftRight,
  Check,
  MoveUp,
  MoveDown,
  X,
  Layout,
  Clock,
  Banknote
} from "lucide-react";

const getRoleSlug = (role: string) => {
  if (!role) return "";
  return role.toLowerCase().replace(/_/g, "-");
};

const formatRoleLabel = (role: string) => {
  if (!role) return "User";
  if (role === "TEST_ENGINEER" || role === "TESTER") return "Test Engineer";
  if (role === "INVENTORY_MANAGER") return "Inventory Manager";
  if (role === "PAX_TEST_ENGINEER") return "PAX Test Engineer";
  if (role === "ASSEMBLY_TECHNICIAN") return "Assembly Technician";
  if (role === "PURCHASE_MANAGER") return "Purchase Manager";
  if (role === "SALES_EXECUTIVE") return "Sales Executive";
  if (role === "MARKETING_MANAGER") return "Marketing Manager";
  if (role === "SUPERVISOR") return "Production Supervisor";
  if (role === "ACCOUNTANT") return "Accountant";
  if (role === "ADMIN") return "Administrator";
  if (role === "SUPERADMIN") return "Super Admin";
  if (role === "QC") return "QC Inspector";
  if (role === "PACKING_OPERATOR" || role === "PACKING") return "Packing Operator";
  if (role === "SELLER") return "Seller";
  if (role === "HR_PAYROLL") return "HR & Payroll Manager";
  return role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
};

const navItems = [
  { name: "HR Dashboard", href: "/hr/dashboard", icon: LayoutDashboard, roles: ["HR_PAYROLL", "ADMIN", "SUPERADMIN"] },
  { name: "Employee Directory", href: "/hr/employees", icon: Users, roles: ["HR_PAYROLL", "ADMIN", "SUPERADMIN"] },
  { name: "Attendance & Timesheets", href: "/hr/attendance", icon: Clock, roles: ["HR_PAYROLL", "ADMIN", "SUPERADMIN"] },
  { name: "Working Calendar & Shifts", href: "/hr/calendar", icon: Calendar, roles: ["HR_PAYROLL", "ADMIN", "SUPERADMIN"] },
  { name: "Leave Management", href: "/hr/leave", icon: ClipboardList, roles: ["HR_PAYROLL", "ADMIN", "SUPERADMIN"] },
  { name: "Salary & Payroll Runs", href: "/hr/payroll", icon: Banknote, roles: ["HR_PAYROLL", "ADMIN", "SUPERADMIN", "ACCOUNTANT"] },
  { name: "HR & Payroll Reports", href: "/hr/reports", icon: FileBarChart, roles: ["HR_PAYROLL", "ADMIN", "SUPERADMIN", "ACCOUNTANT"] },
  { name: "Operational Cockpit", href: "/dashboard", icon: LayoutDashboard, roles: ["TEST_ENGINEER", "TESTER"] },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["SUPERADMIN", "ADMIN", "SUPERVISOR", "SALES_EXECUTIVE", "ACCOUNTANT", "PURCHASE_MANAGER", "MARKETING_MANAGER", "PACKING_OPERATOR", "PACKING"] },
  { name: "Packing Station", href: "/packing", icon: Package, roles: ["PACKING_OPERATOR", "PACKING", "INVENTORY_MANAGER", "SUPERVISOR", "ADMIN", "SUPERADMIN", "QC"] },
  { name: "Packing History", href: "/packing/history", icon: ClipboardList, roles: ["PACKING_OPERATOR", "PACKING", "INVENTORY_MANAGER", "SUPERVISOR", "ADMIN", "SUPERADMIN", "QC"] },
  { name: "Packing Materials", href: "/packing/materials", icon: Layers, roles: ["PACKING_OPERATOR", "PACKING", "INVENTORY_MANAGER", "SUPERVISOR", "ADMIN", "SUPERADMIN"] },
  { name: "ERP Control Tower", href: "/management", icon: Building2, roles: ["SUPERVISOR", "ADMIN", "SUPERADMIN"] },
  { name: "CRM Dashboard", href: "/crm", icon: LayoutDashboard, roles: ["SALES_EXECUTIVE", "MARKETING_MANAGER", "ACCOUNTANT", "ADMIN", "SUPERADMIN"] },
  { name: "Leads", href: "/crm/leads", icon: ClipboardList, roles: ["SALES_EXECUTIVE", "MARKETING_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Customers", href: "/crm/customers", icon: Users, roles: ["SALES_EXECUTIVE", "MARKETING_MANAGER", "ACCOUNTANT", "ADMIN", "SUPERADMIN"] },
  { name: "Quotations", href: "/sales/quotations", icon: FileText, roles: ["SALES_EXECUTIVE", "MARKETING_MANAGER", "ACCOUNTANT", "ADMIN", "SUPERADMIN"] },
  { name: "Sales Orders", href: "/sales/orders", icon: ClipboardList, roles: ["SALES_EXECUTIVE", "MARKETING_MANAGER", "ACCOUNTANT", "ADMIN", "SUPERADMIN"] },
  { name: "Approved Transactions", href: "/finance/approved-quotations", icon: ClipboardList, roles: ["ACCOUNTANT", "ADMIN", "SUPERADMIN"] },
  { name: "Receivables", href: "/finance/receivables", icon: BarChart3, roles: ["ACCOUNTANT", "ADMIN", "SUPERADMIN"] },
  { name: "Financial Clearance", href: "/finance/clearance", icon: ShieldCheck, roles: ["ACCOUNTANT", "ADMIN", "SUPERADMIN"] },
  { name: "Production Dashboard", href: "/production", icon: LayoutDashboard, roles: ["SUPERVISOR", "INVENTORY_MANAGER", "PURCHASE_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Production Req", href: "/production/requirements", icon: ClipboardList, roles: ["SUPERVISOR", "INVENTORY_MANAGER", "PURCHASE_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Production Plans", href: "/production/plans", icon: FileText, roles: ["SUPERVISOR", "INVENTORY_MANAGER", "PURCHASE_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Production Scheduler", href: "/production/scheduler", icon: Calendar, roles: ["SUPERVISOR", "ADMIN", "SUPERADMIN"] },
  { name: "Production Execution", href: "/production/execution", icon: Activity, roles: ["SUPERVISOR", "ADMIN", "SUPERADMIN"] },
  { name: "Work Orders", href: "/production/work-orders", icon: CheckCircle2, roles: ["SUPERVISOR", "INVENTORY_MANAGER", "PURCHASE_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Rework Cockpit", href: "/production/rework", icon: RefreshCw, roles: ["SUPERVISOR", "ADMIN", "SUPERADMIN"] },
  { name: "Quality Dashboard", href: "/quality", icon: ShieldCheck, roles: ["SUPERVISOR", "ADMIN", "SUPERADMIN", "QC"] },
  { name: "Finished Goods", href: "/inventory/finished-goods", icon: Package, roles: ["INVENTORY_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Finance Dashboard", href: "/finance", icon: IndianRupee, roles: ["INVENTORY_MANAGER", "PURCHASE_MANAGER", "ACCOUNTANT", "ADMIN", "SUPERADMIN"] },
  { name: "Invoices", href: "/finance/invoices", icon: FileText, roles: ["INVENTORY_MANAGER", "PURCHASE_MANAGER", "SALES_EXECUTIVE", "ACCOUNTANT", "ADMIN", "SUPERADMIN"] },
  { name: "Payments", href: "/finance/payments", icon: IndianRupee, roles: ["INVENTORY_MANAGER", "PURCHASE_MANAGER", "SALES_EXECUTIVE", "ACCOUNTANT", "ADMIN", "SUPERADMIN"] },
  { name: "Purchase Requests", href: "/procurement/purchase-requests", icon: ClipboardList, roles: ["PURCHASE_MANAGER", "INVENTORY_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Purchase Orders", href: "/procurement/purchase-orders", icon: FileText, roles: ["PURCHASE_MANAGER", "INVENTORY_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Goods Receipts", href: "/procurement/goods-receipts", icon: Archive, roles: ["PURCHASE_MANAGER", "INVENTORY_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Supplier Invoices", href: "/procurement/purchase-invoices", icon: FileText, roles: ["PURCHASE_MANAGER", "INVENTORY_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Warehouse Locations", href: "/inventory/locations", icon: MapPin, roles: ["INVENTORY_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Stock Movements", href: "/inventory/movements", icon: RefreshCw, roles: ["INVENTORY_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Cell Inward", href: "/inward", icon: PlusSquare, roles: ["INVENTORY_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Serialized Cells", href: "/cells", icon: Zap, roles: ["TEST_ENGINEER", "TESTER", "INVENTORY_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Testing Station", href: "/testing", icon: Microscope, roles: ["TEST_ENGINEER", "TESTER", "ADMIN", "SUPERADMIN"] },
  { name: "Inventory", href: "/inventory", icon: Package, roles: ["INVENTORY_MANAGER", "PURCHASE_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "BOM", href: "/bom", icon: Layers, roles: ["INVENTORY_MANAGER", "PURCHASE_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Service Workspace", href: "/service", icon: Wrench, roles: ["INVENTORY_MANAGER", "SUPERVISOR", "ADMIN", "SUPERADMIN"] },
  { name: "Warranty Registry", href: "/service/warranties", icon: ShieldCheck, roles: ["INVENTORY_MANAGER", "SUPERVISOR", "ADMIN", "SUPERADMIN"] },
  { name: "Service Battery Intake", href: "/inventory/service", icon: Archive, roles: ["INVENTORY_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "QC Retest", href: "/qc-retest", icon: RefreshCw, roles: ["QC", "ADMIN", "SUPERADMIN"] },
  { name: "Scrap Review", href: "/scrap", icon: Trash2, roles: ["TEST_ENGINEER", "TESTER", "INVENTORY_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Assembly Queue", href: "/dashboard", icon: ClipboardList, roles: ["ASSEMBLY_TECHNICIAN"] },
  { name: "Active Assembly", href: "/pax/create", icon: Package, roles: ["ASSEMBLY_TECHNICIAN", "ADMIN", "SUPERADMIN"] },
  { name: "Assembly History", href: "/pax/all", icon: Boxes, roles: ["ASSEMBLY_TECHNICIAN", "ADMIN", "SUPERADMIN"] },
  { name: "PAX Assembly", href: "/pax/create", icon: Package, roles: ["ADMIN", "SUPERADMIN"] },
  { name: "PAX Verification", href: "/assy", icon: Boxes, roles: ["ADMIN", "SUPERADMIN"] },
  { name: "Assy Service", href: "/assy/service", icon: Wrench, roles: ["ADMIN", "SUPERADMIN"] },
  { name: "Approval Queue", href: "/supervisor", icon: CheckCircle2, roles: ["SUPERVISOR", "ADMIN", "SUPERADMIN"] },
  { name: "Sales", href: "/sales", icon: ShoppingCart, roles: ["SALES_EXECUTIVE", "ADMIN", "SUPERADMIN"] },
  { name: "Repairs", href: "/repair", icon: Wrench, roles: ["ADMIN", "SUPERADMIN"] },
  { name: "Reports", href: "/reports", icon: FileBarChart, roles: ["SUPERADMIN", "ADMIN", "ACCOUNTANT", "SUPERVISOR", "PURCHASE_MANAGER", "QC"] },
  { name: "PAX Testing", href: "/pax-testing", icon: Microscope, roles: ["PAX_TEST_ENGINEER", "ADMIN", "SUPERADMIN"] },
  { name: "Service Testing", href: "/pax-testing/service", icon: Microscope, roles: ["ADMIN", "SUPERADMIN"] },
  { name: "Service Delivery", href: "/service/delivery", icon: Truck, roles: ["INVENTORY_MANAGER", "ADMIN", "SUPERADMIN"] },
  { name: "Service Cost", href: "/service/cost", icon: IndianRupee, roles: ["ADMIN", "SUPERADMIN"] },
  { name: "Service Pricing", href: "/admin/service-pricing", icon: Settings, roles: ["ADMIN", "SUPERADMIN"] },
  { name: "Defect Analytics", href: "/reports/defects", icon: BarChart3, roles: ["SUPERADMIN", "ADMIN", "ACCOUNTANT", "SUPERVISOR", "PURCHASE_MANAGER", "QC"] },
  { name: "All Pax", href: "/pax/all", icon: Package, roles: ["ADMIN", "SUPERADMIN"] },
  { name: "Admin Settings", href: "/admin-settings", icon: Settings, roles: ["SUPERADMIN", "ADMIN"] },
  { name: "OEE reports", href: "/reports/oee", icon: BarChart3, roles: ["SUPERADMIN", "ADMIN", "ACCOUNTANT", "SUPERVISOR", "PURCHASE_MANAGER", "QC"] }
];

const groupsConfig = [
  {
    id: "testing",
    name: "Testing Station",
    icon: Microscope,
    itemNames: [
      "Operational Cockpit",
      "Serialized Cells",
      "Testing Station",
      "Scrap Review"
    ]
  },
  {
    id: "crm-sales",
    name: "CRM & Sales",
    icon: Users,
    itemNames: [
      "CRM Dashboard",
      "Leads",
      "Customers",
      "Quotations",
      "Sales Orders",
      "Approved Transactions",
      "Sales"
    ]
  },
  {
    id: "finance",
    name: "Finance",
    icon: IndianRupee,
    itemNames: [
      "Finance Dashboard",
      "Receivables",
      "Financial Clearance",
      "Invoices",
      "Payments"
    ]
  },
  {
    id: "packing",
    name: "Packing & Finished Goods",
    icon: Package,
    itemNames: [
      "Packing Station",
      "Packing History",
      "Packing Materials",
      "Finished Goods"
    ]
  },
  {
    id: "inventory-procurement",
    name: "Inventory & Procurement",
    icon: Package,
    itemNames: [
      "Inventory",
      "Finished Goods",
      "Warehouse Locations",
      "Stock Movements",
      "Cell Inward",
      "Serialized Cells",
      "Purchase Requests",
      "Purchase Orders",
      "Goods Receipts",
      "BOM"
    ]
  },
  {
    id: "production",
    name: "Production",
    icon: Layers,
    itemNames: [
      "Production Dashboard",
      "Production Req",
      "Production Plans",
      "Production Scheduler",
      "Production Execution",
      "Work Orders"
    ]
  },
  {
    id: "quality",
    name: "Quality",
    icon: ShieldCheck,
    itemNames: [
      "Quality Dashboard",
      "Testing Station",
      "QC Retest",
      "PAX Testing",
      "PAX Verification",
      "Defect Analytics"
    ]
  },
  {
    id: "pax-assembly",
    name: "PAX Assembly",
    icon: Package,
    itemNames: [
      "Assembly Queue",
      "Active Assembly",
      "Assembly History",
      "PAX Assembly",
      "PAX Verification",
      "Assy Service",
      "Repairs",
      "Scrap Review"
    ]
  },
  {
    id: "rework-repairs",
    name: "Rework & Repairs",
    icon: RefreshCw,
    itemNames: [
      "Rework Cockpit",
      "Repairs",
      "Scrap Review",
      "All Pax"
    ]
  },
  {
    id: "service",
    name: "Service",
    icon: Wrench,
    itemNames: [
      "Service Workspace",
      "Warranty Registry",
      "Service Battery Intake",
      "Assy Service",
      "Service Testing",
      "Service Delivery",
      "Service Cost",
      "Service Pricing"
    ]
  },
  {
    id: "reports-analytics",
    name: "Reports & Analytics",
    icon: FileBarChart,
    itemNames: [
      "Reports",
      "OEE reports",
      "Defect Analytics"
    ]
  },
  {
    id: "administration",
    name: "Administration",
    icon: Building2,
    itemNames: [
      "ERP Control Tower",
      "Approval Queue"
    ]
  },
  {
    id: "hr-payroll",
    name: "HR & Payroll (Zambia)",
    icon: Users,
    itemNames: [
      "HR Dashboard",
      "Employee Directory",
      "Attendance & Timesheets",
      "Working Calendar & Shifts",
      "Leave Management",
      "Salary & Payroll Runs",
      "HR & Payroll Reports"
    ]
  },
  {
    id: "settings",
    name: "Settings",
    icon: Settings,
    itemNames: [
      "Admin Settings",
      "Service Pricing"
    ]
  }
];

const FAVORITE_NAMES = [
  "ERP Control Tower",
  "Sales",
  "Production Execution",
  "Quality Dashboard",
  "Inventory",
  "Reports"
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { 
    isSidebarCollapsed, 
    toggleSidebarCollapse, 
    isMobileSidebarOpen,
    sidebarPosition,
    setSidebarPosition,
    toggleSidebarPosition,
    sidebarWidth,
    setSidebarWidth,
    sidebarFontSize,
    setSidebarFontSize,
    isDragReorderMode,
    toggleDragReorderMode,
    setDragReorderMode,
    groupOrder,
    setGroupOrder,
    itemOrder,
    setItemOrder,
    recentOpenedItems,
    recordRecentOpenedItem,
    resetGroupItemsOrder,
    resetLayoutSettings
  } = useLayoutStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [isOptimizeModalOpen, setIsOptimizeModalOpen] = useState(false);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [draggedSubItem, setDraggedSubItem] = useState<{ groupId: string; itemName: string } | null>(null);
  const [dragOverSubItem, setDragOverSubItem] = useState<{ groupId: string; itemName: string } | null>(null);
  const [selectedCustomizerGroupId, setSelectedCustomizerGroupId] = useState<string>("crm-sales");

  // Dynamic font sizing configuration
  const fontSizeConfig = useMemo(() => {
    if (sidebarFontSize === "large") {
      return {
        itemText: "text-sm font-semibold",
        groupText: "text-sm font-semibold",
        subText: "text-[13px] font-medium",
        badgeText: "text-[10px]",
        iconSize: "w-4 h-4",
        subIconSize: "w-3.5 h-3.5",
        itemPy: "py-2.5",
        subPy: "py-2"
      };
    }
    if (sidebarFontSize === "medium") {
      return {
        itemText: "text-[13px] font-medium",
        groupText: "text-[13px] font-medium",
        subText: "text-xs font-medium",
        badgeText: "text-[10px]",
        iconSize: "w-4 h-4",
        subIconSize: "w-3.5 h-3.5",
        itemPy: "py-2",
        subPy: "py-1.5"
      };
    }
    return {
      itemText: "text-xs font-medium",
      groupText: "text-xs font-medium",
      subText: "text-xs",
      badgeText: "text-[9px]",
      iconSize: "w-4 h-4",
      subIconSize: "w-3.5 h-3.5",
      itemPy: "py-2",
      subPy: "py-1.5"
    };
  }, [sidebarFontSize]);

  const isRightAligned = sidebarPosition === "right";
  const tooltipPositionClass = isRightAligned ? "right-full mr-3" : "left-full ml-3";

  const userRoles = (session?.user as any)?.roles || [];
  const primaryRole = userRoles[0] || "SUPERADMIN";

  const segments = pathname.split("/").filter(Boolean);
  const pathRoleSlug = segments[0] || "";

  const selectedRole = userRoles.find(
    (role: string) => role.toLowerCase().replace(/_/g, "-") === pathRoleSlug
  ) || userRoles[0] || "SUPERADMIN";

  const roleSlug = getRoleSlug(selectedRole);
  const isAssemblyTech = selectedRole === "ASSEMBLY_TECHNICIAN" || pathRoleSlug === "assembly-technician";
  const isTestEngineer = selectedRole === "TEST_ENGINEER" || selectedRole === "TESTER" || pathRoleSlug === "test-engineer" || pathRoleSlug === "tester";
  const isQC = selectedRole === "QC" || pathRoleSlug === "qc";
  const isSupervisor = selectedRole === "SUPERVISOR" || pathRoleSlug === "supervisor";
  const isPaxTestEngineer = selectedRole === "PAX_TEST_ENGINEER" || pathRoleSlug === "pax-test-engineer";
  const isSeller = selectedRole === "SELLER" || pathRoleSlug === "seller";

  // Map relative navItem hrefs to full paths under pathRoleSlug
  const filteredItems = navItems.filter(item => 
    item.roles.includes("ANY") || item.roles.includes(selectedRole)
  ).map(item => ({
    ...item,
    fullHref: item.href === "/dashboard" ? `/${roleSlug}` : `/${roleSlug}${item.href}`
  }));

  // Identify active item based on pathname matching
  const activeItem = filteredItems.reduce((prev, curr) => {
    const isCurrentActive = curr.href === "/dashboard" 
      ? (pathname === `/${roleSlug}` || pathname === `/${roleSlug}/`)
      : (pathname === curr.fullHref || pathname.startsWith(curr.fullHref + "/"));

    if (isCurrentActive && (!prev || curr.fullHref.length > prev.fullHref.length)) {
      return curr;
    }
    return prev;
  }, null as any);

  // Dynamic ordering of groups based on custom groupOrder
  const orderedGroupsConfig = useMemo(() => {
    if (!groupOrder || groupOrder.length === 0) return groupsConfig;
    const orderMap = new Map<string, number>();
    groupOrder.forEach((id, idx) => orderMap.set(id, idx));
    return [...groupsConfig].sort((a, b) => {
      const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999;
      const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999;
      return idxA - idxB;
    });
  }, [groupOrder]);

  // Helper to get ordered item names for a given group respecting itemOrder
  const getGroupItemNames = (group: { id: string; itemNames: string[] }) => {
    const customOrder = itemOrder[group.id];
    if (customOrder && customOrder.length > 0) {
      const ordered = customOrder.filter(name => 
        group.itemNames.some(n => n.toLowerCase() === name.toLowerCase())
      );
      const remaining = group.itemNames.filter(name => 
        !ordered.some(o => o.toLowerCase() === name.toLowerCase())
      );
      return [...ordered, ...remaining];
    }
    return [...group.itemNames];
  };

  // Drag and drop handlers for module groups
  const handleGroupDragStart = (e: React.DragEvent, groupId: string) => {
    setDraggedGroupId(groupId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", groupId);
  };

  const handleGroupDragOver = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverGroupId !== targetGroupId) {
      setDragOverGroupId(targetGroupId);
    }
  };

  const handleGroupDragLeave = () => {
    setDragOverGroupId(null);
  };

  const handleGroupDrop = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    if (!draggedGroupId || draggedGroupId === targetGroupId) {
      setDraggedGroupId(null);
      setDragOverGroupId(null);
      return;
    }

    const currentIds = orderedGroupsConfig.map(g => g.id);
    const fromIndex = currentIds.indexOf(draggedGroupId);
    const toIndex = currentIds.indexOf(targetGroupId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const newIds = [...currentIds];
      const [movedItem] = newIds.splice(fromIndex, 1);
      newIds.splice(toIndex, 0, movedItem);
      setGroupOrder(newIds);
      toast.success("Sidebar modules reordered");
    }

    setDraggedGroupId(null);
    setDragOverGroupId(null);
  };

  const handleGroupDragEnd = () => {
    setDraggedGroupId(null);
    setDragOverGroupId(null);
  };

  const moveGroup = (groupId: string, direction: "up" | "down") => {
    const currentIds = orderedGroupsConfig.map(g => g.id);
    const index = currentIds.indexOf(groupId);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentIds.length) return;

    const newIds = [...currentIds];
    const [movedItem] = newIds.splice(index, 1);
    newIds.splice(targetIndex, 0, movedItem);
    setGroupOrder(newIds);
  };

  // Drag and drop handlers for sub-items
  const moveSubItem = (groupId: string, itemName: string, direction: "up" | "down") => {
    const group = groupsConfig.find(g => g.id === groupId);
    if (!group) return;
    const currentItems = getGroupItemNames(group);
    const index = currentItems.findIndex(n => n.toLowerCase() === itemName.toLowerCase());
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentItems.length) return;

    const newItems = [...currentItems];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, moved);
    setItemOrder(groupId, newItems);
  };

  const handleSubItemDragStart = (e: React.DragEvent, groupId: string, itemName: string) => {
    e.stopPropagation();
    setDraggedSubItem({ groupId, itemName });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${groupId}:${itemName}`);
  };

  const handleSubItemDragOver = (e: React.DragEvent, groupId: string, targetItemName: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (!draggedSubItem || draggedSubItem.groupId !== groupId) return;
    if (dragOverSubItem?.itemName !== targetItemName) {
      setDragOverSubItem({ groupId, itemName: targetItemName });
    }
  };

  const handleSubItemDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setDragOverSubItem(null);
  };

  const handleSubItemDrop = (e: React.DragEvent, groupId: string, targetItemName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedSubItem || draggedSubItem.groupId !== groupId || draggedSubItem.itemName === targetItemName) {
      setDraggedSubItem(null);
      setDragOverSubItem(null);
      return;
    }

    const group = groupsConfig.find(g => g.id === groupId);
    if (!group) return;

    const currentItems = getGroupItemNames(group);
    const fromIndex = currentItems.findIndex(n => n.toLowerCase() === draggedSubItem.itemName.toLowerCase());
    const toIndex = currentItems.findIndex(n => n.toLowerCase() === targetItemName.toLowerCase());

    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      const newItems = [...currentItems];
      const [moved] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, moved);
      setItemOrder(groupId, newItems);
      toast.success("Sub-menu reordered");
    }

    setDraggedSubItem(null);
    setDragOverSubItem(null);
  };

  const handleSubItemDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedSubItem(null);
    setDragOverSubItem(null);
  };

  // Auto-expand parent group of active route when pathname or searchQuery changes
  useEffect(() => {
    if (activeItem && !searchQuery) {
      const activeGroup = groupsConfig.find(g => 
        g.itemNames.some(name => name.toLowerCase() === activeItem.name.toLowerCase())
      );
      if (activeGroup) {
        setExpandedGroupId(activeGroup.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchQuery]);

  // Sync selected customizer group when opening modal
  useEffect(() => {
    if (isOptimizeModalOpen) {
      if (expandedGroupId && orderedGroupsConfig.some(g => g.id === expandedGroupId)) {
        setSelectedCustomizerGroupId(expandedGroupId);
      } else if (orderedGroupsConfig.length > 0) {
        setSelectedCustomizerGroupId(orderedGroupsConfig[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOptimizeModalOpen]);

  // Handle client-side search query filtering
  const query = searchQuery.trim().toLowerCase();
  const searchedItems = filteredItems.filter(item => 
    item.name.toLowerCase().includes(query)
  );

  // Build categorized grouped menu items matching user search query respecting custom itemOrder
  const groupedMenu = orderedGroupsConfig.map(group => {
    const orderedNames = getGroupItemNames(group);
    const groupItems = searchedItems
      .filter(item => group.itemNames.some(name => name.toLowerCase() === item.name.toLowerCase()))
      .sort((a, b) => {
        const indexA = orderedNames.findIndex(name => name.toLowerCase() === a.name.toLowerCase());
        const indexB = orderedNames.findIndex(name => name.toLowerCase() === b.name.toLowerCase());
        const valA = indexA !== -1 ? indexA : 999;
        const valB = indexB !== -1 ? indexB : 999;
        return valA - valB;
      });
    return {
      ...group,
      items: groupItems
    };
  }).filter(group => group.items.length > 0);

  // Auto-record recently opened navigation item
  useEffect(() => {
    if (activeItem?.name) {
      recordRecentOpenedItem(activeItem.name);
    }
  }, [activeItem?.name, recordRecentOpenedItem]);

  // Favorites section dynamically based on recently opened items (recent opening)
  const favoriteItems = useMemo(() => {
    if (isSupervisor) return [];

    // Prioritize recently opened items first
    const namesToDisplay = (recentOpenedItems && recentOpenedItems.length > 0)
      ? recentOpenedItems
      : FAVORITE_NAMES;

    const result: typeof filteredItems = [];
    namesToDisplay.forEach(name => {
      const match = filteredItems.find(item => item.name.toLowerCase() === name.toLowerCase());
      if (match && !result.some(r => r.name.toLowerCase() === match.name.toLowerCase())) {
        result.push(match);
      }
    });

    return result.slice(0, 6);
  }, [isSupervisor, recentOpenedItems, filteredItems]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroupId(prev => prev === groupId ? null : groupId);
  };

  const widthClass = isSidebarCollapsed 
    ? "w-[72px]" 
    : sidebarWidth === "compact" 
      ? "w-[210px]" 
      : sidebarWidth === "wide" 
        ? "w-[280px]" 
        : "w-60";

  const mdWidthClass = isSidebarCollapsed 
    ? "md:w-[72px]" 
    : sidebarWidth === "compact" 
      ? "md:w-[210px]" 
      : sidebarWidth === "wide" 
        ? "md:w-[280px]" 
        : "md:w-60";

  return (
    <aside className={twMerge(
      "flex flex-col h-screen fixed md:sticky top-0 overflow-hidden transition-all duration-300 z-50 bg-[#061B3A] text-white shadow-xl",
      isRightAligned ? "border-l border-[#0D2A54] right-0" : "border-r border-[#0D2A54] left-0",
      isRightAligned 
        ? (isMobileSidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0")
        : (isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"),
      widthClass,
      mdWidthClass
    )}>
      {/* Sidebar Brand Header */}
      <div className={twMerge(
        "p-4 pb-3.5 flex-shrink-0 flex items-center border-b border-[#0D2A54] relative",
        isSidebarCollapsed ? "justify-center" : "justify-between"
      )}>
        {!isSidebarCollapsed ? (
          <>
            <div className="flex flex-col min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#FFC928] shadow-[0_0_10px_rgba(255,201,40,0.5)] flex-shrink-0" />
                <span className="tracking-wide text-white">KYRA</span>
                <span className="text-white">ZAM</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-[#0878F9]/20 border border-[#0878F9]/40 text-[#0878F9] rounded font-mono">2.0</span>
              </h1>
              <p className="text-[9px] uppercase tracking-widest text-[#94A3B8] font-bold mt-1 truncate">
                Battery Pack Management
              </p>
            </div>
            
            {/* Action buttons (Top Right): Optimize Settings & Collapse */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsOptimizeModalOpen(true)}
                className="hidden md:flex items-center justify-center p-1.5 rounded-lg text-[#94A3B8] hover:text-[#0878F9] hover:bg-[#0D2A54] transition-colors cursor-pointer flex-shrink-0"
                title="Optimize Sidebar Alignment & Order"
                aria-label="Optimize Sidebar Alignment & Order"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={toggleSidebarCollapse}
                className="hidden md:flex items-center justify-center p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#0D2A54] transition-colors cursor-pointer flex-shrink-0"
                title={isRightAligned ? "Collapse sidebar to right" : "Collapse sidebar to left"}
                aria-label="Collapse sidebar"
              >
                {isRightAligned ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-1">
            <div className="flex items-center justify-center relative group/logo">
              <span className="text-lg font-bold text-white tracking-tighter">KZ</span>
              <div className="w-1.5 h-1.5 rounded-full bg-[#FFC928] absolute -top-0.5 -right-1" />
            </div>
            {/* Expand Arrow Button (Top Center when collapsed) */}
            <button
              onClick={toggleSidebarCollapse}
              className="hidden md:flex items-center justify-center p-1 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#0D2A54] transition-colors cursor-pointer"
              title={isRightAligned ? "Expand sidebar to left" : "Expand sidebar to right"}
              aria-label="Expand sidebar"
            >
              {isRightAligned ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Navigation Filtering / Search */}
      {!isSidebarCollapsed && (
        <div className="px-3.5 mt-3 mb-1 relative flex-shrink-0">
          <div className="relative group">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-2.5 group-focus-within:text-[#0878F9] transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search navigation..."
              className="w-full bg-[#0D2A54]/80 border border-[#1E3A8A]/50 rounded-lg py-1.5 pl-8 pr-7 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#0878F9] focus:bg-[#0D2A54] focus:ring-1 focus:ring-[#0878F9]/40 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1.5 text-[#94A3B8] hover:text-white text-xs font-semibold px-1 py-0.5"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Navigation Scroll List */}
      <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto no-scrollbar scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        
        {/* ── DEDICATED SELLER PORTAL VIEW ──────────────────────────────────── */}
        {isSeller ? (
          <div className="space-y-0.5">
            {[
              { 
                name: "Sales Dashboard", 
                href: `/${roleSlug}/sales`, 
                icon: LayoutDashboard,
                match: (p: string) => p === `/${roleSlug}` || p === `/${roleSlug}/` || p === `/${roleSlug}/sales` || p === `/${roleSlug}/dashboard`
              },
              { 
                name: "Finished Goods", 
                href: `/${roleSlug}/finished-goods`, 
                icon: Package,
                match: (p: string) => p.includes("/finished-goods")
              },
              { 
                name: "New Sale", 
                href: `/${roleSlug}/sales/new`, 
                icon: ShoppingCart,
                match: (p: string) => p.includes("/sales/new")
              },
              { 
                name: "Sales History", 
                href: `/${roleSlug}/sales/history`, 
                icon: ClipboardList,
                match: (p: string) => p.includes("/sales/history") || p.includes("/sales/orders")
              },
              { 
                name: "Warranty Records", 
                href: `/${roleSlug}/warranties`, 
                icon: ShieldCheck,
                match: (p: string) => p.includes("/warranties") || p.includes("/service/warranties")
              }
            ]
              .filter(item => !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((item) => {
                const isActive = item.match(pathname);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={twMerge(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group/item relative min-w-0 font-medium text-xs",
                      isActive 
                        ? "text-white font-semibold bg-[#0878F9] shadow-md shadow-blue-500/30" 
                        : "text-[#CBD5E1] hover:text-white hover:bg-[#0D2A54]",
                      isSidebarCollapsed && "justify-center px-0"
                    )}
                  >
                    <item.icon className={clsx(
                      "w-4 h-4 flex-shrink-0 transition-colors",
                      isActive ? "text-white" : "text-[#94A3B8] group-hover/item:text-white"
                    )} />
                    {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
                    {isSidebarCollapsed && (
                      <span className={twMerge(
                        "absolute px-2.5 py-1.5 bg-[#061B3A] border border-[#1E3A8A] text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50 shadow-xl",
                        tooltipPositionClass
                      )}>
                        {item.name}
                      </span>
                    )}
                  </Link>
                );
              })}
          </div>
        ) : isPaxTestEngineer ? (
          <div className="space-y-0.5">
            {[
              { 
                name: "PAX Testing", 
                href: `/${roleSlug}/pax-testing`, 
                icon: Microscope, 
                match: (p: string) => p === `/${roleSlug}/pax-testing` || p.startsWith(`/${roleSlug}/pax-testing/`)
              }
            ]
              .filter(item => !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((item) => {
                const isActive = item.match(pathname);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={twMerge(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group/item relative min-w-0 font-medium text-xs",
                      isActive 
                        ? "text-white font-semibold bg-[#0878F9] shadow-md shadow-blue-500/30" 
                        : "text-[#CBD5E1] hover:text-white hover:bg-[#0D2A54]",
                      isSidebarCollapsed && "justify-center px-0"
                    )}
                  >
                    <item.icon className={clsx(
                      "w-4 h-4 flex-shrink-0 transition-colors",
                      isActive ? "text-white" : "text-[#94A3B8] group-hover/item:text-white"
                    )} />
                    {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
                    {isSidebarCollapsed && (
                      <span className={twMerge(
                        "absolute px-2.5 py-1.5 bg-[#061B3A] border border-[#1E3A8A] text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50 shadow-xl",
                        tooltipPositionClass
                      )}>
                        {item.name}
                      </span>
                    )}
                  </Link>
                );
              })}
          </div>
        ) : isAssemblyTech ? (
          <div className="space-y-0.5">
            {[
              { name: "Assembly Queue", href: `/${roleSlug}`, icon: ClipboardList, match: (p: string) => p === `/${roleSlug}` || p === `/${roleSlug}/` },
              { name: "Active Assembly", href: `/${roleSlug}/pax/create`, icon: Package, match: (p: string) => p.includes("/pax/create") },
              { name: "Assembly History", href: `/${roleSlug}/pax/all`, icon: Boxes, match: (p: string) => p.includes("/pax/all") }
            ].map((item) => {
              const isActive = item.match(pathname);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={twMerge(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group/item relative min-w-0 font-medium text-xs",
                    isActive 
                      ? "text-white font-semibold bg-[#0878F9] shadow-md shadow-blue-500/30" 
                      : "text-[#CBD5E1] hover:text-white hover:bg-[#0D2A54]",
                    isSidebarCollapsed && "justify-center px-0"
                  )}
                >
                  <item.icon className={clsx(
                    "w-4 h-4 flex-shrink-0 transition-colors",
                    isActive ? "text-white" : "text-[#94A3B8] group-hover/item:text-white"
                  )} />
                  {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
                  {isSidebarCollapsed && (
                    <span className={twMerge(
                      "absolute px-2.5 py-1.5 bg-[#061B3A] border border-[#1E3A8A] text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50 shadow-xl",
                      tooltipPositionClass
                    )}>
                      {item.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ) : isQC ? (
          <div className="space-y-0.5">
            {[
              { name: "Quality Dashboard", href: `/${roleSlug}/quality`, icon: LayoutDashboard, match: (p: string) => p === `/${roleSlug}` || p.includes("/quality") },
              { name: "Cell QC Queue", href: `/${roleSlug}/cells`, icon: Zap, match: (p: string) => p.includes("cells") && !p.includes("history") },
              { name: "QC Retest", href: `/${roleSlug}/qc-retest`, icon: RefreshCw, match: (p: string) => p.includes("qc-retest") },
              { name: "PAX QC Queue", href: `/${roleSlug}/pax`, icon: Package, match: (p: string) => p.includes("/pax") && !p.includes("history") },
              { name: "Defect Analytics", href: `/${roleSlug}/reports/defects`, icon: BarChart3, match: (p: string) => p.includes("reports/defects") },
              { name: "Reports", href: `/${roleSlug}/reports`, icon: FileBarChart, match: (p: string) => p === `/${roleSlug}/reports` }
            ].map((item) => {
              const isActive = item.match(pathname);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={twMerge(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group/item relative min-w-0 font-medium text-xs",
                    isActive 
                      ? "text-white font-semibold bg-[#0878F9] shadow-md shadow-blue-500/30" 
                      : "text-[#CBD5E1] hover:text-white hover:bg-[#0D2A54]",
                    isSidebarCollapsed && "justify-center px-0"
                  )}
                >
                  <item.icon className={clsx(
                    "w-4 h-4 flex-shrink-0 transition-colors",
                    isActive ? "text-white" : "text-[#94A3B8] group-hover/item:text-white"
                  )} />
                  {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
                  {isSidebarCollapsed && (
                    <span className={twMerge(
                      "absolute px-2.5 py-1.5 bg-[#061B3A] border border-[#1E3A8A] text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50 shadow-xl",
                      tooltipPositionClass
                    )}>
                      {item.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ) : isTestEngineer ? (
          <div className="space-y-0.5">
            {searchedItems.map(item => {
              const isActive = activeItem?.name === item.name || activeItem?.fullHref === item.fullHref;
              return (
                <Link
                  key={item.name}
                  href={item.fullHref}
                  className={twMerge(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group/item relative min-w-0 font-medium text-xs",
                    isActive 
                      ? "text-white font-semibold bg-[#0878F9] shadow-md shadow-blue-500/30" 
                      : "text-[#CBD5E1] hover:text-white hover:bg-[#0D2A54]",
                    isSidebarCollapsed && "justify-center px-0"
                  )}
                >
                  <item.icon className={clsx(
                    "w-4 h-4 flex-shrink-0 transition-colors", 
                    isActive ? "text-white" : "text-[#94A3B8] group-hover/item:text-white"
                  )} />
                  {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
                  
                  {isSidebarCollapsed && (
                    <span className={twMerge(
                      "absolute px-2.5 py-1.5 bg-[#061B3A] border border-[#1E3A8A] text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50 shadow-xl",
                      tooltipPositionClass
                    )}>
                      {item.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          /* ── MULTI-ROLE ERP VIEW ─────────────────────────────────────────── */
          <>
            {/* Favorites Bar (For non-Supervisor roles) */}
            {!isSupervisor && favoriteItems.length > 0 && !searchQuery && (
              <div className="space-y-1">
                <div className={twMerge(
                  "px-3 mb-1.5 flex items-center justify-between",
                  isSidebarCollapsed && "md:justify-center md:px-0"
                )}>
                  <p className="text-[9px] font-bold tracking-widest text-[#64748B] uppercase">
                    {isSidebarCollapsed ? "Recent" : "Favorites / Recent"}
                  </p>
                  {!isSidebarCollapsed && recentOpenedItems.length > 0 && (
                    <span className="text-[8px] font-bold text-[#0878F9] uppercase tracking-wider bg-[#0878F9]/10 px-1.5 py-0.2 rounded border border-[#0878F9]/30">
                      Recent
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {favoriteItems.map(item => {
                    const isActive = item.fullHref === activeItem?.fullHref;
                    return (
                      <Link
                        key={item.name}
                        href={item.fullHref}
                        onClick={() => recordRecentOpenedItem(item.name)}
                        className={twMerge(
                          "flex items-center gap-3 px-3 rounded-lg transition-all duration-150 group/fav relative min-w-0",
                          fontSizeConfig.itemPy,
                          fontSizeConfig.itemText,
                          isActive 
                            ? "text-white font-semibold bg-[#0878F9] shadow-md shadow-blue-500/30" 
                            : "text-[#CBD5E1] hover:text-white hover:bg-[#0D2A54]",
                          isSidebarCollapsed && "justify-center px-0"
                        )}
                      >
                        <item.icon className={clsx(
                          "w-4 h-4 flex-shrink-0 transition-colors", 
                          isActive ? "text-white" : "text-[#94A3B8] group-hover/fav:text-white"
                        )} />
                        {!isSidebarCollapsed && <span className="font-medium truncate">{item.name}</span>}
                        
                        {isSidebarCollapsed && (
                          <span className={twMerge(
                            "absolute px-2.5 py-1.5 bg-[#061B3A] border border-[#1E3A8A] text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover/fav:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50 shadow-xl",
                            tooltipPositionClass
                          )}>
                            {item.name}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modules Section */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-3 mb-1.5">
                <p className={twMerge(
                  "text-[9px] font-bold tracking-widest text-[#64748B] uppercase transition-all",
                  isSidebarCollapsed && "md:text-center md:px-0 w-full"
                )}>
                  {isSidebarCollapsed ? "Mods" : "Modules"}
                </p>
                {!isSidebarCollapsed && isDragReorderMode && (
                  <span className="text-[9px] text-[#FFC928] font-bold bg-[#FFC928]/10 px-1.5 py-0.5 rounded border border-[#FFC928]/30">
                    Reorder Active
                  </span>
                )}
              </div>

              <div className="space-y-0.5">
                {groupedMenu.map(group => {
                  const isGroupExpanded = searchQuery ? true : (expandedGroupId === group.id);
                  const isGroupActive = activeItem && group.itemNames.some(name => name.toLowerCase() === activeItem.name.toLowerCase());
                  
                  return (
                    <div 
                      key={group.id} 
                      draggable={isDragReorderMode}
                      onDragStart={(e) => handleGroupDragStart(e, group.id)}
                      onDragOver={(e) => handleGroupDragOver(e, group.id)}
                      onDragLeave={handleGroupDragLeave}
                      onDrop={(e) => handleGroupDrop(e, group.id)}
                      onDragEnd={handleGroupDragEnd}
                      className={twMerge(
                        "space-y-0.5 relative group/trigger-container transition-all duration-150 rounded-lg",
                        dragOverGroupId === group.id && "bg-[#0878F9]/20 ring-2 ring-[#0878F9] ring-dashed",
                        draggedGroupId === group.id && "opacity-40"
                      )}
                    >
                      <div className="flex items-center">
                        {isDragReorderMode && !isSidebarCollapsed && (
                          <div 
                            className="p-1 cursor-grab active:cursor-grabbing text-[#64748B] hover:text-[#FFC928] transition-colors flex-shrink-0"
                            title="Drag to reorder module"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {/* Module Group Trigger */}
                        <button
                          onClick={() => toggleGroup(group.id)}
                          title={isSidebarCollapsed ? group.name : undefined}
                          className={twMerge(
                            "w-full flex items-center justify-between px-3 rounded-lg text-[#CBD5E1] hover:text-white hover:bg-[#0D2A54] transition-all font-medium group/trigger relative cursor-pointer",
                            fontSizeConfig.groupText,
                            fontSizeConfig.itemPy,
                            isGroupActive && "text-white bg-[#0D2A54] font-semibold",
                            isSidebarCollapsed && "justify-center px-0"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <group.icon className={twMerge(
                              "w-4 h-4 flex-shrink-0 transition-colors", 
                              isGroupActive ? "text-[#0878F9]" : "text-[#94A3B8] group-hover/trigger:text-white"
                            )} />
                            {!isSidebarCollapsed && <span className="truncate">{group.name}</span>}
                          </div>
                          {!isSidebarCollapsed && (
                            <ChevronRight className={twMerge(
                              "w-3.5 h-3.5 text-[#64748B] transition-transform duration-150 flex-shrink-0", 
                              isGroupExpanded && "rotate-90 text-white"
                            )} />
                          )}

                          {/* Hover popover sub-menus in collapsed mode */}
                          {isSidebarCollapsed && (
                            <div className={twMerge(
                              "absolute top-0 p-2 bg-[#061B3A] border border-[#1E3A8A] text-white text-xs font-medium rounded-xl opacity-0 pointer-events-none group-hover/trigger:opacity-100 group-hover/trigger:pointer-events-auto scale-95 group-hover/trigger:scale-100 transition-all duration-150 whitespace-nowrap z-50 shadow-2xl min-w-[200px] flex flex-col gap-1",
                              isRightAligned 
                                ? "right-full mr-2 origin-right -translate-x-2 group-hover/trigger:translate-x-0" 
                                : "left-full ml-2 origin-left translate-x-2 group-hover/trigger:translate-x-0"
                            )}>
                              <div className="text-[9px] font-bold text-[#94A3B8] uppercase px-2.5 py-1.5 border-b border-[#0D2A54] tracking-wider">
                                {group.name}
                              </div>
                              <div className="py-1 space-y-0.5">
                                {group.items.map(subItem => {
                                  const isSubActive = subItem.fullHref === activeItem?.fullHref;
                                  return (
                                    <Link
                                      key={subItem.name}
                                      href={subItem.fullHref}
                                      onClick={() => recordRecentOpenedItem(subItem.name)}
                                      className={twMerge(
                                        "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs transition-colors font-medium",
                                        isSubActive 
                                          ? "bg-[#0878F9] text-white font-semibold"
                                          : "text-[#CBD5E1] hover:bg-[#0D2A54] hover:text-white"
                                      )}
                                    >
                                      <subItem.icon className={twMerge("w-3.5 h-3.5", isSubActive ? "text-white" : "text-[#94A3B8]")} />
                                      <span>{subItem.name}</span>
                                    </Link>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </button>
                      </div>

                      {/* Sub items (Expanded Accordion) */}
                      {!isSidebarCollapsed && (
                        <AnimatePresence initial={false}>
                          {isGroupExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15, ease: "easeInOut" }}
                              className={twMerge(
                                "overflow-hidden mt-0.5 space-y-0.5",
                                isDragReorderMode ? "pl-6" : "pl-3 border-l border-[#0D2A54] ml-3.5"
                              )}
                            >
                              {group.items.map(item => {
                                const isActive = item.fullHref === activeItem?.fullHref;
                                const isItemDragging = draggedSubItem?.groupId === group.id && draggedSubItem?.itemName === item.name;
                                const isItemDragOver = dragOverSubItem?.groupId === group.id && dragOverSubItem?.itemName === item.name;

                                return (
                                  <div
                                    key={item.name}
                                    draggable={isDragReorderMode}
                                    onDragStart={(e) => handleSubItemDragStart(e, group.id, item.name)}
                                    onDragOver={(e) => handleSubItemDragOver(e, group.id, item.name)}
                                    onDragLeave={handleSubItemDragLeave}
                                    onDrop={(e) => handleSubItemDrop(e, group.id, item.name)}
                                    onDragEnd={handleSubItemDragEnd}
                                    className={twMerge(
                                      "flex items-center gap-1 rounded-md transition-all group/sub-row",
                                      isItemDragOver && "bg-[#0878F9]/25 ring-1 ring-[#0878F9] ring-dashed",
                                      isItemDragging && "opacity-40"
                                    )}
                                  >
                                    {isDragReorderMode && (
                                      <div 
                                        className="p-1 cursor-grab active:cursor-grabbing text-[#64748B] hover:text-[#FFC928] flex-shrink-0"
                                        title="Drag to reorder sub-menu"
                                      >
                                        <GripVertical className="w-3 h-3" />
                                      </div>
                                    )}
                                    <Link
                                      href={item.fullHref}
                                      onClick={() => recordRecentOpenedItem(item.name)}
                                      className={twMerge(
                                        "flex-1 flex items-center gap-2.5 px-2.5 rounded-md transition-all duration-150 group/item relative min-w-0",
                                        fontSizeConfig.subText,
                                        fontSizeConfig.subPy,
                                        isActive 
                                          ? "text-white font-semibold bg-[#0878F9] shadow-sm" 
                                          : "text-[#94A3B8] hover:text-white hover:bg-[#0D2A54]"
                                      )}
                                    >
                                      <item.icon className={twMerge(
                                        fontSizeConfig.subIconSize,
                                        "flex-shrink-0 transition-colors", 
                                        isActive ? "text-white" : "text-[#64748B] group-hover/item:text-white"
                                      )} />
                                      <span className="font-medium truncate">{item.name}</span>
                                    </Link>
                                  </div>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </nav>

      {/* ── SIDEBAR BOTTOM ALIGNMENT & OPTIMIZATION BAR ──────────────────── */}
      {!isSidebarCollapsed ? (
        <div className="p-2.5 border-t border-[#0D2A54] bg-[#051731] flex items-center justify-between gap-1 flex-shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setIsOptimizeModalOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-[#0D2A54] text-[#94A3B8] hover:text-white transition-colors cursor-pointer flex-1 truncate"
            title="Customize Sidebar Menus, Sub-menus & Font Size"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#0878F9] flex-shrink-0" />
            <span className="truncate text-[11px] font-medium">Customize Menus</span>
          </button>
          
          <button
            type="button"
            onClick={toggleDragReorderMode}
            className={twMerge(
              "p-1.5 rounded-md transition-colors cursor-pointer flex-shrink-0",
              isDragReorderMode 
                ? "bg-[#FFC928]/20 text-[#FFC928] border border-[#FFC928]/40" 
                : "hover:bg-[#0D2A54] text-[#94A3B8] hover:text-white"
            )}
            title={isDragReorderMode ? "Done reordering (Exit drag mode)" : "Quick In-Sidebar Drag Handles"}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={toggleSidebarPosition}
            className="p-1.5 rounded-md hover:bg-[#0D2A54] text-[#94A3B8] hover:text-white transition-colors cursor-pointer flex-shrink-0"
            title={`Dock Sidebar to ${isRightAligned ? "Left" : "Right"}`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="p-2 border-t border-[#0D2A54] bg-[#051731] flex flex-col items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => setIsOptimizeModalOpen(true)}
            className="p-1.5 rounded-md hover:bg-[#0D2A54] text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
            title="Sidebar Menu Customizer"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#0878F9]" />
          </button>
        </div>
      )}

      {/* ── MODAL: CLEAN WHITE BACKGROUND & BLUE/BLACK THEMED CUSTOMIZER ───── */}
      {mounted && isOptimizeModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl shadow-2xl text-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[#0878F9] shadow-sm">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Sidebar Navigation Customizer
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-50 text-[#0878F9] border border-blue-200 font-semibold">
                      Drag & Drop
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Customize menu and sub-menu hierarchy, docking, width scale, and sidebar font size
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOptimizeModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Sizing, Font Size & Dock Controls Bar */}
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Dock side */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Dock:</span>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setSidebarPosition("left");
                        toast.success("Sidebar docked to Left");
                      }}
                      className={twMerge(
                        "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5",
                        sidebarPosition === "left"
                          ? "bg-[#0878F9] text-white shadow-sm font-semibold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      )}
                    >
                      <PanelLeft className="w-3.5 h-3.5" />
                      Left
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSidebarPosition("right");
                        toast.success("Sidebar docked to Right");
                      }}
                      className={twMerge(
                        "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5",
                        sidebarPosition === "right"
                          ? "bg-[#0878F9] text-white shadow-sm font-semibold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      )}
                    >
                      <PanelRight className="w-3.5 h-3.5" />
                      Right
                    </button>
                  </div>
                </div>

                {/* Width scale */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Width:</span>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                    {[
                      { id: "compact" as const, label: "Compact (210px)" },
                      { id: "standard" as const, label: "Standard (240px)" },
                      { id: "wide" as const, label: "Wide (280px)" }
                    ].map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          setSidebarWidth(w.id);
                          toast.success(`Width set to ${w.label}`);
                        }}
                        className={twMerge(
                          "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer",
                          sidebarWidth === w.id
                            ? "bg-[#0878F9] text-white shadow-sm font-semibold"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        )}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size Option (Requested by User) */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Font Size:</span>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
                    {[
                      { id: "standard" as const, label: "Standard (12px)" },
                      { id: "medium" as const, label: "Medium (13px)" },
                      { id: "large" as const, label: "Large (14px)" }
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setSidebarFontSize(f.id);
                          toast.success(`Font size set to ${f.label}`);
                        }}
                        className={twMerge(
                          "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer",
                          sidebarFontSize === f.id
                            ? "bg-[#0878F9] text-white shadow-sm font-semibold"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* In-sidebar direct drag switch */}
              <button
                type="button"
                onClick={toggleDragReorderMode}
                className={twMerge(
                  "px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 shadow-sm",
                  isDragReorderMode
                    ? "bg-amber-50 border-amber-300 text-amber-700"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                )}
              >
                <GripVertical className="w-3.5 h-3.5" />
                <span>{isDragReorderMode ? "In-Sidebar Drag Active" : "Enable In-Sidebar Drag"}</span>
              </button>
            </div>

            {/* Modal Body: 2-Column Split Workspace (Clean White Theme) */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-5 text-xs bg-white">
              
              {/* Column 1: Top-Level Menus (Modules) */}
              <div className="md:col-span-5 flex flex-col gap-2 min-h-0">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <span>1. Top-Level Menus</span>
                      <span className="text-[10px] text-[#0878F9] font-mono font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        {orderedGroupsConfig.length} Modules
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500">Drag handles or click arrows. Select a menu to customize its sub-menus.</p>
                  </div>
                </div>

                <div className="space-y-1.5 overflow-y-auto flex-1 pr-1 max-h-[460px]">
                  {orderedGroupsConfig.map((grp, idx) => {
                    const isSelected = (selectedCustomizerGroupId || orderedGroupsConfig[0]?.id) === grp.id;
                    const isDragOver = dragOverGroupId === grp.id;
                    const isDragging = draggedGroupId === grp.id;
                    const groupItemCount = grp.itemNames.length;

                    return (
                      <div
                        key={grp.id}
                        draggable
                        onDragStart={(e) => handleGroupDragStart(e, grp.id)}
                        onDragOver={(e) => handleGroupDragOver(e, grp.id)}
                        onDragLeave={handleGroupDragLeave}
                        onDrop={(e) => handleGroupDrop(e, grp.id)}
                        onDragEnd={handleGroupDragEnd}
                        onClick={() => setSelectedCustomizerGroupId(grp.id)}
                        className={twMerge(
                          "flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all cursor-pointer select-none",
                          isSelected
                            ? "bg-blue-50/80 border-[#0878F9] text-[#0878F9] shadow-sm ring-1 ring-[#0878F9]"
                            : "bg-white border-slate-200 text-slate-800 hover:border-blue-400 hover:bg-blue-50/30 shadow-sm",
                          isDragOver && "ring-2 ring-dashed ring-amber-400 bg-amber-50/50",
                          isDragging && "opacity-40"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div 
                            className="p-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-amber-500 transition-colors flex-shrink-0"
                            title="Drag to reorder"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <grp.icon className={twMerge(
                            "w-4 h-4 flex-shrink-0",
                            isSelected ? "text-[#0878F9]" : "text-slate-500"
                          )} />
                          <div className="min-w-0">
                            <span className={twMerge(
                              "font-semibold truncate block",
                              isSelected ? "text-blue-700" : "text-slate-900"
                            )}>{grp.name}</span>
                            <span className="text-[10px] text-slate-500 block">{groupItemCount} sub-menus</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveGroup(grp.id, "up");
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                            title="Move Up"
                          >
                            <MoveUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === orderedGroupsConfig.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveGroup(grp.id, "down");
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                            title="Move Down"
                          >
                            <MoveDown className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className={twMerge(
                            "w-4 h-4 transition-transform flex-shrink-0 ml-1",
                            isSelected ? "text-[#0878F9] translate-x-0.5" : "text-slate-400"
                          )} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Column 2: Sub-Menus (Child Items of Selected Menu) */}
              <div className="md:col-span-7 flex flex-col gap-2 min-h-0 bg-slate-50/70 border border-slate-200 rounded-2xl p-3.5 sm:p-4">
                {(() => {
                  const activeGroup = orderedGroupsConfig.find(g => g.id === (selectedCustomizerGroupId || orderedGroupsConfig[0]?.id)) || orderedGroupsConfig[0];
                  if (!activeGroup) {
                    return (
                      <div className="p-8 text-center text-slate-500">
                        Select a menu on the left to customize its sub-menus
                      </div>
                    );
                  }

                  const activeItemNames = getGroupItemNames(activeGroup);
                  const isCustomOrdered = Boolean(itemOrder[activeGroup.id] && itemOrder[activeGroup.id].length > 0);

                  return (
                    <>
                      {/* Sub-menu panel header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 flex-shrink-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-blue-50 border border-blue-200 text-[#0878F9] shadow-sm">
                            <activeGroup.icon className="w-4 h-4 flex-shrink-0" />
                          </div>
                          <div>
                            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 truncate">
                              2. Sub-Menus in {activeGroup.name}
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              Drag handles or use Up/Down arrows to reorder pages within this module
                            </p>
                          </div>
                        </div>

                        {isCustomOrdered && (
                          <button
                            type="button"
                            onClick={() => {
                              resetGroupItemsOrder(activeGroup.id);
                              toast.success(`Reset sub-menus in ${activeGroup.name} to default`);
                            }}
                            className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors flex-shrink-0 cursor-pointer font-medium shadow-sm"
                            title="Reset this module to original order"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset Order</span>
                          </button>
                        )}
                      </div>

                      {/* Sub-menu items list */}
                      <div className="space-y-1.5 overflow-y-auto flex-1 pr-1 max-h-[440px] pt-1">
                        {activeItemNames.map((subName, subIdx) => {
                          const meta = navItems.find(ni => ni.name.toLowerCase() === subName.toLowerCase());
                          const SubIcon = meta?.icon || FileText;
                          const subHref = meta?.href || "";
                          const isDragOver = dragOverSubItem?.groupId === activeGroup.id && dragOverSubItem?.itemName === subName;
                          const isDragging = draggedSubItem?.groupId === activeGroup.id && draggedSubItem?.itemName === subName;

                          return (
                            <div
                              key={subName}
                              draggable
                              onDragStart={(e) => handleSubItemDragStart(e, activeGroup.id, subName)}
                              onDragOver={(e) => handleSubItemDragOver(e, activeGroup.id, subName)}
                              onDragLeave={handleSubItemDragLeave}
                              onDrop={(e) => handleSubItemDrop(e, activeGroup.id, subName)}
                              onDragEnd={handleSubItemDragEnd}
                              className={twMerge(
                                "flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs transition-all cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-md select-none shadow-sm",
                                isDragOver && "ring-2 ring-dashed ring-[#0878F9] bg-blue-50/70 border-[#0878F9]",
                                isDragging && "opacity-40"
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div 
                                  className="p-1 text-slate-400 hover:text-amber-500 transition-colors flex-shrink-0"
                                  title="Drag to reorder sub-menu"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <SubIcon className="w-4 h-4 text-[#0878F9] flex-shrink-0" />
                                <div className="min-w-0">
                                  <span className="font-semibold text-slate-900 truncate block">{subName}</span>
                                  {subHref && (
                                    <span className="text-[10px] text-slate-500 font-mono truncate block">
                                      {subHref}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  disabled={subIdx === 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveSubItem(activeGroup.id, subName, "up");
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                                  title="Move Up"
                                >
                                  <MoveUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={subIdx === activeItemNames.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveSubItem(activeGroup.id, subName, "down");
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                                  title="Move Down"
                                >
                                  <MoveDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer (Clean Slate & Rose / Blue buttons) */}
            <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 text-xs">
              <button
                type="button"
                onClick={() => {
                  resetLayoutSettings();
                  toast.success("Sidebar menus, sub-menus & font size reset to factory defaults");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors text-xs font-semibold cursor-pointer shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All to Defaults</span>
              </button>

              <div className="text-[11px] text-slate-500 hidden sm:block">
                Drag items or click arrows • Font size & layout changes save automatically
              </div>

              <button
                type="button"
                onClick={() => setIsOptimizeModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-[#0878F9] hover:bg-blue-600 text-white font-semibold text-xs shadow-md transition-all cursor-pointer shadow-blue-500/20"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
}

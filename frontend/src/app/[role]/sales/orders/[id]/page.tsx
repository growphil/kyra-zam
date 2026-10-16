"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getMediaUrl } from "@/lib/api";
import { 
  ClipboardList, 
  ArrowLeft, 
  Loader2, 
  User, 
  Calendar, 
  Building2, 
  Mail, 
  Phone, 
  CheckCircle,
  AlertTriangle,
  Send,
  Plus,
  Trash,
  Check,
  X,
  CreditCard,
  Truck,
  Archive,
  BarChart3,
  Bookmark,
  MapPin,
  IndianRupee,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Upload,
  ExternalLink,
  Receipt,
  Clock,
  XCircle,
  Eye,
  Sparkles,
  Layers,
  CheckCircle2,
  CircleDot,
  Circle,
  Lock,
  Unlock,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Ban
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function SalesOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const roleSlug = params.role as string;
  const normalizedRole = (roleSlug || "").replace(/-/g, "_").toLowerCase();
  const isAccountant = normalizedRole === "accountant" || normalizedRole === "superadmin" || normalizedRole === "admin";
  const queryClient = useQueryClient();

  // Dialog / Form states
  const [reserveItemId, setReserveItemId] = useState("");
  const [reserveQty, setReserveQty] = useState(1);
  const [isReserveOpen, setIsReserveOpen] = useState(false);

  const [fulfillItemId, setFulfillItemId] = useState("");
  const [fulfillQty, setFulfillQty] = useState(0);
  const [cancelQty, setCancelQty] = useState(0);
  const [isFulfillOpen, setIsFulfillOpen] = useState(false);

  // Edit draft details
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({
    requiredDeliveryDate: "",
    priority: "NORMAL",
    assignedSalesUserId: "",
    paymentTerms: "",
    deliveryTerms: "",
    customerNotes: "",
    internalNotes: ""
  });

  // --- PAYMENT RECORDING MODAL STATE ---
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>("BANK_TRANSFER");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [bankDetails, setBankDetails] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [paymentProofUrl, setPaymentProofUrl] = useState<string>("");
  const [isUploadingProof, setIsUploadingProof] = useState<boolean>(false);

  // --- ACCOUNTANT REVIEW / REJECT STATE ---
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectPaymentId, setRejectPaymentId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);

  // --- ADMINISTRATIVE DIALOGS (Hold & Cancel) ---
  const [isHoldDialogOpen, setIsHoldDialogOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // --- DATA FETCHING ---
  const { data: order, isLoading } = useQuery({
    queryKey: ["sales-order-details", orderId],
    queryFn: async () => {
      const res = await api.get(`/crm/sales-orders/${orderId}`);
      setEditForm({
        requiredDeliveryDate: res.data.requiredDeliveryDate.split("T")[0],
        priority: res.data.priority,
        assignedSalesUserId: res.data.assignedSalesUserId || "",
        paymentTerms: res.data.paymentTerms,
        deliveryTerms: res.data.deliveryTerms,
        customerNotes: res.data.customerNotes || "",
        internalNotes: res.data.internalNotes || ""
      });
      return res.data;
    }
  });

  const { data: users } = useQuery({
    queryKey: ["crm-system-users"],
    queryFn: async () => (await api.get("/crm/users")).data
  });

  // --- MUTATIONS ---
  const confirmOrderMutation = useMutation({
    mutationFn: () => api.put(`/crm/sales-orders/${orderId}/confirm`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order-details"] });
      toast.success("Sales Order confirmed successfully");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Confirmation failed")
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.put(`/crm/sales-orders/${orderId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order-details"] });
      toast.success("Sales Order status changed");
      setIsHoldDialogOpen(false);
      setIsCancelDialogOpen(false);
      setHoldReason("");
      setCancelReason("");
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Status update failed")
  });

  const updateDraftMutation = useMutation({
    mutationFn: (data: any) => api.put(`/crm/sales-orders/${orderId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order-details"] });
      toast.success("Sales Order details updated");
      setIsEditOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Update failed")
  });

  const reserveStockMutation = useMutation({
    mutationFn: (data: { itemId: string; quantity: number }) => api.post(`/crm/sales-orders/${orderId}/reserve`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order-details"] });
      toast.success("Inventory stock successfully reserved");
      setIsReserveOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Reservation failed")
  });

  const spawnRequirementMutation = useMutation({
    mutationFn: (data: any) => api.post("/crm/production/requirements", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order-details"] });
      toast.success("Production Requirement spawned successfully");
      router.push(`/${roleSlug}/production/requirements`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to spawn Production Requirement")
  });

  const fulfillItemsMutation = useMutation({
    mutationFn: (data: { itemId: string; fulfilledQty: number; cancelledQty: number }) => api.put(`/crm/sales-orders/${orderId}/fulfill`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order-details"] });
      toast.success("Item fulfillment recorded");
      setIsFulfillOpen(false);
      setFulfillQty(0);
      setCancelQty(0);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Fulfillment update failed")
  });

  const createDispatchMutation = useMutation({
    mutationFn: (data: any) => api.post("/crm/dispatch/orders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order-details"] });
      toast.success("Dispatch Order spawned successfully!");
      router.push(`/${roleSlug}/dispatch/orders`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Dispatch order creation failed");
    }
  });

  // --- PAYMENT MUTATIONS ---
  const recordPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      return (await api.post("/crm/finance/payments", data)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order-details"] });
      queryClient.invalidateQueries({ queryKey: ["finance-payments-list"] });
      toast.success("Payment submitted for verification. Accountant notified!");
      setIsRecordPaymentOpen(false);
      setPaymentAmount("");
      setReferenceNumber("");
      setBankDetails("");
      setPaymentNotes("");
      setPaymentProofUrl("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Payment recording failed");
    }
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: (paymentId: string) => api.put(`/crm/finance/payments/${paymentId}/verify`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order-details"] });
      queryClient.invalidateQueries({ queryKey: ["finance-payments-list"] });
      toast.success("Payment verified & accepted!");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Verification failed");
    }
  });

  const rejectPaymentMutation = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) => 
      api.put(`/crm/finance/payments/${paymentId}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order-details"] });
      queryClient.invalidateQueries({ queryKey: ["finance-payments-list"] });
      toast.success("Payment rejected. Submitter notified with reason.");
      setIsRejectDialogOpen(false);
      setRejectPaymentId(null);
      setRejectReason("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Payment rejection failed");
    }
  });

  // Proof Upload Handler
  const handleProofFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setIsUploadingProof(true);
    try {
      const res = await api.post("/crm/finance/upload-proof", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setPaymentProofUrl(res.data.url);
      toast.success("Payment proof uploaded successfully");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to upload payment proof");
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid payment amount greater than 0");
      return;
    }

    const orderTotal = parseFloat(order.grandTotal.toString());
    const verifiedPaid = order.payments?.filter((p: any) => p.status === "VERIFIED")
      .reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0) || 0;
    const remaining = Math.max(0, orderTotal - verifiedPaid);

    if (amt > remaining) {
      toast.error(`Payment cannot exceed the remaining balance of ₹${remaining.toLocaleString()}`);
      return;
    }

    recordPaymentMutation.mutate({
      salesOrderId: order.id,
      amount: amt,
      paymentMethod,
      paymentDate: new Date(paymentDate).toISOString(),
      referenceNumber: referenceNumber || null,
      bankDetails: bankDetails || null,
      notes: paymentNotes || null,
      paymentProofUrl: paymentProofUrl || null
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-12 text-center text-[#526B91]">
        <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <p className="font-bold">Sales Order file not found</p>
      </div>
    );
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateDraftMutation.mutate(editForm);
  };

  const isOverdue = new Date(order.requiredDeliveryDate) < new Date() && order.status !== "FULFILLED" && order.status !== "CANCELLED";

  // Financial clearance calculations
  const orderTotal = parseFloat(order.grandTotal.toString());
  const verifiedPaid = order.payments?.filter((p: any) => p.status === "VERIFIED")
    .reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0) || 0;
  const pendingPaid = order.payments?.filter((p: any) => p.status === "PENDING_VERIFICATION")
    .reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0) || 0;
  const remainingPayable = Math.max(0, orderTotal - verifiedPaid);

  const isAccountantRole = ["ACCOUNTANT", "ADMIN", "SUPERADMIN"].includes(roleSlug?.toUpperCase?.() || "");
  const canManageFulfillment = order.status !== "CANCELLED" && order.status !== "DRAFT";
  const canSpawnProduction = ["accountant", "admin", "superadmin", "sales_executive"].includes(normalizedRole);

  // Display payment status
  let displayPaymentStatus = order.paymentStatus;
  let paymentBadgeColor = "bg-slate-500/15 text-[#526B91] border-slate-500/20";
  if (order.isFinancialCleared || verifiedPaid >= orderTotal) {
    displayPaymentStatus = "FULLY PAID";
    paymentBadgeColor = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  } else if (pendingPaid > 0) {
    displayPaymentStatus = "PAYMENT VERIFICATION PENDING";
    paymentBadgeColor = "bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse";
  } else if (verifiedPaid > 0) {
    displayPaymentStatus = "PARTIALLY PAID";
    paymentBadgeColor = "bg-blue-500/15 text-blue-400 border-blue-500/30";
  } else {
    displayPaymentStatus = "PAYMENT PENDING";
    paymentBadgeColor = "bg-slate-500/15 text-[#526B91] border-slate-500/20";
  }

  // --- STATE-DRIVEN PROGRESS DERIVATIONS ---
  const isQuotationApproved = Boolean(order.quotation);
  const isCustomerAccepted = Boolean(order.quotation); // quotation must be ACCEPTED to convert
  const isOrderConfirmed = order.status !== "DRAFT";
  const isPaymentPending = remainingPayable > 0;
  const hasPendingVerification = pendingPaid > 0;
  const isFullPaymentVerified = verifiedPaid >= orderTotal;
  const isFinancialCleared = order.isFinancialCleared;
  const isProductionActive = order.items?.some((i: any) => i.quantityFulfilled > 0) || order.status === "IN_FULFILLMENT" || order.status === "PARTIALLY_FULFILLED";
  const isFulfilled = order.status === "FULFILLED";

  return (
    <div className="space-y-4 text-[#0B2148]">
      
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.push(`/${roleSlug}/sales/orders`)}
          className="flex items-center gap-2 text-[#526B91] hover:text-[#0B2148] hover:bg-[#EAF5FF] hover:border-[#0878F9]/40 font-bold text-sm bg-white border border-[#D8E8FA] px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Orders
        </button>

        {order.status === "DRAFT" && (
          <button 
            onClick={() => {
              setEditForm({
                requiredDeliveryDate: order.requiredDeliveryDate.split("T")[0],
                priority: order.priority,
                assignedSalesUserId: order.assignedSalesUserId || "",
                paymentTerms: order.paymentTerms,
                deliveryTerms: order.deliveryTerms,
                customerNotes: order.customerNotes || "",
                internalNotes: order.internalNotes || ""
              });
              setIsEditOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0665d0] text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
          >
            Modify Draft Details
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Details Overview, Progress Timeline & Admin Controls */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Order Overview Panel */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-6 shadow-xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Sales Order Number</span>
                <h2 className="text-2xl font-display font-bold text-[#0B2148] mt-1 font-mono">{order.salesOrderNumber}</h2>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                order.status === "FULFILLED" ? "bg-emerald-50 text-[#166534] border border-emerald-200" :
                order.status === "CANCELLED" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                order.status === "ON_HOLD" ? "bg-amber-50 text-amber-800 border border-amber-200" :
                order.status === "IN_FULFILLMENT" || order.status === "PARTIALLY_FULFILLED" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                order.status === "READY_FOR_FULFILLMENT" ? "bg-emerald-50 text-[#166534] border border-emerald-200" :
                order.status === "CONFIRMED" ? "bg-blue-50 text-[#0878F9] border border-blue-200" :
                "bg-slate-100 text-[#526B91] border border-slate-200"
              }`}>
                {order.status}
              </span>
            </div>

            {/* Financial Clearance Live Status */}
            <div>
              {order.isFinancialCleared ? (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <ShieldCheck className="w-5 h-5 text-[#166534] shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-[#166534] uppercase tracking-widest block">Financially Cleared</span>
                    <p className="text-[10px] text-[#166534]/80 font-medium">Production workflow unlocked & ready</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                  <ShieldAlert className="w-5 h-5 text-amber-800 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest block">Not Cleared</span>
                    <p className="text-[10px] text-amber-800/80 font-medium">Awaiting full payment verification before production</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 text-sm text-[#0B2148] border-t border-[#D8E8FA] pt-4">
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-[#0878F9] mt-0.5" />
                <div>
                  <p className="font-bold text-[#0B2148]">{order.customer?.name}</p>
                  <p className="text-xs text-[#526B91]">Customer Code: {order.customer?.customerCode}</p>
                </div>
              </div>

              {/* Source quotation tracing */}
              {order.quotation && (
                <div className="flex items-start gap-3">
                  <Bookmark className="w-4 h-4 text-[#0878F9] mt-0.5" />
                  <div>
                    <a 
                      href={`/${roleSlug}/sales/quotations/${order.quotationId}`}
                      className="font-bold text-[#0878F9] hover:underline text-xs"
                    >
                      Quotation: {order.quotation.quotationNumber} (Rev {order.quotation.version})
                    </a>
                    <p className="text-[10px] text-[#526B91]">Converted from Accepted proposal</p>
                  </div>
                </div>
              )}

              {/* Addresses */}
              <div className="border-t border-[#D8E8FA] pt-4 space-y-3">
                <div>
                  <p className="text-xs text-[#526B91] font-bold uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    Billing Address Snapshot
                  </p>
                  <p className="text-xs text-[#0B2148] mt-1">{order.billingAddressSnapshot}</p>
                </div>
                <div>
                  <p className="text-xs text-[#526B91] font-bold uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    Shipping Address Snapshot
                  </p>
                  <p className="text-xs text-[#0B2148] mt-1">{order.shippingAddressSnapshot}</p>
                </div>
              </div>

              <div className="border-t border-[#D8E8FA] pt-4 grid grid-cols-2 gap-4 text-xs font-semibold text-[#526B91]">
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Date Created</p>
                  <p className="mt-0.5 text-[#0B2148]">{new Date(order.orderDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider">Delivery Target</p>
                  <p className={`mt-0.5 ${isOverdue ? "text-rose-700 font-bold" : "text-[#0B2148] font-semibold"}`}>
                    {new Date(order.requiredDeliveryDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* ORDER PROGRESS TIMELINE (Read-Only State-Driven) */}
          {/* ==================================================== */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8E8FA]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">Order Progress Lifecycle</h3>
              </div>
              <span className="text-[9px] font-mono text-[#166534] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                State-Driven
              </span>
            </div>

            <div className="space-y-3.5">
              
              {/* Step 1: Quotation Approved */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-[#166534]" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-[#0B2148]">Quotation Approved</p>
                  <p className="text-[10px] text-[#526B91]">
                    {order.quotation ? `Quotation ${order.quotation.quotationNumber} approved by Sales Executive` : "Direct order established"}
                  </p>
                </div>
              </div>

              {/* Step 2: Customer Accepted */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-[#166534]" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-[#0B2148]">Customer Accepted</p>
                  <p className="text-[10px] text-[#526B91]">Formal acceptance recorded & verified</p>
                </div>
              </div>

              {/* Step 3: Sales Order Created & Confirmed */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {isOrderConfirmed ? (
                    <CheckCircle2 className="w-4 h-4 text-[#166534]" />
                  ) : (
                    <CircleDot className="w-4 h-4 text-amber-400 animate-pulse" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-[#0B2148]">Sales Order Created</p>
                  <p className="text-[10px] text-[#526B91]">
                    {isOrderConfirmed ? "Order confirmed and ready for payment" : "Draft state - confirmation needed"}
                  </p>
                </div>
              </div>

              {/* Step 4: Customer Payment Pending / Recorded */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {isFullPaymentVerified ? (
                    <CheckCircle2 className="w-4 h-4 text-[#166534]" />
                  ) : hasPendingVerification ? (
                    <CircleDot className="w-4 h-4 text-amber-400 animate-pulse" />
                  ) : verifiedPaid > 0 ? (
                    <CircleDot className="w-4 h-4 text-blue-400" />
                  ) : (
                    <CircleDot className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-[#0B2148]">
                    {isFullPaymentVerified ? "Payment Completed" : hasPendingVerification ? "Payment Submitted" : verifiedPaid > 0 ? "Partial Payment" : "Payment Pending"}
                  </p>
                  <p className="text-[10px] text-[#526B91]">
                    {isFullPaymentVerified 
                      ? `Full ₹${orderTotal.toLocaleString()} verified` 
                      : hasPendingVerification 
                      ? `₹${pendingPaid.toLocaleString()} submitted • Verification in progress` 
                      : verifiedPaid > 0 
                      ? `₹${verifiedPaid.toLocaleString()} of ₹${orderTotal.toLocaleString()} verified` 
                      : `₹${remainingPayable.toLocaleString()} balance payable`}
                  </p>
                  {remainingPayable > 0 && order.status !== "CANCELLED" && order.status !== "DRAFT" && (
                    <button
                      type="button"
                      onClick={() => {
                        document.getElementById("payment-clearance-section")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="mt-1 text-[10px] font-bold text-[#0878F9] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Payment Section & Record →</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Step 5: Accountant Verification */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {isFullPaymentVerified ? (
                    <CheckCircle2 className="w-4 h-4 text-[#166534]" />
                  ) : hasPendingVerification ? (
                    <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                  ) : (
                    <Circle className="w-4 h-4 text-[#526B91]" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-[#0B2148]">Accountant Verification</p>
                  <p className="text-[10px] text-[#526B91]">
                    {isFullPaymentVerified 
                      ? "100% payments verified by Accountant" 
                      : hasPendingVerification 
                      ? "Accountant reviewing payment proof & deposit" 
                      : "Awaiting payment submission"}
                  </p>
                </div>
              </div>

              {/* Step 6: Financial Clearance Gate */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {isFinancialCleared ? (
                    <ShieldCheck className="w-4 h-4 text-[#166534]" />
                  ) : (
                    <Lock className="w-4 h-4 text-amber-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-[#0B2148]">Financial Clearance</p>
                  <p className="text-[10px] text-[#526B91]">
                    {isFinancialCleared 
                      ? "Financial clearance granted • Production unlocked" 
                      : "Locked • Requires full verified payment"}
                  </p>
                </div>
              </div>

              {/* Step 7: Production Operations */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {isFulfilled ? (
                    <CheckCircle2 className="w-4 h-4 text-[#166534]" />
                  ) : isProductionActive ? (
                    <CircleDot className="w-4 h-4 text-purple-600 animate-pulse" />
                  ) : isFinancialCleared ? (
                    <CircleDot className="w-4 h-4 text-[#0878F9]" />
                  ) : (
                    <Circle className="w-4 h-4 text-[#526B91]" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-[#0B2148]">Production Operations</p>
                  <p className="text-[10px] text-[#526B91]">
                    {isFulfilled 
                      ? "Production fully completed" 
                      : isProductionActive 
                      ? "Assembly & Testing in progress" 
                      : isFinancialCleared 
                      ? "Ready to spawn Production Requirement" 
                      : "Gated by Financial Clearance"}
                  </p>

                  {/* Quick Spawn Production Action (Restricted to Accountant, Admin, Super Admin, Sales Executive) */}
                  {isFinancialCleared && !isFulfilled && !isProductionActive && order?.items && order.items.length > 0 && canSpawnProduction && (
                    <div className="mt-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          const firstPendingItem = order.items.find((it: any) => it.quantityPending > 0) || order.items[0];
                          if (firstPendingItem) {
                            spawnRequirementMutation.mutate({
                              salesOrderId: order.id,
                              salesOrderItemId: firstPendingItem.id,
                              customerId: order.customerId,
                              productRef: firstPendingItem.productRef || firstPendingItem.description,
                              requiredQuantity: firstPendingItem.quantityPending > 0 ? firstPendingItem.quantityPending : firstPendingItem.quantityOrdered,
                              requiredDeliveryDate: order.requiredDeliveryDate,
                              priority: order.priority
                            });
                          }
                        }}
                        disabled={spawnRequirementMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0878F9] hover:bg-[#0665d0] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                      >
                        {spawnRequirementMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>Spawn Production Requirement</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 8: Fulfillment & Dispatch */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {isFulfilled ? (
                    <CheckCircle2 className="w-4 h-4 text-[#166534]" />
                  ) : (
                    <Circle className="w-4 h-4 text-[#526B91]" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-[#0B2148]">Dispatch & Fulfillment</p>
                  <p className="text-[10px] text-[#526B91]">
                    {isFulfilled ? "Order dispatched & delivered" : "Upcoming final fulfillment"}
                  </p>
                </div>
              </div>
            </div>

            {/* Contextual Jump Link (Eliminating duplicate modal trigger) */}
            {remainingPayable > 0 && order.status !== "CANCELLED" && order.status !== "DRAFT" && (
              <div className="pt-3 border-t border-[#D8E8FA] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#526B91] uppercase font-bold tracking-wider block">Outstanding Due</span>
                  <span className="text-xs font-mono font-bold text-amber-700">₹ {remainingPayable.toLocaleString()}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById("payment-clearance-section")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#EAF5FF] hover:bg-[#D8E8FA] text-[#0878F9] border border-[#0878F9]/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Jump to Payment & Clearance ↓</span>
                </button>
              </div>
            )}
          </div>

          {/* ==================================================== */}
          {/* ADMINISTRATIVE & EXCEPTION CONTROLS (Hold / Cancel) */}
          {/* ==================================================== */}
          {order.status !== "FULFILLED" && order.status !== "CANCELLED" && (
            <div className="glass-panel p-5 rounded-3xl border border-[#D8E8FA] bg-white space-y-3 shadow-sm">
              <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest block">
                Administrative & Exception Controls
              </span>

              <div className="flex flex-col gap-2">
                {order.status === "DRAFT" && (
                  <button 
                    onClick={() => confirmOrderMutation.mutate()}
                    className="w-full py-2 rounded-xl bg-[#0878F9] hover:bg-[#0665d0] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Confirm Sales Order
                  </button>
                )}

                {order.status === "ON_HOLD" ? (
                  <button 
                    onClick={() => updateStatusMutation.mutate("CONFIRMED")}
                    className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-[#166534] border border-emerald-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    Resume Order from Hold
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsHoldDialogOpen(true)}
                    className="w-full py-2 bg-white hover:bg-[#EAF5FF] hover:border-[#0878F9]/40 text-[#526B91] hover:text-[#0B2148] border border-[#D8E8FA] text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                    Place Order On Hold
                  </button>
                )}

                <button 
                  onClick={() => setIsCancelDialogOpen(true)}
                  className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Cancel Sales Order
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Columns: Line items & Payment / Financial Clearance */}
        <div className="lg:col-span-2 space-y-6">
          {/* ==================================================== */}
          {/* PAYMENT & FINANCIAL CLEARANCE SECTION */}
          {/* ==================================================== */}
          <div id="payment-clearance-section" className="p-6 sm:p-8 rounded-3xl border border-[#D8E8FA] bg-white space-y-6 shadow-xs relative">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#D8E8FA]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#166534]">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-display font-bold text-[#0B2148]">Payment & Financial Clearance</h3>
                  <p className="text-xs text-[#526B91]">Authoritative customer payments ledger & accounting verification gate</p>
                </div>
              </div>

              {/* Single Authoritative Record Payment Button */}
              {remainingPayable > 0 && order.status !== "CANCELLED" && order.status !== "DRAFT" ? (
                <button
                  type="button"
                  onClick={() => {
                    setPaymentAmount(remainingPayable.toString());
                    setIsRecordPaymentOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#0878F9] hover:bg-[#0665d0] text-white font-bold text-xs shadow-md shadow-[#0878F9]/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Record Payment
                </button>
              ) : remainingPayable === 0 ? (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[#166534] text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  Full Payment Verified
                </div>
              ) : null}
            </div>

            {/* Financial Summary 4-Column Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-1">
                <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Order Total</span>
                <p className="text-lg font-mono font-bold text-[#0B2148]">₹ {orderTotal.toLocaleString()}</p>
                <p className="text-[10px] text-[#526B91] font-medium">Grand Total Value</p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-1">
                <span className="text-[10px] font-bold text-[#166534] uppercase tracking-wider">Verified Paid</span>
                <p className="text-lg font-mono font-bold text-[#166534]">₹ {verifiedPaid.toLocaleString()}</p>
                <p className="text-[10px] text-[#166534]/80 font-medium">Accountant Accepted</p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-1">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Pending Verification</span>
                <p className="text-lg font-mono font-bold text-amber-700">₹ {pendingPaid.toLocaleString()}</p>
                <p className="text-[10px] text-amber-700/80 font-medium">Under Accountant Audit</p>
              </div>

              <div className={`p-4 rounded-2xl space-y-1 border ${remainingPayable === 0 ? "bg-emerald-50/60 border-emerald-200" : "bg-rose-50/60 border-rose-200"}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${remainingPayable === 0 ? "text-[#166534]" : "text-rose-800"}`}>
                  Remaining Balance
                </span>
                <p className={`text-lg font-mono font-bold ${remainingPayable === 0 ? "text-[#166534]" : "text-rose-700"}`}>
                  ₹ {remainingPayable.toLocaleString()}
                </p>
                <p className={`text-[10px] font-medium ${remainingPayable === 0 ? "text-[#166534]/80" : "text-rose-700/80"}`}>
                  {remainingPayable === 0 ? "All Dues Cleared" : "Outstanding to Clear"}
                </p>
              </div>
            </div>

            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-3 p-3.5 bg-[#F4F9FF] rounded-2xl border border-[#D8E8FA]">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#526B91] font-medium">Payment Status:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  displayPaymentStatus === "FULLY PAID" ? "bg-emerald-50 text-[#166534] border-emerald-200" :
                  displayPaymentStatus === "PAYMENT VERIFICATION PENDING" ? "bg-amber-50 text-amber-800 border-amber-200 animate-pulse" :
                  displayPaymentStatus === "PARTIALLY PAID" ? "bg-blue-50 text-[#0878F9] border-blue-200" :
                  "bg-slate-100 text-[#526B91] border-slate-200"
                }`}>
                  {displayPaymentStatus}
                </span>
              </div>

              <div className="h-4 w-[1px] bg-[#D8E8FA] hidden sm:block" />

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#526B91] font-medium">Financial Clearance:</span>
                {order.isFinancialCleared ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#166534] border border-emerald-200 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    CLEARED — PRODUCTION UNLOCKED
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    AWAITING FULL PAYMENT VERIFICATION
                  </span>
                )}
              </div>
            </div>

            {/* Payment Submissions & History Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider">Payment Transaction History</h4>
                <span className="text-[10px] text-[#526B91]">
                  {order.payments?.length || 0} {order.payments?.length === 1 ? "Record" : "Records"}
                </span>
              </div>
              
              {order.payments && order.payments.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-[#D8E8FA] bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#D8E8FA] text-[10px] uppercase font-bold text-[#526B91] tracking-wider bg-[#F4F9FF]">
                        <th className="p-3">Ref</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3">Method</th>
                        <th className="p-3">Txn / UTR Ref</th>
                        <th className="p-3">Payment Date</th>
                        <th className="p-3">Submitted By</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Receipt Proof</th>
                        {isAccountantRole && <th className="p-3 text-center">Accountant Audit</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                      {order.payments.map((p: any) => {
                        const isPending = p.status === "PENDING_VERIFICATION";
                        const isVerified = p.status === "VERIFIED";
                        const isRejected = p.status === "REJECTED";

                        return (
                          <tr key={p.id} className="hover:bg-[#F4F9FF] transition-colors">
                            <td className="p-3 font-mono font-bold text-[#0B2148] text-xs">{p.paymentReference}</td>
                            <td className="p-3 text-right font-mono font-bold text-[#166534]">
                              ₹ {parseFloat(p.amount).toLocaleString()}
                            </td>
                            <td className="p-3 uppercase font-semibold text-[11px] text-[#0B2148]">
                              {p.paymentMethod.replace(/_/g, " ")}
                            </td>
                            <td className="p-3 font-mono text-[#526B91] text-[11px]">
                              {p.referenceNumber || "-"}
                            </td>
                            <td className="p-3 text-[#526B91] font-mono">
                              {new Date(p.paymentDate).toLocaleDateString()}
                            </td>
                            <td className="p-3 text-[#526B91] text-[11px]">
                              {p.recordedBy?.name || "Sales User"}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                isVerified ? "bg-emerald-50 text-[#166534] border border-emerald-200" :
                                isPending ? "bg-amber-50 text-amber-800 border border-amber-200 animate-pulse" :
                                "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}>
                                {isVerified ? "VERIFIED" : isPending ? "PENDING REVIEW" : "REJECTED"}
                              </span>
                              {isRejected && p.rejectionReason && (
                                <div className="text-[9px] text-rose-600 italic mt-0.5 max-w-[150px] truncate" title={p.rejectionReason}>
                                  {p.rejectionReason}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {p.paymentProofUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedProofUrl(p.paymentProofUrl)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F4F9FF] hover:bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA] hover:border-[#0878F9]/40 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                >
                                  <FileText className="w-3 h-3 text-[#0878F9]" />
                                  View Proof
                                </button>
                              ) : (
                                <span className="text-[10px] text-[#526B91] italic">No document</span>
                              )}
                            </td>

                            {/* Accountant Quick Actions */}
                            {isAccountantRole && (
                              <td className="p-3 text-center">
                                {isPending ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => verifyPaymentMutation.mutate(p.id)}
                                      disabled={verifyPaymentMutation.isPending}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                                    >
                                      {verifyPaymentMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                      Verify
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectPaymentId(p.id);
                                        setRejectReason("");
                                        setIsRejectDialogOpen(true);
                                      }}
                                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                      Reject
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-[#526B91] font-mono">
                                    {isVerified ? `Verified by ${p.verifiedBy?.name || 'Accountant'}` : 'Closed'}
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 rounded-2xl border border-dashed border-[#D8E8FA] bg-[#F4F9FF] text-center text-[#526B91] space-y-2">
                  <Receipt className="w-8 h-8 text-[#526B91]/40 mx-auto" />
                  <p className="text-xs font-semibold text-[#0B2148]">No payment transactions recorded yet.</p>
                  <p className="text-[11px] text-[#526B91]">When customer submits payment or deposit evidence, record it here for Accountant verification.</p>
                  {remainingPayable > 0 && order.status !== "CANCELLED" && order.status !== "DRAFT" && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentAmount(remainingPayable.toString());
                        setIsRecordPaymentOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0878F9] hover:bg-[#0665d0] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer mt-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Record First Payment
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-1 border-b border-[#D8E8FA]">
              <h3 className="text-lg font-display font-bold text-[#0B2148]">Sales Order Line Items</h3>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#F4F9FF] text-[#0B2148] border border-[#D8E8FA]">
                {order.items?.length || 0} {order.items?.length === 1 ? "Item" : "Items"}
              </span>
            </div>
            
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-[#D8E8FA] text-[#526B91] font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Item Details & Specifications</th>
                    <th className="py-3 px-3 text-center">Qty Ordered</th>
                    <th className="py-3 px-3 text-center">Fulfillment Status</th>
                    <th className="py-3 px-3 text-center">Classification</th>
                    <th className="py-3 px-3 text-right">Line Total</th>
                    {canManageFulfillment && (
                      <th className="py-3 px-3 text-center">Fulfillment Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8F1FC] text-[#0B2148]">
                  {order.items?.map((item: any) => (
                    <tr key={item.id} className="hover:bg-[#F4F9FF] transition-colors">
                      {/* Item Details */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-[#0B2148] text-sm">{item.description}</div>
                        {item.productRef && (
                          <div className="text-[11px] text-[#526B91] font-mono mt-0.5">
                            <span className="text-[#526B91] font-sans">SKU:</span> {item.productRef}
                          </div>
                        )}
                      </td>

                      {/* Qty Ordered */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-mono font-bold text-[#0B2148] text-sm">{item.quantityOrdered}</span>
                        <span className="text-[10px] text-[#526B91] ml-1">units</span>
                      </td>

                      {/* Fulfillment Status */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {item.quantityPending === 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#166534] border border-emerald-200">
                              ✓ Completed ({item.quantityFulfilled})
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 font-mono text-[10px]">
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#166534] border border-emerald-200 font-semibold" title="Quantity Fulfilled">
                                Done: {item.quantityFulfilled || 0}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold" title="Quantity Pending">
                                Pending: {item.quantityPending}
                              </span>
                            </div>
                          )}
                          {item.quantityCancelled > 0 && (
                            <span className="text-[9px] text-rose-700 font-mono">
                              Cancelled: {item.quantityCancelled}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Classification */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="px-2.5 py-1 bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg text-[10px] font-bold text-[#0B2148] font-mono">
                          {item.fulfillmentType || "STANDARD"}
                        </span>
                      </td>

                      {/* Line Total */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="font-bold text-[#0B2148] font-mono text-sm">
                          {order.currency} {parseFloat(item.lineTotal?.toString() || "0").toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>

                      {/* Actions (Rendered for all operational roles when order is active) */}
                      {canManageFulfillment && (
                        <td className="py-3.5 px-3 text-center">
                          <div className="flex items-center justify-center flex-wrap gap-1.5">
                            {/* Spawn Production Requirement Gate (Restricted to Accountant, Admin, Super Admin, Sales Executive) */}
                            {canSpawnProduction && (
                              order.isFinancialCleared ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    spawnRequirementMutation.mutate({
                                      salesOrderId: order.id,
                                      salesOrderItemId: item.id,
                                      customerId: order.customerId,
                                      productRef: item.productRef || item.description,
                                      requiredQuantity: item.quantityPending > 0 ? item.quantityPending : item.quantityOrdered,
                                      requiredDeliveryDate: order.requiredDeliveryDate,
                                      priority: order.priority
                                    });
                                  }}
                                  disabled={spawnRequirementMutation.isPending}
                                  className="px-2.5 py-1 bg-[#0878F9] hover:bg-[#0665d0] text-white font-bold text-[10px] rounded-lg shadow-xs transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  {spawnRequirementMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                  <span>Spawn Production</span>
                                </button>
                              ) : (
                                <span 
                                  title="Production requirement is blocked until accountant verifies full customer payment."
                                  className="px-2.5 py-1 bg-amber-50 text-amber-800 font-semibold text-[10px] rounded-lg border border-amber-200 italic cursor-help"
                                >
                                  Awaiting Clearance
                                </span>
                              )
                            )}

                            {/* Create Dispatch */}
                            <button
                              type="button"
                              onClick={() => {
                                createDispatchMutation.mutate({
                                  salesOrderId: order.id,
                                  customerId: order.customerId,
                                  plannedDispatchDate: new Date().toISOString().split("T")[0],
                                  deliveryAddressSnapshot: order.shippingAddressSnapshot,
                                  priority: order.priority,
                                  items: [
                                    {
                                      salesOrderItemId: item.id,
                                      productRef: item.productRef,
                                      quantityOrdered: item.quantityOrdered,
                                      quantityDispatched: item.quantityPending
                                    }
                                  ]
                                });
                              }}
                              disabled={item.quantityPending === 0 || createDispatchMutation.isPending}
                              className="px-2.5 py-1 bg-white hover:bg-[#EAF5FF] text-[#0878F9] font-bold text-[10px] rounded-lg border border-[#D8E8FA] hover:border-[#0878F9]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                              Dispatch
                            </button>

                            {/* Reservation trigger */}
                            {item.materialId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReserveItemId(item.id);
                                  setReserveQty(item.quantityPending);
                                  setIsReserveOpen(true);
                                }}
                                disabled={item.quantityPending === 0}
                                className="px-2.5 py-1 bg-white hover:bg-[#F4F9FF] border border-[#D8E8FA] rounded-lg text-[10px] font-bold text-[#0B2148] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                              >
                                Reserve
                              </button>
                            )}

                            {/* Fulfillment update */}
                            <button
                              type="button"
                              onClick={() => {
                                setFulfillItemId(item.id);
                                setFulfillQty(item.quantityPending);
                                setIsFulfillOpen(true);
                              }}
                              disabled={item.quantityPending === 0}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#166534] font-bold text-[10px] rounded-lg border border-emerald-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                              Fulfill
                            </button>
                          </div>
                        </td>
                      )}
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
          </div>

          {/* Pricing calculations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Address Details card */}
            <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
              <h4 className="text-sm font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA]">Order Delivery Terms</h4>
              <div className="space-y-3 text-xs text-[#0B2148]">
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Delivery Terms</p>
                  <p className="mt-0.5 font-semibold text-[#0B2148]">{order.deliveryTerms}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Payment Terms</p>
                  <p className="mt-0.5 font-semibold text-[#0B2148]">{order.paymentTerms}</p>
                </div>
                {order.customerNotes && (
                  <div>
                    <p className="text-[10px] text-[#526B91] uppercase tracking-wider font-bold">Customer Notes</p>
                    <p className="mt-0.5 text-[#526B91]">{order.customerNotes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Total financial totals */}
            <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
              <h4 className="text-sm font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA]">Quotation Calculation Breakdown</h4>
              <div className="space-y-3 text-xs text-[#526B91]">
                <div className="flex justify-between">
                  <span>Subtotal sum:</span>
                  <span className="font-mono text-[#0B2148]">INR {parseFloat(order.subtotal.toString()).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discounts applied:</span>
                  <span className="font-mono text-[#0B2148]">- INR {parseFloat(order.discount.toString()).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes (GST):</span>
                  <span className="font-mono text-[#0B2148]">INR {parseFloat(order.tax.toString()).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Freight charges:</span>
                  <span className="font-mono text-[#0B2148]">INR {parseFloat(order.additionalCharges.toString()).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-[#0B2148] pt-2 border-t border-[#D8E8FA]">
                  <span>Grand Total:</span>
                  <span className="font-mono text-[#166534] font-bold">INR {parseFloat(order.grandTotal.toString()).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Reservations timeline and items */}
          <div className="glass-panel p-6 rounded-3xl border border-[#D8E8FA] bg-white space-y-4">
            <h3 className="text-sm font-bold text-[#526B91] uppercase tracking-wider pb-2 border-b border-[#D8E8FA]">
              Material Stock Booked Reservations
            </h3>
            {order.reservations?.length > 0 ? (
              <div className="space-y-3">
                {order.reservations.map((res: any) => (
                  <div key={res.id} className="p-4 rounded-xl border border-[#D8E8FA] bg-white/[0.01] flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#0B2148]">Material SKU: {res.material?.sku} ({res.material?.name})</p>
                      <p className="text-[10px] text-[#526B91] font-semibold mt-0.5">
                        Reserved Qty: {res.quantity} • Booked: {new Date(res.reservedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-[#166534] border border-emerald-200 rounded">
                      {res.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#526B91]">No active stock reservations registered on inventory materials.</p>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* RECORD PAYMENT MODAL (Spacious & Validated) */}
      {/* ==================================================== */}
      {isRecordPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="p-6 sm:p-8 rounded-3xl border border-[#D8E8FA] bg-white max-w-2xl md:max-w-3xl w-full mx-auto space-y-5 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-[#D8E8FA]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#166534] shadow-xs">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold text-[#0B2148]">Record Customer Payment</h3>
                  <p className="text-xs text-[#526B91]">Sales Order: <strong className="text-[#0B2148] font-mono">{order.salesOrderNumber}</strong> • {order.customer?.name}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsRecordPaymentOpen(false)}
                className="w-9 h-9 rounded-xl bg-[#F4F9FF] hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0B2148] border border-[#D8E8FA] flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Financial Status Summary Banner */}
            <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-[#D8E8FA] space-y-2.5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2.5 rounded-xl bg-white border border-[#D8E8FA]">
                  <span className="text-[10px] text-[#526B91] uppercase font-bold tracking-wider block">Order Total</span>
                  <span className="font-mono font-bold text-sm text-[#0B2148]">₹ {orderTotal.toLocaleString()}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <span className="text-[10px] text-[#166534] uppercase font-bold tracking-wider block">Verified Paid</span>
                  <span className="font-mono font-bold text-sm text-[#166534]">₹ {verifiedPaid.toLocaleString()}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200">
                  <span className="text-[10px] text-amber-800 uppercase font-bold tracking-wider block">Balance Due</span>
                  <span className="font-mono font-bold text-sm text-amber-700">₹ {remainingPayable.toLocaleString()}</span>
                </div>
              </div>
              <p className="text-[11px] text-[#526B91] text-center border-t border-[#D8E8FA] pt-2">
                Partial payments are accepted. Submitted payments are recorded as <strong className="text-[#0B2148]">PENDING_VERIFICATION</strong> and forwarded for Authorised Accountant verification.
              </p>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 text-xs">
              
              {/* Row 1: Payment Amount (with presets) & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                      Payment Amount (INR) *
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPaymentAmount(remainingPayable.toString())}
                        className="px-2 py-0.5 rounded-lg bg-[#EAF5FF] hover:bg-[#D8E8FA] text-[#0878F9] text-[10px] font-bold border border-[#0878F9]/30 transition-colors cursor-pointer"
                      >
                        Full (₹{remainingPayable.toLocaleString()})
                      </button>
                      {remainingPayable >= 2000 && (
                        <button
                          type="button"
                          onClick={() => setPaymentAmount((Math.round(remainingPayable / 2)).toString())}
                          className="px-2 py-0.5 rounded-lg bg-[#F4F9FF] hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0B2148] text-[10px] font-bold border border-[#D8E8FA] transition-colors cursor-pointer"
                        >
                          50%
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-[#526B91]">₹</span>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      min={1}
                      max={remainingPayable}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={`e.g. ${remainingPayable}`}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-[#0B2148] font-mono focus:outline-none focus:border-[#0878F9] focus:bg-white transition-all"
                    />
                  </div>
                  {parseFloat(paymentAmount) > remainingPayable && (
                    <p className="text-[11px] text-rose-600 font-semibold">
                      Amount cannot exceed remaining balance of ₹{remainingPayable.toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">
                    Payment Method *
                  </label>
                  <select 
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3.5 py-2.5 text-sm text-[#0B2148] font-medium focus:outline-none focus:border-[#0878F9] focus:bg-white transition-all"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT / RTGS</option>
                    <option value="UPI">UPI / QR Payment</option>
                    <option value="CHEQUE">Cheque / Demand Draft</option>
                    <option value="CARD">Credit / Debit Card</option>
                    <option value="CASH">Cash Deposit</option>
                    <option value="OTHER">Other Gateway</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Payment Date & Reference Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">
                    Payment Date *
                  </label>
                  <input 
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3.5 py-2.5 text-sm text-[#0B2148] font-medium focus:outline-none focus:border-[#0878F9] focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">
                    Transaction / UTR / Cheque Ref No.
                  </label>
                  <input 
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. UTR-98218821992, CHQ-402911"
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3.5 py-2.5 text-sm text-[#0B2148] font-mono focus:outline-none focus:border-[#0878F9] focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Row 3: Bank Account Details & Proof Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">
                    Bank Account / Deposited To (Optional)
                  </label>
                  <input 
                    type="text"
                    value={bankDetails}
                    onChange={(e) => setBankDetails(e.target.value)}
                    placeholder="e.g. HDFC Current A/c - 502000xxxx"
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3.5 py-2.5 text-sm text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">
                    Payment Proof / Receipt Document
                  </label>
                  
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer">
                      <div className="border border-dashed border-[#D8E8FA] hover:border-[#0878F9]/50 bg-[#F4F9FF] hover:bg-[#EAF5FF] px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-2 text-[#526B91] hover:text-[#0878F9] transition-all">
                        {isUploadingProof ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[#0878F9]" />
                        ) : (
                          <Upload className="w-4 h-4 text-[#0878F9]" />
                        )}
                        <span className="text-xs font-semibold">
                          {isUploadingProof ? "Uploading file..." : paymentProofUrl ? "Replace Attached Proof" : "Upload Receipt Image / PDF"}
                        </span>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        className="hidden" 
                        onChange={handleProofFileUpload} 
                        disabled={isUploadingProof}
                      />
                    </label>

                    {paymentProofUrl && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[#166534]">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 shrink-0 text-[#166534]" />
                          <span className="text-[11px] font-mono truncate max-w-[160px]">
                            {paymentProofUrl.split("/").pop()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={getMediaUrl(paymentProofUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-[#0878F9] hover:underline"
                          >
                            Preview
                          </a>
                          <button
                            type="button"
                            onClick={() => setPaymentProofUrl("")}
                            className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 4: Remarks / Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block">
                  Remarks / Internal Audit Notes (Optional)
                </label>
                <textarea 
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Enter any notes, deposit counter info, or notes for the Accountant audit..."
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl p-3 text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white resize-none transition-all"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex justify-end items-center gap-3 pt-4 border-t border-[#D8E8FA]">
                <button 
                  type="button"
                  onClick={() => setIsRecordPaymentOpen(false)}
                  className="px-5 py-2.5 bg-white border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] hover:bg-[#F4F9FF] text-xs font-bold rounded-xl cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={recordPaymentMutation.isPending || isUploadingProof || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > remainingPayable}
                  className="px-6 py-2.5 bg-[#0878F9] hover:bg-[#0665d0] text-white text-xs font-bold rounded-xl shadow-md shadow-[#0878F9]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                >
                  {recordPaymentMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit for Verification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* PLACE ON HOLD CONFIRMATION MODAL */}
      {/* ==================================================== */}
      {isHoldDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="p-6 rounded-3xl border border-amber-200 bg-white max-w-md w-full mx-auto space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-700 pb-2 border-b border-[#D8E8FA]">
              <div className="p-2 bg-amber-50 rounded-xl border border-amber-200">
                <PauseCircle className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-[#0B2148]">Place Order On Hold</h3>
            </div>

            <p className="text-xs text-[#0B2148]">
              Placing this Sales Order on hold will temporarily pause all downstream processing until resumed.
            </p>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                Hold Reason / Explanation (Optional)
              </label>
              <textarea
                rows={2}
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder="e.g. Customer requested schedule hold..."
                className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl p-3 text-xs text-[#0B2148] placeholder:text-[#526B91] focus:outline-none focus:border-amber-500 focus:bg-white resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsHoldDialogOpen(false)}
                className="px-4 py-2 bg-white border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updateStatusMutation.isPending}
                onClick={() => updateStatusMutation.mutate("ON_HOLD")}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {updateStatusMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Hold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* CANCEL ORDER CONFIRMATION MODAL */}
      {/* ==================================================== */}
      {isCancelDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="p-6 rounded-3xl border border-rose-200 bg-white max-w-md w-full mx-auto space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-700 pb-2 border-b border-[#D8E8FA]">
              <div className="p-2 bg-rose-50 rounded-xl border border-rose-200">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-[#0B2148]">Cancel Sales Order</h3>
            </div>

            <p className="text-xs text-[#0B2148]">
              Are you sure you want to cancel <strong className="text-[#0B2148] font-mono">{order.salesOrderNumber}</strong>? This action will release any reserved inventory materials and cannot be undone.
            </p>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                Cancellation Reason (Optional)
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer cancelled agreement..."
                className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl p-3 text-xs text-[#0B2148] placeholder:text-[#526B91] focus:outline-none focus:border-rose-500 focus:bg-white resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelDialogOpen(false)}
                className="px-4 py-2 bg-white border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] text-xs font-bold rounded-xl cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={updateStatusMutation.isPending}
                onClick={() => updateStatusMutation.mutate("CANCELLED")}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {updateStatusMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* REJECT PAYMENT DIALOG (Accountant) */}
      {/* ==================================================== */}
      {isRejectDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="p-6 rounded-3xl border border-rose-200 bg-white max-w-lg w-full mx-auto space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-700 pb-2 border-b border-[#D8E8FA]">
              <div className="p-2 bg-rose-50 rounded-xl border border-rose-200">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-[#0B2148]">Reject Payment Submission</h3>
            </div>

            <p className="text-xs text-[#0B2148]">
              Please enter the audit reason for rejecting this payment submission. The submitter will receive this feedback to provide corrected payment evidence.
            </p>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!rejectPaymentId) return;
                if (!rejectReason.trim()) {
                  toast.error("Rejection reason is required");
                  return;
                }
                rejectPaymentMutation.mutate({ paymentId: rejectPaymentId, reason: rejectReason.trim() });
              }} 
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                  Rejection Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Attached receipt proof does not match transaction UTR..."
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl p-3 text-xs text-[#0B2148] placeholder:text-[#526B91] focus:outline-none focus:border-rose-500 focus:bg-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRejectDialogOpen(false)}
                  className="px-4 py-2 bg-white border border-[#D8E8FA] text-[#526B91] hover:text-[#0B2148] text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectPaymentMutation.isPending}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {rejectPaymentMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* PAYMENT PROOF VIEWER MODAL */}
      {/* ==================================================== */}
      {selectedProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="p-6 rounded-3xl border border-[#D8E8FA] bg-white max-w-2xl w-full mx-auto space-y-4 shadow-2xl relative">
            <div className="flex justify-between items-center pb-3 border-b border-[#D8E8FA]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0878F9]" />
                <h3 className="text-sm font-bold text-[#0B2148] font-mono">Payment Proof Document</h3>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedProofUrl(null)}
                className="w-8 h-8 rounded-full bg-[#F4F9FF] hover:bg-[#EAF5FF] text-[#526B91] hover:text-[#0B2148] flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-center p-2 bg-[#F4F9FF] rounded-2xl max-h-[70vh] overflow-auto border border-[#D8E8FA]">
              {selectedProofUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                <img 
                  src={getMediaUrl(selectedProofUrl)} 
                  alt="Payment Proof" 
                  className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-sm" 
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.includes(":8000")) {
                      target.src = `http://localhost:8000${selectedProofUrl.startsWith('/') ? '' : '/'}${selectedProofUrl}`;
                    }
                  }}
                />
              ) : (
                <div className="p-8 text-center space-y-3">
                  <FileText className="w-12 h-12 text-[#0878F9] mx-auto" />
                  <p className="text-xs text-[#0B2148] font-mono">{selectedProofUrl.split("/").pop()}</p>
                  <a
                    href={getMediaUrl(selectedProofUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#0878F9] text-white font-bold text-xs rounded-xl hover:bg-[#0665d0] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Document in New Tab
                  </a>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#D8E8FA]">
              <a
                href={getMediaUrl(selectedProofUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#F4F9FF] hover:bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA] hover:border-[#0878F9]/40 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open File
              </a>
              <button
                type="button"
                onClick={() => setSelectedProofUrl(null)}
                className="px-4 py-2 bg-[#0878F9] text-white font-bold text-xs rounded-xl hover:bg-[#0665d0] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-out Edit dialog */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm p-4">
          <div className="p-6 rounded-3xl border border-[#D8E8FA] bg-white max-w-md w-full mx-4 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-[#D8E8FA]">
              <h3 className="text-lg font-bold text-[#0B2148]">Modify Draft Order</h3>
              <button type="button" onClick={() => setIsEditOpen(false)} className="text-[#526B91] hover:text-[#0B2148] cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Required Delivery Date *</label>
                <input 
                  type="date"
                  required
                  value={editForm.requiredDeliveryDate}
                  onChange={(e) => setEditForm({ ...editForm, requiredDeliveryDate: e.target.value })}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Order Priority *</label>
                <select 
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Sales Agent Owner</label>
                <select 
                  value={editForm.assignedSalesUserId}
                  onChange={(e) => setEditForm({ ...editForm, assignedSalesUserId: e.target.value })}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                >
                  <option value="">Choose Executive</option>
                  {users?.filter((u: any) => u.roles?.includes("SALES_EXECUTIVE") || u.role === "SALES_EXECUTIVE").map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name} (Sales Executive)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Payment Terms</label>
                  <input 
                    type="text"
                    value={editForm.paymentTerms}
                    onChange={(e) => setEditForm({ ...editForm, paymentTerms: e.target.value })}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Delivery Terms</label>
                  <input 
                    type="text"
                    value={editForm.deliveryTerms}
                    onChange={(e) => setEditForm({ ...editForm, deliveryTerms: e.target.value })}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Customer Term Notes</label>
                <textarea 
                  value={editForm.customerNotes}
                  onChange={(e) => setEditForm({ ...editForm, customerNotes: e.target.value })}
                  rows={2}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-3 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:bg-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsEditOpen(false)} className="px-4 py-2 bg-white border border-[#D8E8FA] text-[#526B91] text-xs font-bold rounded-xl cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[#0878F9] text-white text-xs font-bold rounded-xl hover:bg-[#0665d0] cursor-pointer">Save Draft Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Reservation Dialog */}
      {isReserveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm p-4">
          <div className="p-6 rounded-3xl border border-[#D8E8FA] bg-white max-w-sm w-full mx-4 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-[#0B2148]">Book Stock Reservation</h3>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Reserve Quantity</label>
              <input 
                type="number"
                min={1}
                value={reserveQty}
                onChange={(e) => setReserveQty(parseInt(e.target.value, 10))}
                className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2 text-sm text-[#0B2148] font-mono focus:outline-none focus:border-[#0878F9] focus:bg-white"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsReserveOpen(false)} className="px-4 py-2 rounded-xl text-[#526B91] bg-white border border-[#D8E8FA] text-xs font-bold cursor-pointer">Cancel</button>
              <button 
                onClick={() => reserveStockMutation.mutate({ itemId: reserveItemId, quantity: reserveQty })}
                disabled={reserveStockMutation.isPending}
                className="px-4 py-2 rounded-xl bg-[#0878F9] text-white text-xs font-bold hover:bg-[#0665d0] cursor-pointer"
              >
                Confirm Book
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fulfillment dialog */}
      {isFulfillOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/40 backdrop-blur-sm p-4">
          <div className="p-6 rounded-3xl border border-[#D8E8FA] bg-white max-w-sm w-full mx-4 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-[#0B2148]">Record Item Fulfillment</h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Fulfilled Qty</label>
                <input 
                  type="number"
                  min={0}
                  value={fulfillQty}
                  onChange={(e) => setFulfillQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2 text-sm text-[#0B2148] font-mono focus:outline-none focus:border-[#0878F9] focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Cancelled Qty</label>
                <input 
                  type="number"
                  min={0}
                  value={cancelQty}
                  onChange={(e) => setCancelQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl px-4 py-2 text-sm text-[#0B2148] font-mono focus:outline-none focus:border-[#0878F9] focus:bg-white"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setIsFulfillOpen(false)} className="px-4 py-2 rounded-xl text-[#526B91] bg-white border border-[#D8E8FA] text-xs font-bold cursor-pointer">Cancel</button>
              <button 
                onClick={() => fulfillItemsMutation.mutate({ itemId: fulfillItemId, fulfilledQty: fulfillQty, cancelledQty: cancelQty })}
                disabled={fulfillItemsMutation.isPending}
                className="px-4 py-2 rounded-xl bg-[#0878F9] text-white text-xs font-bold hover:bg-[#0665d0] cursor-pointer"
              >
                Log Fulfillment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

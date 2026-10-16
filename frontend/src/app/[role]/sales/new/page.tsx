"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  ShoppingCart, 
  Search, 
  Loader2, 
  CheckCircle2, 
  Package, 
  ShieldCheck, 
  User, 
  UserPlus, 
  DollarSign, 
  Truck, 
  QrCode, 
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  BadgeCheck,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/ui/PageHeader";

export default function NewSaleWorkflowPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roleSlug = params.role as string;
  const initialSerial = searchParams.get("serial") || "";
  const queryClient = useQueryClient();

  // Workflow State
  const [selectedPack, setSelectedPack] = useState<any>(null);
  const [scanInput, setScanInput] = useState(initialSerial);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Customer State
  const [customerMode, setCustomerMode] = useState<"SELECT" | "REGISTER">("SELECT");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [newCustCity, setNewCustCity] = useState("Default");
  const [newCustState, setNewCustState] = useState("Default");

  // Sale & Pricing State
  const [saleChannel, setSaleChannel] = useState<"CUSTOMER" | "VENDOR">("CUSTOMER");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [basePrice, setBasePrice] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(18); // Default 18% GST
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);

  // Query Finished Goods list for quick selection
  const { data: fgData, isLoading: loadingFG } = useQuery({
    queryKey: ["sales-fg-quick-list"],
    queryFn: async () => (await api.get("/sales/finished-goods", { params: { limit: 20 } })).data
  });

  // Query Customers list
  const { data: customersData, isLoading: loadingCustomers } = useQuery({
    queryKey: ["sales-customers-list", customerSearch],
    queryFn: async () => (await api.get("/sales/customers", { params: { search: customerSearch } })).data
  });

  // Query Vendors list
  const { data: vendorsData } = useQuery({
    queryKey: ["sales-vendors-list"],
    queryFn: async () => (await api.get("/sales/vendors")).data
  });

  // Automatically verify initial serial from URL
  useEffect(() => {
    if (initialSerial) {
      verifyPack(initialSerial);
    }
  }, [initialSerial]);

  // Pack Verification
  const verifyPack = async (serialToVerify: string) => {
    if (!serialToVerify.trim()) return;
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const res = await api.get(`/sales/finished-goods/verify/${encodeURIComponent(serialToVerify.trim())}`);
      if (res.data.eligible) {
        setSelectedPack(res.data.pack);
        setBasePrice(res.data.pack.configuredSellingPrice || 0);
        toast.success(`Verified: ${res.data.pack.paxSerial} (${res.data.pack.model})`);
      } else {
        setSelectedPack(null);
        setVerifyError(res.data.reason || "Pack is not eligible for sale");
        toast.error(res.data.reason || "Pack is not eligible for sale");
      }
    } catch (err: any) {
      setSelectedPack(null);
      const msg = err.response?.data?.reason || "Battery pack not found in Finished Goods or not eligible for sale.";
      setVerifyError(msg);
      toast.error(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  // Register New Customer Mutation
  const registerCustomerMutation = useMutation({
    mutationFn: (data: any) => api.post("/sales/customers", data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sales-customers-list"] });
      setSelectedCustomer(res.data);
      toast.success(`Customer ${res.data.name} (${res.data.customerCode}) registered successfully!`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Customer registration failed");
    }
  });

  const handleRegisterCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      toast.error("Customer name and phone number are required");
      return;
    }
    registerCustomerMutation.mutate({
      name: newCustName.trim(),
      phone: newCustPhone.trim(),
      email: newCustEmail.trim() || undefined,
      billingAddress: newCustAddress.trim() || "Storefront Counter Delivery",
      city: newCustCity,
      state: newCustState
    });
  };

  // Financial Calculations
  const calculatedTaxAmount = Math.round((basePrice * (taxRate / 100)) * 100) / 100;
  const calculatedGrandTotal = Math.max(0, basePrice + calculatedTaxAmount - Number(discount));

  // Submit Sale Mutation
  const handleConfirmSale = async () => {
    if (!selectedPack) {
      toast.error("Please select an eligible Finished Goods battery pack");
      return;
    }

    if (saleChannel === "CUSTOMER" && !selectedCustomer) {
      toast.error("Please select or register a customer for direct sale");
      return;
    }

    if (saleChannel === "VENDOR" && !selectedVendorId) {
      toast.error("Please select a vendor for wholesale distribution");
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = `SALE-${selectedPack.paxSerial}-${Date.now()}`;

    try {
      const payload: any = {
        paxSerial: selectedPack.paxSerial,
        saleType: saleChannel,
        vendorId: saleChannel === "VENDOR" ? selectedVendorId : null,
        customerId: selectedCustomer?.id || null,
        customerName: saleChannel === "CUSTOMER" ? selectedCustomer?.name : null,
        amount: calculatedGrandTotal,
        discount: Number(discount) || 0,
        taxRate: Number(taxRate) || 0,
        taxAmount: calculatedTaxAmount,
        notes: notes || "Direct Finished Goods Storefront Handover",
        idempotencyKey
      };

      const res = await api.post("/sales", payload);
      queryClient.invalidateQueries({ queryKey: ["sales-finished-goods-list"] });
      queryClient.invalidateQueries({ queryKey: ["sales-fg-quick-list"] });
      setCompletedSale(res.data);
      toast.success("Sale completed successfully! Warranty and dispatch authorized.");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to process sale. Please check eligibility.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        title="New Finished Goods Sale"
        description="Search/scan eligible battery pack, select customer, confirm pricing and authorize dispatch & warranty"
        icon={<ShoppingCart className="w-5 h-5 text-[#0878F9]" />}
        breadcrumbs={[
          { label: "Sales", href: `/${roleSlug}/sales` },
          { label: "Finished Goods", href: `/${roleSlug}/finished-goods` },
          { label: "New Sale" }
        ]}
        actions={
          <button
            onClick={() => router.push(`/${roleSlug}/finished-goods`)}
            className="px-3 py-1.5 border border-[#D8E8FA] hover:bg-white text-xs font-semibold rounded-xl text-[#0B2148] flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Finished Goods
          </button>
        }
      />

      {/* Sale Success Completion Card */}
      {completedSale ? (
        <div className="bg-white rounded-3xl border border-emerald-200 p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-4 border-b border-emerald-100 pb-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <BadgeCheck className="w-8 h-8" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-widest">
                Transaction Secured & Authorized
              </span>
              <h2 className="text-xl font-bold text-[#0B2148] mt-1">
                Sale Successfully Completed for {completedSale.paxSerial}
              </h2>
              <p className="text-xs text-[#526B91]">
                Existing payment verification, warehouse stock movement, dispatch authorization, and warranty activation completed.
              </p>
            </div>
          </div>

          {/* Generated Documents Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl">
              <p className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider">Sales Order</p>
              <p className="font-mono text-base font-bold text-[#0B2148] mt-1">
                {completedSale.salesOrderNumber || "SO-GENERATED"}
              </p>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded mt-2 inline-block">
                PAID & FULFILLED
              </span>
            </div>

            <div className="p-4 bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl">
              <p className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider">Dispatch Order</p>
              <p className="font-mono text-base font-bold text-[#0B2148] mt-1">
                {completedSale.dispatchNumber || "DO-GENERATED"}
              </p>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded mt-2 inline-block">
                DELIVERED
              </span>
            </div>

            <div className="p-4 bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl">
              <p className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider">Warranty Number</p>
              <p className="font-mono text-base font-bold text-[#0878F9] mt-1">
                {completedSale.warrantyNumber || "WAR-GENERATED"}
              </p>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded mt-2 inline-block">
                ACTIVE (12 MONTHS)
              </span>
            </div>

            <div className="p-4 bg-[#F4F9FF] border border-[#D8E8FA] rounded-2xl">
              <p className="text-[10px] uppercase font-bold text-[#526B91] tracking-wider">Final Sale Amount</p>
              <p className="font-mono text-base font-bold text-[#0B2148] mt-1">
                ₹{Number(completedSale.amount).toLocaleString("en-IN")}
              </p>
              <span className="text-[10px] font-bold text-[#526B91] mt-2 inline-block">
                Direct Store Collection
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => router.push(`/${roleSlug}/warranties`)}
              className="px-4 py-2 bg-[#061B3A] hover:bg-[#0B2148] text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-all"
            >
              <ShieldCheck className="w-4 h-4 text-[#0878F9]" />
              View Warranty Records
            </button>
            <button
              onClick={() => router.push(`/${roleSlug}/sales/history`)}
              className="px-4 py-2 bg-white border border-[#D8E8FA] hover:bg-[#F4F9FF] text-[#0B2148] text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-all"
            >
              <FileText className="w-4 h-4 text-[#526B91]" />
              View Sales History
            </button>
            <button
              onClick={() => {
                setCompletedSale(null);
                setSelectedPack(null);
                setSelectedCustomer(null);
                setScanInput("");
              }}
              className="px-4 py-2 bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer transition-all ml-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Start Another Sale
            </button>
          </div>
        </div>
      ) : (
        /* Workflow 3-Step Wizard Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Step 1 (Pack) & Step 2 (Customer) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* ── STEP 1: SELECT OR SCAN BATTERY PACK ─────────────────────── */}
            <div className="bg-white rounded-3xl border border-[#D8E8FA] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-[#0878F9] text-white text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <h3 className="text-sm font-bold text-[#0B2148]">
                    Select Finished Goods Battery Pack
                  </h3>
                </div>
                {selectedPack && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    PACK VERIFIED
                  </span>
                )}
              </div>

              {/* Barcode / Serial Scan or Input */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <QrCode className="w-4 h-4 text-[#526B91] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Scan sticker barcode or enter pack serial..."
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") verifyPack(scanInput); }}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-10 pr-4 py-2.5 text-xs font-mono font-bold text-[#0B2148] placeholder-[#64748B] focus:outline-none focus:bg-white focus:border-[#0878F9]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => verifyPack(scanInput)}
                  disabled={isVerifying || !scanInput.trim()}
                  className="px-4 py-2.5 bg-[#061B3A] hover:bg-[#0B2148] text-white text-xs font-semibold rounded-xl flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-all"
                >
                  {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify Pack"}
                </button>
              </div>

              {verifyError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              {/* Selected Pack Card */}
              {selectedPack ? (
                <div className="p-4 bg-[#F4F9FF] border border-blue-200 rounded-2xl space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-sm font-bold text-[#0B2148]">{selectedPack.paxSerial}</p>
                      <p className="text-xs font-semibold text-[#526B91]">{selectedPack.model}</p>
                    </div>
                    <span className="text-xs font-bold text-[#0878F9] font-mono">
                      ₹{selectedPack.configuredSellingPrice?.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                    <div className="p-2 bg-white rounded-lg border border-[#D8E8FA]">
                      <span className="text-[#526B91] block text-[9px] uppercase font-bold">Specs</span>
                      <span className="font-mono font-semibold text-[#0B2148]">
                        {selectedPack.specifications?.nominalVoltage}V {selectedPack.specifications?.nominalCapacity}Ah
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-[#D8E8FA]">
                      <span className="text-[#526B91] block text-[9px] uppercase font-bold">Warehouse</span>
                      <span className="font-mono font-semibold text-[#0B2148]">
                        {selectedPack.packing?.warehouseCode || "WH-FG"}
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-[#D8E8FA]">
                      <span className="text-[#526B91] block text-[9px] uppercase font-bold">Sticker</span>
                      <span className="font-mono font-semibold text-[#0B2148] truncate block">
                        {selectedPack.packing?.stickerNumber || "STK-VERIFIED"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Quick selection from available FG packs */
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">
                    Or select an available Finished Goods pack:
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                    {loadingFG ? (
                      <div className="p-6 text-center text-xs text-[#526B91]">Loading buffer...</div>
                    ) : fgData?.packs?.length > 0 ? (
                      fgData.packs.map((p: any) => (
                        <div
                          key={p.paxSerial}
                          onClick={() => {
                            setSelectedPack(p);
                            setScanInput(p.paxSerial);
                            setBasePrice(p.configuredSellingPrice || 0);
                            setVerifyError(null);
                          }}
                          className="p-3 bg-white hover:bg-[#EAF5FF] border border-[#D8E8FA] rounded-xl flex items-center justify-between cursor-pointer transition-all text-xs"
                        >
                          <div>
                            <span className="font-mono font-bold text-[#0B2148] block">{p.paxSerial}</span>
                            <span className="text-[11px] text-[#526B91]">{p.model}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-[#0878F9] block">
                              ₹{p.configuredSellingPrice?.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[10px] text-emerald-600 font-semibold">Available</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-xs text-[#526B91] bg-[#F4F9FF] rounded-xl">
                        No Finished Goods currently available.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── STEP 2: SELECT OR REGISTER CUSTOMER ─────────────────────── */}
            <div className="bg-white rounded-3xl border border-[#D8E8FA] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-[#0878F9] text-white text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <h3 className="text-sm font-bold text-[#0B2148]">
                    Select or Register Customer
                  </h3>
                </div>

                {/* Sale Channel Selector */}
                <div className="flex items-center bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setSaleChannel("CUSTOMER")}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${saleChannel === "CUSTOMER" ? "bg-[#0878F9] text-white shadow-xs" : "text-[#526B91] hover:text-[#0B2148]"}`}
                  >
                    Direct Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaleChannel("VENDOR")}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${saleChannel === "VENDOR" ? "bg-[#0878F9] text-white shadow-xs" : "text-[#526B91] hover:text-[#0B2148]"}`}
                  >
                    Vendor Distribution
                  </button>
                </div>
              </div>

              {saleChannel === "VENDOR" ? (
                /* Vendor Distribution Channel */
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider block">
                    Select Authorized Vendor
                  </label>
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2.5 px-4 text-xs font-semibold text-[#0B2148] focus:bg-white focus:border-[#0878F9] outline-none"
                  >
                    <option value="">Choose a wholesale vendor...</option>
                    {vendorsData?.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.name} ({v.phone || "No phone"})</option>
                    ))}
                  </select>
                </div>
              ) : (
                /* Direct Customer Selection & Registration */
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-[#E8F1FC] pb-2">
                    <button
                      type="button"
                      onClick={() => setCustomerMode("SELECT")}
                      className={`text-xs font-bold pb-1 cursor-pointer transition-all ${customerMode === "SELECT" ? "text-[#0878F9] border-b-2 border-[#0878F9]" : "text-[#526B91] hover:text-[#0B2148]"}`}
                    >
                      Existing Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerMode("REGISTER")}
                      className={`text-xs font-bold pb-1 cursor-pointer transition-all ${customerMode === "REGISTER" ? "text-[#0878F9] border-b-2 border-[#0878F9]" : "text-[#526B91] hover:text-[#0B2148]"}`}
                    >
                      + Register New Customer
                    </button>
                  </div>

                  {customerMode === "SELECT" ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="w-4 h-4 text-[#526B91] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search customer by name, code or phone..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-9 pr-4 py-2 text-xs text-[#0B2148] placeholder-[#64748B] focus:bg-white focus:border-[#0878F9] outline-none"
                        />
                      </div>

                      {/* Customer Selection Cards */}
                      <div className="max-h-44 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                        {loadingCustomers ? (
                          <div className="p-4 text-center text-xs text-[#526B91]">Loading customers...</div>
                        ) : customersData?.length > 0 ? (
                          customersData.map((c: any) => (
                            <div
                              key={c.id}
                              onClick={() => setSelectedCustomer(c)}
                              className={`p-3 rounded-xl border transition-all cursor-pointer text-xs flex items-center justify-between ${selectedCustomer?.id === c.id ? "bg-[#EAF5FF] border-[#0878F9] text-[#0878F9]" : "bg-white border-[#D8E8FA] hover:bg-[#F4F9FF] text-[#0B2148]"}`}
                            >
                              <div>
                                <span className="font-bold block">{c.name}</span>
                                <span className="text-[11px] text-[#526B91]">{c.phone} • {c.customerCode}</span>
                              </div>
                              {selectedCustomer?.id === c.id && (
                                <CheckCircle2 className="w-4 h-4 text-[#0878F9]" />
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-xs text-[#526B91]">No customers found. Click &quot;Register New Customer&quot; above.</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Register New Customer Form */
                    <form onSubmit={handleRegisterCustomer} className="space-y-3 bg-[#F4F9FF] p-4 rounded-2xl border border-[#D8E8FA]">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-[#526B91] uppercase block mb-1">Full Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="Customer Name"
                            value={newCustName}
                            onChange={(e) => setNewCustName(e.target.value)}
                            className="w-full bg-white border border-[#D8E8FA] rounded-lg p-2 text-xs text-[#0B2148] outline-none focus:border-[#0878F9]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#526B91] uppercase block mb-1">Phone Number *</label>
                          <input
                            type="tel"
                            required
                            placeholder="+91 98765 43210"
                            value={newCustPhone}
                            onChange={(e) => setNewCustPhone(e.target.value)}
                            className="w-full bg-white border border-[#D8E8FA] rounded-lg p-2 text-xs text-[#0B2148] outline-none focus:border-[#0878F9]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-[#526B91] uppercase block mb-1">Email (Optional)</label>
                          <input
                            type="email"
                            placeholder="customer@email.com"
                            value={newCustEmail}
                            onChange={(e) => setNewCustEmail(e.target.value)}
                            className="w-full bg-white border border-[#D8E8FA] rounded-lg p-2 text-xs text-[#0B2148] outline-none focus:border-[#0878F9]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#526B91] uppercase block mb-1">Delivery Address</label>
                          <input
                            type="text"
                            placeholder="Delivery Address / City"
                            value={newCustAddress}
                            onChange={(e) => setNewCustAddress(e.target.value)}
                            className="w-full bg-white border border-[#D8E8FA] rounded-lg p-2 text-xs text-[#0B2148] outline-none focus:border-[#0878F9]"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={registerCustomerMutation.isPending}
                        className="w-full py-2 bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      >
                        {registerCustomerMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                        Save & Select Customer
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Step 3 (Pricing, Taxes, Grand Total & Confirmation) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl border border-[#D8E8FA] p-6 shadow-xs space-y-5 sticky top-20">
              <div className="flex items-center gap-2.5 border-b border-[#E8F1FC] pb-3">
                <span className="w-6 h-6 rounded-full bg-[#0878F9] text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="text-sm font-bold text-[#0B2148]">
                  Price, Taxes & Order Confirmation
                </h3>
              </div>

              {/* Price Breakdown form */}
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block mb-1">
                    Configured Selling Price (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-[#526B91]">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={basePrice}
                      onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-8 pr-4 py-2 font-mono font-bold text-[#0B2148] outline-none focus:bg-white focus:border-[#0878F9]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block mb-1">
                      Applicable GST (%)
                    </label>
                    <select
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl py-2 px-3 text-xs font-semibold text-[#0B2148] focus:bg-white focus:border-[#0878F9] outline-none"
                    >
                      <option value={18}>18% GST (Standard)</option>
                      <option value={12}>12% GST (Concessional)</option>
                      <option value={5}>5% GST (Renewable)</option>
                      <option value={0}>0% Tax (Exempt)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block mb-1">
                      Approved Discount (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[#526B91]">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discount}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl pl-7 pr-3 py-2 font-mono text-xs font-semibold text-[#0B2148] outline-none focus:bg-white focus:border-[#0878F9]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider block mb-1">
                    Storefront Notes / Delivery Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="Direct collection notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl p-2 text-xs text-[#0B2148] outline-none focus:bg-white focus:border-[#0878F9]"
                  />
                </div>
              </div>

              {/* Total Calculation summary box */}
              <div className="p-4 bg-[#F4F9FF] rounded-2xl border border-[#D8E8FA] space-y-2 text-xs">
                <div className="flex justify-between text-[#526B91]">
                  <span>Base Subtotal:</span>
                  <span className="font-mono font-semibold text-[#0B2148]">₹{basePrice.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[#526B91]">
                  <span>GST ({taxRate}%):</span>
                  <span className="font-mono font-semibold text-[#0B2148]">+ ₹{calculatedTaxAmount.toLocaleString("en-IN")}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Approved Discount:</span>
                    <span className="font-mono font-semibold">- ₹{Number(discount).toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-[#D8E8FA] flex justify-between items-center text-sm font-bold text-[#0B2148]">
                  <span>Grand Total (Payable):</span>
                  <span className="font-mono text-base text-[#0878F9]">
                    ₹{calculatedGrandTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Strict Business Rules Checklist Notice */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5 text-[11px] text-[#061B3A]">
                <div className="flex items-center gap-1.5 font-bold text-[#0878F9]">
                  <ShieldCheck className="w-4 h-4" />
                  Automated Authorization on Handover:
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[#526B91] text-[10px]">
                  <li>Creates immediate Sales Order (FULFILLED) & Payment Verification</li>
                  <li>Generates Dispatch Order & Proof of Delivery</li>
                  <li>Deducts warehouse inventory stock ledger</li>
                  <li>Generates and activates 12-month standard warranty</li>
                </ul>
              </div>

              {/* Confirm Sale Button */}
              <button
                type="button"
                onClick={handleConfirmSale}
                disabled={isSubmitting || !selectedPack || (saleChannel === "CUSTOMER" && !selectedCustomer) || (saleChannel === "VENDOR" && !selectedVendorId)}
                className="w-full py-3.5 bg-[#0878F9] hover:bg-[#0667DB] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all uppercase tracking-wider"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Securing Transaction & Activating Warranty...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm Sale & Dispatch Handover
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

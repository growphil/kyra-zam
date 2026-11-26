"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Users, 
  Search, 
  Plus, 
  X, 
  Loader2, 
  Building2, 
  Phone, 
  Mail, 
  ArrowUpRight,
  User,
  UserPlus,
  UserCheck,
  Copy,
  Sparkles,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Eye,
  Check,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneInput } from "@/components/ui/PhoneInput";
import PageHeader from "@/components/ui/PageHeader";
import { validatePhoneNumber } from "@/lib/phoneValidation";
import { COUNTRIES, DEFAULT_COUNTRY, Country } from "@/lib/countries";
import { 
  INDIAN_STATES, 
  validateCustomerName, 
  validateContactPerson, 
  validateEmail, 
  validateGstin, 
  validatePostalCode, 
  formatAddressString 
} from "@/lib/customerValidation";

export default function CustomersPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  // Search & Filters
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Create Customer Drawer State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [customerType, setCustomerType] = useState<"INDIVIDUAL" | "BUSINESS">("INDIVIDUAL");
  const [customerName, setCustomerName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [alternatePhone, setAlternatePhone] = useState("");
  const [altPhoneCountry, setAltPhoneCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [taxGst, setTaxGst] = useState("");
  const [notes, setNotes] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");

  // Structured Billing Address State
  const [billingLine1, setBillingLine1] = useState("");
  const [billingLine2, setBillingLine2] = useState("");
  const [billingLandmark, setBillingLandmark] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingState, setBillingState] = useState("Tamil Nadu");
  const [billingCountry, setBillingCountry] = useState("India");
  const [billingPostalCode, setBillingPostalCode] = useState("");

  // Structured Shipping Address State
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [shippingLine1, setShippingLine1] = useState("");
  const [shippingLine2, setShippingLine2] = useState("");
  const [shippingLandmark, setShippingLandmark] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("Tamil Nadu");
  const [shippingCountry, setShippingCountry] = useState("India");
  const [shippingPostalCode, setShippingPostalCode] = useState("");

  // Validation Error State
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync shipping address when sameAsBilling is true
  const effectiveShippingLine1 = sameAsBilling ? billingLine1 : shippingLine1;
  const effectiveShippingLine2 = sameAsBilling ? billingLine2 : shippingLine2;
  const effectiveShippingLandmark = sameAsBilling ? billingLandmark : shippingLandmark;
  const effectiveShippingCity = sameAsBilling ? billingCity : shippingCity;
  const effectiveShippingState = sameAsBilling ? billingState : shippingState;
  const effectiveShippingCountry = sameAsBilling ? billingCountry : shippingCountry;
  const effectiveShippingPostalCode = sameAsBilling ? billingPostalCode : shippingPostalCode;

  // --- DATA FETCHING ---
  const { data, isLoading, isRefetching } = useQuery({
    queryKey: ["customers-list", search, type, status, page, limit],
    queryFn: async () => {
      const res = await api.get("/crm/customers", {
        params: { search, type, status, page, limit }
      });
      return res.data;
    }
  });

  const { data: users = [] } = useQuery({
    queryKey: ["crm-system-users"],
    queryFn: async () => (await api.get("/crm/users")).data || []
  });

  // --- MUTATIONS ---
  const createCustomerMutation = useMutation({
    mutationFn: (custData: any) => api.post("/crm/customers", custData),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["customers-list"] });
      toast.success(`Customer ${res.data?.customerCode || ""} registered successfully`);
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      if (err.response?.status === 409 && err.response?.data?.duplicateFound) {
        const existing = err.response.data.existingCustomer;
        toast.error(`Duplicate customer found: ${existing?.customerCode} - ${existing?.name}`);
      } else {
        toast.error(err.response?.data?.error || "Failed to create customer");
      }
    }
  });

  const resetForm = () => {
    setCustomerType("INDIVIDUAL");
    setCustomerName("");
    setContactPerson("");
    setEmail("");
    setPhone("");
    setAlternatePhone("");
    setTaxGst("");
    setNotes("");
    setAssignedUserId("");
    
    setBillingLine1("");
    setBillingLine2("");
    setBillingLandmark("");
    setBillingCity("");
    setBillingState("Tamil Nadu");
    setBillingCountry("India");
    setBillingPostalCode("");

    setSameAsBilling(true);
    setShippingLine1("");
    setShippingLine2("");
    setShippingLandmark("");
    setShippingCity("");
    setShippingState("Tamil Nadu");
    setShippingCountry("India");
    setShippingPostalCode("");

    setErrors({});
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    let firstInvalidId = "";

    // 1. Customer Name
    const nameVal = validateCustomerName(customerName, customerType);
    if (!nameVal.isValid) {
      errs.name = nameVal.error || "Invalid name";
      if (!firstInvalidId) firstInvalidId = "customer-name-input";
    }

    // 2. Contact Person for Business
    if (customerType === "BUSINESS" && contactPerson.trim()) {
      const cpVal = validateContactPerson(contactPerson);
      if (!cpVal.isValid) {
        errs.contactPerson = cpVal.error || "Invalid contact person";
        if (!firstInvalidId) firstInvalidId = "contact-person-input";
      }
    }

    // 3. Email Address
    const emailVal = validateEmail(email);
    if (!emailVal.isValid) {
      errs.email = emailVal.error || "Invalid email";
      if (!firstInvalidId) firstInvalidId = "customer-email-input";
    }

    // 4. Phone Number
    const phoneVal = validatePhoneNumber(phone, phoneCountry, true);
    if (!phoneVal.isValid) {
      errs.phone = phoneVal.error || "Invalid phone number";
      if (!firstInvalidId) firstInvalidId = "customer-phone-input";
    }

    // 5. Alternate Phone
    if (alternatePhone && alternatePhone.trim()) {
      const altVal = validatePhoneNumber(alternatePhone, altPhoneCountry, false);
      if (!altVal.isValid) {
        errs.alternatePhone = altVal.error || "Invalid alternate phone number";
        if (!firstInvalidId) firstInvalidId = "customer-altphone-input";
      }
    }

    // 6. GSTIN
    if (taxGst && taxGst.trim()) {
      if (!validateGstin(taxGst)) {
        errs.taxGst = "Invalid GSTIN structure (must be 15-character alphanumeric e.g. 33AATCM3839R1ZI)";
        if (!firstInvalidId) firstInvalidId = "customer-gst-input";
      }
    }

    // 7. Billing Address
    if (!billingLine1.trim()) {
      errs.billingLine1 = "Address Line 1 (Door / Building / Street) is required";
      if (!firstInvalidId) firstInvalidId = "billing-line1-input";
    }

    if (!billingCity.trim()) {
      errs.billingCity = "City is required";
      if (!firstInvalidId) firstInvalidId = "billing-city-input";
    }

    if (!billingState.trim()) {
      errs.billingState = "State is required";
      if (!firstInvalidId) firstInvalidId = "billing-state-input";
    }

    const billPinVal = validatePostalCode(billingPostalCode, billingCountry);
    if (!billPinVal.isValid) {
      errs.billingPostalCode = billPinVal.error || "Invalid postal code";
      if (!firstInvalidId) firstInvalidId = "billing-postal-input";
    }

    // 8. Shipping Address (if not same as billing)
    if (!sameAsBilling) {
      if (!shippingLine1.trim()) {
        errs.shippingLine1 = "Shipping Address Line 1 is required";
        if (!firstInvalidId) firstInvalidId = "shipping-line1-input";
      }

      if (!shippingCity.trim()) {
        errs.shippingCity = "Shipping City is required";
        if (!firstInvalidId) firstInvalidId = "shipping-city-input";
      }

      if (!shippingState.trim()) {
        errs.shippingState = "Shipping State is required";
        if (!firstInvalidId) firstInvalidId = "shipping-state-input";
      }

      const shipPinVal = validatePostalCode(shippingPostalCode, shippingCountry);
      if (!shipPinVal.isValid) {
        errs.shippingPostalCode = shipPinVal.error || "Invalid shipping postal code";
        if (!firstInvalidId) firstInvalidId = "shipping-postal-input";
      }
    }

    setErrors(errs);

    if (firstInvalidId) {
      const el = document.getElementById(firstInvalidId);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    return Object.keys(errs).length === 0;
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please fix the highlighted validation errors before submitting.");
      return;
    }

    const fullBillingAddress = formatAddressString(billingLine1, billingLine2, billingLandmark);
    const fullShippingAddress = sameAsBilling
      ? fullBillingAddress
      : formatAddressString(shippingLine1, shippingLine2, shippingLandmark);

    const formattedPhone = phone.startsWith("+") ? phone.trim() : `${phoneCountry.dialCode}${phone.trim()}`;
    const formattedAltPhone = alternatePhone.trim()
      ? (alternatePhone.startsWith("+") ? alternatePhone.trim() : `${altPhoneCountry.dialCode}${alternatePhone.trim()}`)
      : null;

    createCustomerMutation.mutate({
      type: customerType,
      name: customerName.trim(),
      contactPerson: customerType === "BUSINESS" && contactPerson.trim() ? contactPerson.trim() : null,
      email: email.trim().toLowerCase(),
      phone: formattedPhone,
      alternatePhone: formattedAltPhone,
      billingAddress: fullBillingAddress,
      shippingAddress: fullShippingAddress,
      city: billingCity.trim(),
      state: billingState.trim(),
      country: billingCountry.trim(),
      postalCode: billingPostalCode.trim(),
      taxGst: taxGst.trim().toUpperCase() || null,
      notes: notes.trim() || null,
      assignedUserId: assignedUserId || null
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const resetFilters = () => {
    setSearch("");
    setType("");
    setStatus("");
    setPage(1);
    toast.success("Filters reset successfully");
  };

  const customers = data?.customers || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  const getAvatarInitials = (name: string) => {
    return name
      .split(" ")
      .map(part => part.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, page - 2);
      let end = Math.min(totalPages, page + 2);
      if (start === 1) {
        end = maxVisiblePages;
      } else if (end === totalPages) {
        start = totalPages - maxVisiblePages + 1;
      }
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  const startRange = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRange = Math.min(page * limit, total);

  return (
    <div className="space-y-4 text-[#0B2148]">
      
      {/* 1. Standardized Compact Page Header */}
      <PageHeader
        title="Customer Accounts"
        description="Master repository for verified commercial buyers, individual clients, and industrial accounts."
        icon={<Building2 className="w-5 h-5 text-[#0878F9]" />}
        badge={
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
            {total} registered
          </span>
        }
        actions={
          <button 
            id="register-customer-btn"
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-semibold text-xs transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Register Customer
          </button>
        }
      />

      {/* 2. Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <div className="relative min-w-[280px] max-w-md flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#526B91]" />
            <input 
              type="text" 
              placeholder="Search by Customer ID (KY-001), name, email, phone, GSTIN..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-900 placeholder:text-[#526B91] focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          <select 
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
          >
            <option value="">All Types</option>
            <option value="INDIVIDUAL">Individual</option>
            <option value="BUSINESS">Business / Corporate</option>
          </select>

          <select 
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 text-slate-700 font-medium rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="BLOCKED">Blocked</option>
          </select>

          {(search || type || status) && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-xs font-semibold transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}
        </div>

        <div className="text-xs text-[#526B91] font-medium">
          Showing <span className="font-semibold text-slate-900">{startRange}–{endRange}</span> of <span className="font-semibold text-slate-900">{total}</span> customers
        </div>
      </div>

      {/* 3. Customer Data Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading || isRefetching ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              <span className="text-xs text-[#526B91] font-medium">Loading customer accounts...</span>
            </div>
          ) : customers.length > 0 ? (
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] uppercase font-bold text-[#526B91] tracking-wider">
                  <th className="py-3.5 px-5 w-[140px]">Customer ID</th>
                  <th className="py-3.5 px-5">Customer / Company Name</th>
                  <th className="py-3.5 px-5 w-[140px]">Type</th>
                  <th className="py-3.5 px-5">Contact Details</th>
                  <th className="py-3.5 px-5">City / State</th>
                  <th className="py-3.5 px-5 w-[160px]">Assigned Agent</th>
                  <th className="py-3.5 px-5 w-[120px] text-center">Status</th>
                  <th className="py-3.5 px-5 w-[120px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {customers.map((c: any) => {
                  const ownerName = c.assignedUser?.name || "Unassigned";
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Customer ID */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50/80 px-2.5 py-1 rounded-md border border-blue-200/60">
                            {c.customerCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(c.customerCode, "Customer ID")}
                            className="text-[#526B91] hover:text-slate-700 p-1 transition-colors cursor-pointer"
                            title="Copy customer ID"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Customer Name */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 text-xs font-bold flex-shrink-0">
                            {getAvatarInitials(c.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                              {c.name}
                            </div>
                            {c.type === "BUSINESS" && c.contactPerson && (
                              <div className="text-[11px] text-[#526B91] truncate flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3 text-[#526B91]" />
                                {c.contactPerson}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Customer Type */}
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          c.type === "BUSINESS" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}>
                          {c.type}
                        </span>
                      </td>

                      {/* Contact Details */}
                      <td className="py-4 px-5">
                        <div className="space-y-0.5 text-[#526B91] text-[11px]">
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3 h-3 text-[#526B91] flex-shrink-0" />
                            <a href={`mailto:${c.email}`} className="hover:text-blue-600 truncate">{c.email}</a>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono">
                            <Phone className="w-3 h-3 text-[#526B91] flex-shrink-0" />
                            <span>{c.phone}</span>
                          </div>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-4 px-5 text-[#526B91]">
                        <div className="truncate font-medium">{c.city || "—"}, {c.state || "—"}</div>
                        <div className="text-[10px] text-[#526B91] truncate">{c.country} {c.postalCode ? `- ${c.postalCode}` : ""}</div>
                      </td>

                      {/* Assigned Agent */}
                      <td className="py-4 px-5 text-slate-700">
                        {ownerName !== "Unassigned" ? (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold">
                              {getAvatarInitials(ownerName)}
                            </div>
                            <span className="truncate max-w-[120px] font-medium">{ownerName}</span>
                          </div>
                        ) : (
                          <span className="text-[#526B91] italic">Unassigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase ${
                          c.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          c.status === "INACTIVE" ? "bg-slate-100 text-[#526B91] border-slate-200" :
                          "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                          {c.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => router.push(`/${roleSlug}/crm/customers/${c.id}`)}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#526B91]" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-[#526B91] mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">No Customers Found</h3>
              <p className="text-xs mt-1 text-[#526B91] max-w-sm">
                No customer accounts match your active search filters.
              </p>
              {(search || type || status) && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                >
                  Clear Active Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* 4. Pagination */}
        <div className="py-3.5 px-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#526B91] font-medium">Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white border border-slate-200 text-slate-700 font-medium rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button 
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-[#526B91] hover:text-slate-900 disabled:opacity-40 disabled:hover:text-[#526B91] rounded-lg hover:bg-slate-100 transition-colors text-xs font-semibold cursor-pointer"
            >
              Previous
            </button>

            {getPageNumbers().map(p => (
              <button
                type="button"
                key={p}
                onClick={() => setPage(p)}
                className={`min-w-[32px] h-8 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  page === p
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-[#526B91] hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {p}
              </button>
            ))}

            <button 
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-[#526B91] hover:text-slate-900 disabled:opacity-40 disabled:hover:text-[#526B91] rounded-lg hover:bg-slate-100 transition-colors text-xs font-semibold cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Full-Width Single-View Register Customer Modal Popup */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            {/* Backdrop click close */}
            <div className="fixed inset-0" onClick={() => setIsCreateOpen(false)} />

            <motion.div 
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-6xl xl:max-w-7xl max-h-[92vh] bg-white rounded-2xl border border-[#D8E8FA] shadow-2xl flex flex-col z-10 overflow-hidden my-auto text-[#0B2148]"
            >
              {/* Modal Sticky Header */}
              <div className="flex justify-between items-center px-6 py-4.5 border-b border-[#D8E8FA] bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EAF5FF] border border-[#D8E8FA] flex items-center justify-center text-[#0878F9] shadow-2xs">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#0B2148] flex items-center gap-2">
                      <span>Register New Customer Profile</span>
                      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#EAF5FF] text-[#0878F9] border border-[#D8E8FA]">
                        {customerType === "BUSINESS" ? "Corporate Entity" : "Individual Client"}
                      </span>
                    </h2>
                    <p className="text-xs text-[#526B91]">
                      Initialize verified commercial account file with structured billing & delivery routing specifications.
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="p-2 bg-[#F4F9FF] hover:bg-[#EAF5FF] rounded-xl text-[#526B91] hover:text-[#0878F9] transition-colors cursor-pointer border border-[#D8E8FA]"
                  title="Close Modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Content - 2-Column Responsive Layout for Single View */}
              <form id="customer-register-form" onSubmit={handleCreateSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-[#F4F9FF]/40 space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    
                    {/* LEFT COLUMN: Identity, Contact & Notes (5 cols) */}
                    <div className="lg:col-span-5 space-y-4">
                      
                      {/* 1. CUSTOMER TYPE & DEMOGRAPHIC INFORMATION */}
                      <div className="space-y-4 bg-white p-4 sm:p-5 rounded-2xl border border-[#D8E8FA] shadow-2xs">
                        <div className="flex items-center justify-between pb-1 border-b border-[#D8E8FA]">
                          <h3 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5">
                            <User className="w-4 h-4 text-[#0878F9]" />
                            1. Customer Identity
                          </h3>
                          <span className="text-[10px] font-semibold text-[#526B91]">* Required</span>
                        </div>

                        {/* Customer Type Segmented Switch */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                            Customer Profile Type *
                          </label>
                          <div className="grid grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => setCustomerType("INDIVIDUAL")}
                              className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                customerType === "INDIVIDUAL" 
                                  ? "bg-[#0878F9] text-white border-[#0878F9] shadow-sm shadow-blue-500/20" 
                                  : "bg-white text-[#526B91] border-[#D8E8FA] hover:bg-[#F4F9FF] hover:text-[#0878F9]"
                              }`}
                            >
                              <User className="w-3.5 h-3.5" />
                              <span>Individual</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomerType("BUSINESS")}
                              className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                customerType === "BUSINESS" 
                                  ? "bg-[#0878F9] text-white border-[#0878F9] shadow-sm shadow-blue-500/20" 
                                  : "bg-white text-[#526B91] border-[#D8E8FA] hover:bg-[#F4F9FF] hover:text-[#0878F9]"
                              }`}
                            >
                              <Building2 className="w-3.5 h-3.5" />
                              <span>Corporate / B2B</span>
                            </button>
                          </div>
                        </div>

                        {/* Name & Contact Person Grid */}
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                              {customerType === "BUSINESS" ? "Company / Business Legal Name *" : "Customer Full Name *"}
                            </label>
                            <input 
                              id="customer-name-input"
                              type="text" 
                              required
                              placeholder={customerType === "BUSINESS" ? "e.g. Lusaka Solar Energy Ltd" : "e.g. John Banda"}
                              value={customerName}
                              onChange={(e) => {
                                setCustomerName(e.target.value);
                                if (errors.name) setErrors(prev => ({ ...prev, name: "" }));
                              }}
                              className={`w-full bg-white border ${errors.name ? 'border-rose-400 ring-1 ring-rose-300' : 'border-[#D8E8FA]'} rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] transition-colors shadow-2xs`}
                            />
                            {errors.name && <p className="text-[10px] text-rose-600 font-semibold">{errors.name}</p>}
                          </div>

                          {customerType === "BUSINESS" && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                                Primary Contact Person
                              </label>
                              <input 
                                id="contact-person-input"
                                type="text" 
                                placeholder="e.g. Kelvin Phiri (Procurement Head)"
                                value={contactPerson}
                                onChange={(e) => {
                                  setContactPerson(e.target.value);
                                  if (errors.contactPerson) setErrors(prev => ({ ...prev, contactPerson: "" }));
                                }}
                                className={`w-full bg-white border ${errors.contactPerson ? 'border-rose-400 ring-1 ring-rose-300' : 'border-[#D8E8FA]'} rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] transition-colors shadow-2xs`}
                              />
                              {errors.contactPerson && <p className="text-[10px] text-rose-600 font-semibold">{errors.contactPerson}</p>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 2. CONTACT & COMMERCIAL IDENTIFIERS */}
                      <div className="space-y-4 bg-white p-4 sm:p-5 rounded-2xl border border-[#D8E8FA] shadow-2xs">
                        <div className="flex items-center justify-between pb-1 border-b border-[#D8E8FA]">
                          <h3 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5">
                            <Mail className="w-4 h-4 text-[#0878F9]" />
                            2. Communication & Commercial IDs
                          </h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {/* Email */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                              Email Address *
                            </label>
                            <input 
                              id="customer-email-input"
                              type="email" 
                              required
                              placeholder="e.g. billing@company.com"
                              value={email}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                if (errors.email) setErrors(prev => ({ ...prev, email: "" }));
                              }}
                              className={`w-full bg-white border ${errors.email ? 'border-rose-400 ring-1 ring-rose-300' : 'border-[#D8E8FA]'} rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] transition-colors shadow-2xs`}
                            />
                            {errors.email && <p className="text-[10px] text-rose-600 font-semibold">{errors.email}</p>}
                          </div>

                          {/* Tax / TPIN / GSTIN */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider flex items-center justify-between">
                              <span>TPIN / Tax / GST No.</span>
                              <span className="text-[9px] text-[#526B91] font-medium">Optional</span>
                            </label>
                            <input 
                              id="customer-gst-input"
                              type="text" 
                              maxLength={15}
                              placeholder="e.g. 1001234567 / GST"
                              value={taxGst}
                              onChange={(e) => {
                                setTaxGst(e.target.value.toUpperCase());
                                if (errors.taxGst) setErrors(prev => ({ ...prev, taxGst: "" }));
                              }}
                              className={`w-full bg-white border ${errors.taxGst ? 'border-rose-400 ring-1 ring-rose-300' : 'border-[#D8E8FA]'} rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] font-mono transition-colors shadow-2xs`}
                            />
                            {errors.taxGst && <p className="text-[10px] text-rose-600 font-semibold">{errors.taxGst}</p>}
                          </div>
                        </div>

                        {/* Phone Inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div id="customer-phone-input">
                            <PhoneInput
                              label="Primary Phone Number"
                              required={true}
                              country={phoneCountry}
                              phoneNumber={phone}
                              error={errors.phone}
                              onCountryChange={(c) => {
                                setPhoneCountry(c);
                                if (errors.phone) {
                                  const res = validatePhoneNumber(phone, c, true);
                                  setErrors(prev => ({ ...prev, phone: res.isValid ? "" : (res.error || "") }));
                                }
                              }}
                              onPhoneChange={(val) => {
                                setPhone(val);
                                if (errors.phone) {
                                  const res = validatePhoneNumber(val, phoneCountry, true);
                                  setErrors(prev => ({ ...prev, phone: res.isValid ? "" : (res.error || "") }));
                                }
                              }}
                              onBlur={() => {
                                if (phone) {
                                  const res = validatePhoneNumber(phone, phoneCountry, true);
                                  if (!res.isValid) {
                                    setErrors(prev => ({ ...prev, phone: res.error || "Invalid phone number" }));
                                  }
                                }
                              }}
                            />
                          </div>

                          <div id="customer-altphone-input">
                            <PhoneInput
                              label="Alternate Phone (Optional)"
                              required={false}
                              country={altPhoneCountry}
                              phoneNumber={alternatePhone}
                              error={errors.alternatePhone}
                              onCountryChange={(c) => {
                                setAltPhoneCountry(c);
                                if (errors.alternatePhone) {
                                  const res = validatePhoneNumber(alternatePhone, c, false);
                                  setErrors(prev => ({ ...prev, alternatePhone: res.isValid ? "" : (res.error || "") }));
                                }
                              }}
                              onPhoneChange={(val) => {
                                setAlternatePhone(val);
                                if (errors.alternatePhone) {
                                  const res = validatePhoneNumber(val, altPhoneCountry, false);
                                  setErrors(prev => ({ ...prev, alternatePhone: res.isValid ? "" : (res.error || "") }));
                                }
                              }}
                              onBlur={() => {
                                if (alternatePhone) {
                                  const res = validatePhoneNumber(alternatePhone, altPhoneCountry, false);
                                  if (!res.isValid) {
                                    setErrors(prev => ({ ...prev, alternatePhone: res.error || "Invalid alternate phone number" }));
                                  }
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 5. ACCOUNT ASSIGNMENT & MASTER NOTES */}
                      <div className="space-y-4 bg-white p-4 sm:p-5 rounded-2xl border border-[#D8E8FA] shadow-2xs">
                        <div className="flex items-center justify-between pb-1 border-b border-[#D8E8FA]">
                          <h3 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-[#0878F9]" />
                            3. Account Ownership & Notes
                          </h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                              Assignee Sales Executive
                            </label>
                            <select 
                              value={assignedUserId}
                              onChange={(e) => setAssignedUserId(e.target.value)}
                              className="w-full bg-white border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] cursor-pointer shadow-2xs"
                            >
                              <option value="">Select Assignee User</option>
                              {users?.filter((u: any) => u.roles?.includes("SALES_EXECUTIVE") || u.role === "SALES_EXECUTIVE").map((u: any) => (
                                <option key={u.id} value={u.id}>{u.name} (Sales Executive)</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                              Commercial Notes / Terms
                            </label>
                            <textarea 
                              placeholder="Payment terms, special agreements, warranty clauses..."
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              rows={2}
                              className="w-full bg-white border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] resize-none shadow-2xs"
                            />
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* RIGHT COLUMN: Structured Billing & Shipping Addresses (7 cols) */}
                    <div className="lg:col-span-7 space-y-4">
                      
                      {/* 3. STRUCTURED BILLING ADDRESS */}
                      <div className="space-y-4 bg-white p-4 sm:p-5 rounded-2xl border border-[#D8E8FA] shadow-2xs">
                        <div className="flex items-center justify-between pb-1 border-b border-[#D8E8FA]">
                          <h3 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-[#0878F9]" />
                            4. Registered Billing Address
                          </h3>
                          <span className="text-[10px] font-semibold text-[#526B91]">* Required for Invoicing</span>
                        </div>

                        {/* Address Line 1 */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                            Address Line 1 (Door / Flat / Plot / Building No.) *
                          </label>
                          <input 
                            id="billing-line1-input"
                            type="text" 
                            required
                            placeholder="e.g. Plot 1042, Great East Road"
                            value={billingLine1}
                            onChange={(e) => {
                              setBillingLine1(e.target.value);
                              if (errors.billingLine1) setErrors(prev => ({ ...prev, billingLine1: "" }));
                            }}
                            className={`w-full bg-white border ${errors.billingLine1 ? 'border-rose-400 ring-1 ring-rose-300' : 'border-[#D8E8FA]'} rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] transition-colors shadow-2xs`}
                          />
                          {errors.billingLine1 && <p className="text-[10px] text-rose-600 font-semibold">{errors.billingLine1}</p>}
                        </div>

                        {/* Address Line 2 & Landmark */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                              Address Line 2 (Street / Road / Area)
                            </label>
                            <input 
                              type="text" 
                              placeholder="e.g. Industrial Area"
                              value={billingLine2}
                              onChange={(e) => setBillingLine2(e.target.value)}
                              className="w-full bg-white border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] transition-colors shadow-2xs"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                              Landmark (Optional)
                            </label>
                            <input 
                              type="text" 
                              placeholder="e.g. Opposite Arcades Mall"
                              value={billingLandmark}
                              onChange={(e) => setBillingLandmark(e.target.value)}
                              className="w-full bg-white border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] transition-colors shadow-2xs"
                            />
                          </div>
                        </div>

                        {/* City, State, Country, PIN Code Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {/* City */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                              City *
                            </label>
                            <input 
                              id="billing-city-input"
                              type="text" 
                              required
                              placeholder="e.g. Lusaka"
                              value={billingCity}
                              onChange={(e) => {
                                setBillingCity(e.target.value);
                                if (errors.billingCity) setErrors(prev => ({ ...prev, billingCity: "" }));
                              }}
                              className={`w-full bg-white border ${errors.billingCity ? 'border-rose-400 ring-1 ring-rose-300' : 'border-[#D8E8FA]'} rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] shadow-2xs`}
                            />
                            {errors.billingCity && <p className="text-[10px] text-rose-600 font-semibold">{errors.billingCity}</p>}
                          </div>

                          {/* State */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                              State / Province *
                            </label>
                            {billingCountry === "India" ? (
                              <select
                                id="billing-state-input"
                                value={billingState}
                                onChange={(e) => {
                                  setBillingState(e.target.value);
                                  if (errors.billingState) setErrors(prev => ({ ...prev, billingState: "" }));
                                }}
                                className={`w-full bg-white border ${errors.billingState ? 'border-rose-400 ring-1 ring-rose-300' : 'border-[#D8E8FA]'} rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] cursor-pointer shadow-2xs`}
                              >
                                {INDIAN_STATES.map((st) => (
                                  <option key={st} value={st}>{st}</option>
                                ))}
                              </select>
                            ) : (
                              <input 
                                id="billing-state-input"
                                type="text"
                                required
                                placeholder="e.g. Lusaka Province"
                                value={billingState}
                                onChange={(e) => {
                                  setBillingState(e.target.value);
                                  if (errors.billingState) setErrors(prev => ({ ...prev, billingState: "" }));
                                }}
                                className={`w-full bg-white border ${errors.billingState ? 'border-rose-400 ring-1 ring-rose-300' : 'border-[#D8E8FA]'} rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] shadow-2xs`}
                              />
                            )}
                          </div>

                          {/* Country */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                              Country *
                            </label>
                            <select
                              value={billingCountry}
                              onChange={(e) => setBillingCountry(e.target.value)}
                              className="w-full bg-white border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] cursor-pointer shadow-2xs"
                            >
                              {COUNTRIES.map((c) => (
                                <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* PIN / Postal Code */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                              Postal Code *
                            </label>
                            <input 
                              id="billing-postal-input"
                              type="text" 
                              required
                              maxLength={10}
                              placeholder="e.g. 10101"
                              value={billingPostalCode}
                              onChange={(e) => {
                                setBillingPostalCode(e.target.value.trim());
                                if (errors.billingPostalCode) setErrors(prev => ({ ...prev, billingPostalCode: "" }));
                              }}
                              className={`w-full bg-white border ${errors.billingPostalCode ? 'border-rose-400 ring-1 ring-rose-300' : 'border-[#D8E8FA]'} rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] font-mono shadow-2xs`}
                            />
                            {errors.billingPostalCode && <p className="text-[10px] text-rose-600 font-semibold">{errors.billingPostalCode}</p>}
                          </div>
                        </div>
                      </div>

                      {/* 4. DESTINATION SHIPPING ADDRESS & SAME AS BILLING TOGGLE */}
                      <div className="space-y-4 bg-white p-4 sm:p-5 rounded-2xl border border-[#D8E8FA] shadow-2xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#D8E8FA]">
                          <h3 className="text-xs font-bold text-[#0B2148] uppercase tracking-wider flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-[#0878F9]" />
                            5. Delivery / Shipping Address
                          </h3>

                          {/* Same as Billing Checkbox */}
                          <label className="inline-flex items-center gap-2 cursor-pointer bg-[#F4F9FF] px-3 py-1.5 rounded-xl border border-[#D8E8FA] shadow-2xs hover:bg-[#EAF5FF] transition-colors">
                            <input 
                              type="checkbox"
                              checked={sameAsBilling}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSameAsBilling(checked);
                                if (checked) {
                                  setShippingLine1("");
                                  setShippingLine2("");
                                  setShippingLandmark("");
                                  setShippingCity("");
                                  setShippingState("Tamil Nadu");
                                  setShippingCountry("India");
                                  setShippingPostalCode("");
                                }
                              }}
                              className="w-4 h-4 rounded text-[#0878F9] focus:ring-[#0878F9] border-[#D8E8FA] cursor-pointer"
                            />
                            <span className="text-xs font-bold text-[#0B2148]">Same as Billing Address</span>
                          </label>
                        </div>

                        {sameAsBilling ? (
                          <div className="p-3.5 bg-[#EAF5FF]/60 border border-[#D8E8FA] rounded-xl text-xs space-y-1">
                            <div className="flex items-center gap-1.5 text-[#0878F9] font-bold text-[11px]">
                              <Check className="w-4 h-4" />
                              <span>Synchronized with Registered Billing Address</span>
                            </div>
                            <p className="text-[#0B2148] font-medium text-xs">
                              {billingLine1 ? `${billingLine1}, ` : ""}{billingLine2 ? `${billingLine2}, ` : ""}{billingLandmark ? `Landmark: ${billingLandmark}, ` : ""}
                              {billingCity ? `${billingCity}, ` : ""}{billingState ? `${billingState}, ` : ""}{billingCountry} {billingPostalCode ? `- ${billingPostalCode}` : ""}
                            </p>
                            <p className="text-[10px] text-[#526B91] italic">
                              Uncheck &quot;Same as Billing Address&quot; above to designate an independent delivery destination, depot, or warehouse.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3.5 pt-1">
                            {/* Shipping Address Line 1 */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                                Shipping Address Line 1 *
                              </label>
                              <input 
                                id="shipping-line1-input"
                                type="text" 
                                required
                                placeholder="e.g. Warehouse 4, Logistics Depot, Heavy Industrial Area"
                                value={shippingLine1}
                                onChange={(e) => {
                                  setShippingLine1(e.target.value);
                                  if (errors.shippingLine1) setErrors(prev => ({ ...prev, shippingLine1: "" }));
                                }}
                                className={`w-full bg-white border ${errors.shippingLine1 ? 'border-rose-400 ring-1 ring-rose-300' : 'border-[#D8E8FA]'} rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] transition-colors shadow-2xs`}
                              />
                              {errors.shippingLine1 && <p className="text-[10px] text-rose-600 font-semibold">{errors.shippingLine1}</p>}
                            </div>

                            {/* Shipping Address Line 2 & Landmark */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                                  Shipping Address Line 2
                                </label>
                                <input 
                                  type="text" 
                                  placeholder="e.g. Off Kafue Road"
                                  value={shippingLine2}
                                  onChange={(e) => setShippingLine2(e.target.value)}
                                  className="w-full bg-white border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] shadow-2xs"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                                  Landmark (Optional)
                                </label>
                                <input 
                                  type="text" 
                                  placeholder="e.g. Near Distribution Gate 2"
                                  value={shippingLandmark}
                                  onChange={(e) => setShippingLandmark(e.target.value)}
                                  className="w-full bg-white border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] shadow-2xs"
                                />
                              </div>
                            </div>

                            {/* Shipping City, State, Country, PIN Code Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">City *</label>
                                <input 
                                  id="shipping-city-input"
                                  type="text" 
                                  required
                                  placeholder="e.g. Ndola"
                                  value={shippingCity}
                                  onChange={(e) => {
                                    setShippingCity(e.target.value);
                                    if (errors.shippingCity) setErrors(prev => ({ ...prev, shippingCity: "" }));
                                  }}
                                  className={`w-full bg-white border ${errors.shippingCity ? 'border-rose-400 ring-1 ring-rose-300' : 'border-[#D8E8FA]'} rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] shadow-2xs`}
                                />
                                {errors.shippingCity && <p className="text-[10px] text-rose-600 font-semibold">{errors.shippingCity}</p>}
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">State / Province *</label>
                                {shippingCountry === "India" ? (
                                  <select
                                    id="shipping-state-input"
                                    value={shippingState}
                                    onChange={(e) => {
                                      setShippingState(e.target.value);
                                      if (errors.shippingState) setErrors(prev => ({ ...prev, shippingState: "" }));
                                    }}
                                    className={`w-full bg-white border ${errors.shippingState ? 'border-rose-400 ring-1 ring-rose-300' : 'border-[#D8E8FA]'} rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] cursor-pointer shadow-2xs`}
                                  >
                                    {INDIAN_STATES.map((st) => (
                                      <option key={st} value={st}>{st}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input 
                                    id="shipping-state-input"
                                    type="text"
                                    required
                                    placeholder="e.g. Copperbelt"
                                    value={shippingState}
                                    onChange={(e) => {
                                      setShippingState(e.target.value);
                                      if (errors.shippingState) setErrors(prev => ({ ...prev, shippingState: "" }));
                                    }}
                                    className={`w-full bg-white border ${errors.shippingState ? 'border-rose-400 ring-1 ring-rose-300' : 'border-[#D8E8FA]'} rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] shadow-2xs`}
                                  />
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Country *</label>
                                <select
                                  value={shippingCountry}
                                  onChange={(e) => setShippingCountry(e.target.value)}
                                  className="w-full bg-white border border-[#D8E8FA] rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] cursor-pointer shadow-2xs"
                                >
                                  {COUNTRIES.map((c) => (
                                    <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Postal Code *</label>
                                <input 
                                  id="shipping-postal-input"
                                  type="text" 
                                  required
                                  maxLength={10}
                                  placeholder="e.g. 10101"
                                  value={shippingPostalCode}
                                  onChange={(e) => {
                                    setShippingPostalCode(e.target.value.trim());
                                    if (errors.shippingPostalCode) setErrors(prev => ({ ...prev, shippingPostalCode: "" }));
                                  }}
                                  className={`w-full bg-white border ${errors.shippingPostalCode ? 'border-rose-400 ring-1 ring-rose-300' : 'border-[#D8E8FA]'} rounded-xl px-3.5 py-2 text-xs text-[#0B2148] focus:outline-none focus:border-[#0878F9] focus:ring-1 focus:ring-[#0878F9] font-mono shadow-2xs`}
                                />
                                {errors.shippingPostalCode && <p className="text-[10px] text-rose-600 font-semibold">{errors.shippingPostalCode}</p>}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>

                  </div>
                </div>

                {/* Modal Sticky Footer */}
                <div className="px-6 py-3.5 bg-white border-t border-[#D8E8FA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2 text-xs text-[#526B91]">
                    <ShieldCheck className="w-4 h-4 text-[#0878F9]" />
                    <span>Instant duplicate check • Auto-assigned sequential Customer Code</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button 
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="px-5 py-2.5 bg-white hover:bg-[#F4F9FF] text-[#526B91] hover:text-[#0B2148] border border-[#D8E8FA] font-semibold rounded-xl text-xs transition-colors cursor-pointer shadow-2xs"
                    >
                      Cancel
                    </button>

                    <button 
                      id="submit-customer-btn"
                      type="submit" 
                      disabled={createCustomerMutation.isPending}
                      className="px-6 py-2.5 bg-[#0878F9] hover:bg-[#0667DB] text-white font-semibold rounded-xl shadow-sm shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
                    >
                      {createCustomerMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Registering Customer Profile...</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4" />
                          <span>Register Customer Profile</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

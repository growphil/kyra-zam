"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  Users, 
  ArrowLeft, 
  Loader2, 
  Building2, 
  Phone, 
  Mail, 
  User, 
  MapPin, 
  CheckCircle,
  AlertTriangle,
  Plus,
  Send,
  MessageSquare,
  CreditCard,
  Truck,
  Wrench,
  ShieldAlert,
  ShieldCheck,
  ClipboardList,
  Copy,
  Pencil,
  Check,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { validatePhoneNumber, normalizePastedPhone } from "@/lib/phoneValidation";
import { COUNTRIES, DEFAULT_COUNTRY, Country } from "@/lib/countries";
import { 
  INDIAN_STATES, 
  validateCustomerName, 
  validateContactPerson, 
  validateEmail, 
  validateGstin, 
  validatePostalCode, 
  formatAddressString,
  parseAddressString 
} from "@/lib/customerValidation";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();

  // Activity logging state
  const [newActivity, setNewActivity] = useState({
    activityType: "CALL",
    subject: "",
    description: "",
    dueDate: ""
  });

  // Edit details drawer state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editType, setEditType] = useState<"INDIVIDUAL" | "BUSINESS">("INDIVIDUAL");
  const [editName, setEditName] = useState("");
  const [editContactPerson, setEditContactPerson] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPhoneCountry, setEditPhoneCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [editAlternatePhone, setEditAlternatePhone] = useState("");
  const [editAltPhoneCountry, setEditAltPhoneCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [editTaxGst, setEditTaxGst] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [editBillingLine1, setEditBillingLine1] = useState("");
  const [editBillingLine2, setEditBillingLine2] = useState("");
  const [editBillingLandmark, setEditBillingLandmark] = useState("");
  const [editBillingCity, setEditBillingCity] = useState("");
  const [editBillingState, setEditBillingState] = useState("Tamil Nadu");
  const [editBillingCountry, setEditBillingCountry] = useState("India");
  const [editBillingPostalCode, setEditBillingPostalCode] = useState("");

  const [editSameAsBilling, setEditSameAsBilling] = useState(true);
  const [editShippingLine1, setEditShippingLine1] = useState("");
  const [editShippingLine2, setEditShippingLine2] = useState("");
  const [editShippingLandmark, setEditShippingLandmark] = useState("");
  const [editShippingCity, setEditShippingCity] = useState("");
  const [editShippingState, setEditShippingState] = useState("Tamil Nadu");
  const [editShippingCountry, setEditShippingCountry] = useState("India");
  const [editShippingPostalCode, setEditShippingPostalCode] = useState("");

  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // --- DATA FETCHING ---
  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer-details", customerId],
    queryFn: async () => {
      const res = await api.get(`/crm/customers/${customerId}`);
      return res.data;
    }
  });

  const openEditDrawer = () => {
    if (!customer) return;
    setEditType(customer.type || "INDIVIDUAL");
    setEditName(customer.name || "");
    setEditContactPerson(customer.contactPerson || "");
    setEditEmail(customer.email || "");

    // Phone parsing
    if (customer.phone) {
      const parsedPhone = normalizePastedPhone(customer.phone, DEFAULT_COUNTRY);
      setEditPhone(parsedPhone.nationalNumber || customer.phone);
      if (parsedPhone.detectedCountry) {
        setEditPhoneCountry(parsedPhone.detectedCountry);
      } else {
        setEditPhoneCountry(DEFAULT_COUNTRY);
      }
    } else {
      setEditPhone("");
      setEditPhoneCountry(DEFAULT_COUNTRY);
    }

    // Alternate Phone parsing
    if (customer.alternatePhone) {
      const parsedAlt = normalizePastedPhone(customer.alternatePhone, DEFAULT_COUNTRY);
      setEditAlternatePhone(parsedAlt.nationalNumber || customer.alternatePhone);
      if (parsedAlt.detectedCountry) {
        setEditAltPhoneCountry(parsedAlt.detectedCountry);
      } else {
        setEditAltPhoneCountry(DEFAULT_COUNTRY);
      }
    } else {
      setEditAlternatePhone("");
      setEditAltPhoneCountry(DEFAULT_COUNTRY);
    }

    setEditTaxGst(customer.taxGst || "");
    setEditNotes(customer.notes || "");

    const parsedBill = parseAddressString(customer.billingAddress || "");
    setEditBillingLine1(parsedBill.line1);
    setEditBillingLine2(parsedBill.line2);
    setEditBillingLandmark(parsedBill.landmark);
    setEditBillingCity(customer.city || "");
    setEditBillingState(customer.state || "Tamil Nadu");
    setEditBillingCountry(customer.country || "India");
    setEditBillingPostalCode(customer.postalCode || "");

    const isSame = !customer.shippingAddress || customer.shippingAddress === customer.billingAddress;
    setEditSameAsBilling(isSame);
    if (!isSame) {
      const parsedShip = parseAddressString(customer.shippingAddress || "");
      setEditShippingLine1(parsedShip.line1);
      setEditShippingLine2(parsedShip.line2);
      setEditShippingLandmark(parsedShip.landmark);
      setEditShippingCity(customer.city || "");
      setEditShippingState(customer.state || "Tamil Nadu");
      setEditShippingCountry(customer.country || "India");
      setEditShippingPostalCode(customer.postalCode || "");
    }

    setEditErrors({});
    setIsEditOpen(true);
  };

  // --- MUTATIONS ---
  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.put(`/crm/customers/${customerId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-details"] });
      queryClient.invalidateQueries({ queryKey: ["customers-list"] });
      toast.success("Customer status updated");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to update status");
    }
  });

  const updateCustomerMutation = useMutation({
    mutationFn: (updateData: any) => api.put(`/crm/customers/${customerId}`, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-details"] });
      queryClient.invalidateQueries({ queryKey: ["customers-list"] });
      toast.success("Customer details updated successfully");
      setIsEditOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to update customer");
    }
  });

  const addActivityMutation = useMutation({
    mutationFn: (actData: any) => api.post("/crm/activities", { ...actData, customerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-details"] });
      toast.success("CRM Activity Logged");
      setNewActivity({
        activityType: "CALL",
        subject: "",
        description: "",
        dueDate: ""
      });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Failed to add activity")
  });

  const completeActivityMutation = useMutation({
    mutationFn: (activityId: string) => api.put(`/crm/activities/${activityId}`, { status: "COMPLETED" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-details"] });
      toast.success("Activity Marked Completed");
    },
    onError: (err: any) => toast.error("Failed to complete activity")
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-12 text-center text-[#526B91] bg-white rounded-2xl border border-slate-200 max-w-md mx-auto my-12 shadow-xs">
        <AlertTriangle className="w-12 h-12 mx-auto text-rose-500 mb-4" />
        <p className="font-bold text-slate-900">Customer File Not Found</p>
        <button
          type="button"
          onClick={() => router.push(`/${roleSlug}/crm/customers`)}
          className="mt-4 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
        >
          Return to Registry
        </button>
      </div>
    );
  }

  const handleLogActivitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivity.subject.trim()) {
      toast.error("Activity Subject is required");
      return;
    }
    addActivityMutation.mutate({
      ...newActivity,
      dueDate: newActivity.dueDate ? newActivity.dueDate : null
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const errs: Record<string, string> = {};

    const nameVal = validateCustomerName(editName, editType);
    if (!nameVal.isValid) errs.name = nameVal.error || "Invalid name";

    if (editType === "BUSINESS" && editContactPerson.trim()) {
      const cpVal = validateContactPerson(editContactPerson);
      if (!cpVal.isValid) errs.contactPerson = cpVal.error || "Invalid contact person";
    }

    const emailVal = validateEmail(editEmail);
    if (!emailVal.isValid) errs.email = emailVal.error || "Invalid email";

    const phoneVal = validatePhoneNumber(editPhone, editPhoneCountry, true);
    if (!phoneVal.isValid) errs.phone = phoneVal.error || "Invalid phone number";

    if (editAlternatePhone.trim()) {
      const altVal = validatePhoneNumber(editAlternatePhone, editAltPhoneCountry, false);
      if (!altVal.isValid) errs.alternatePhone = altVal.error || "Invalid alternate phone";
    }

    if (editTaxGst.trim()) {
      if (!validateGstin(editTaxGst)) {
        errs.taxGst = "Invalid GSTIN structure (15-character alphanumeric)";
      }
    }

    if (!editBillingLine1.trim()) errs.billingLine1 = "Billing Address Line 1 is required";
    if (!editBillingCity.trim()) errs.billingCity = "Billing City is required";
    if (!editBillingState.trim()) errs.billingState = "Billing State is required";

    const pinVal = validatePostalCode(editBillingPostalCode, editBillingCountry);
    if (!pinVal.isValid) errs.billingPostalCode = pinVal.error || "Invalid postal code";

    if (!editSameAsBilling) {
      if (!editShippingLine1.trim()) errs.shippingLine1 = "Shipping Address Line 1 is required";
      if (!editShippingCity.trim()) errs.shippingCity = "Shipping City is required";
      if (!editShippingState.trim()) errs.shippingState = "Shipping State is required";
      const shipPinVal = validatePostalCode(editShippingPostalCode, editShippingCountry);
      if (!shipPinVal.isValid) errs.shippingPostalCode = shipPinVal.error || "Invalid shipping postal code";
    }

    setEditErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Please fix the highlighted validation errors.");
      return;
    }

    const fullBilling = formatAddressString(editBillingLine1, editBillingLine2, editBillingLandmark);
    const fullShipping = editSameAsBilling
      ? fullBilling
      : formatAddressString(editShippingLine1, editShippingLine2, editShippingLandmark);

    const formattedPhone = editPhone.startsWith("+") ? editPhone.trim() : `${editPhoneCountry.dialCode}${editPhone.trim()}`;
    const formattedAltPhone = editAlternatePhone.trim()
      ? (editAlternatePhone.startsWith("+") ? editAlternatePhone.trim() : `${editAltPhoneCountry.dialCode}${editAlternatePhone.trim()}`)
      : null;

    updateCustomerMutation.mutate({
      type: editType,
      name: editName.trim(),
      contactPerson: editType === "BUSINESS" && editContactPerson.trim() ? editContactPerson.trim() : null,
      email: editEmail.trim().toLowerCase(),
      phone: formattedPhone,
      alternatePhone: formattedAltPhone,
      billingAddress: fullBilling,
      shippingAddress: fullShipping,
      city: editBillingCity.trim(),
      state: editBillingState.trim(),
      country: editBillingCountry.trim(),
      postalCode: editBillingPostalCode.trim(),
      taxGst: editTaxGst.trim().toUpperCase() || null,
      notes: editNotes.trim() || null
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-4 text-[#0B2148]">
      
      {/* Top Header Controls */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.push(`/${roleSlug}/crm/customers`)}
          className="flex items-center gap-2 text-[#526B91] hover:text-slate-900 font-semibold text-xs bg-white border border-slate-200 px-4 py-2.5 rounded-xl transition-all shadow-xs hover:bg-slate-50 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Customer Registry
        </button>

        <button 
          id="modify-customer-profile-btn"
          onClick={openEditDrawer}
          className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
          Modify Profile Details
        </button>
      </div>

      {/* Main split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: Overview & Structured Addresses */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Customer Overview Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-[#526B91] uppercase tracking-widest">Customer ID</span>
                <div className="flex items-center gap-2 mt-1">
                  <h2 className="text-2xl font-display font-bold text-slate-900 font-mono">{customer.customerCode}</h2>
                  <button 
                    type="button"
                    onClick={() => copyToClipboard(customer.customerCode, "Customer ID")}
                    className="text-[#526B91] hover:text-slate-700 p-1 cursor-pointer"
                    title="Copy ID"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${
                customer.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                customer.status === "INACTIVE" ? "bg-slate-100 text-[#526B91] border-slate-200" :
                "bg-rose-50 text-rose-700 border-rose-200"
              }`}>
                {customer.status}
              </span>
            </div>

            <div className="space-y-4 text-sm text-[#526B91] border-t border-slate-100 pt-4">
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">{customer.name}</p>
                  <p className="text-xs text-[#526B91]">{customer.type === "BUSINESS" ? "Company / Entity Name" : "Customer Full Name"}</p>
                </div>
              </div>

              {customer.type === "BUSINESS" && customer.contactPerson && (
                <div className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900">{customer.contactPerson}</p>
                    <p className="text-xs text-[#526B91]">Primary Contact Person</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-blue-600 mt-0.5" />
                <div>
                  <a href={`mailto:${customer.email}`} className="font-semibold hover:underline text-blue-600">{customer.email}</a>
                  <p className="text-xs text-[#526B91]">Official Email</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-semibold font-mono text-slate-900">{customer.phone}</p>
                  {customer.alternatePhone && (
                    <p className="text-[#526B91] text-xs font-mono mt-0.5">Alt: {customer.alternatePhone}</p>
                  )}
                  <p className="text-xs text-[#526B91]">Verified Contact Number</p>
                </div>
              </div>

              {customer.taxGst && (
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-mono font-bold text-slate-900">{customer.taxGst}</p>
                    <p className="text-xs text-[#526B91]">GSTIN / TAX Identification</p>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#526B91] uppercase tracking-wider text-[10px]">Profile Type</span>
                  <span className="font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    {customer.type}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#526B91] uppercase tracking-wider text-[10px]">Assigned Agent</span>
                  <span className="font-semibold text-slate-900">{customer.assignedUser?.name || "Unassigned"}</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#526B91] uppercase tracking-wider text-[10px]">Account Status</span>
                  <select 
                    value={customer.status}
                    onChange={(e) => updateStatusMutation.mutate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 px-2.5 py-1 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Structured Addresses Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-blue-600" />
              Registered Commercial Addresses
            </h3>

            <div className="space-y-4 text-xs text-[#526B91]">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <p className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider">Registered Billing Address</p>
                <p className="text-slate-900 font-medium">{customer.billingAddress}</p>
                <p className="text-[#526B91] text-[11px]">{customer.city}, {customer.state} - {customer.postalCode}, {customer.country}</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <p className="text-[10px] text-[#526B91] font-bold uppercase tracking-wider">Destination Shipping Address</p>
                {customer.shippingAddress && customer.shippingAddress !== customer.billingAddress ? (
                  <>
                    <p className="text-slate-900 font-medium">{customer.shippingAddress}</p>
                    <p className="text-[#526B91] text-[11px]">{customer.city}, {customer.state} - {customer.postalCode}, {customer.country}</p>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                    <Check className="w-3.5 h-3.5" />
                    <span>Same as Billing Address</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Activities & History */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Converted Lead Context */}
          {customer.leads?.length > 0 && (
            <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-blue-900">Lead Conversion Origin</p>
                  <p className="text-xs text-[#526B91] mt-0.5">
                    This profile was converted from Lead <span className="font-mono text-slate-900 font-bold">{customer.leads[0].leadNumber}</span> on {new Date(customer.leads[0].updatedAt).toLocaleDateString()}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Activities timeline */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <h3 className="text-sm font-display font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              CRM Activities & Customer Engagement
            </h3>

            {/* Log customer activity */}
            <form onSubmit={handleLogActivitySubmit} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/75 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <p className="text-[11px] font-bold text-[#526B91] uppercase tracking-wider">Log Activity Entry</p>
                <div className="flex gap-1.5 flex-wrap">
                  {["CALL", "MEETING", "EMAIL", "NOTE", "FOLLOW_UP", "TASK"].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewActivity({ ...newActivity, activityType: t })}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        newActivity.activityType === t ? "bg-blue-600 text-white" : "bg-white text-[#526B91] border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Subject *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Follow-up on quotation proposal"
                    value={newActivity.subject}
                    onChange={(e) => setNewActivity({ ...newActivity, subject: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-[#526B91] focus:outline-none focus:border-blue-500 shadow-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Scheduled Date</label>
                  <input 
                    type="date" 
                    value={newActivity.dueDate}
                    onChange={(e) => setNewActivity({ ...newActivity, dueDate: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Details</label>
                <textarea 
                  placeholder="Record interaction notes, deliverables, or customer feedback..."
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-[#526B91] focus:outline-none focus:border-blue-500 resize-none shadow-xs"
                />
              </div>

              <div className="flex justify-end">
                <button 
                  type="submit" 
                  disabled={addActivityMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {addActivityMutation.isPending ? "Logging..." : "Log CRM Entry"}
                </button>
              </div>
            </form>

            <div className="relative border-l border-slate-200 ml-3 pl-5 space-y-4">
              {customer.activities?.length > 0 ? (
                customer.activities.map((act: any) => (
                  <div key={act.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white" />
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                            {act.activityType}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900">{act.subject}</h4>
                        </div>
                        {act.description && <p className="text-xs text-[#526B91] mt-1">{act.description}</p>}
                        <p className="text-[10px] text-[#526B91] font-medium mt-1">
                          Logged by: {act.createdByUser?.name || "System"} • {new Date(act.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {act.status === "PENDING" ? (
                          <>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md">Pending</span>
                            <button
                              onClick={() => completeActivityMutation.mutate(act.id)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 font-semibold text-xs rounded-lg transition-all cursor-pointer"
                            >
                              Complete
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                            {act.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-[#526B91] text-xs">No activity logs recorded yet.</div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Edit Customer Profile Dialog Drawer */}
      <AnimatePresence>
        {isEditOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-white backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setIsEditOpen(false)} />

            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-3xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl p-6 sm:p-8 z-10 overflow-y-auto text-slate-900"
            >
              <div className="flex justify-between items-center pb-5 border-b border-slate-200">
                <div>
                  <h3 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
                    <Pencil className="w-5 h-5 text-blue-600" />
                    Modify Customer Profile ({customer.customerCode})
                  </h3>
                  <p className="text-xs text-[#526B91] mt-0.5">Update demographic and structured address records.</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsEditOpen(false)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-[#526B91] hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="flex-1 py-6 space-y-6">
                
                {/* 1. Profile Info */}
                <div className="space-y-4 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">1. Account Type & Name</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">
                        {editType === "BUSINESS" ? "Company / Business Name *" : "Customer Full Name *"}
                      </label>
                      <input 
                        type="text" 
                        required
                        placeholder={editType === "BUSINESS" ? "e.g. ABC Industries Pvt Ltd" : "e.g. Rajesh Kumar"}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                      />
                      {editErrors.name && <p className="text-[10px] text-rose-600 font-semibold">{editErrors.name}</p>}
                    </div>

                    {editType === "BUSINESS" && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Contact Person</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Rajesh Kumar"
                          value={editContactPerson}
                          onChange={(e) => setEditContactPerson(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Contact & Tax Info */}
                <div className="space-y-4 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">2. Contact Details & Tax Identifiers</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Email Address *</label>
                      <input 
                        type="email" 
                        required
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                      />
                      {editErrors.email && <p className="text-[10px] text-rose-600 font-semibold">{editErrors.email}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Tax / GSTIN Number</label>
                      <input 
                        type="text" 
                        maxLength={15}
                        placeholder="15-character GSTIN"
                        value={editTaxGst}
                        onChange={(e) => setEditTaxGst(e.target.value.toUpperCase())}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500 shadow-xs"
                      />
                      {editErrors.taxGst && <p className="text-[10px] text-rose-600 font-semibold">{editErrors.taxGst}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PhoneInput
                      label="Primary Phone Number"
                      required={true}
                      country={editPhoneCountry}
                      phoneNumber={editPhone}
                      error={editErrors.phone}
                      onCountryChange={(c) => {
                        setEditPhoneCountry(c);
                        if (editErrors.phone) {
                          const res = validatePhoneNumber(editPhone, c, true);
                          setEditErrors(prev => ({ ...prev, phone: res.isValid ? "" : (res.error || "") }));
                        }
                      }}
                      onPhoneChange={(val) => {
                        setEditPhone(val);
                        if (editErrors.phone) {
                          const res = validatePhoneNumber(val, editPhoneCountry, true);
                          setEditErrors(prev => ({ ...prev, phone: res.isValid ? "" : (res.error || "") }));
                        }
                      }}
                      onBlur={() => {
                        if (editPhone) {
                          const res = validatePhoneNumber(editPhone, editPhoneCountry, true);
                          if (!res.isValid) {
                            setEditErrors(prev => ({ ...prev, phone: res.error || "Invalid phone number" }));
                          }
                        }
                      }}
                    />

                    <PhoneInput
                      label="Alternate Phone (Optional)"
                      required={false}
                      country={editAltPhoneCountry}
                      phoneNumber={editAlternatePhone}
                      error={editErrors.alternatePhone}
                      onCountryChange={(c) => {
                        setEditAltPhoneCountry(c);
                        if (editErrors.alternatePhone) {
                          const res = validatePhoneNumber(editAlternatePhone, c, false);
                          setEditErrors(prev => ({ ...prev, alternatePhone: res.isValid ? "" : (res.error || "") }));
                        }
                      }}
                      onPhoneChange={(val) => {
                        setEditAlternatePhone(val);
                        if (editErrors.alternatePhone) {
                          const res = validatePhoneNumber(val, editAltPhoneCountry, false);
                          setEditErrors(prev => ({ ...prev, alternatePhone: res.isValid ? "" : (res.error || "") }));
                        }
                      }}
                      onBlur={() => {
                        if (editAlternatePhone) {
                          const res = validatePhoneNumber(editAlternatePhone, editAltPhoneCountry, false);
                          if (!res.isValid) {
                            setEditErrors(prev => ({ ...prev, alternatePhone: res.error || "Invalid alternate phone number" }));
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                {/* 3. Structured Billing Address */}
                <div className="space-y-4 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">3. Structured Billing Address</h4>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Address Line 1 *</label>
                    <input 
                      type="text" 
                      required
                      value={editBillingLine1}
                      onChange={(e) => setEditBillingLine1(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                    />
                    {editErrors.billingLine1 && <p className="text-[10px] text-rose-600 font-semibold">{editErrors.billingLine1}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Address Line 2</label>
                      <input 
                        type="text" 
                        value={editBillingLine2}
                        onChange={(e) => setEditBillingLine2(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Landmark</label>
                      <input 
                        type="text" 
                        value={editBillingLandmark}
                        onChange={(e) => setEditBillingLandmark(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">City *</label>
                      <input 
                        type="text" 
                        required
                        value={editBillingCity}
                        onChange={(e) => setEditBillingCity(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                      />
                      {editErrors.billingCity && <p className="text-[10px] text-rose-600 font-semibold">{editErrors.billingCity}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">State *</label>
                      {editBillingCountry === "India" ? (
                        <select
                          value={editBillingState}
                          onChange={(e) => setEditBillingState(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                        >
                          {INDIAN_STATES.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      ) : (
                        <input 
                          type="text"
                          required
                          value={editBillingState}
                          onChange={(e) => setEditBillingState(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                        />
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Country *</label>
                      <select
                        value={editBillingCountry}
                        onChange={(e) => setEditBillingCountry(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">PIN / Postal *</label>
                      <input 
                        type="text" 
                        required
                        maxLength={10}
                        value={editBillingPostalCode}
                        onChange={(e) => setEditBillingPostalCode(e.target.value.trim())}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500 shadow-xs"
                      />
                      {editErrors.billingPostalCode && <p className="text-[10px] text-rose-600 font-semibold">{editErrors.billingPostalCode}</p>}
                    </div>
                  </div>
                </div>

                {/* 4. Structured Shipping Address */}
                <div className="space-y-4 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">4. Shipping Destination</h4>
                    <label className="inline-flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                      <input 
                        type="checkbox"
                        checked={editSameAsBilling}
                        onChange={(e) => setEditSameAsBilling(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <span className="text-xs font-bold text-slate-700">Same as Billing Address</span>
                    </label>
                  </div>

                  {!editSameAsBilling && (
                    <div className="space-y-4 pt-1">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Shipping Address Line 1 *</label>
                        <input 
                          type="text" 
                          required
                          value={editShippingLine1}
                          onChange={(e) => setEditShippingLine1(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">City *</label>
                          <input 
                            type="text" 
                            required
                            value={editShippingCity}
                            onChange={(e) => setEditShippingCity(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">State *</label>
                          <input 
                            type="text" 
                            required
                            value={editShippingState}
                            onChange={(e) => setEditShippingState(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-xs"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">Country *</label>
                          <select
                            value={editShippingCountry}
                            onChange={(e) => setEditShippingCountry(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                          >
                            {COUNTRIES.map((c) => (
                              <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-[#526B91] uppercase tracking-wider">PIN / Postal *</label>
                          <input 
                            type="text" 
                            required
                            maxLength={10}
                            value={editShippingPostalCode}
                            onChange={(e) => setEditShippingPostalCode(e.target.value.trim())}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500 shadow-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsEditOpen(false)}
                    className="px-5 py-2.5 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={updateCustomerMutation.isPending}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {updateCustomerMutation.isPending ? "Saving..." : "Save Profile Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

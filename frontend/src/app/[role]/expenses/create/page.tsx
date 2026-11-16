"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Receipt,
  UploadCloud,
  FileText,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Building2,
  Info
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

interface UploadedFile {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  documentType: string;
}

export default function CreateExpensePage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userRoles: string[] = (session?.user as any)?.roles || [];

  const isSuperadmin = userRoles.includes("SUPERADMIN") || userRoles.includes("ULTRA_ADMIN");
  const isAccountant = userRoles.includes("ACCOUNTANT") && !isSuperadmin;
  const isAdmin = userRoles.includes("ADMIN") && !isSuperadmin && !isAccountant;

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ZMW");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [department, setDepartment] = useState("Operations");
  const [costCentre, setCostCentre] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorContact, setVendorContact] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("UNPAID");

  // File upload state
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // 1. Fetch categories
  const { data: catData } = useQuery({
    queryKey: ["expenses-categories-active"],
    queryFn: async () => (await api.get("/expenses/categories", { params: { activeOnly: "true" } })).data
  });
  const categories = catData?.categories || [];

  // 2. Fetch active threshold
  const { data: thresholdData } = useQuery({
    queryKey: ["expenses-active-threshold"],
    queryFn: async () => (await api.get("/expenses/settings/threshold")).data
  });
  const activeThreshold = thresholdData?.activeThreshold?.amount || 5000;
  const thresholdCurrency = thresholdData?.activeThreshold?.currency || "ZMW";

  // Calculate live route evaluation
  const numAmount = parseFloat(amount) || 0;
  const willAutoApprove = isAccountant && numAmount > 0 && numAmount <= activeThreshold;
  const willRouteSuperadmin = (isAccountant && numAmount > activeThreshold) || isSuperadmin;
  const willRouteAccountant = isAdmin;

  // Upload proof handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Invalid file format. Please upload PDF, JPG, PNG or WEBP.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size exceeds 20MB limit.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/expenses/upload-proof", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setAttachments((prev) => [...prev, res.data]);
      toast.success(`Attached "${file.name}" successfully.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to upload document proof.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => (await api.post("/expenses", payload)).data,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["expenses-summary"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-recent"] });
      toast.success(res.message || "Expense submitted successfully.");
      router.push(`/${roleSlug}/expenses/${res.expense.id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to create expense voucher.");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return toast.error("Please enter an expense title");
    if (!categoryId) return toast.error("Please select an expense category");
    if (!amount || numAmount <= 0) return toast.error("Please enter a valid expense amount");
    if (!description.trim()) return toast.error("Please provide a description");
    if (!attachments || attachments.length === 0) {
      return toast.error("Supporting Document Proof is mandatory. Please upload at least one receipt, invoice, or voucher proof before submitting.");
    }

    createMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      categoryId,
      amount: numAmount,
      currency,
      expenseDate,
      department,
      costCentre: costCentre.trim() || null,
      vendorName: vendorName.trim() || null,
      vendorContact: vendorContact.trim() || null,
      invoiceNumber: invoiceNumber.trim() || null,
      paymentMethod,
      paymentReference: paymentReference.trim() || null,
      paymentStatus,
      attachments
    });
  };

  return (
    <div className="space-y-6 max-w-[1200px] pb-16">
      <PageHeader
        title="Create Expense Voucher"
        subtitle="Submit a new operational expenditure voucher with supporting tax invoices or proof"
        icon={<Receipt className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <button
            onClick={() => router.push(`/${roleSlug}/expenses`)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dynamic Route Indicator Card */}
        <div className={`p-4 rounded-2xl border transition-all ${
          willAutoApprove
            ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
            : willRouteAccountant
            ? "bg-amber-50/80 border-amber-200 text-amber-900"
            : "bg-blue-50/80 border-blue-200 text-blue-900"
        }`}>
          <div className="flex items-start gap-3">
            {willAutoApprove ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            ) : willRouteAccountant ? (
              <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            )}
            <div className="text-xs space-y-1">
              <p className="font-bold">
                {willAutoApprove
                  ? "Instant Auto-Approval Eligible"
                  : willRouteAccountant
                  ? "Awaiting Authorised Accountant Verification"
                  : "Superadmin Verification Queue"}
              </p>
              <p className="opacity-90">
                {willAutoApprove && (
                  <>
                    Amount ({currency} {numAmount.toLocaleString()}) is within the active threshold ({thresholdCurrency} {Number(activeThreshold).toLocaleString()}). Upon submission, this expense will be <strong>automatically approved</strong> and logged into the official expense ledger.
                  </>
                )}
                {isAccountant && numAmount > activeThreshold && (
                  <>
                    Amount ({currency} {numAmount.toLocaleString()}) exceeds the auto-approval threshold ({thresholdCurrency} {Number(activeThreshold).toLocaleString()}). It will enter <strong>Pending Verification</strong> and require Superadmin review.
                  </>
                )}
                {isAdmin && (
                  <>
                    Admin-created expenses are strictly routed to the <strong>Accountant verification queue</strong> for independent audit before entering the official ledger.
                  </>
                )}
                {isSuperadmin && (
                  <>
                    Superadmin-created expenses enter the verification workflow. Separation of duties prevents self-approval.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Section A: Expense Information */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">A</span>
            <h3 className="text-sm font-bold text-slate-800">Expense Information</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expense Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Factory Backup Generator Fuel 500L"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expense Category <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 bg-white"
              >
                <option value="">-- Select Category --</option>
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expense Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expense Amount <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-24 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-blue-500 bg-slate-50"
                >
                  <option value="ZMW">ZMW</option>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 bg-white"
              >
                <option value="Operations">Operations</option>
                <option value="Finance & Accounts">Finance & Accounts</option>
                <option value="Assembly & Production">Assembly & Production</option>
                <option value="Quality Control">Quality Control</option>
                <option value="Procurement & Logistics">Procurement & Logistics</option>
                <option value="Sales & Marketing">Sales & Marketing</option>
                <option value="Management & Admin">Management & Admin</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description / Purpose <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the necessity, scope and details of this expenditure..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section B: Vendor & Invoice Details */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">B</span>
            <h3 className="text-sm font-bold text-slate-800">Vendor & Supplier Details (Optional)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor / Payee Name</label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g. TotalEnergies Zambia"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Contact / Phone</label>
              <input
                type="text"
                value={vendorContact}
                onChange={(e) => setVendorContact(e.target.value)}
                placeholder="e.g. +260 970 000 000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Tax Invoice Number</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-2026-908"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cost Centre / Project Code</label>
              <input
                type="text"
                value={costCentre}
                onChange={(e) => setCostCentre(e.target.value)}
                placeholder="e.g. CC-PLANT-01"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section C: Payment Information */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">C</span>
            <h3 className="text-sm font-bold text-slate-800">Payment & Settlement Information</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 bg-white"
              >
                <option value="BANK_TRANSFER">Bank Transfer (EFT/RTGS)</option>
                <option value="MOBILE_MONEY">Mobile Money (Airtel/MTN/Zamtel)</option>
                <option value="CASH">Petty Cash</option>
                <option value="COMPANY_CARD">Company Card</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 bg-white"
              >
                <option value="UNPAID">Pending Settlement (Unpaid)</option>
                <option value="PAID">Already Settled / Disbursed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Reference / UTR</label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. UTR-98721389"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section D: Supporting Documents Upload */}
        <div className={`p-6 rounded-2xl bg-white border shadow-xs space-y-4 transition-all ${
          attachments.length === 0 ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200"
        }`}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">D</span>
              <h3 className="text-sm font-bold text-slate-800">
                Supporting Document Proof <span className="text-rose-500 font-bold">*</span>
              </h3>
            </div>
            {attachments.length === 0 ? (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Mandatory Proof Required
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {attachments.length} {attachments.length === 1 ? "Proof Attached" : "Proofs Attached"}
              </span>
            )}
          </div>

          <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
            attachments.length === 0
              ? "border-amber-300 bg-amber-50/20 hover:border-amber-400"
              : "border-emerald-300 bg-emerald-50/10 hover:border-emerald-400"
          }`}>
            <UploadCloud className={`w-10 h-10 mx-auto mb-2 ${
              attachments.length === 0 ? "text-amber-500" : "text-emerald-500"
            }`} />
            <p className="text-xs font-bold text-slate-800">Upload Receipts, Tax Invoices, or Bank Transfer Proof</p>
            <p className="text-[11px] text-slate-500 mt-1">Accepted formats: PDF, JPG, PNG, WEBP (Max 20MB per file)</p>

            <label className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 transition-all cursor-pointer shadow-xs">
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              <span>{isUploading ? "Uploading..." : "Select File"}</span>
              <input
                type="file"
                disabled={isUploading}
                onChange={handleFileUpload}
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
              />
            </label>
          </div>

          {attachments.length === 0 && (
            <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1.5 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              Supporting document proof is mandatory for all expense claims. Please attach at least one proof file to submit.
            </p>
          )}

          {/* Attached Files List */}
          {attachments.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-bold text-slate-700">Attached Documents ({attachments.length}):</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2.5 truncate">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-800 truncate">{file.fileName}</p>
                        <p className="text-[10px] text-slate-400">{(file.fileSize / 1024).toFixed(1)} KB • {file.documentType}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                      title="Remove attachment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push(`/${roleSlug}/expenses`)}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Submission...</span>
              </>
            ) : (
              <>
                <Receipt className="w-4 h-4" />
                <span>Submit Expense Voucher</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

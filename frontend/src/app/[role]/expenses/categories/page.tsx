"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Layers,
  PlusSquare,
  Search,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Trash2,
  Edit2,
  AlertCircle,
  Loader2
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

export default function ExpenseCategoriesPage() {
  const params = useParams();
  const router = useRouter();
  const roleSlug = params.role as string;
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userRoles: string[] = (session?.user as any)?.roles || [];

  const isSuperadmin = userRoles.includes("SUPERADMIN") || userRoles.includes("ULTRA_ADMIN");

  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["expenses-categories-all"],
    queryFn: async () => (await api.get("/expenses/categories")).data
  });

  const categories = (data?.categories || []).filter((c: any) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Create Category Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => (await api.post("/expenses/categories", payload)).data,
    onSuccess: () => {
      toast.success("Expense category created successfully.");
      setIsCreateOpen(false);
      setNewCatName("");
      setNewCatDesc("");
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to create category.");
    }
  });

  // Toggle Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (id: string) => (await api.patch(`/expenses/categories/${id}/status`)).data,
    onSuccess: (res) => {
      toast.success(`Category "${res.name}" is now ${res.isActive ? "ACTIVE" : "INACTIVE"}.`);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to update category status.");
    }
  });

  // Delete Category Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/expenses/categories/${id}`)).data,
    onSuccess: (res) => {
      toast.success(res.message || "Category deleted.");
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Cannot delete category referenced by financial records.");
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return toast.error("Please enter a category name");
    createMutation.mutate({ name: newCatName.trim(), description: newCatDesc.trim() || null });
  };

  return (
    <div className="space-y-6 max-w-[1400px] pb-16">
      <PageHeader
        title="Expense Categories Directory"
        subtitle="Manage official chart of accounts classifications for manufacturing and operational expenditures"
        icon={<Layers className="w-5 h-5 text-[#0878F9]" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/${roleSlug}/expenses`)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </button>

            {isSuperadmin && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0878F9] hover:bg-[#0667DB] text-white font-bold text-xs transition-all cursor-pointer shadow-xs"
              >
                <PlusSquare className="w-4 h-4" />
                Add Category
              </button>
            )}
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search categories..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-blue-500"
          />
        </div>
        <span className="text-xs font-semibold text-slate-400">Total: {categories.length}</span>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat: any) => (
          <div key={cat.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-900">{cat.name}</h4>
                <button
                  disabled={!isSuperadmin || toggleStatusMutation.isPending}
                  onClick={() => toggleStatusMutation.mutate(cat.id)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                    cat.isActive
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                  }`}
                  title={isSuperadmin ? "Click to toggle active status" : undefined}
                >
                  {cat.isActive ? "ACTIVE" : "INACTIVE"}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{cat.description || "No description provided."}</p>
            </div>

            <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Logged Vouchers: <strong className="text-slate-800">{cat._count?.expenses || 0}</strong>
              </span>

              {isSuperadmin && (
                <button
                  disabled={cat._count?.expenses > 0 || deleteMutation.isPending}
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
                      deleteMutation.mutate(cat.id);
                    }
                  }}
                  className="text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 p-1 transition-colors"
                  title={cat._count?.expenses > 0 ? "Cannot delete category referenced by expenses" : "Delete category"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <PlusSquare className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Add Expense Category</h4>
                <p className="text-xs text-slate-500">Define a new operational expenditure classification</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Solar Equipment Maintenance"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Brief description of this expense classification..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all disabled:opacity-50"
                >
                  {createMutation.isPending ? "Creating..." : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Battery, 
  Lock, 
  Mail, 
  Loader2, 
  ChevronRight, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Wrench, 
  Package, 
  Users, 
  Receipt, 
  ShoppingBag, 
  Megaphone, 
  Layers, 
  Crown,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface SeedAccount {
  role: string;
  name: string;
  email: string;
  pass: string;
  badge: string;
  category: "Core Production" | "Quality & Testing" | "Operations & Supply" | "Administration";
  icon: any;
}

const SEED_ACCOUNTS: SeedAccount[] = [
  {
    role: "Assembly Technician",
    name: "Deepak Nair",
    email: "asm@kyrazam.com",
    pass: "AsmTech@2025",
    badge: "ASSEMBLY_TECH",
    category: "Core Production",
    icon: Wrench,
  },
  {
    role: "Supervisor",
    name: "Meena Iyer",
    email: "super@kyrazam.com",
    pass: "Supervisor@2025",
    badge: "SUPERVISOR",
    category: "Core Production",
    icon: Users,
  },
  {
    role: "Test Engineer",
    name: "Sunita Patel",
    email: "test@kyrazam.com",
    pass: "TestEng@2025",
    badge: "TEST_ENG",
    category: "Quality & Testing",
    icon: Zap,
  },
  {
    role: "QC Inspector",
    name: "Amit Patel",
    email: "qc@kyrazam.com",
    pass: "QcEngineer@2025",
    badge: "QC",
    category: "Quality & Testing",
    icon: ShieldCheck,
  },
  {
    role: "PAX Test Engineer",
    name: "Kiran Reddy",
    email: "paxtest@kyrazam.com",
    pass: "PaxTest@2025",
    badge: "PAX_TEST",
    category: "Quality & Testing",
    icon: Layers,
  },
  {
    role: "Inventory Manager",
    name: "Ravi Kumar",
    email: "inv@kyrazam.com",
    pass: "InvMgr@2025",
    badge: "INVENTORY",
    category: "Operations & Supply",
    icon: Package,
  },
  {
    role: "Packing Operator",
    name: "Suresh Patel",
    email: "packing@kyrazam.com",
    pass: "Packing@2025",
    badge: "PACKING",
    category: "Operations & Supply",
    icon: Package,
  },
  {
    role: "Purchase Manager",
    name: "Sanjay Gupta",
    email: "purchase@kyrazam.com",
    pass: "PurchMgr@2025",
    badge: "PURCHASE",
    category: "Operations & Supply",
    icon: ShoppingBag,
  },
  {
    role: "Sales Executive",
    name: "Vikram Singh",
    email: "sales@kyrazam.com",
    pass: "SalesExec@2025",
    badge: "SALES",
    category: "Operations & Supply",
    icon: ShoppingBag,
  },
  {
    role: "Accountant",
    name: "Ananya Bose",
    email: "acct@kyrazam.com",
    pass: "Accountant@2025",
    badge: "ACCOUNTS",
    category: "Operations & Supply",
    icon: Receipt,
  },
  {
    role: "Marketing Manager",
    name: "Rohit Sharma",
    email: "marketing@kyrazam.com",
    pass: "Marketing@2025",
    badge: "MARKETING",
    category: "Operations & Supply",
    icon: Megaphone,
  },
  {
    role: "Admin",
    name: "Priya Sharma",
    email: "admin@kyrazam.com",
    pass: "Admin@2025",
    badge: "ADMIN",
    category: "Administration",
    icon: ShieldCheck,
  },
  {
    role: "Super Admin",
    name: "Arjun Mehta",
    email: "superadmin@kyrazam.com",
    pass: "SuperAdmin@2025",
    badge: "SUPERADMIN",
    category: "Administration",
    icon: Crown,
  }
];

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeAutoRole, setActiveAutoRole] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const performLogin = async (loginEmail: string, loginPass: string, roleName?: string) => {
    setLoading(true);
    if (roleName) setActiveAutoRole(roleName);

    try {
      const result = await signIn("credentials", {
        email: loginEmail,
        password: loginPass,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid credentials. Please verify your seed password.");
      } else {
        toast.success(`Welcome back${roleName ? `, ${roleName}` : ""}! Redirecting...`);
        
        // Fetch session to retrieve active role and token
        const sessionRes = await fetch("/api/auth/session");
        const session = await sessionRes.json();
        const role = (session?.user as any)?.roles?.[0];
        
        if (session?.accessToken) {
          localStorage.setItem("token", session.accessToken);
        }
        if (session?.refreshToken) {
          localStorage.setItem("refreshToken", session.refreshToken);
        }
        if (session?.user) {
          localStorage.setItem("user", JSON.stringify(session.user));
        }
        
        if (role) {
          const roleSlug = role.toLowerCase().replace(/_/g, "-");
          if (role === "PAX_TEST_ENGINEER" || roleSlug === "pax-test-engineer") {
            router.push(`/${roleSlug}/pax-testing`);
          } else if (role === "PACKING_OPERATOR" || role === "PACKING" || roleSlug === "packing-operator") {
            router.push(`/${roleSlug}/packing`);
          } else {
            router.push(`/${roleSlug}`);
          }
        } else {
          router.push("/dashboard");
        }
      }
    } catch (error) {
      toast.error("An unexpected error occurred during login.");
    } finally {
      setLoading(false);
      setActiveAutoRole(null);
    }
  };

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(email, password);
  };

  const handleQuickRoleSelect = (account: SeedAccount) => {
    setEmail(account.email);
    setPassword(account.pass);
    performLogin(account.email, account.pass, account.role);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#F4F9FF] text-[#0B2148] flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Soft Ambient Light Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-[#0878F9]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-[#FFC928]/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start relative z-10"
      >
        {/* Left Column: Form & Brand Card */}
        <div className="lg:col-span-5 w-full bg-white border border-[#D8E8FA] shadow-xl shadow-blue-900/5 p-7 sm:p-9 rounded-2xl relative">
          
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 bg-[#EAF5FF] border border-[#D8E8FA] rounded-2xl flex items-center justify-center mb-3 shadow-xs">
              <Battery className="w-7 h-7 text-[#0878F9]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0B2148] tracking-tight flex items-center gap-1.5 justify-center">
              <span>KYRA</span>
              <span className="text-[#0878F9]">ZAM</span>
              <span className="text-xs px-2 py-0.5 bg-[#EAF5FF] border border-[#D8E8FA] text-[#0878F9] rounded font-mono font-bold">2.0</span>
            </h1>
            <p className="text-[#526B91] mt-1 text-xs font-semibold uppercase tracking-wider">
              Battery Pack Management System
            </p>
          </div>

          <form onSubmit={handleManualLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0B2148] ml-0.5">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] group-focus-within:text-[#0878F9] transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@kyrazam.com"
                  className="w-full bg-white border border-[#D8E8FA] rounded-lg py-2.5 pl-10 pr-3.5 text-sm text-[#0B2148] placeholder-[#94A3B8] focus:outline-none focus:border-[#0878F9] focus:ring-2 focus:ring-[#0878F9]/15 transition-all font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0B2148] ml-0.5">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] group-focus-within:text-[#0878F9] transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-white border border-[#D8E8FA] rounded-lg py-2.5 pl-10 pr-3.5 text-sm text-[#0B2148] placeholder-[#94A3B8] focus:outline-none focus:border-[#0878F9] focus:ring-2 focus:ring-[#0878F9]/15 transition-all font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0878F9] hover:bg-[#0667DB] disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer active:scale-98 mt-2 text-xs uppercase tracking-wider"
            >
              {loading && !activeAutoRole ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#D8E8FA] text-center">
            <p className="text-[11px] text-[#526B91] leading-relaxed">
              &copy; 2026 GROWPHIL PROJECTS PVT LTD.<br />
              Industrial Battery Pack ERP & Execution System
            </p>
          </div>
        </div>

        {/* Right Column: Seed Roles Quick Auto-Login Grid */}
        <div className="lg:col-span-7 w-full bg-white border border-[#D8E8FA] shadow-xl shadow-blue-900/5 p-6 sm:p-8 rounded-2xl space-y-4">
          
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D8E8FA] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#0B2148] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0878F9]" />
                Demo Personnel & Quick Auto-Login
              </h2>
              <p className="text-xs text-[#526B91] mt-0.5">
                Click any seeded personnel card below to auto-fill credentials and log in instantly.
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 bg-[#EAF5FF] border border-[#D8E8FA] rounded-full text-[#0878F9]">
              13 Roles Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[520px] overflow-y-auto pr-1">
            {SEED_ACCOUNTS.map((acc) => {
              const Icon = acc.icon;
              const isSelected = activeAutoRole === acc.role;

              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleQuickRoleSelect(acc)}
                  disabled={loading}
                  className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden group flex items-start gap-3 cursor-pointer ${
                    isSelected 
                      ? "bg-[#EAF5FF] border-[#0878F9] ring-2 ring-[#0878F9]/30 shadow-xs" 
                      : "bg-[#F4F9FF] hover:bg-[#EAF5FF] border-[#D8E8FA] hover:border-[#0878F9]/40 active:scale-98"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    acc.category === "Core Production" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                    acc.category === "Quality & Testing" ? "bg-blue-50 border-blue-200 text-blue-700" :
                    acc.category === "Administration" ? "bg-purple-50 border-purple-200 text-purple-700" :
                    "bg-sky-50 border-sky-200 text-sky-700"
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-[#0B2148] group-hover:text-[#0878F9] transition-colors truncate">
                        {acc.role}
                      </p>
                      {isSelected && (
                        <Loader2 className="w-3.5 h-3.5 text-[#0878F9] animate-spin shrink-0" />
                      )}
                    </div>
                    
                    <p className="text-[11px] text-[#526B91] font-medium truncate mt-0.5">
                      {acc.name}
                    </p>
                    
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#64748B] mt-1">
                      <span className="truncate">{acc.email}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white text-[#0B2148] border border-[#D8E8FA] shrink-0 ml-1 font-semibold">
                        {acc.badge}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-3 bg-[#F4F9FF] border border-[#D8E8FA] rounded-xl flex items-center justify-between text-[11px] text-[#526B91]">
            <span>Default Seed Password for all accounts:</span>
            <span className="font-mono font-bold text-[#0B2148] bg-white px-2 py-0.5 rounded border border-[#D8E8FA]">
              RoleName@2025
            </span>
          </div>

        </div>

      </motion.div>
    </div>
  );
}

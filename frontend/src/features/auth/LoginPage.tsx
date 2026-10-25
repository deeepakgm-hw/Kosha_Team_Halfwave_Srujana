import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ShieldCheck,
  TrendingUp,
  Receipt,
  QrCode,
  Lock,
  Mail,
  User,
  Building,
  Phone,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { KoshaLogo } from "../../components/ui/KoshaLogo";
import { useAuth } from "../../context/AuthContext";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, login, registerCustomer, registerBusiness, loginWithGoogle, forgotPassword, resetPassword } = useAuth();

  // Role tab: "customer" | "business_owner"
  const initialRole = searchParams.get("role") === "business" ? "business_owner" : "customer";
  const [role, setRole] = useState<"customer" | "business_owner">(initialRole);

  // Form mode: "login" | "register"
  const [mode, setMode] = useState<"login" | "register">("login");

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("retail");

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Forgot password modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // If already authenticated, redirect
  useEffect(() => {
    if (user) {
      if (user.role === "customer") {
        navigate("/customer/dashboard");
      } else {
        navigate("/load");
      }
    }
  }, [user, navigate]);

  // Sync role with URL query param if present
  const handleRoleChange = (newRole: "customer" | "business_owner") => {
    setRole(newRole);
    setErrorMessage(null);
    setSuccessMessage(null);
    setSearchParams({ role: newRole === "business_owner" ? "business" : "customer" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await login({ email, password, role });
      } else {
        if (role === "customer") {
          if (!fullName.trim()) {
            throw new Error("Please enter your full name.");
          }
          await registerCustomer({
            email,
            password,
            confirm_password: password,
            full_name: fullName,
            phone: phone.trim() || undefined,
          });
        } else {
          if (!fullName.trim()) {
            throw new Error("Please enter your full name.");
          }
          if (!businessName.trim()) {
            throw new Error("Please enter your business or shop name.");
          }
          await registerBusiness({
            email,
            password,
            confirm_password: password,
            full_name: fullName,
            business_name: businessName,
            business_type: businessType,
            phone: phone.trim() || undefined,
          });
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Authentication failed. Please verify your details.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    let googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!googleClientId) {
      try {
        const confRes = await fetch("/api/auth/config");
        if (confRes.ok) {
          const conf = await confRes.json();
          googleClientId = conf.google_client_id;
        }
      } catch {
        // Fall through
      }
    }

    if (!googleClientId) {
      setErrorMessage(
        "Google Sign-In is not configured yet for this environment (GOOGLE_CLIENT_ID missing). Please use standard email/password."
      );
      return;
    }

    try {
      setLoading(true);
      if (!(window as any).google?.accounts?.id) {
        throw new Error("Google Identity Services script is loading. Please try again in a moment.");
      }

      (window as any).google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: any) => {
          try {
            await loginWithGoogle({ credential: response.credential, role });
          } catch (err: any) {
            setErrorMessage(err?.message || "Google authentication failed.");
          } finally {
            setLoading(false);
          }
        },
      });

      (window as any).google.accounts.id.prompt();
    } catch (err: any) {
      setErrorMessage(err?.message || "Unable to initialize Google Sign-In.");
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);

    try {
      if (!resetToken) {
        const res = await forgotPassword(forgotEmail);
        setForgotSuccess(res.message);
        if (res.reset_token) {
          setResetToken(res.reset_token);
        }
      } else {
        const res = await resetPassword({
          token: resetToken,
          new_password: newPassword,
          confirm_password: newPassword,
        });
        setForgotSuccess(res.message);
        setTimeout(() => {
          setIsForgotModalOpen(false);
          setResetToken(null);
          setForgotEmail("");
          setNewPassword("");
        }, 1500);
      }
    } catch (err: any) {
      setForgotError(err?.message || "Failed to process password request.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-6 lg:p-10 relative overflow-hidden bg-gradient-to-br from-[#F5F7FA] via-[#EDF3FC] to-[#E5F0FC]">
      {/* Dynamic Ambient Glassmorphism Orbs */}
      <div className="absolute -top-28 -left-28 w-[500px] h-[500px] bg-[#0070E0]/15 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute top-1/4 -right-24 w-[460px] h-[460px] bg-sky-400/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/4 w-[480px] h-[480px] bg-[#001C64]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-[360px] h-[360px] bg-[#FFC439]/12 rounded-full blur-[90px] pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between z-10 relative mb-4">
        <div className="flex items-center gap-3">
          <KoshaLogo size="md" showWordmark={true} />
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/70 backdrop-blur-md text-[#003087] border border-white/80 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0070E0]" />
            <span>Secure Treasury Platform</span>
          </div>
        </div>

        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#545D68] hover:text-[#001C64] px-3.5 py-1.5 rounded-full bg-white/60 hover:bg-white/90 backdrop-blur-md border border-white/80 shadow-xs transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </button>
      </header>

      {/* Main 2-Column Split */}
      <main className="w-full max-w-6xl mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center z-10 my-auto py-6">
        {/* Left Column: Brand & Value Narrative */}
        <div className="lg:col-span-6 space-y-6 text-[#0C0C0D] pr-0 lg:pr-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-white/90 text-[#001C64] text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#0070E0]" />
            <span>Authentic Real-Time Treasury</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#001C64] leading-tight">
            Know your treasury <br />
            <span className="text-[#0070E0]">
              before it runs dry.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-[#545D68] leading-relaxed font-normal">
            Stay ahead of your cash flow. Track verified payments, generate automated digital bills, manage shop credit, and ensure timely collections with full data transparency.
          </p>

          {/* Value Props Matrix (Frosted Glass Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#E1E7EC]/80">
            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/65 hover:bg-white/85 backdrop-blur-md border border-white/90 shadow-[0_4px_16px_rgba(0,28,100,0.04)] transition-all duration-200">
              <div className="p-2.5 rounded-xl bg-[#0070E0]/10 text-[#0070E0] shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#001C64]">Verified UPI Payments</h4>
                <p className="text-xs text-[#545D68] mt-0.5">Dynamic QR with live webhook reconciliation.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/65 hover:bg-white/85 backdrop-blur-md border border-white/90 shadow-[0_4px_16px_rgba(0,28,100,0.04)] transition-all duration-200">
              <div className="p-2.5 rounded-xl bg-[#003087]/10 text-[#003087] shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#001C64]">Unified Bill Ledger</h4>
                <p className="text-xs text-[#545D68] mt-0.5">Dual-synchronized customer & shopkeeper views.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/65 hover:bg-white/85 backdrop-blur-md border border-white/90 shadow-[0_4px_16px_rgba(0,28,100,0.04)] transition-all duration-200">
              <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-700 shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#001C64]">Runway Forecasting</h4>
                <p className="text-xs text-[#545D68] mt-0.5">Simulate stress tests and cash inflows accurately.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/65 hover:bg-white/85 backdrop-blur-md border border-white/90 shadow-[0_4px_16px_rgba(0,28,100,0.04)] transition-all duration-200">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-700 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#001C64]">Strict Data Integrity</h4>
                <p className="text-xs text-[#545D68] mt-0.5">Genuine multi-tenant relational persistence.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Premium Glassmorphism Card */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <div className="relative rounded-3xl bg-white/75 backdrop-blur-2xl border border-white/90 shadow-[0_20px_50px_rgba(0,28,100,0.09),0_0_0_1px_rgba(255,255,255,0.8)] p-6 sm:p-8 overflow-hidden">
            {/* Top Light Glare Highlight */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-white/60 to-transparent rounded-full blur-2xl pointer-events-none" />

            {/* Segmented Role Selector */}
            <div className="flex p-1.5 mb-6 rounded-2xl bg-[#E1E7EC]/60 backdrop-blur-md border border-white/70 shadow-inner relative z-10">
              <button
                type="button"
                onClick={() => handleRoleChange("customer")}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  role === "customer"
                    ? "bg-white text-[#001C64] shadow-sm border border-white/80"
                    : "text-[#545D68] hover:text-[#001C64] hover:bg-white/40"
                }`}
              >
                <User className="w-4 h-4 text-[#0070E0]" />
                <span>Customer</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange("business_owner")}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  role === "business_owner"
                    ? "bg-white text-[#001C64] shadow-sm border border-white/80"
                    : "text-[#545D68] hover:text-[#001C64] hover:bg-white/40"
                }`}
              >
                <Building className="w-4 h-4 text-[#0070E0]" />
                <span>Business Owner</span>
              </button>
            </div>

            {/* Contextual Header */}
            <div className="mb-6 relative z-10">
              <h2 className="text-xl sm:text-2xl font-black text-[#001C64] tracking-tight">
                {role === "customer"
                  ? mode === "login"
                    ? "Welcome back"
                    : "Create Customer Account"
                  : mode === "login"
                  ? "Welcome back, Business Owner"
                  : "Register Your Business"}
              </h2>
              <p className="text-xs sm:text-sm text-[#545D68] mt-1 font-medium">
                {role === "customer"
                  ? mode === "login"
                    ? "Sign in to manage your purchases, payments, and outstanding dues."
                    : "Join KOSHA to view bills, settle balances, and track payment receipts."
                  : mode === "login"
                  ? "Manage your bills, customer dues, payments, and cash flow in one place."
                  : "Set up your verified business treasury, register customers, and issue digital bills."}
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-50/90 backdrop-blur-xs border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 shadow-2xs relative z-10">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="font-medium">{errorMessage}</div>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50/90 backdrop-blur-xs border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 shadow-2xs relative z-10">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <div className="font-medium">{successMessage}</div>
              </div>
            )}

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl border border-[#E1E7EC] bg-white/85 hover:bg-white backdrop-blur-sm text-[#001C64] font-bold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-2xs hover:shadow-xs transition-all mb-5 disabled:opacity-50 cursor-pointer relative z-10"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center justify-center my-4 z-10">
              <div className="border-t border-[#E1E7EC] w-full" />
              <span className="bg-white/80 backdrop-blur-md px-3 text-[11px] uppercase tracking-wider text-[#545D68] font-bold rounded-full border border-white/60 absolute">
                or with email
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              {mode === "register" && (
                <div>
                  <label className="block text-xs font-bold text-[#001C64] mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E1E7EC] focus:outline-hidden focus:ring-4 focus:ring-[#0070E0]/15 focus:border-[#0070E0] bg-white/70 backdrop-blur-sm text-[#001C64] placeholder:text-slate-400 transition-all shadow-2xs"
                    />
                  </div>
                </div>
              )}

              {mode === "register" && role === "business_owner" && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#001C64] mb-1">Business Name</label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Royal Provisions"
                        className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E1E7EC] focus:outline-hidden focus:ring-4 focus:ring-[#0070E0]/15 focus:border-[#0070E0] bg-white/70 backdrop-blur-sm text-[#001C64] placeholder:text-slate-400 transition-all shadow-2xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#001C64] mb-1">Business Type</label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E1E7EC] focus:outline-hidden focus:ring-4 focus:ring-[#0070E0]/15 focus:border-[#0070E0] bg-white/70 backdrop-blur-sm text-[#001C64] transition-all shadow-2xs cursor-pointer"
                    >
                      <option value="retail">Retail / Grocery Store</option>
                      <option value="wholesale">Wholesale &amp; Distribution</option>
                      <option value="manufacturing">Manufacturing</option>
                      <option value="services">Services &amp; Consulting</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-[#001C64] mb-1">
                  {role === "business_owner" ? "Business Email Address" : "Email Address"}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E1E7EC] focus:outline-hidden focus:ring-4 focus:ring-[#0070E0]/15 focus:border-[#0070E0] bg-white/70 backdrop-blur-sm text-[#001C64] placeholder:text-slate-400 transition-all shadow-2xs"
                  />
                </div>
              </div>

              {mode === "register" && (
                <div>
                  <label className="block text-xs font-bold text-[#001C64] mb-1">
                    Phone Number <span className="text-[#545D68] font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E1E7EC] focus:outline-hidden focus:ring-4 focus:ring-[#0070E0]/15 focus:border-[#0070E0] bg-white/70 backdrop-blur-sm text-[#001C64] placeholder:text-slate-400 transition-all shadow-2xs"
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#001C64]">Password</label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setIsForgotModalOpen(true);
                      }}
                      className="text-xs font-bold text-[#0070E0] hover:text-[#003087] transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E1E7EC] focus:outline-hidden focus:ring-4 focus:ring-[#0070E0]/15 focus:border-[#0070E0] bg-white/70 backdrop-blur-sm text-[#001C64] placeholder:text-slate-400 transition-all shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Signature Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[#0070E0] hover:bg-[#003087] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(0,112,224,0.35)] hover:shadow-[0_6px_20px_rgba(0,112,224,0.45)] active:scale-[0.99] transition-all duration-200 mt-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>
                      {mode === "login"
                        ? "Sign In"
                        : role === "customer"
                        ? "Create Customer Account"
                        : "Register Business"}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Mode Switcher */}
            <div className="mt-5 text-center text-xs text-[#545D68] relative z-10 font-medium">
              {mode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setErrorMessage(null);
                    }}
                    className="font-bold text-[#0070E0] hover:text-[#003087] underline underline-offset-2 ml-1 cursor-pointer"
                  >
                    {role === "customer" ? "Create Customer Account" : "Register Business"}
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setErrorMessage(null);
                    }}
                    className="font-bold text-[#0070E0] hover:text-[#003087] underline underline-offset-2 ml-1 cursor-pointer"
                  >
                    Sign in here
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Frosted Glass Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white/85 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_rgba(0,28,100,0.18)] border border-white/90 p-6 sm:p-8 relative">
            <h3 className="text-lg font-black text-[#001C64] mb-1">Reset Password</h3>
            <p className="text-xs text-[#545D68] mb-4 font-medium">
              Enter your registered email address to receive a secure password reset token.
            </p>

            {forgotError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {forgotError}
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                {forgotSuccess}
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#001C64] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E1E7EC] focus:outline-hidden focus:ring-4 focus:ring-[#0070E0]/15 focus:border-[#0070E0] bg-white/70 backdrop-blur-sm text-[#001C64] transition-all"
                />
              </div>

              {resetToken && (
                <div>
                  <label className="block text-xs font-bold text-[#001C64] mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new 8+ character password"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E1E7EC] focus:outline-hidden focus:ring-4 focus:ring-[#0070E0]/15 focus:border-[#0070E0] bg-white/70 backdrop-blur-sm text-[#001C64] transition-all"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[#545D68] hover:text-[#001C64] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0070E0] hover:bg-[#003087] text-white text-xs font-bold shadow-[0_4px_12px_rgba(0,112,224,0.3)] cursor-pointer"
                >
                  {resetToken ? "Update Password" : "Send Reset Token"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto text-center py-4 text-xs text-[#545D68] z-10 font-medium">
        &copy; {new Date().getFullYear()} KOSHA Treasury Platform. Strictly authentic financial ledgering.
      </footer>
    </div>
  );
};

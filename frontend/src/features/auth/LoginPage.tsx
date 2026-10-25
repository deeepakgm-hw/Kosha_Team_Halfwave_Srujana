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
        // Navigation will be handled by useEffect
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
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!googleClientId) {
      setErrorMessage(
        "Google Sign-In is not configured yet for this environment (VITE_GOOGLE_CLIENT_ID missing). Please use standard email/password."
      );
      return;
    }

    try {
      setLoading(true);
      // Trigger Google Identity Services One Tap or Token Flow
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
        // If server provided reset_token in dev mode, capture it
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
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-6 lg:p-10 relative overflow-hidden bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50/30">
      {/* Decorative ambient background accents */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between z-10 relative mb-4">
        <div className="flex items-center gap-3">
          <KoshaLogo size="md" showWordmark={true} />
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Secure Treasury Platform</span>
          </div>
        </div>

        <button
          onClick={() => navigate("/")}
          className="text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          &larr; Back to Home
        </button>
      </header>

      {/* Main 2-Column Split */}
      <main className="w-full max-w-6xl mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center z-10 my-auto py-6">
        {/* Left Column: Brand & Value Narrative */}
        <div className="lg:col-span-6 space-y-6 text-slate-900 pr-0 lg:pr-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100/70 border border-emerald-200/80 text-emerald-900 text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Authentic Real-Time Treasury</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Know your treasury <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-700">
              before it runs dry.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Stay ahead of your cash flow. Track verified payments, generate automated digital bills, manage shop credit, and ensure timely collections with full data transparency.
          </p>

          {/* Value Props Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200/80">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/60 backdrop-blur-xs border border-white/80 shadow-xs">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Verified UPI Payments</h4>
                <p className="text-xs text-slate-500 mt-0.5">Dynamic QR with live webhook reconciliation.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/60 backdrop-blur-xs border border-white/80 shadow-xs">
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-700">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Unified Bill Ledger</h4>
                <p className="text-xs text-slate-500 mt-0.5">Dual-synchronized customer & shopkeeper views.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/60 backdrop-blur-xs border border-white/80 shadow-xs">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-700">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Runway Forecasting</h4>
                <p className="text-xs text-slate-500 mt-0.5">Simulate stress tests and cash inflows accurately.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/60 backdrop-blur-xs border border-white/80 shadow-xs">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Strict Data Integrity</h4>
                <p className="text-xs text-slate-500 mt-0.5">Genuine multi-tenant relational persistence.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Card */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <div className="relative rounded-2xl bg-white/80 backdrop-blur-xl border border-slate-200/90 shadow-xl shadow-emerald-950/5 p-6 sm:p-8">
            {/* Segmented Role Selector */}
            <div className="flex p-1 mb-6 rounded-xl bg-slate-100/90 border border-slate-200/80">
              <button
                type="button"
                onClick={() => handleRoleChange("customer")}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  role === "customer"
                    ? "bg-white text-emerald-800 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <User className="w-4 h-4" />
                <span>Customer</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange("business_owner")}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
                  role === "business_owner"
                    ? "bg-white text-emerald-800 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Building className="w-4 h-4" />
                <span>Business Owner</span>
              </button>
            </div>

            {/* Contextual Header */}
            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {role === "customer"
                  ? mode === "login"
                    ? "Welcome back"
                    : "Create Customer Account"
                  : mode === "login"
                  ? "Welcome back, Business Owner"
                  : "Register Your Business"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
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
              <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div>{errorMessage}</div>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <div>{successMessage}</div>
              </div>
            )}

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-xs transition-colors mb-5 disabled:opacity-50"
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

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-slate-400 font-semibold absolute">
                or with email
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all bg-white"
                    />
                  </div>
                </div>
              )}

              {mode === "register" && role === "business_owner" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name</label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Royal Provisions"
                        className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Business Type</label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all bg-white text-slate-700"
                    >
                      <option value="retail">Retail / Grocery Store</option>
                      <option value="wholesale">Wholesale & Distribution</option>
                      <option value="manufacturing">Manufacturing</option>
                      <option value="services">Services & Consulting</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all bg-white"
                  />
                </div>
              </div>

              {mode === "register" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all bg-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setIsForgotModalOpen(true);
                      }}
                      className="text-xs font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
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
                    className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 transition-all duration-200 mt-2 disabled:opacity-50 cursor-pointer"
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
            <div className="mt-5 text-center text-xs text-slate-600">
              {mode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setErrorMessage(null);
                    }}
                    className="font-bold text-emerald-700 hover:text-emerald-800 underline underline-offset-2 ml-1"
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
                    className="font-bold text-emerald-700 hover:text-emerald-800 underline underline-offset-2 ml-1"
                  >
                    Sign in here
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 relative">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Reset Password</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter your registered email address to receive a password reset token.
            </p>

            {forgotError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {forgotError}
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                {forgotSuccess}
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                />
              </div>

              {resetToken && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new 8+ character password"
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                >
                  {resetToken ? "Update Password" : "Send Reset Token"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto text-center py-4 text-xs text-slate-400 z-10">
        &copy; {new Date().getFullYear()} KOSHA Treasury Platform. Strictly authentic financial ledgering.
      </footer>
    </div>
  );
};

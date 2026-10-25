import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Store,
  User,
  Menu,
  X,
  TrendingUp,
  QrCode,
  ShieldCheck,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { KoshaLogo } from "../../components/ui/KoshaLogo";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";

export const LandingNavbar: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [solutionsDropdownOpen, setSolutionsDropdownOpen] = useState(false);

  const handleOpenBusiness = () => {
    if (isAuthenticated && user?.role === "business_owner") {
      navigate("/overview");
    } else {
      navigate("/login?role=business");
    }
  };

  const handleOpenCustomer = () => {
    if (isAuthenticated && user?.role === "customer") {
      navigate("/customer/dashboard");
    } else {
      navigate("/login?role=customer");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E1E7EC] transition-all duration-200">
      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link to="/" className="flex items-center gap-2 focus:outline-hidden" aria-label="KOSHA Home">
            <KoshaLogo size="md" showWordmark={true} />
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-[#0C0C0D]">
            {/* Solutions Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setSolutionsDropdownOpen(true)}
              onMouseLeave={() => setSolutionsDropdownOpen(false)}
            >
              <button
                type="button"
                className="flex items-center gap-1 hover:text-[#0070E0] transition-colors py-2 cursor-pointer"
                onClick={() => setSolutionsDropdownOpen(!solutionsDropdownOpen)}
              >
                <span>Solutions</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${solutionsDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {solutionsDropdownOpen && (
                <div className="absolute top-full left-0 w-80 bg-white rounded-2xl shadow-xl border border-[#E1E7EC] p-3 space-y-1.5 animate-in fade-in slide-in-from-top-2">
                  <a
                    href="#predictive-runway"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F5F7FA] transition-colors"
                    onClick={() => setSolutionsDropdownOpen(false)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#0070E0]/10 text-[#0070E0] flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#001C64]">90-Day Predictive Runway</div>
                      <div className="text-[11px] text-[#545D68]">Forecast cash flow &amp; safety buffer breaches</div>
                    </div>
                  </a>

                  <a
                    href="#shop-credit"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F5F7FA] transition-colors"
                    onClick={() => setSolutionsDropdownOpen(false)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#001C64]">Counter QR Credit Checkout</div>
                      <div className="text-[11px] text-[#545D68]">Split payments &amp; instant customer ledgers</div>
                    </div>
                  </a>

                  <a
                    href="#msmed-protection"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F5F7FA] transition-colors"
                    onClick={() => setSolutionsDropdownOpen(false)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#003087]/10 text-[#003087] flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#001C64]">MSMED Section 16 Engine</div>
                      <div className="text-[11px] text-[#545D68]">Statutory 3x RBI penal interest tracking</div>
                    </div>
                  </a>
                </div>
              )}
            </div>

            <a href="#predictive-runway" className="hover:text-[#0070E0] transition-colors">
              Predictive Runway
            </a>
            <a href="#shop-credit" className="hover:text-[#0070E0] transition-colors">
              Shop Credit &amp; QR
            </a>
            <a href="#msmed-protection" className="hover:text-[#0070E0] transition-colors">
              MSMED Protection
            </a>
            <a href="#how-it-works" className="hover:text-[#0070E0] transition-colors">
              How It Works
            </a>
          </nav>
        </div>

        {/* Right Nav: Language + Auth State / Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          {/* Language Switcher */}
          <div className="flex items-center p-0.5 rounded-full bg-[#F5F7FA] border border-[#E1E7EC] text-xs font-semibold">
            <button
              onClick={() => setLanguage("EN")}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                language === "EN" ? "bg-white text-[#001C64] shadow-xs font-bold" : "text-[#545D68] hover:text-[#0C0C0D]"
              }`}
              aria-label="English language"
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("HI")}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                language === "HI" ? "bg-white text-[#001C64] shadow-xs font-bold" : "text-[#545D68] hover:text-[#0C0C0D]"
              }`}
              aria-label="Hindi language (हिन्दी)"
            >
              हि
            </button>
            <button
              onClick={() => setLanguage("KN")}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                language === "KN" ? "bg-white text-[#001C64] shadow-xs font-bold" : "text-[#545D68] hover:text-[#0C0C0D]"
              }`}
              aria-label="Kannada language (ಕನ್ನಡ)"
            >
              ಕ
            </button>
          </div>

          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(user.role === "customer" ? "/customer/dashboard" : "/overview")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer"
              >
                {user.role === "customer" ? <User className="w-3.5 h-3.5" /> : <Store className="w-3.5 h-3.5" />}
                <span>{user.full_name || user.email}</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-full text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              {/* Member Login Button */}
              <button
                type="button"
                onClick={handleOpenCustomer}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold text-[#0070E0] bg-white hover:bg-[#F5F7FA] border-2 border-[#0070E0] transition-all shadow-xs hover:shadow-sm cursor-pointer"
                aria-label="Member Login"
              >
                <User className="w-3.5 h-3.5 text-[#0070E0]" />
                <span>Member Login</span>
              </button>

              {/* Business Login Button */}
              <button
                type="button"
                onClick={handleOpenBusiness}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-white bg-[#0070E0] hover:bg-[#003087] transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer"
                aria-label="Business Login"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Business Login</span>
              </button>
            </>
          )}
        </div>

        {/* Mobile menu hamburger toggle */}
        <div className="flex sm:hidden items-center gap-2">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => navigate(user?.role === "customer" ? "/customer/dashboard" : "/load")}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-emerald-700"
            >
              Dashboard
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenBusiness}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-[#0070E0]"
            >
              Login
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-white border-b border-slate-200 px-4 py-5 space-y-4 animate-in fade-in duration-150">
          <nav className="flex flex-col space-y-3 text-sm font-semibold text-slate-700">
            <a
              href="#predictive-runway"
              className="py-1 hover:text-[#0070E0]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Predictive Cash Runway
            </a>
            <a
              href="#shop-credit"
              className="py-1 hover:text-[#0070E0]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Shop Credit & QR Checkout
            </a>
            <a
              href="#msmed-protection"
              className="py-1 hover:text-[#0070E0]"
              onClick={() => setMobileMenuOpen(false)}
            >
              MSMED Act Protection
            </a>
            <a
              href="#how-it-works"
              className="py-1 hover:text-[#0070E0]"
              onClick={() => setMobileMenuOpen(false)}
            >
              How It Works
            </a>
          </nav>

          {/* Language Switcher in Mobile Drawer */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Select Language:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLanguage("EN")}
                className={`px-3 py-1 rounded-md text-xs font-bold ${
                  language === "EN" ? "bg-[#0070E0] text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage("HI")}
                className={`px-3 py-1 rounded-md text-xs font-bold ${
                  language === "HI" ? "bg-[#0070E0] text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                हिन्दी
              </button>
              <button
                onClick={() => setLanguage("KN")}
                className={`px-3 py-1 rounded-md text-xs font-bold ${
                  language === "KN" ? "bg-[#0070E0] text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                ಕನ್ನಡ
              </button>
            </div>
          </div>

          {/* Dual Action Login / Logout Buttons in Mobile Drawer */}
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            {isAuthenticated && user ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(user.role === "customer" ? "/customer/dashboard" : "/overview");
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2"
                >
                  {user.role === "customer" ? <User className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                  <span>Open {user.role === "customer" ? "Customer Portal" : "Merchant Portal"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full py-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-sm flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out ({user.email})</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleOpenBusiness();
                  }}
                  className="w-full py-3 rounded-xl bg-[#0070E0] text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2"
                >
                  <Store className="w-4 h-4" />
                  <span>Business Login (Merchant Portal)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleOpenCustomer();
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300/80 font-bold text-sm flex items-center justify-center gap-2"
                >
                  <User className="w-4 h-4 text-emerald-700" />
                  <span>Member Login (Customer Portal)</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

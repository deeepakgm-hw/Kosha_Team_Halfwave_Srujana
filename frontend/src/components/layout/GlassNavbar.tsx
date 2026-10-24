import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { KoshaLogo } from "../ui/KoshaLogo";
import { useBusiness } from "../../context/BusinessContext";
import { useLanguage } from "../../context/LanguageContext";
import { ChevronDown, Database, Sparkles, Plus, Check, Menu, X, HelpCircle, LogOut, User } from "lucide-react";

export const GlassNavbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { language, setLanguage, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const {
    isDemoMode,
    setIsDemoMode,
    businesses,
    activeBusiness,
    activeBusinessId,
    setActiveBusinessId,
    createBusiness,
  } = useBusiness();

  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newBizName, setNewBizName] = useState<string>("");
  const [newBizCategory, setNewBizCategory] = useState<string>("Small");

  const mainSteps = [
    { stepNumber: 1, name: t("step1"), path: "/load", aliases: ["/"] },
    { stepNumber: 2, name: t("step2"), path: "/understand-cash-flow", aliases: ["/forecast", "/know"] },
    { stepNumber: 3, name: t("step3"), path: "/test-scenarios", aliases: ["/scenarios", "/simulate", "/decide"] },
    { stepNumber: 4, name: t("step4"), path: "/compare-actions", aliases: ["/actions", "/fixes", "/act"] },
    { stepNumber: 5, name: t("step5"), path: "/action-plan", aliases: ["/plan"] },
  ];

  const supportingNav = [
    { name: t("receivables"), path: "/receivables", aliases: [] },
    { name: "Shop Credit", path: "/shop-credit", aliases: ["/shopkeeper", "/shopkeeper-credit"] },
    { name: t("cashCalendar"), path: "/calendar", aliases: ["/cash-calendar"] },
    { name: t("forecastReliability"), path: "/reliability", aliases: ["/trust", "/forecast-reliability"] },
  ];

  const handleSignOut = () => {
    sessionStorage.clear();
    localStorage.removeItem("kosha_user_session");
    setIsDemoMode(true);
    navigate("/welcome");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBizName.trim()) return;
    try {
      await createBusiness({
        legal_name: newBizName.trim(),
        trade_name: newBizName.trim().split(" ")[0],
        msme_category: newBizCategory,
      });
      setShowCreateModal(false);
      setNewBizName("");
    } catch {
      // Handled in context
    }
  };

  const isStepActive = (item: { path: string; aliases?: string[] }) => {
    if (currentPath === item.path) return true;
    if (currentPath === "/" && item.path === "/load") return true;
    if (item.aliases && item.aliases.includes(currentPath)) return true;
    return false;
  };

  return (
    <header className="w-full px-4 sm:px-6 py-3.5 flex flex-col z-30 relative select-none">
      <div className="w-full flex items-center justify-between">
        {/* Left: Brand Lockup */}
        <Link to="/load" className="hover:opacity-95 transition-opacity shrink-0 flex items-center gap-2">
          <KoshaLogo size="md" showWordmark={true} />
        </Link>

        {/* Center: Stepper & Navigation Pills (Desktop & Tablet) */}
        <nav
          aria-label="Main Treasury Workflow Navigation"
          className="hidden lg:flex items-center gap-0.5 xl:gap-1.5 p-1 rounded-full bg-white/50 backdrop-blur-md border border-white/70 shadow-xs overflow-x-auto no-scrollbar shrink-0"
        >
          {/* Main 5-Step Flow */}
          {mainSteps.map((item) => {
            const active = isStepActive(item);

            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? "page" : undefined}
                className={`px-2 xl:px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  active
                    ? "bg-kosha-blue text-white shadow-xs ring-2 ring-blue-400/30"
                    : "text-kosha-navy/80 hover:text-kosha-navy hover:bg-white/60"
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                  active ? "bg-white/20 text-white" : "bg-slate-200/70 text-slate-600"
                }`}>
                  {item.stepNumber}
                </span>
                <span>{item.name}</span>
              </Link>
            );
          })}

          {/* Divider */}
          <span className="w-px h-4 bg-slate-300/80 mx-1 shrink-0" />

          {/* Supporting Views */}
          {supportingNav.map((item) => {
            const active = isStepActive(item);
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? "page" : undefined}
                className={`px-2 xl:px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  active
                    ? "bg-kosha-blue text-white shadow-xs font-semibold ring-2 ring-blue-400/30"
                    : "text-kosha-navy/80 hover:text-kosha-navy hover:bg-white/60"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Right: Controls & Workspace Mode */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Workspace Mode Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/60 hover:bg-white/80 border border-white/80 text-kosha-navy shadow-xs transition-all"
              title="Switch Workspace Mode"
              aria-label="Switch workspace mode"
            >
              {isDemoMode ? (
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <Database className="w-3.5 h-3.5 text-kosha-blue" />
              )}
              <span className="max-w-[110px] sm:max-w-[140px] truncate">
                {isDemoMode ? "Demo Mode" : activeBusiness?.legal_name || "Real Data"}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-10 w-64 rounded-2xl bg-white/95 backdrop-blur-xl border border-white/80 shadow-glass-lg p-2 z-50 text-xs">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Workspace
                </div>
                <button
                  onClick={() => {
                    setIsDemoMode(true);
                    setShowDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                    isDemoMode ? "bg-amber-50 text-amber-900 font-semibold" : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Sample Business (Demo)</span>
                  </div>
                  {isDemoMode && <Check className="w-3.5 h-3.5 text-amber-600" />}
                </button>

                {businesses.map((biz) => (
                  <button
                    key={biz.id}
                    onClick={() => {
                      setIsDemoMode(false);
                      setActiveBusinessId(biz.id);
                      setShowDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                      !isDemoMode && activeBusinessId === biz.id
                        ? "bg-blue-50 text-kosha-blue font-semibold"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <Database className="w-3.5 h-3.5 text-kosha-blue shrink-0" />
                      <span className="truncate">{biz.legal_name}</span>
                    </div>
                    {!isDemoMode && activeBusinessId === biz.id && (
                      <Check className="w-3.5 h-3.5 text-kosha-blue shrink-0" />
                    )}
                  </button>
                ))}

                <div className="pt-1 mt-1 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      setShowCreateModal(true);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-blue-50 text-kosha-blue font-semibold flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Business Workspace</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Language Switcher EN · हि · ಕ */}
          <div className="hidden sm:flex items-center p-0.5 rounded-full bg-white/50 border border-white/70 shadow-xs text-xs font-semibold">
            <button
              onClick={() => setLanguage("EN")}
              className={`px-2 py-1 rounded-full transition-all ${
                language === "EN"
                  ? "bg-kosha-blue text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-kosha-navy"
              }`}
              aria-label="English language"
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("HI")}
              className={`px-2 py-1 rounded-full transition-all ${
                language === "HI"
                  ? "bg-kosha-blue text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-kosha-navy"
              }`}
              aria-label="Hindi language (हिन्दी)"
            >
              हि
            </button>
            <button
              onClick={() => setLanguage("KN")}
              className={`px-2 py-1 rounded-full transition-all ${
                language === "KN"
                  ? "bg-kosha-blue text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-kosha-navy"
              }`}
              aria-label="Kannada language (ಕನ್ನಡ)"
            >
              ಕ
            </button>
          </div>

          {/* Customer View Switcher */}
          <Link
            to="/customer/dashboard"
            className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 shadow-xs transition-all"
            title="Open Customer Credit Dashboard"
          >
            <User className="w-3.5 h-3.5 text-emerald-600" />
            <span>Customer View</span>
          </Link>

          {/* Product Overview / Welcome Link */}
          <Link
            to="/welcome"
            className="px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-white/50 hover:bg-white text-kosha-navy border border-white/80 shadow-xs transition-all flex items-center gap-1"
            title="KOSHA Welcome & Demo Overview"
          >
            <HelpCircle className="w-3.5 h-3.5 text-kosha-blue" />
            <span className="hidden xl:inline">{t("overview")}</span>
          </Link>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-white/50 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-white/80 hover:border-rose-200 shadow-xs transition-all flex items-center gap-1.5 group"
            title={t("signOut")}
            aria-label={t("signOut")}
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-600 transition-colors" />
            <span className="hidden md:inline">{t("signOut")}</span>
          </button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-full bg-white/60 text-kosha-navy border border-white/80"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-3 p-3 rounded-2xl bg-white/95 backdrop-blur-xl border border-white/80 shadow-glass-md flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
          <div className="text-[10px] uppercase font-bold text-slate-400 px-2 pt-1">
            {t("workflowTitle")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {mainSteps.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold text-left flex items-center gap-2 ${
                  isStepActive(item)
                    ? "bg-kosha-blue text-white"
                    : "bg-slate-50 text-kosha-navy hover:bg-slate-100"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-bold">
                  {item.stepNumber}
                </span>
                <span>{item.name}</span>
              </Link>
            ))}
          </div>

          <div className="text-[10px] uppercase font-bold text-slate-400 px-2 pt-2 border-t border-slate-100">
            {t("supportingTools")}
          </div>
          <div className="grid grid-cols-1 gap-1">
            {supportingNav.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium ${
                  isStepActive(item)
                    ? "bg-kosha-blue text-white font-semibold"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Mobile Customer View Link */}
          <div className="pt-2">
            <Link
              to="/customer/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center gap-2 transition-colors"
            >
              <User className="w-4 h-4 text-emerald-600" />
              <span>Switch to Customer View</span>
            </Link>
          </div>

          {/* Mobile Language Switcher & Sign Out */}
          <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-slate-100">
            <div className="flex items-center gap-1 text-xs font-semibold">
              <span className="text-[10px] text-slate-400 mr-1">Lang:</span>
              <button
                onClick={() => setLanguage("EN")}
                className={`px-2 py-1 rounded-lg ${language === "EN" ? "bg-kosha-blue text-white font-bold" : "bg-slate-100 text-slate-700"}`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage("HI")}
                className={`px-2 py-1 rounded-lg ${language === "HI" ? "bg-kosha-blue text-white font-bold" : "bg-slate-100 text-slate-700"}`}
              >
                हि
              </button>
              <button
                onClick={() => setLanguage("KN")}
                className={`px-2 py-1 rounded-lg ${language === "KN" ? "bg-kosha-blue text-white font-bold" : "bg-slate-100 text-slate-700"}`}
              >
                ಕ
              </button>
            </div>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleSignOut();
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t("signOut")}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal for Creating New Business */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 rounded-3xl">
            <h3 className="text-lg font-bold text-kosha-navy">Create Business Workspace</h3>
            <p className="text-xs text-slate-500 mt-1">
              Add a persistent MSME profile to load CSV transactions, track MSMED legal interest, and simulate cash-flows.
            </p>
            <form onSubmit={handleCreate} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Legal Enterprise Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Srujana Automation Pvt Ltd"
                  value={newBizName}
                  onChange={(e) => setNewBizName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kosha-blue bg-white/90"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">MSME Classification</label>
                <select
                  value={newBizCategory}
                  onChange={(e) => setNewBizCategory(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kosha-blue bg-white/90"
                >
                  <option value="Micro">Micro (&lt; ₹1 Cr Inv, &lt; ₹5 Cr T/O)</option>
                  <option value="Small">Small (&lt; ₹10 Cr Inv, &lt; ₹50 Cr T/O)</option>
                  <option value="Medium">Medium (&lt; ₹50 Cr Inv, &lt; ₹250 Cr T/O)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-full hover:bg-white font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-kosha-blue text-white rounded-full hover:bg-kosha-deep font-semibold shadow-xs"
                >
                  Create & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { KoshaLogo } from "../ui/KoshaLogo";
import { useBusiness } from "../../context/BusinessContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import {
  ChevronDown,
  Database,
  Sparkles,
  Plus,
  Check,
  Menu,
  X,
  HelpCircle,
  LogOut,
  User,
  Store,
  CreditCard,
  FileText,
  Calendar,
  ShieldCheck,
} from "lucide-react";

export const GlassNavbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { language, setLanguage, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const { user, logout } = useAuth();
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
  const [showToolsDropdown, setShowToolsDropdown] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newBizName, setNewBizName] = useState<string>("");
  const [newBizCategory, setNewBizCategory] = useState<string>("Small");

  const workspaceDropdownRef = useRef<HTMLDivElement>(null);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        workspaceDropdownRef.current &&
        !workspaceDropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
      if (
        toolsDropdownRef.current &&
        !toolsDropdownRef.current.contains(event.target as Node)
      ) {
        setShowToolsDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const mainSteps = [
    { stepNumber: 1, name: t("step1"), path: "/load", aliases: ["/"] },
    { stepNumber: 2, name: t("step2"), path: "/understand-cash-flow", aliases: ["/forecast", "/know"] },
    { stepNumber: 3, name: t("step3"), path: "/test-scenarios", aliases: ["/scenarios", "/simulate", "/decide"] },
    { stepNumber: 4, name: t("step4"), path: "/compare-actions", aliases: ["/actions", "/fixes", "/act"] },
    { stepNumber: 5, name: t("step5"), path: "/action-plan", aliases: ["/plan"] },
  ];

  const operationalNav = [
    { name: "Shop Credit", shortName: "Credit", path: "/shop-credit", aliases: ["/shopkeeper", "/shopkeeper-credit"], icon: Store },
    { name: "UPI Payments", shortName: "UPI", path: "/payments", aliases: ["/upi-payments", "/razorpay"], icon: CreditCard },
  ];

  const analyticalNav = [
    { name: t("receivables"), path: "/receivables", aliases: [], desc: "MSMED Act 2006 Late Interest", icon: FileText },
    { name: t("cashCalendar"), path: "/calendar", aliases: ["/cash-calendar"], desc: "42-Day Outflow Schedule", icon: Calendar },
    { name: t("forecastReliability"), path: "/reliability", aliases: ["/trust", "/forecast-reliability"], desc: "Historical Model Confidence", icon: ShieldCheck },
  ];

  const supportingNav = [...operationalNav, ...analyticalNav];

  const handleSignOut = async () => {
    await logout();
    sessionStorage.clear();
    navigate("/login?role=business");
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

  const getStepShortName = (stepNumber: number) => {
    if (language === "HI") {
      const hi = ["डेटा", "पूर्वानुमान", "परिदृश्य", "कार्रवाई", "योजना"];
      return hi[stepNumber - 1];
    }
    if (language === "KN") {
      const kn = ["ಲೋಡ್", "ಮುನ್ನೋಟ", "ಸನ್ನಿವೇಶ", "ಕ್ರಮಗಳು", "ಯೋಜನೆ"];
      return kn[stepNumber - 1];
    }
    const en = ["Load", "Forecast", "Scenarios", "Actions", "Plan"];
    return en[stepNumber - 1];
  };

  const activeAnalyticalTool = analyticalNav.find((tool) => isStepActive(tool));

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-[#E1E7EC] shadow-2xs select-none">
      <div className="max-w-[1536px] mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 lg:gap-4">
        {/* Left: Brand Lockup */}
        <Link to="/load" className="hover:opacity-95 transition-opacity shrink-0 flex items-center gap-2">
          <KoshaLogo size="md" showWordmark={true} />
        </Link>

        {/* Center: Stepper & Navigation Pills (Desktop & Tablet) */}
        <div className="hidden lg:flex items-center gap-2 xl:gap-3 min-w-0">
          {/* Main 5-Step Treasury Workflow */}
          <nav
            aria-label="Main Treasury Workflow Navigation"
            className="flex items-center gap-0.5 xl:gap-1 p-1 rounded-full bg-[#F5F7FA] border border-[#E1E7EC] shadow-2xs shrink-0"
          >
            {mainSteps.map((item) => {
              const active = isStepActive(item);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={item.name}
                  aria-label={item.name}
                  aria-current={active ? "page" : undefined}
                  className={`px-2.5 xl:px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    active
                      ? "bg-[#0070E0] text-white shadow-xs font-bold"
                      : "text-[#545D68] hover:text-[#0C0C0D] hover:bg-white"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold shrink-0 ${
                      active ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-600"
                    }`}
                  >
                    {item.stepNumber}
                  </span>
                  <span className="hidden 2xl:inline">{item.name}</span>
                  <span className="2xl:hidden">{getStepShortName(item.stepNumber)}</span>
                </Link>
              );
            })}
          </nav>

          {/* Operations & Analytical Tools Pill */}
          <nav
            aria-label="Supporting Operations and Tools Navigation"
            className="flex items-center gap-0.5 xl:gap-1 p-1 rounded-full bg-[#F5F7FA] border border-[#E1E7EC] shadow-2xs shrink-0"
          >
            {/* Primary operational links visible on xl screens */}
            <div className="hidden xl:flex items-center gap-0.5">
              {operationalNav.map((item) => {
                const active = isStepActive(item);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={item.name}
                    aria-current={active ? "page" : undefined}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      active
                        ? "bg-[#0070E0] text-white shadow-xs font-bold"
                        : "text-[#545D68] hover:text-[#0C0C0D] hover:bg-white"
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Tools Dropdown Button */}
            <div className="relative" ref={toolsDropdownRef}>
              <button
                type="button"
                onClick={() => setShowToolsDropdown(!showToolsDropdown)}
                aria-expanded={showToolsDropdown}
                aria-haspopup="true"
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeAnalyticalTool
                    ? "bg-[#0070E0] text-white shadow-xs font-bold"
                    : "text-[#545D68] hover:text-[#0C0C0D] hover:bg-white"
                }`}
              >
                <span>{activeAnalyticalTool ? activeAnalyticalTool.name : "Tools"}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    showToolsDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Tools Dropdown Menu */}
              <div
                className={`absolute left-0 mt-2 w-64 rounded-2xl bg-white border border-[#E1E7EC] shadow-paypal p-1.5 z-50 transition-all ${
                  showToolsDropdown ? "block" : "hidden"
                }`}
                role="menu"
              >
                {/* On medium screens (< xl), show Shop Credit and UPI Payments in dropdown */}
                <div className="xl:hidden pb-1 mb-1 border-b border-[#E1E7EC]">
                  <div className="px-3 py-1 text-[10px] font-bold text-[#545D68] uppercase tracking-wider">
                    Operations
                  </div>
                  {operationalNav.map((tool) => {
                    const active = isStepActive(tool);
                    return (
                      <Link
                        key={tool.path}
                        to={tool.path}
                        onClick={() => setShowToolsDropdown(false)}
                        className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                          active ? "bg-[#0070E0]/10 text-[#0070E0] font-bold" : "text-slate-700 hover:bg-[#F5F7FA]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <tool.icon className="w-3.5 h-3.5 text-slate-500" />
                          <span>{tool.name}</span>
                        </div>
                        {active && <Check className="w-3.5 h-3.5 text-[#0070E0]" />}
                      </Link>
                    );
                  })}
                </div>

                <div className="px-3 py-1 text-[10px] font-bold text-[#545D68] uppercase tracking-wider">
                  {t("supportingTools")}
                </div>
                {analyticalNav.map((tool) => {
                  const active = isStepActive(tool);
                  return (
                    <Link
                      key={tool.path}
                      to={tool.path}
                      onClick={() => setShowToolsDropdown(false)}
                      className={`w-full px-3 py-2 rounded-xl text-xs flex items-start gap-2.5 transition-colors ${
                        active ? "bg-[#0070E0]/10 text-[#0070E0] font-bold" : "text-slate-700 hover:bg-[#F5F7FA]"
                      }`}
                    >
                      <tool.icon
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          active ? "text-[#0070E0]" : "text-slate-500"
                        }`}
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 leading-tight">
                          {tool.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">
                          {tool.desc}
                        </span>
                      </div>
                      {active && (
                        <Check className="w-3.5 h-3.5 text-[#0070E0] ml-auto shrink-0 mt-0.5" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>

        {/* Right: Controls & Workspace Mode */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Workspace Mode Dropdown */}
          <div className="relative" ref={workspaceDropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#F5F7FA] hover:bg-white border border-[#E1E7EC] text-[#001C64] shadow-xs transition-all"
              title="Switch Workspace Mode"
              aria-label="Switch workspace mode"
            >
              {isDemoMode ? (
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <Database className="w-3.5 h-3.5 text-[#0070E0] shrink-0" />
              )}
              <span className="max-w-[90px] sm:max-w-[125px] truncate">
                {isDemoMode ? "Demo Mode" : activeBusiness?.legal_name || "Real Data"}
              </span>
              <ChevronDown className="w-3 h-3 text-[#545D68] shrink-0" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-10 w-64 rounded-2xl bg-white border border-[#E1E7EC] shadow-paypal p-2 z-50 text-xs">
                <div className="px-3 py-1.5 text-[10px] font-bold text-[#545D68] uppercase tracking-wider">
                  Workspace
                </div>
                <button
                  onClick={() => {
                    setIsDemoMode(true);
                    setShowDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                    isDemoMode ? "bg-amber-50 text-amber-900 font-semibold" : "hover:bg-[#F5F7FA] text-slate-700"
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
                        ? "bg-[#0070E0]/10 text-[#0070E0] font-semibold"
                        : "hover:bg-[#F5F7FA] text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <Database className="w-3.5 h-3.5 text-[#0070E0] shrink-0" />
                      <span className="truncate">{biz.legal_name}</span>
                    </div>
                    {!isDemoMode && activeBusinessId === biz.id && (
                      <Check className="w-3.5 h-3.5 text-[#0070E0] shrink-0" />
                    )}
                  </button>
                ))}

                <div className="pt-1 mt-1 border-t border-[#E1E7EC]">
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      setShowCreateModal(true);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-[#0070E0]/10 text-[#0070E0] font-semibold flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Business Workspace</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Language Switcher EN · हि · ಕ */}
          <div className="hidden sm:flex items-center p-0.5 rounded-full bg-[#F5F7FA] border border-[#E1E7EC] shadow-xs text-xs font-semibold">
            <button
              onClick={() => setLanguage("EN")}
              className={`px-2 py-1 rounded-full transition-all ${
                language === "EN"
                  ? "bg-[#0070E0] text-white shadow-xs font-bold"
                  : "text-[#545D68] hover:text-[#0C0C0D]"
              }`}
              aria-label="English language"
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("HI")}
              className={`px-2 py-1 rounded-full transition-all ${
                language === "HI"
                  ? "bg-[#0070E0] text-white shadow-xs font-bold"
                  : "text-[#545D68] hover:text-[#0C0C0D]"
              }`}
              aria-label="Hindi language (हिन्दी)"
            >
              हि
            </button>
            <button
              onClick={() => setLanguage("KN")}
              className={`px-2 py-1 rounded-full transition-all ${
                language === "KN"
                  ? "bg-[#0070E0] text-white shadow-xs font-bold"
                  : "text-[#545D68] hover:text-[#0C0C0D]"
              }`}
              aria-label="Kannada language (ಕನ್ನಡ)"
            >
              ಕ
            </button>
          </div>

          {/* Customer View Switcher */}
          <Link
            to="/customer/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#0070E0]/10 hover:bg-[#0070E0]/20 text-[#0070E0] border border-[#0070E0]/20 shadow-xs transition-all"
            title="Open Customer Credit Dashboard"
          >
            <User className="w-3.5 h-3.5 text-[#0070E0] shrink-0" />
            <span className="hidden xl:inline">Customer View</span>
          </Link>

          {/* Product Overview / Welcome Link */}
          <Link
            to="/welcome"
            className="px-2.5 py-1.5 rounded-full text-xs font-semibold bg-[#F5F7FA] hover:bg-white text-[#001C64] border border-[#E1E7EC] shadow-xs transition-all flex items-center gap-1"
            title="KOSHA Welcome & Demo Overview"
            aria-label="Overview"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#0070E0] shrink-0" />
            <span className="hidden 2xl:inline">{t("overview")}</span>
          </Link>

          {/* Authenticated User Badge */}
          {user && (
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span className="max-w-[120px] truncate">{user.full_name || user.email}</span>
            </div>
          )}

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="px-2.5 py-1.5 rounded-full text-xs font-semibold bg-[#F5F7FA] hover:bg-rose-50 text-[#545D68] hover:text-rose-600 border border-[#E1E7EC] hover:border-rose-200 shadow-xs transition-all flex items-center gap-1.5 group"
            title={t("signOut")}
            aria-label="Sign out"
          >
            <LogOut className="w-3.5 h-3.5 text-[#545D68] group-hover:text-rose-600 transition-colors shrink-0" />
            <span className="hidden 2xl:inline">{t("signOut")}</span>
          </button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-full bg-[#F5F7FA] text-[#001C64] border border-[#E1E7EC]"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-2 p-3 rounded-2xl bg-white border border-[#E1E7EC] shadow-paypal flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 mx-3 mb-3">
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
                    ? "bg-[#0070E0] text-white"
                    : "bg-[#F5F7FA] text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-bold">
                  {item.stepNumber}
                </span>
                <span>{item.name}</span>
              </Link>
            ))}
          </div>

          <div className="text-[10px] uppercase font-bold text-slate-400 px-2 pt-2 border-t border-[#E1E7EC]">
            Operations & {t("supportingTools")}
          </div>
          <div className="grid grid-cols-1 gap-1">
            {supportingNav.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  isStepActive(item)
                    ? "bg-[#0070E0] text-white font-semibold"
                    : "text-slate-700 hover:bg-[#F5F7FA]"
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                <span>{item.name}</span>
              </Link>
            ))}
          </div>

          {/* Mobile Customer View Link */}
          <div className="pt-2">
            <Link
              to="/customer/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-[#0070E0]/10 hover:bg-[#0070E0]/20 text-[#0070E0] border border-[#0070E0]/20 flex items-center justify-center gap-2 transition-colors"
            >
              <User className="w-4 h-4 text-[#0070E0]" />
              <span>Switch to Customer View</span>
            </Link>
          </div>

          {/* Mobile Language Switcher & Sign Out */}
          <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-[#E1E7EC]">
            <div className="flex items-center gap-1 text-xs font-semibold">
              <span className="text-[10px] text-slate-400 mr-1">Lang:</span>
              <button
                onClick={() => setLanguage("EN")}
                className={`px-2 py-1 rounded-lg ${
                  language === "EN" ? "bg-[#0070E0] text-white font-bold" : "bg-[#F5F7FA] text-slate-700"
                }`}
                aria-label="English language"
              >
                EN
              </button>
              <button
                onClick={() => setLanguage("HI")}
                className={`px-2 py-1 rounded-lg ${
                  language === "HI" ? "bg-[#0070E0] text-white font-bold" : "bg-[#F5F7FA] text-slate-700"
                }`}
                aria-label="Hindi language (हिन्दी)"
              >
                हि
              </button>
              <button
                onClick={() => setLanguage("KN")}
                className={`px-2 py-1 rounded-lg ${
                  language === "KN" ? "bg-[#0070E0] text-white font-bold" : "bg-[#F5F7FA] text-slate-700"
                }`}
                aria-label="Kannada language (ಕನ್ನಡ)"
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
              aria-label="Sign out"
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
          <div className="bg-white max-w-md w-full p-6 rounded-3xl border border-[#E1E7EC] shadow-paypal">
            <h3 className="text-lg font-bold text-[#001C64]">Create Business Workspace</h3>
            <p className="text-xs text-slate-500 mt-1">
              Add a persistent MSME profile to load CSV transactions, track MSMED legal interest, and simulate cash flows.
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
                  className="w-full border border-[#E1E7EC] rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070E0] bg-[#F5F7FA]"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">MSME Classification</label>
                <select
                  value={newBizCategory}
                  onChange={(e) => setNewBizCategory(e.target.value)}
                  className="w-full border border-[#E1E7EC] rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0070E0] bg-[#F5F7FA]"
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
                  className="px-4 py-2 border border-[#E1E7EC] text-slate-700 rounded-full hover:bg-[#F5F7FA] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0070E0] text-white rounded-full hover:bg-[#003087] font-semibold shadow-xs"
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

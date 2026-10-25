import React, { useEffect, useState } from "react";
import { Building2, Activity, CheckCircle2, AlertTriangle, ChevronDown, Plus } from "lucide-react";
import { apiClient } from "../../lib/api";
import { useBusiness } from "../../context/BusinessContext";

export const Navbar: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
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

  useEffect(() => {
    let mounted = true;
    apiClient
      .getHealth()
      .then((res) => {
        if (mounted) {
          setApiStatus(res.status === "healthy" ? "online" : "offline");
        }
      })
      .catch(() => {
        if (mounted) {
          setApiStatus("offline");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

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
      // Error handled in API client
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 relative">
      {/* Current Enterprise Selector */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">
          <Building2 className="w-4 h-4" />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1.5 text-left group focus:outline-none"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-800 group-hover:text-emerald-700">
                  {activeBusiness ? activeBusiness.legal_name : "Select Enterprise"}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                    isDemoMode
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  }`}
                >
                  {isDemoMode ? "Synthetic Persona" : "Persistent DB"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {activeBusiness?.registration_number || "No MSME Reg"} •{" "}
                {activeBusiness?.currency || "INR"} Ledger
              </p>
            </div>
          </button>

          {/* Business Switcher Dropdown */}
          {showDropdown && (
            <div className="absolute top-12 left-0 w-72 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 text-xs">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Workspaces
              </div>
              <button
                onClick={() => {
                  setIsDemoMode(true);
                  setShowDropdown(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between ${
                  isDemoMode ? "bg-amber-50/60 font-semibold text-amber-900" : "text-slate-700"
                }`}
              >
                <span>Demo (Apex Precision)</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                  Demo
                </span>
              </button>
              {businesses.map((biz) => (
                <button
                  key={biz.id}
                  onClick={() => {
                    setIsDemoMode(false);
                    setActiveBusinessId(biz.id);
                    setShowDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between ${
                    !isDemoMode && activeBusinessId === biz.id
                      ? "bg-emerald-50 font-semibold text-emerald-900"
                      : "text-slate-700"
                  }`}
                >
                  <span className="truncate pr-2">{biz.legal_name}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                    {biz.msme_category}
                  </span>
                </button>
              ))}
              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setShowCreateModal(true);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-emerald-700 font-medium flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Real Business</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backend Live Indicator & Meta */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-slate-200 bg-slate-50">
          <Activity className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-600">Backend API:</span>
          {apiStatus === "online" ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Connected
            </span>
          ) : apiStatus === "checking" ? (
            <span className="text-slate-500">Checking...</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Disconnected
            </span>
          )}
        </div>
      </div>

      {/* Modal for Creating Real Business */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Create Persistent Business</h3>
            <p className="text-xs text-slate-500 mt-1">
              Add a real MSME profile to import bank statements, track customer invoices, and simulate
              reconciled cash forecasts.
            </p>
            <form onSubmit={handleCreate} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Legal Enterprise Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Industrial Solutions Pvt Ltd"
                  value={newBizName}
                  onChange={(e) => setNewBizName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">MSME Classification</label>
                <select
                  value={newBizCategory}
                  onChange={(e) => setNewBizCategory(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
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
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
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

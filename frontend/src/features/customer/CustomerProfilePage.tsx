import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Store, Phone, Mail, ArrowRight, HelpCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { apiClient } from "../../lib/api";
import { CustomerProfile } from "../../types/customer";
import { useAuth } from "../../context/AuthContext";

export const CustomerProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const targetId = user?.customer_id;
    if (!targetId) {
      setIsLoading(false);
      return;
    }

    apiClient
      .getCustomerDashboard(targetId)
      .then((data) => {
        if (isMounted && data.customer) {
          setProfile(data.customer);
        }
      })
      .catch(() => {
        // Fallback to auth profile if direct dashboard fetch fails
        if (isMounted && user) {
          setProfile({
            id: user.customer_id || user.id,
            display_name: user.full_name || user.email.split("@")[0],
            phone: user.phone || "Not provided",
            email: user.email,
            created_at: new Date().toISOString(),
          });
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";
  };

  const displayName = profile?.display_name || user?.full_name || user?.email || "Customer Account";
  const initials = getInitials(displayName);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#001C64] tracking-tight flex items-center gap-2">
          <User className="w-7 h-7 text-[#0070E0]" />
          <span>Customer Profile</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#545D68] font-medium mt-0.5">
          Member account settings and registered verified identity.
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E1E7EC] shadow-paypal space-y-6">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#0070E0]" />
            <span className="text-xs font-semibold">Loading profile from database...</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#001C64] text-white font-black text-2xl flex items-center justify-center shadow-paypal">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-[#001C64]">{displayName}</h2>
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-bold bg-[#0070E0]/10 text-[#0070E0] border border-[#0070E0]/20">
                    <ShieldCheck className="w-3 h-3 text-[#0070E0]" />
                    <span>Verified Member</span>
                  </span>
                </div>
                <p className="text-xs text-[#545D68] font-medium mt-0.5">
                  Customer Identifier: {profile?.id || user?.customer_id || "Unassigned"}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div className="p-3.5 bg-[#F5F7FA] rounded-2xl border border-[#E1E7EC] flex items-center justify-between">
                <span className="text-[#545D68] font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#545D68]" />
                  <span>Registered Phone</span>
                </span>
                <span className="font-mono font-bold text-[#001C64]">
                  {profile?.phone || user?.phone || "Not registered"}
                </span>
              </div>

              <div className="p-3.5 bg-[#F5F7FA] rounded-2xl border border-[#E1E7EC] flex items-center justify-between">
                <span className="text-[#545D68] font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#545D68]" />
                  <span>Email</span>
                </span>
                <span className="font-mono font-bold text-[#001C64]">
                  {profile?.email || user?.email || "Not registered"}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Switch Experience Option */}
        <div className="p-4 bg-[#F5F7FA] border border-[#E1E7EC] rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0070E0] text-white flex items-center justify-center font-bold shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-xs text-[#001C64]">Are you a business owner?</p>
              <p className="text-[11px] text-[#545D68]">Access the merchant treasury forecast and billing tools.</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/login?role=business")}
            className="px-5 py-2.5 rounded-full bg-[#0070E0] hover:bg-[#003087] text-white text-xs font-bold shadow-paypal transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span>Merchant Portal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Disclaimer */}
        <div className="p-3.5 bg-[#F5F7FA] rounded-2xl border border-[#E1E7EC] text-xs text-[#545D68] flex items-start gap-2.5 leading-relaxed">
          <HelpCircle className="w-4 h-4 text-[#545D68] shrink-0 mt-0.5" />
          <p className="text-[11px]">
            KOSHA is a treasury platform providing mutual shop credit ledgering and instant UPI reconciliation.
          </p>
        </div>
      </div>
    </div>
  );
};

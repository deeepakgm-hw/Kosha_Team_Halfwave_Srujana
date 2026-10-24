import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { BusinessProfile, BusinessStateSummary, PersonaType } from "../types/cashflow";
import { apiClient } from "../lib/api";

export const PERSONA_PROFILES: Record<PersonaType, BusinessProfile> = {
  manufacturer: {
    id: "apex_precision_mfg",
    legal_name: "Apex Precision Components Pvt Ltd",
    trade_name: "Apex Precision",
    industry: "Automotive Ancillary & High-Precision Machining",
    msme_category: "Small",
    currency: "INR",
    registration_number: "UDYAM-MH-01-0084920",
    is_demo: true,
    created_at: "2026-10-24T00:00:00Z",
  },
  trader: {
    id: "biz_ret_03",
    legal_name: "GreenGrocer Distribution Pvt Ltd",
    trade_name: "GreenGrocer Hub",
    industry: "FMCG / Agri Wholesale & Food Distribution",
    msme_category: "Small",
    currency: "INR",
    registration_number: "UDYAM-KA-03-0091823",
    is_demo: true,
    created_at: "2026-10-24T00:00:00Z",
  },
  service: {
    id: "biz_srv_02",
    legal_name: "PixelCraft Digital Solutions LLP",
    trade_name: "PixelCraft Studio",
    industry: "Software, Cloud & Digital Design Agency",
    msme_category: "Micro",
    currency: "INR",
    registration_number: "UDYAM-TS-09-0023419",
    is_demo: true,
    created_at: "2026-10-24T00:00:00Z",
  },
};

export const DEMO_BUSINESS = PERSONA_PROFILES.manufacturer;

interface BusinessContextType {
  isDemoMode: boolean;
  setIsDemoMode: (val: boolean) => void;
  selectedPersona: PersonaType;
  setSelectedPersona: (val: PersonaType) => void;
  businesses: BusinessProfile[];
  activeBusiness: BusinessProfile | null;
  activeBusinessId: string | null;
  setActiveBusinessId: (id: string | null) => void;
  stateSummary: BusinessStateSummary | null;
  isLoading: boolean;
  refreshBusinesses: () => Promise<void>;
  refreshStateSummary: () => Promise<void>;
  createBusiness: (data: {
    legal_name: string;
    trade_name: string;
    industry?: string;
    msme_category?: string;
    currency?: string;
    is_demo?: boolean;
  }) => Promise<BusinessProfile>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const BusinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [selectedPersona, setSelectedPersona] = useState<PersonaType>("manufacturer");
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [stateSummary, setStateSummary] = useState<BusinessStateSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshBusinesses = useCallback(async () => {
    try {
      const list = await apiClient.listBusinesses();
      setBusinesses(list);
      if (!isDemoMode && list.length > 0 && !activeBusinessId) {
        const real = list.find((b) => !b.is_demo) || list[0];
        setActiveBusinessId(real.id);
      }
    } catch {
      // Backend might be offline
    }
  }, [isDemoMode, activeBusinessId]);

  const refreshStateSummary = useCallback(async () => {
    if (isDemoMode) {
      setStateSummary(null);
      return;
    }
    if (!activeBusinessId) {
      setStateSummary(null);
      return;
    }
    try {
      const summary = await apiClient.getBusinessState(activeBusinessId);
      setStateSummary(summary);
    } catch {
      setStateSummary(null);
    }
  }, [isDemoMode, activeBusinessId]);

  useEffect(() => {
    refreshBusinesses();
  }, [refreshBusinesses]);

  useEffect(() => {
    refreshStateSummary();
  }, [refreshStateSummary]);

  const createBusiness = async (data: {
    legal_name: string;
    trade_name: string;
    industry?: string;
    msme_category?: string;
    currency?: string;
    is_demo?: boolean;
  }) => {
    setIsLoading(true);
    try {
      const created = await apiClient.createBusiness({
        legal_name: data.legal_name,
        trade_name: data.trade_name,
        industry: data.industry || "General Manufacturing",
        msme_category: data.msme_category || "Small",
        currency: data.currency || "INR",
        is_demo: data.is_demo ?? false,
      });
      await refreshBusinesses();
      setIsDemoMode(false);
      setActiveBusinessId(created.id);
      return created;
    } finally {
      setIsLoading(false);
    }
  };

  const activeDemoBusiness = PERSONA_PROFILES[selectedPersona] || PERSONA_PROFILES.manufacturer;
  const activeBusiness = isDemoMode
    ? activeDemoBusiness
    : businesses.find((b) => b.id === activeBusinessId) || null;

  return (
    <BusinessContext.Provider
      value={{
        isDemoMode,
        setIsDemoMode,
        selectedPersona,
        setSelectedPersona,
        businesses,
        activeBusiness,
        activeBusinessId: isDemoMode ? activeDemoBusiness.id : activeBusinessId,
        setActiveBusinessId,
        stateSummary,
        isLoading,
        refreshBusinesses,
        refreshStateSummary,
        createBusiness,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = (): BusinessContextType => {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error("useBusiness must be used within a BusinessProvider");
  }
  return context;
};

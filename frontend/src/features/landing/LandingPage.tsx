import React from "react";
import { LandingNavbar } from "./LandingNavbar";
import { LandingHero } from "./LandingHero";
import { LandingStats } from "./LandingStats";
import { LandingFeatures } from "./LandingFeatures";
import { LandingPersonaSelector } from "./LandingPersonaSelector";
import { LandingTestimonials } from "./LandingTestimonials";
import { LandingCtaBanner } from "./LandingCtaBanner";
import { LandingFooter } from "./LandingFooter";

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-sky-200 selection:text-slate-900">
      {/* Sticky PayPal-style Top Navigation */}
      <LandingNavbar />

      {/* Main Page Content */}
      <main className="flex-1">
        {/* 1. Hero Section with Dual CTAs and Device Mockups */}
        <LandingHero />

        {/* 2. Trust Metrics / Social Proof Bar */}
        <LandingStats />

        {/* 3. Core Feature Showcases with Photography & Live Cards */}
        <LandingFeatures />

        {/* 4. Persona Selection Matrix (Business Owner vs Customer Member) */}
        <LandingPersonaSelector />

        {/* 5. MSME Testimonials and Customer Success Stories */}
        <LandingTestimonials />

        {/* 6. High-Conversion Bottom CTA Banner */}
        <LandingCtaBanner />
      </main>

      {/* Comprehensive Multi-Column Footer */}
      <LandingFooter />
    </div>
  );
};

export default LandingPage;

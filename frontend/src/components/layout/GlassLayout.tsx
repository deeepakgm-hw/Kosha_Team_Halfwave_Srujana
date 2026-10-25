import React from "react";
import { Outlet } from "react-router-dom";
import { GlassNavbar } from "./GlassNavbar";

export const GlassLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden bg-[#F5F7FA]">
      {/* Top PayPal Navbar */}
      <GlassNavbar />

      {/* Main Screen Content */}
      <main className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
};

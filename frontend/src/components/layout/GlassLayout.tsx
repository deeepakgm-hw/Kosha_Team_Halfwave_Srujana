import React from "react";
import { Outlet } from "react-router-dom";
import { GlassNavbar } from "./GlassNavbar";

export const GlassLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      {/* Ambient background glow orbs */}
      <div className="fixed top-[-10%] left-[-5%] w-[45vw] h-[45vw] rounded-full bg-blue-200/40 blur-[100px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full bg-sky-200/50 blur-[120px] pointer-events-none -z-10" />

      {/* Top Glass Navbar */}
      <GlassNavbar />

      {/* Main Screen Content */}
      <main className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
};

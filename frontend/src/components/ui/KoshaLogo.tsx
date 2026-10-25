import React from "react";

interface KoshaLogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

export const KoshaLogo: React.FC<KoshaLogoProps> = ({
  size = "md",
  showWordmark = true,
  showSubtitle = false,
  className = "",
}) => {
  const iconSizes = {
    sm: "w-7 h-7",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  const textSizes = {
    sm: "text-base tracking-tight font-extrabold",
    md: "text-xl tracking-tight font-black",
    lg: "text-3xl tracking-tight font-black",
  };

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {/* PayPal Inspired Monogram Glyphs */}
      <svg
        className={`${iconSizes[size]} shrink-0`}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ppBlueDeep" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#003087" />
            <stop offset="100%" stopColor="#001C64" />
          </linearGradient>
          <linearGradient id="ppBlueBright" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0070E0" />
            <stop offset="100%" stopColor="#00457C" />
          </linearGradient>
        </defs>

        {/* Back layered glyph (Deep Blue) */}
        <rect x="8" y="10" width="70" height="80" rx="22" fill="url(#ppBlueDeep)" />

        {/* Front overlapping tilted glyph (Vivid PayPal Blue) */}
        <rect x="22" y="10" width="70" height="80" rx="22" fill="url(#ppBlueBright)" fillOpacity="0.94" />

        {/* Stylized White 'K' Monogram */}
        <line x1="44" y1="30" x2="44" y2="70" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" />
        <line x1="46" y1="50" x2="68" y2="34" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" />
        <line x1="52" y1="46" x2="70" y2="68" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" />

        {/* Signature PayPal Gold Coin Sparkle */}
        <circle cx="78" cy="22" r="7" fill="#FFC439" />
      </svg>

      {/* Wordmark */}
      {showWordmark && (
        <div className="flex flex-col">
          <div className="flex items-center">
            <span className={`${textSizes[size]} text-[#001C64] font-black tracking-tight leading-none italic`}>
              KO
            </span>
            <span className={`${textSizes[size]} text-[#0070E0] font-black tracking-tight leading-none italic`}>
              SHA
            </span>
          </div>
          {showSubtitle && (
            <span className="text-[10px] font-bold text-[#003087] uppercase tracking-wider mt-0.5">
              Pay · Credit · Treasury
            </span>
          )}
        </div>
      )}
    </div>
  );
};

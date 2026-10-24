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
    md: "w-9 h-9",
    lg: "w-14 h-14",
  };

  const textSizes = {
    sm: "text-base tracking-tight font-extrabold",
    md: "text-xl tracking-tight font-black",
    lg: "text-3xl tracking-tight font-black",
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Brand Icon SVG */}
      <svg
        className={`${iconSizes[size]} shrink-0`}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="koshaGradient" x1="20" y1="10" x2="80" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5EB0FF" />
            <stop offset="100%" stopColor="#1D6FD6" />
          </linearGradient>
        </defs>
        {/* Rounded Squircle Body */}
        <rect width="100" height="100" rx="28" fill="url(#koshaGradient)" />

        {/* Inner subtle glow ring */}
        <rect
          x="2"
          y="2"
          width="96"
          height="96"
          rx="26"
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth="3"
        />

        {/* White Stylized 'K' */}
        {/* Vertical stem */}
        <line
          x1="36"
          y1="26"
          x2="36"
          y2="74"
          stroke="#FFFFFF"
          strokeWidth="11"
          strokeLinecap="round"
        />

        {/* Upper diagonal branch to golden sun */}
        <line
          x1="38"
          y1="50"
          x2="64"
          y2="33"
          stroke="#FFFFFF"
          strokeWidth="11"
          strokeLinecap="round"
        />

        {/* Lower diagonal branch */}
        <line
          x1="45"
          y1="45"
          x2="69"
          y2="72"
          stroke="#FFFFFF"
          strokeWidth="11"
          strokeLinecap="round"
        />

        {/* Golden Sun / Coin Dot at top right */}
        <circle cx="73" cy="28" r="7.5" fill="#FBBF24" />
      </svg>

      {/* Wordmark */}
      {showWordmark && (
        <div className="flex flex-col">
          <span className={`${textSizes[size]} text-kosha-navy font-black tracking-wider leading-none`}>
            KOSHA
          </span>
          {showSubtitle && (
            <span className="text-xs font-semibold text-[#14509E] mt-0.5 tracking-normal">
              कोश
            </span>
          )}
        </div>
      )}
    </div>
  );
};

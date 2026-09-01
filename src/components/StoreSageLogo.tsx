import React from "react";

interface StoreSageLogoProps {
  size?: number | string;
  className?: string;
  withGlow?: boolean;
}

export default function StoreSageLogo({
  size = 40,
  className = "",
  withGlow = false,
}: StoreSageLogoProps) {
  return (
    <div
      className={`inline-flex items-center justify-center relative select-none shrink-0 ${className}`}
      style={{ width: size, height: size }}
      id="storesage-brand-logo"
    >
      {withGlow && (
        <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-full pointer-events-none" />
      )}
      <svg
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
      >
        <defs>
          <linearGradient id="ssHexGrad" x1="50" y1="50" x2="450" y2="450" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="50%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id="ssTapeGrad" x1="180" y1="140" x2="260" y2="280" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>

        {/* Outer Hexagon Frame with thick rounded stroke */}
        <path
          d="M 250 35
             L 425 135
             A 20 20 0 0 1 435 152
             L 435 348
             A 20 20 0 0 1 425 365
             L 250 465
             A 20 20 0 0 1 230 465
             L 75 365
             A 20 20 0 0 1 65 348
             L 65 152
             A 20 20 0 0 1 75 135
             L 250 35
             Z"
          stroke="url(#ssHexGrad)"
          strokeWidth="32"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* 3D Isometric Cardboard Box */}
        {/* Left Dark Blue Face */}
        <path
          d="M 148 185
             L 248 238
             L 248 365
             L 148 312
             Z"
          fill="#0F387A"
        />

        {/* Right White / Light Face */}
        <path
          d="M 248 238
             L 348 185
             L 348 312
             L 248 365
             Z"
          fill="#FFFFFF"
        />

        {/* Top White / Light Ice Face */}
        <path
          d="M 248 132
             L 348 185
             L 248 238
             L 148 185
             Z"
          fill="#FFFFFF"
        />

        {/* Packaging Tape Top Stripe */}
        <path
          d="M 248 132
             L 282 150
             L 218 222
             L 184 204
             Z"
          fill="url(#ssTapeGrad)"
        />

        {/* Packaging Tape Front Flap Overhang */}
        <path
          d="M 184 204
             L 208 217
             L 208 255
             L 196 248
             L 184 255
             Z"
          fill="#FFFFFF"
        />

        {/* Right Face Ventilation / Slot Markings */}
        <path
          d="M 258 300 L 278 290"
          stroke="#0F387A"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M 258 318 L 278 308"
          stroke="#0F387A"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Checklist / Document Badge (Bottom-Right Overlay) */}
        <rect
          x="286"
          y="250"
          width="118"
          height="145"
          rx="24"
          fill="#FFFFFF"
          stroke="#0D3678"
          strokeWidth="18"
        />

        {/* Checklist Items: 3 Rows of Checkmarks + Horizontal Lines */}
        {/* Row 1 */}
        <path
          d="M 310 286 L 319 295 L 332 280"
          stroke="#0D3678"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 345 287 L 382 287"
          stroke="#0D3678"
          strokeWidth="9"
          strokeLinecap="round"
        />

        {/* Row 2 */}
        <path
          d="M 310 322 L 319 331 L 332 316"
          stroke="#0D3678"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 345 323 L 382 323"
          stroke="#0D3678"
          strokeWidth="9"
          strokeLinecap="round"
        />

        {/* Row 3 */}
        <path
          d="M 310 358 L 319 367 L 332 352"
          stroke="#0D3678"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 345 359 L 382 359"
          stroke="#0D3678"
          strokeWidth="9"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

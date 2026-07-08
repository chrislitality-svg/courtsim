/** 水墨远山剪影（SVG 平涂，无渐变） */

export default function InkMountains() {
  return (
    <svg
      className="cs-ink-mountains"
      viewBox="0 0 1200 80"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M0 80 L0 52 Q80 38 160 48 T320 42 T480 50 T640 38 T800 46 T960 40 T1120 48 L1200 52 L1200 80 Z"
      />
      <path
        fill="currentColor"
        opacity="0.65"
        d="M0 80 L0 58 Q120 48 240 56 T480 50 T720 58 T960 52 L1200 60 L1200 80 Z"
      />
    </svg>
  );
}

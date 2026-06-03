interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "white";
  subtitle?: string;
}

const sizeStyles = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
  xl: "text-5xl",
};

const subtitleSizeStyles = {
  sm: "text-[9px]",
  md: "text-[10px]",
  lg: "text-xs",
  xl: "text-sm",
};

export function Logo({
  className = "",
  size = "md",
  variant = "default",
  subtitle,
}: LogoProps) {
  const textColor = variant === "white" ? "text-white" : "text-[#3f37c9]";
  const shadowStyle =
    variant === "white" ? "drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" : "";
  const sizeClass = sizeStyles[size];
  const subtitleSize = subtitleSizeStyles[size];

  return (
    <div className={`flex flex-col ${shadowStyle} ${className}`}>
      <div className="flex items-baseline leading-none">
        <span
          className={`font-bold ${textColor} ${sizeClass}`}
          style={{ fontFamily: "var(--font-chakra-petch), sans-serif" }}
        >
          GEAR-
        </span>
        <span
          className={`font-bold bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] bg-clip-text text-transparent ${sizeClass}`}
          style={{ fontFamily: "var(--font-chakra-petch), sans-serif" }}
        >
          UI
        </span>
      </div>
      {subtitle && (
        <span
          className={`${subtitleSize} text-slate-400 font-medium tracking-wide mt-0.5`}
          style={{ fontFamily: "var(--font-chakra-petch), sans-serif" }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}

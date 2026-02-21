import { cn } from "@/lib/utils";

interface MetricRingProps {
  value: number;
  max: number;
  label: string;
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
}

export function MetricRing({ value, max, label, sublabel, size = 80, strokeWidth = 6, className, color = "hsl(var(--primary))" }: MetricRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = max > 0 ? Math.min(value / max, 1) : 0;
  const dashOffset = circumference * (1 - percent);

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-foreground">{value}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-foreground">{label}</span>
      {sublabel && <span className="text-[10px] text-muted-foreground -mt-1">{sublabel}</span>}
    </div>
  );
}

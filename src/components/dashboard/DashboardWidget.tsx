import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardWidgetProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function DashboardWidget({ title, description, icon, children, className, action }: DashboardWidgetProps) {
  return (
    <Card className={cn("border-border/50 shadow-sm hover:shadow-md transition-shadow", className)}>
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">{icon}</div>}
            <div>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">{children}</CardContent>
    </Card>
  );
}

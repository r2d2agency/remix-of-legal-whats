import { ReactNode } from "react";
import { Sidebar, SIDEBAR_COLLAPSED_WIDTH } from "./Sidebar";
import { TopBar } from "./TopBar";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Sidebar />
      <TopBar />
      {/* Desktop: margin-left for collapsed sidebar + top bar, Mobile: no margin */}
      {/* Use calc to ensure content fits exactly within available space */}
      <main className="lg:ml-16 pt-14 lg:pt-12 overflow-x-hidden w-full lg:w-[calc(100vw-4rem)] box-border">
        <div className="p-2 lg:p-3 xl:p-4 w-full min-w-0 overflow-x-hidden">{children}</div>
      </main>
    </div>
  );
}

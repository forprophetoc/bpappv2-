import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FilePlus,
  Briefcase,
  Phone,
  LogOut,
} from "lucide-react";
import { COMPANY } from "../../../esticlose.config";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "New Estimate", href: "/new-estimate", icon: FilePlus },
  { label: "All Jobs", href: "/all-jobs", icon: Briefcase },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen bg-[#f0f4f8]">
      {/* Sidebar — hidden on mobile */}
      <aside className="hidden sm:flex w-[200px] bg-[#1a2332] flex-col shrink-0 fixed inset-y-0 left-0 z-30">
        {/* Logo area */}
        <div className="px-4 py-5 flex flex-col items-center">
          <div className="w-16 h-16 bg-[#1a2332] rounded-full flex items-center justify-center border-2 border-[#2a3a4e] mb-1">
            <span className="text-white text-xs font-bold text-center leading-tight">
              {COMPANY.name.split(" ").map(w => w[0]).join("").slice(0, 3)}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#2a3a4e] text-white"
                    : "text-gray-400 hover:text-white hover:bg-[#2a3a4e]/50"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Phone className="h-4 w-4 shrink-0" />
            <span>{COMPANY.phoneDisplay}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#2a3a4e] flex items-center justify-center text-white text-xs font-bold">
                U
              </div>
              <span className="text-gray-300 text-sm truncate max-w-[100px]">
                User
              </span>
            </div>
            <button className="text-gray-500 hover:text-gray-300 transition-colors" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="sm:ml-[200px] flex-1 min-h-screen pb-20 sm:pb-0">
        {children}
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-[#1a2332] border-t border-[#2a3a4e] z-30 flex items-center justify-around py-2 px-1 safe-bottom">
        {NAV_ITEMS.map((item) => {
          const active = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                active
                  ? "text-white bg-[#2a3a4e]"
                  : "text-gray-400"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

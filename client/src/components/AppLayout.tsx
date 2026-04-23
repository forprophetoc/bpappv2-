import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FilePlus,
  Briefcase,
  Calendar,
  Phone,
  LogOut,
  Building2,
  ClipboardCheck,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "New Estimate", href: "/new-estimate", icon: FilePlus },
  { label: "All Jobs", href: "/all-jobs", icon: Briefcase },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Onboard Company", href: "/onboard", icon: Building2 },
  { label: "Onboarding Audit", href: "/audit", icon: ClipboardCheck },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen bg-[#f0f4f8]">
      {/* Sidebar */}
      <aside className="w-[200px] bg-[#1a2332] flex flex-col shrink-0 fixed inset-y-0 left-0 z-30">
        {/* Logo area */}
        <div className="px-4 py-5 flex flex-col items-center">
          <div className="w-16 h-16 bg-[#1a2332] rounded-full flex items-center justify-center border-2 border-[#2a3a4e] mb-1">
            <span className="text-white text-xs font-bold text-center leading-tight">
              [[logo]]
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
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
          {/* Phone */}
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Phone className="h-4 w-4 shrink-0" />
            <span>[[phone]]</span>
          </div>

          {/* User */}
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
      <main className="ml-[200px] flex-1 min-h-screen">
        {children}
      </main>
    </div>
  );
}

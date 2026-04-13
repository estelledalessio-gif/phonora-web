import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { BookOpen, Mic, LayoutDashboard, Settings as SettingsIcon, LogOut, History, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Layout({ children }: { children: ReactNode }) {
  const { isAuthenticated, logout, user } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/practice", label: "Practice", icon: Mic },
    { href: "/ipa", label: "IPA Library", icon: BookOpen },
    { href: "/results", label: "History", icon: History },
    { href: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b bg-card h-16 flex items-center justify-between px-6 shrink-0">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <Mic className="w-6 h-6 text-primary" />
              <span className="font-serif font-bold text-xl text-primary">Phonora</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Log In</Button>
            </Link>
            <Link href="/signup">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </header>
        <main className="flex-1 flex flex-col">{children}</main>
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-6 border-b border-sidebar-border shrink-0">
        <Link href="/dashboard">
          <div className="flex items-center gap-2 cursor-pointer">
            <Mic className="w-6 h-6 text-sidebar-primary" />
            <span className="font-serif font-bold text-xl text-sidebar-primary">Phonora</span>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border shrink-0">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user?.displayName || "User"}</span>
            <span className="text-xs text-sidebar-foreground/50 truncate w-32">
              {user?.targetAccent || "American English"}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} title="Log out">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* Mobile Header & Sheet */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-16 border-b bg-card flex items-center justify-between px-4 shrink-0">
          <Link href="/dashboard">
            <div className="flex items-center gap-2 cursor-pointer">
              <Mic className="w-6 h-6 text-primary" />
              <span className="font-serif font-bold text-lg text-primary">Phonora</span>
            </div>
          </Link>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <div className="max-w-4xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
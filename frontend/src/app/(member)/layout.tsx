"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { PageRefreshProvider } from "@/lib/page-refresh";
import { Button } from "@/components/ui/button";
import {
  FileText,
  LayoutDashboard,
  History,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { authApi } from "@/services/auth.api";
import { APP_SETTINGS, ROUTES, UI_SETTINGS, USER_ROLES } from "@/lib/settings";
import type { User } from "@/types";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";

const navItems = [
  { href: ROUTES.memberDashboard, label: "Dashboard", icon: LayoutDashboard },
  { href: ROUTES.newReport, label: "New Report", icon: FileText },
  { href: ROUTES.reportHistory, label: "Report History", icon: History },
];

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);

  useEffect(() => {
    authApi
      .getMe()
      .then((currentUser) => {
        if (currentUser.role !== USER_ROLES.TEAM_MEMBER) {
          router.push(ROUTES.managerDashboard);
          return;
        }
        setUser(currentUser);
      })
      .catch(() => {
        router.push(ROUTES.login);
      });
  }, [router]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      router.push(ROUTES.login);
    }
  };

  return (
    <div className="min-h-screen flex relative">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="p-1"
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
          <h2 className="text-sm font-bold">{APP_SETTINGS.memberPanelTitle}</h2>
        </div>
        {user && <p className="text-xs text-muted-foreground">{user.name}</p>}
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r bg-card transition-transform duration-300 ease-in-out md:sticky md:top-0 md:h-screen md:shrink-0 md:translate-x-0 md:transition-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ width: UI_SETTINGS.layout.sidebarWidth }}
      >
        <div className="flex h-full flex-col">
          <div className="p-6 hidden md:block">
            <h2 className="text-lg font-bold">
              {APP_SETTINGS.memberPanelTitle}
            </h2>
            {user && (
              <p className="text-sm text-muted-foreground mt-1">{user.name}</p>
            )}
          </div>
          <div className="p-6 md:hidden" />
          <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-20">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setLogoutConfirmationOpen(true)}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto w-full">
        <div className="pt-14 md:pt-0">
          <div className="p-4 sm:p-6 lg:p-8">
            <PageRefreshProvider key={pathname}>{children}</PageRefreshProvider>
          </div>
        </div>
      </main>
      <ConfirmationDialog
        open={logoutConfirmationOpen}
        onOpenChange={setLogoutConfirmationOpen}
        title="Log out of your account?"
        description="You will need to sign in again to access your weekly reports."
        confirmLabel="Log out"
        variant="destructive"
        onConfirm={handleLogout}
      />
    </div>
  );
}

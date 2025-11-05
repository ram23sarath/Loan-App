import React from "react";
import { NavLink } from "react-router-dom";
import {
  FilePlusIcon,
  HistoryIcon,
  LandmarkIcon,
  UserPlusIcon,
  UsersIcon,
  LogOutIcon,
  BookOpenIcon,
} from "../constants";
// Database icon for Data section
const DatabaseIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v6c0 1.657 3.582 3 8 3s8-1.343 8-3V6" />
    <path d="M4 12v6c0 1.657 3.582 3 8 3s8-1.343 8-3v-6" />
  </svg>
);
// Hamburger removed — using bottom nav for mobile
import { useData } from "../context/DataContext";
import HamburgerIcon from "./ui/HamburgerIcon";

const navItems = [
  { path: "/", label: "Add Customer", icon: UserPlusIcon },
  { path: "/add-record", label: "Add Record", icon: FilePlusIcon },
  { path: "/customers", label: "Customers", icon: UsersIcon },
  { path: "/loans", label: "Loans", icon: LandmarkIcon },
  { path: "/loan-seniority", label: "Loan Seniority", icon: HistoryIcon },
  { path: "/subscriptions", label: "Subscriptions", icon: HistoryIcon },
  { path: "/data", label: "Misc", icon: DatabaseIcon },
  { path: "/summary", label: "Summary", icon: BookOpenIcon },
];

const Sidebar = () => {
  const {
    session,
    signOut,
    loans = [],
    installments = [],
    subscriptions = [],
  } = useData();

  // --- Summary Calculations ---
  const totalInterestCollected = loans.reduce((acc, loan) => {
    const loanInstallments = installments.filter((i) => i.loan_id === loan.id);
    const totalPaidForLoan = loanInstallments.reduce(
      (sum, inst) => sum + inst.amount,
      0
    );
    if (totalPaidForLoan > loan.original_amount) {
      const interestCollected = Math.min(
        totalPaidForLoan - loan.original_amount,
        loan.interest_amount
      );
      return acc + interestCollected;
    }
    return acc;
  }, 0);
  const totalLateFeeCollected = installments.reduce(
    (acc, inst) => acc + (inst.late_fee || 0),
    0
  );
  const totalSubscriptionCollected = subscriptions.reduce(
    (acc, sub) => acc + (sub.amount || 0),
    0
  );
  const totalAllCollected =
    totalInterestCollected + totalLateFeeCollected + totalSubscriptionCollected;
  const totalLoansGiven = loans.reduce(
    (acc, loan) => acc + loan.original_amount + loan.interest_amount,
    0
  );
  const activeLinkClass = "bg-indigo-50 text-indigo-600 font-semibold";
  const inactiveLinkClass =
    "text-gray-600 hover:bg-gray-100 hover:text-gray-900";

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Sidebar collapsed by default; users can expand via hover or toggle.
  const [collapsed, setCollapsed] = React.useState(true);
  // Publish sidebar width as a CSS variable so the main content can shift accordingly.
  // We only apply the offset on desktop (sm and up). On small screens we keep it 0.
  React.useEffect(() => {
    const applyVar = () => {
      if (typeof window === 'undefined') return;
      const isDesktop = window.matchMedia('(min-width: 640px)').matches;
      const sidebarWidth = collapsed ? 80 : 256; // matches the inline style width
      const leftOffset = 16; // left-4 (Tailwind) -> 16px
      const gap = 16; // extra gap between sidebar and content
      const total = isDesktop ? `${sidebarWidth + leftOffset + gap}px` : '0px';
      try {
        document.documentElement.style.setProperty('--sidebar-offset', total);
      } catch (e) {
        // ignore
      }
    };

    applyVar();
    window.addEventListener('resize', applyVar);
    return () => {
      window.removeEventListener('resize', applyVar);
      try {
        document.documentElement.style.setProperty('--sidebar-offset', '0px');
      } catch (e) {}
    };
  }, [collapsed]);
  const collapseTimer = React.useRef<number | null>(null);

  const clearCollapseTimer = () => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current as unknown as number);
      collapseTimer.current = null;
    }
  };

  const startCollapseTimer = (ms = 3000) => {
    clearCollapseTimer();
    collapseTimer.current = window.setTimeout(() => {
      setCollapsed(true);
      collapseTimer.current = null;
    }, ms) as unknown as number;
  };

  React.useEffect(() => {
    return () => clearCollapseTimer();
  }, []);

  // Responsive sidebar and bottom nav
  return (
    <>
      {/* --- CHANGED 3: Mobile hamburger button removed --- */}
      {/* The button below was removed, as requested */}
      {/*
      <button
        aria-label="Toggle menu"
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 p-2 rounded-md bg-white border border-gray-200 shadow sm:hidden"
      >
        <HamburgerIcon className="w-6 h-6 text-gray-700" />
      </button>
      */}

      {/* --- CHANGED 4: Bottom nav is now always visible on mobile --- */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex justify-around items-center py-2 sm:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center px-2 ${
                isActive ? "text-indigo-600" : "text-gray-500"
              }`
            }
            aria-label={item.label}
          >
            <item.icon className="w-6 h-6" />
          </NavLink>
        ))}
        {/* Logout button for mobile view */}
        <button
          onClick={handleSignOut}
          aria-label="Logout"
          className="flex flex-col items-center justify-center px-2 text-red-600 hover:bg-red-50 rounded-md"
        >
          <LogOutIcon className="w-6 h-6" />
        </button>
      </nav>

      {/* Desktop sidebar (hidden on small screens) */}
      <aside
        onMouseEnter={() => {
          // expand on hover
          setCollapsed(false);
          clearCollapseTimer();
        }}
        onMouseLeave={() => {
          // start auto-collapse timer
          startCollapseTimer(3000);
        }}
        // Use an explicit width transition (avoid transition-all jitter)
        style={{
          width: collapsed ? 80 : 256,
          transition: "width 260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
        // Floating on the left for desktop: fixed with top/bottom offsets so it appears to "float"
        className={`fixed left-4 top-4 bottom-4 z-40 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col hidden sm:flex`}
      >
        <div
          className={`p-4 border-b border-gray-200 flex items-center ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!collapsed && (
            <h1 className="text-2xl font-bold text-gray-800">
              Loan Management
            </h1>
          )}
          <button
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            onClick={() => {
              setCollapsed(!collapsed);
              clearCollapseTimer();
            }}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            <HamburgerIcon className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto min-h-0">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `group flex items-center p-3 rounded-lg transition-colors duration-200 ${
                    isActive ? activeLinkClass : inactiveLinkClass
                  }`
                }
              >
                <div className="relative flex items-center w-full">
                  <item.icon className={`w-6 h-6 text-current`} />

                  {/* label container - animate maxWidth & opacity to avoid reflow jitter */}
                  <span
                    className="inline-block overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out"
                    style={{
                      maxWidth: collapsed ? 0 : 160,
                      opacity: collapsed ? 0 : 1,
                      transform: collapsed
                        ? "translateX(-6px)"
                        : "translateX(0)",
                      marginLeft: collapsed ? 0 : 12,
                    }}
                    aria-hidden={collapsed}
                  >
                    {item.label}
                  </span>

                  {/* simple tooltip shown only when collapsed */}
                  {collapsed && (
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 pointer-events-none hidden group-hover:block">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                        {item.label}
                      </div>
                    </div>
                  )}
                </div>
              </NavLink>
            ))}
          </nav>
          <div className="shrink-0">
            <div className="p-4 border-t border-gray-200 space-y-4">
              {session?.user && !collapsed && (
                <div className="text-center">
                  <p
                    className="text-xs text-gray-500 truncate"
                    title={session.user.email}
                  >
                    Logged in as:
                  </p>
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {session.user.email}
                  </p>
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center p-3 rounded-lg transition-colors duration-200 text-red-600 bg-red-50 hover:bg-red-100 font-semibold"
                aria-label={collapsed ? "Logout" : undefined}
              >
                <LogOutIcon className={`w-5 h-5 ${collapsed ? "" : "mr-2"}`} />
                {!collapsed && <span>Logout</span>}
              </button>
            </div>
            {!collapsed && (
              <div className="p-4 border-t border-gray-200 text-center text-xs text-gray-400">
                <p>&copy; {new Date().getFullYear()} Sleek Solutions</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* --- CHANGED 5: Mobile drawer overlay removed --- */}
      {/*
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-64 bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Menu</h2>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <nav className="space-y-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center p-3 rounded-lg ${
                      isActive ? activeLinkClass : inactiveLinkClass
                    }`
                  }
                >
                  <item.icon className="w-6 h-6 mr-3" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
      */}
    </>
  );
};

export default Sidebar;
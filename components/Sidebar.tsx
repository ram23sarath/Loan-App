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
  StarIcon,
  KeyIcon,
} from "../constants";
import { useData } from "../context/DataContext";
import HamburgerIcon from "./ui/HamburgerIcon";
import ChangePasswordModal from "./modals/ChangePasswordModal";

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

const allNavItems = [
  { path: "/", label: "Add Customer", icon: UserPlusIcon, adminOnly: true },
  { path: "/add-record", label: "Add Record", icon: FilePlusIcon, adminOnly: true },
  { path: "/customers", label: "Customers", icon: UsersIcon, adminOnly: true },
  { path: "/loans", label: "Loans", icon: LandmarkIcon },
  { path: "/loan-seniority", label: "Loan Seniority", icon: StarIcon, adminOnly: true },
  { path: "/subscriptions", label: "Subscriptions", icon: HistoryIcon },
  { path: "/data", label: "Misc", icon: DatabaseIcon },
  { path: "/summary", label: "Summary", icon: BookOpenIcon },
];

const Sidebar = () => {
  const {
    session,
    signOut,
    isScopedCustomer,
    scopedCustomerId,
    customers = [],
  } = useData();

  const [showPasswordModal, setShowPasswordModal] = React.useState(false);
  const [showLandscapeMenu, setShowLandscapeMenu] = React.useState(false);

  // Filter navigation items based on user role
  const navItems = allNavItems.filter((item) => !item.adminOnly || !isScopedCustomer);

  const activeLinkClass = "bg-indigo-50 text-indigo-600 font-semibold";
  const inactiveLinkClass = "text-gray-600 hover:bg-gray-100 hover:text-gray-900";

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Sidebar collapsed by default; users can expand via hover or toggle (desktop only).
  const [collapsed, setCollapsed] = React.useState(true);

  // --- UPDATED LAYOUT CALCULATION ---
  React.useEffect(() => {
    const applyVar = () => {
      if (typeof window === "undefined") return;

      // Logic: Sidebar is visible if:
      // 1. It is a large screen (Laptop/Desktop) OR
      // 2. It is a tablet in portrait mode (sm but not landscape)
      const isLargeDesktop = window.matchMedia("(min-width: 1024px)").matches;
      const isTabletPortrait = window.matchMedia("(min-width: 640px) and (orientation: portrait)").matches;
      
      const isSidebarVisible = isLargeDesktop || isTabletPortrait;

      const sidebarWidth = collapsed ? 80 : 256; 
      const leftOffset = 16; 
      const gap = 16;
      // If sidebar is hidden (mobile landscape), offset is 0
      const total = isSidebarVisible ? `${sidebarWidth + leftOffset + gap}px` : "0px";
      
      try {
        document.documentElement.style.setProperty("--sidebar-offset", total);
      } catch (e) {}
    };

    applyVar();
    window.addEventListener("resize", applyVar);
    window.addEventListener("orientationchange", applyVar);
    
    return () => {
      window.removeEventListener("resize", applyVar);
      window.removeEventListener("orientationchange", applyVar);
      try {
        document.documentElement.style.setProperty("--sidebar-offset", "0px");
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

  return (
    <>
      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      )}

      {/* Spacer div: Larger in portrait (h-20), Smaller in landscape (h-16).
          UPDATED: Added lg:landscape:hidden so it doesn't take space on laptops */}
      <div className="h-20 sm:hidden landscape:h-16 lg:landscape:hidden" aria-hidden="true" />

      {/* --- MOBILE NAV BAR --- */}
      {/* UPDATED CLASS: sm:hidden landscape:flex lg:landscape:hidden 
          This forces it to appear on mobile landscape, but hide on laptops */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 sm:hidden landscape:flex lg:landscape:hidden">
        
        {/* 1. PORTRAIT MODE: Show scrollable list of icons */}
        <div className="landscape:hidden flex justify-around items-center py-2 overflow-x-auto w-full">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center px-2 py-1 transition-colors duration-200 whitespace-nowrap text-xs ${
                  isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"
                }`
              }
              aria-label={item.label}
            >
              <item.icon className="w-5 h-5" />
              <span className="mt-1">{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setShowPasswordModal(true)}
            className="flex flex-col items-center justify-center px-2 py-1 text-amber-600 hover:bg-amber-50 rounded-md transition-colors duration-200 whitespace-nowrap text-xs"
          >
            <KeyIcon className="w-5 h-5" />
            <span className="mt-1">Password</span>
          </button>
          <button
            onClick={handleSignOut}
            className="flex flex-col items-center justify-center px-2 py-1 text-red-600 hover:bg-red-50 rounded-md transition-colors duration-200 whitespace-nowrap text-xs"
          >
            <LogOutIcon className="w-5 h-5" />
            <span className="mt-1">Logout</span>
          </button>
        </div>

        {/* 2. LANDSCAPE MODE: Show exactly 3 icons */}
        <div className="hidden landscape:flex justify-between items-center py-2 px-4 w-full">
          <button
            onClick={() => setShowLandscapeMenu(true)}
            className="p-2 -ml-2 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
          >
            <HamburgerIcon className="w-6 h-6" />
          </button>

          <div className="flex gap-4">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center text-amber-600 hover:bg-amber-50 rounded-md p-2 transition-colors"
            >
              <KeyIcon className="w-6 h-6" />
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center text-red-600 hover:bg-red-50 rounded-md p-2 transition-colors"
            >
              <LogOutIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* --- DESKTOP SIDEBAR --- */}
      {/* UPDATED CLASS: hidden sm:flex landscape:hidden lg:landscape:flex 
          This hides it on mobile landscape, but shows it on Tablet Portrait (sm) and Laptop (lg) */}
      <aside
        onMouseEnter={() => {
          setCollapsed(false);
          clearCollapseTimer();
        }}
        onMouseLeave={() => {
          startCollapseTimer(3000);
        }}
        style={{
          width: collapsed ? 80 : 256,
          transition: "width 260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
        className="fixed left-4 top-4 bottom-4 z-40 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col hidden sm:flex landscape:hidden lg:landscape:flex"
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
                  <item.icon className="w-6 h-6 text-current" />
                  <span
                    className="inline-block overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out"
                    style={{
                      maxWidth: collapsed ? 0 : 160,
                      opacity: collapsed ? 0 : 1,
                      transform: collapsed ? "translateX(-6px)" : "translateX(0)",
                      marginLeft: collapsed ? 0 : 12,
                    }}
                    aria-hidden={collapsed}
                  >
                    {item.label}
                  </span>
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
          
          {/* Bottom actions (User, Pass, Logout) */}
          <div className="shrink-0">
            <div className="p-4 border-t border-gray-200 space-y-4">
              {session?.user && !collapsed && (
                <div className="text-center">
                  <p className="text-xs text-gray-500 truncate">Logged in as:</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {isScopedCustomer && scopedCustomerId
                      ? customers.find((c) => c.id === scopedCustomerId)?.name || session.user.email
                      : session.user.email}
                  </p>
                </div>
              )}
              <button
                onClick={() => setShowPasswordModal(true)}
                className="w-full flex items-center justify-center p-3 rounded-lg transition-colors duration-200 text-amber-600 bg-amber-50 hover:bg-amber-100 font-semibold"
              >
                <KeyIcon className={`w-5 h-5 ${collapsed ? "" : "mr-2"}`} />
                {!collapsed && <span>Change Password</span>}
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center p-3 rounded-lg transition-colors duration-200 text-red-600 bg-red-50 hover:bg-red-100 font-semibold"
              >
                <LogOutIcon className={`w-5 h-5 ${collapsed ? "" : "mr-2"}`} />
                {!collapsed && <span>Logout</span>}
              </button>
            </div>
            {!collapsed && (
              <div className="p-4 border-t border-gray-200 text-center text-xs text-gray-400">
                <p>&copy; {new Date().getFullYear()} I J Reddy Loan App</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* --- MENU MODAL (LANDSCAPE MOBILE ONLY) --- */}
      {showLandscapeMenu && (
        <div
          className="fixed inset-0 z-50 sm:hidden landscape:flex lg:landscape:hidden items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowLandscapeMenu(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">Navigation</h3>
              <button
                onClick={() => setShowLandscapeMenu(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="p-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setShowLandscapeMenu(false)}
                  className={({ isActive }) =>
                    `flex items-center p-3 rounded-lg transition-colors duration-200 border ${
                      isActive 
                        ? "bg-indigo-50 border-indigo-100 text-indigo-700" 
                        : "border-gray-50 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 mr-3 shrink-0" />
                  <span className="font-medium text-sm truncate">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
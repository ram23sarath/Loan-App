import React from "react";
import { NavLink } from "react-router-dom";
import {
  FilePlusIcon,
  HistoryIcon,
  LandmarkIcon,
  UserPlusIcon,
  UsersIcon,
  BookOpenIcon,
  StarIcon,
  HomeIcon,
} from "../constants";
import { useData } from "../context/DataContext";
import HamburgerIcon from "./ui/HamburgerIcon";
import { ProfileHeaderHandle } from "./ProfileHeader";

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

interface SidebarProps {
  profileRef: React.RefObject<ProfileHeaderHandle>;
}

const Sidebar: React.FC<SidebarProps> = ({ profileRef }) => {
  const {
    session,
    signOut,
    isScopedCustomer,
    scopedCustomerId,
    customers = [],
    customerMap,
  } = useData();

  const [showLandscapeMenu, setShowLandscapeMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  let navItems = allNavItems.filter((item) => !item.adminOnly || !isScopedCustomer);

  // For scoped customers, add a Home link that navigates to the customer dashboard above Loans
  if (isScopedCustomer) {
    const homeItem = { path: '/', label: 'Home', icon: HomeIcon };
    const loansIndex = navItems.findIndex((it) => it.path === '/loans');
    if (loansIndex >= 0) {
      navItems.splice(loansIndex, 0, homeItem);
    } else {
      navItems.unshift(homeItem);
    }
  }
  const activeLinkClass = "bg-indigo-50 text-indigo-600 font-semibold";
  const inactiveLinkClass = "text-gray-600 hover:bg-gray-100 hover:text-gray-900";

  const [collapsed, setCollapsed] = React.useState(true);

  // Close landscape dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowLandscapeMenu(false);
      }
    };
    if (showLandscapeMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showLandscapeMenu]);

  // --- RESPONSIVE OFFSET LOGIC ---
  React.useEffect(() => {
    const applyVar = () => {
      if (typeof window === "undefined") return;

      const isLargeDesktop = window.matchMedia("(min-width: 1024px)").matches;
      const isTabletPortrait = window.matchMedia("(min-width: 640px) and (orientation: portrait)").matches;
      const isMobileLandscape = window.matchMedia("(max-width: 1023px) and (orientation: landscape)").matches;

      // Common visual constants
      const leftOffset = 16;
      const gap = 16;

      let total = "0px";

      if (isLargeDesktop || isTabletPortrait) {
        const sidebarWidth = collapsed ? 80 : 256;
        total = `${sidebarWidth + leftOffset + gap}px`;
      }
      // Mobile Landscape
      else if (isMobileLandscape) {
        const sidebarWidth = 80;
        total = `${sidebarWidth + leftOffset + gap}px`;
      }

      try {
        document.documentElement.style.setProperty("--sidebar-offset", total);
      } catch (e) { }
    };

    applyVar();
    window.addEventListener("resize", applyVar);
    window.addEventListener("orientationchange", applyVar);
    return () => {
      window.removeEventListener("resize", applyVar);
      window.removeEventListener("orientationchange", applyVar);
      try {
        document.documentElement.style.setProperty("--sidebar-offset", "0px");
      } catch (e) { }
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

  const handleProfileClick = () => {
    profileRef.current?.openMenu();
  };

  // Calculate user initials for profile button (same logic as ProfileHeader)
  const userEmail = session?.user?.email || 'User';
  const customerDetails = isScopedCustomer && scopedCustomerId
    ? customerMap.get(scopedCustomerId)
    : null;
  const displayName = isScopedCustomer && customerDetails?.name ? customerDetails.name : userEmail;
  const initials = (displayName && displayName.trim().charAt(0).toUpperCase()) || 'U';

  return (
    <>
      {/* Spacer for Portrait Mobile Bottom Nav only */}
      <div className="h-20 sm:hidden landscape:hidden" aria-hidden="true" />

      {/* 1. PORTRAIT MOBILE NAV (Bottom Bar) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 sm:hidden landscape:hidden">
        <div className="flex justify-around items-center py-2 overflow-x-auto w-full">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center px-2 py-1 transition-colors duration-200 whitespace-nowrap text-xs ${isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="mt-1">{item.label}</span>
            </NavLink>
          ))}
          {/* Profile Icon Button with Initials */}
          <button
            onClick={handleProfileClick}
            className="flex flex-col items-center justify-center px-2 py-1 transition-colors duration-200 whitespace-nowrap text-xs text-gray-500 hover:text-gray-700"
          >
            <div className="w-5 h-5 rounded-full bg-indigo-600 text-white font-semibold flex items-center justify-center text-[10px]">
              {initials}
            </div>
            <span className="mt-1">Profile</span>
          </button>
        </div>
      </nav>

      {/* 2. MOBILE LANDSCAPE SIDEBAR (Left Side Floating) */}
      <div
        ref={menuRef}
        className="fixed top-4 bottom-4 left-4 z-50 w-[80px] bg-white rounded-2xl border border-gray-200 shadow-sm hidden landscape:flex lg:landscape:hidden flex-col justify-between items-center py-4"
      >
        {/* Top: Hamburger */}
        <div className="relative">
          <button
            onClick={() => setShowLandscapeMenu(!showLandscapeMenu)}
            className={`p-3 rounded-xl transition-colors ${showLandscapeMenu ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <HamburgerIcon className="w-6 h-6" />
          </button>

          {/* --- CHANGED: 2-COLUMN GRID DROPDOWN --- */}
          {/* w-96 makes it wide enough for 2 columns. max-h-[85vh] prevents overflow. */}
          {showLandscapeMenu && (
            <div className="absolute top-0 left-full ml-4 w-96 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Navigate</span>
              </div>

              {/* 2 Column Grid Layout */}
              <nav className="max-h-[85vh] overflow-y-auto p-2 grid grid-cols-2 gap-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setShowLandscapeMenu(false)}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 rounded-lg text-sm transition-colors border ${isActive
                        ? "bg-indigo-50 border-indigo-100 text-indigo-700 font-medium"
                        : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4 mr-2 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* 3. DESKTOP SIDEBAR */}
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
          className={`p-4 border-b border-gray-200 flex items-center ${collapsed ? "justify-center" : "justify-between"
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
                  `group flex items-center p-3 rounded-lg transition-colors duration-200 ${isActive ? activeLinkClass : inactiveLinkClass
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

          <div className="shrink-0">
            {!collapsed && (
              <div className="p-4 border-t border-gray-200 text-center text-xs text-gray-400">
                <p>&copy; {new Date().getFullYear()} I J Reddy Loan App</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
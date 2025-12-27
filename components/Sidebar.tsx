import React from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence, Variants } from "framer-motion";
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

// Animation variants
const menuDropdownVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -10,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    x: -10,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

const menuItemVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
};

const navItemVariants: Variants = {
  idle: { scale: 1, x: 0 },
  hover: {
    scale: 1.02,
    x: 4,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 20,
    },
  },
  tap: { scale: 0.98 },
};

const iconVariants: Variants = {
  idle: { scale: 1, rotate: 0 },
  hover: {
    scale: 1.1,
    rotate: [0, -5, 5, 0],
    transition: {
      scale: { type: 'spring', stiffness: 400, damping: 20 },
      rotate: { duration: 0.3 },
    },
  },
};

const profileButtonVariants: Variants = {
  idle: { scale: 1 },
  hover: {
    scale: 1.1,
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 20,
    },
  },
  tap: { scale: 0.95 },
};

const allNavItems = [
  { path: "/", label: "Add Customer", icon: UserPlusIcon, adminOnly: true },
  { path: "/add-record", label: "Add Record", icon: FilePlusIcon, adminOnly: true },
  { path: "/customers", label: "Customers", icon: UsersIcon, adminOnly: true },
  { path: "/loans", label: "Loans", icon: LandmarkIcon },
  { path: "/subscriptions", label: "Subscriptions", icon: HistoryIcon },
  { path: "/data", label: "Misc", icon: DatabaseIcon },
  { path: "/loan-seniority", label: "Loan Seniority", icon: StarIcon },
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
  const activeLinkClass = "bg-indigo-50 text-indigo-600 font-semibold dark:bg-indigo-900/30 dark:text-indigo-400";
  const inactiveLinkClass = "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-dark-muted dark:hover:bg-slate-700 dark:hover:text-dark-text";

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
        const sidebarWidth = 96;
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
      <div className="h-28 sm:hidden landscape:hidden" aria-hidden="true" />

      {/* 1. PORTRAIT MOBILE NAV (Bottom Bar) */}
      <motion.nav
        className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 sm:hidden landscape:hidden dark:bg-dark-card dark:border-dark-border"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="flex justify-around items-center py-2 overflow-x-auto w-full gap-1">
          {navItems.map((item, idx) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center px-2 py-1.5 min-w-[60px] max-w-[80px] flex-shrink-0 transition-colors duration-200 text-[10px] ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 hover:text-gray-700 dark:text-dark-muted dark:hover:text-dark-text"
                }`
              }
            >
              {({ isActive }) => (
                <motion.div
                  className="flex flex-col items-center"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: idx * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <motion.div
                    animate={{
                      scale: isActive ? 1.1 : 1,
                      y: isActive ? -2 : 0,
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    <item.icon className="w-6 h-6 flex-shrink-0" />
                  </motion.div>
                  <span className="mt-1 text-center leading-tight">{item.label}</span>
                </motion.div>
              )}
            </NavLink>
          ))}
          {/* Profile Icon Button with Initials */}
          <motion.button
            onClick={handleProfileClick}
            className="flex flex-col items-center justify-center px-2 py-1.5 min-w-[60px] max-w-[80px] flex-shrink-0 transition-colors duration-200 text-[10px] text-gray-500 hover:text-gray-700 dark:text-dark-muted dark:hover:text-dark-text"
            variants={profileButtonVariants}
            initial="idle"
            whileHover="hover"
            whileTap="tap"
          >
            <motion.div
              className="w-6 h-6 flex-shrink-0 rounded-full bg-indigo-600 text-white font-semibold flex items-center justify-center text-xs"
              whileHover={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.3 }}
            >
              {initials}
            </motion.div>
            <span className="mt-1 text-center leading-tight">Profile</span>
          </motion.button>
        </div>
      </motion.nav>

      {/* 2. MOBILE LANDSCAPE SIDEBAR (Left Side Floating) */}
      <motion.div
        ref={menuRef}
        className="fixed top-4 bottom-4 left-4 z-50 w-[96px] bg-white rounded-2xl border border-gray-200 shadow-sm hidden landscape:flex lg:landscape:hidden flex-col justify-between items-center py-4 dark:bg-dark-card dark:border-dark-border"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Top: Hamburger */}
        <div className="relative flex justify-center w-full">
          <motion.button
            onClick={() => setShowLandscapeMenu(!showLandscapeMenu)}
            className={`p-4 rounded-xl transition-colors ${showLandscapeMenu ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-100 dark:text-dark-muted dark:hover:bg-slate-700'}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            animate={{ rotate: showLandscapeMenu ? 90 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <HamburgerIcon className="w-7 h-7" />
          </motion.button>

          {/* --- CHANGED: 2-COLUMN GRID DROPDOWN --- */}
          <AnimatePresence>
            {showLandscapeMenu && (
              <motion.div
                className="absolute top-0 left-full ml-4 w-96 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1 z-50 dark:bg-dark-card dark:border-dark-border"
                variants={menuDropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50 dark:border-dark-border dark:bg-slate-800/50">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-dark-muted">Navigate</span>
                </div>

                {/* 2 Column Grid Layout */}
                <nav className="max-h-[85vh] overflow-y-auto p-2 grid grid-cols-2 gap-2">
                  {navItems.map((item, idx) => (
                    <motion.div
                      key={item.path}
                      variants={menuItemVariants}
                      custom={idx}
                    >
                      <NavLink
                        to={item.path}
                        onClick={() => setShowLandscapeMenu(false)}
                        className={({ isActive }) =>
                          `flex items-center px-3 py-2 rounded-lg text-sm transition-colors border ${isActive
                            ? "bg-indigo-50 border-indigo-100 text-indigo-700 font-medium dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400"
                            : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-dark-muted dark:hover:bg-slate-700 dark:hover:text-dark-text"
                          }`
                        }
                      >
                        <item.icon className="w-4 h-4 mr-2 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    </motion.div>
                  ))}
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* 3. DESKTOP SIDEBAR */}
      <motion.aside
        onMouseEnter={() => {
          setCollapsed(false);
          clearCollapseTimer();
        }}
        onMouseLeave={() => {
          startCollapseTimer(3000);
        }}
        initial={{ x: -100, opacity: 0 }}
        animate={{
          x: 0,
          opacity: 1,
          width: collapsed ? 80 : 256,
        }}
        transition={{
          x: { type: 'spring', stiffness: 300, damping: 30 },
          opacity: { duration: 0.2 },
          width: { type: 'spring', stiffness: 300, damping: 30 },
        }}
        className="fixed left-4 top-4 bottom-4 z-40 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col hidden sm:flex landscape:hidden lg:landscape:flex dark:bg-dark-card dark:border-dark-border"
      >
        <div
          className={`p-4 border-b border-gray-200 flex items-center dark:border-dark-border ${collapsed ? "justify-center" : "justify-between"
            }`}
        >
          <AnimatePresence>
            {!collapsed && (
              <motion.h1
                className="text-xl lg:text-2xl font-bold text-gray-800 truncate dark:text-dark-text"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <span className="hidden lg:inline">Loan Management</span>
                <span className="lg:hidden">Loans</span>
              </motion.h1>
            )}
          </AnimatePresence>
          <motion.button
            onClick={() => {
              setCollapsed(!collapsed);
              clearCollapseTimer();
            }}
            className="p-2 rounded-md hover:bg-gray-100 shrink-0 dark:hover:bg-slate-700"
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <HamburgerIcon className="w-5 h-5 text-gray-700 dark:text-dark-muted" />
          </motion.button>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto min-h-0">
            {navItems.map((item, idx) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `group flex items-center p-3 rounded-lg transition-colors duration-200 ${isActive ? activeLinkClass : inactiveLinkClass
                  }`
                }
              >
                {({ isActive }) => (
                  <motion.div
                    className="relative flex items-center w-full"
                    variants={navItemVariants}
                    initial="idle"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    <motion.div
                      variants={iconVariants}
                      initial="idle"
                      whileHover="hover"
                      animate={{
                        scale: isActive ? 1.1 : 1,
                      }}
                    >
                      <item.icon className="w-6 h-6 text-current" />
                    </motion.div>
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          className="inline-block overflow-hidden whitespace-nowrap ml-3"
                          initial={{ opacity: 0, width: 0, x: -10 }}
                          animate={{ opacity: 1, width: 'auto', x: 0 }}
                          exit={{ opacity: 0, width: 0, x: -10 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {collapsed && (
                      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 pointer-events-none hidden group-hover:block">
                        <motion.div
                          className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap dark:bg-slate-600"
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          {item.label}
                        </motion.div>
                      </div>
                    )}
                  </motion.div>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="shrink-0">
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  className="p-4 border-t border-gray-200 text-center text-xs text-gray-400 dark:border-dark-border dark:text-dark-muted"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <p>&copy; {new Date().getFullYear()} I J Reddy Loan App</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
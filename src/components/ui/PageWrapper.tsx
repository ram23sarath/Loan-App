import React from "react";
import { motion, Transition, Variants } from "framer-motion";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useData } from "../../context/DataContext";
import Toast from "./Toast";

// Smooth page variants - lightweight opacity + subtle y shift (no blur for performance)
const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 6,
  },
  in: {
    opacity: 1,
    y: 0,
  },
  out: {
    opacity: 0,
    y: -4,
  },
};

// Reduced motion variants - instant opacity only, no transitions
const reducedMotionVariants: Variants = {
  initial: { opacity: 0 },
  in: { opacity: 1 },
  out: { opacity: 0 },
};

const pageTransition: Transition = {
  type: "tween",
  ease: [0.25, 0.1, 0.25, 1],
  duration: 0.25,
};

// Container variants for staggered children
const containerVariants: Variants = {
  initial: { opacity: 0 },
  in: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
  out: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

// Child variants for staggered animations
export const childVariants: Variants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  in: {
    opacity: 1,
    y: 0,
    transition: {
      type: "tween",
      ease: "easeOut",
      duration: 0.25,
    },
  },
  out: {
    opacity: 0,
    y: -6,
  },
};

const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  const { isScopedCustomer, session, scopedCustomerId, customers } = useData();
  const [toast, setToast] = React.useState<{
    show: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({ show: false, message: "", type: "info" });
  const prefersReducedMotion = useReducedMotion();

  React.useEffect(() => {
    type BackgroundUserCreateDetail = {
      status?: string;
      message?: string;
    };

    type BackgroundUserCreateEvent = CustomEvent<BackgroundUserCreateDetail>;

    const handler = (e: Event) => {
      try {
        const detail = (e as BackgroundUserCreateEvent).detail || {};
        const type = detail.status === "success" ? "success" : "error";
        const msg =
          detail.message ||
          (type === "success"
            ? "User created successfully"
            : "Failed to create user");
        setToast({ show: true, message: msg, type });
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Error handling background-user-create event:", err);
        }
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener(
        "background-user-create",
        handler as EventListener,
      );
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "background-user-create",
          handler as EventListener,
        );
      }
    };
  }, []);

  const currentVariants = prefersReducedMotion
    ? reducedMotionVariants
    : pageVariants;

  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={currentVariants}
      transition={prefersReducedMotion ? { duration: 0 } : pageTransition}
      className="w-full min-h-full p-4 pb-24 sm:p-8 landscape:pb-16"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
      }}
    >
      <Toast
        show={toast.show}
        message={toast.message}
        onClose={() => setToast({ show: false, message: "", type: "info" })}
        type={toast.type}
      />

      {children}
    </motion.div>
  );
};

export default PageWrapper;

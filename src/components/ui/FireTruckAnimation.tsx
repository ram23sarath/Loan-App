import React, { useEffect, useState, lazy, Suspense } from "react";
import { useVisibilityTrigger } from "../hooks/useVisibilityTrigger";

// Lazy load the heavy animation component
// This ensures framer-motion is only loaded when needed
const FireTruckAnimationContent = lazy(() => 
  import(
    /* webpackChunkName: "firetruck-animation-content" */ 
    "./FireTruckAnimationContent"
  )
);

interface FireTruckAnimationProps {
  onComplete: () => void;
  startDelay?: number;
}

const FireTruckAnimation: React.FC<FireTruckAnimationProps> = ({
  onComplete,
  startDelay = 150,
}) => {
  const [shouldAnimate, setShouldAnimate] = useState(false);
  
  // Visibility hook - monitored in the lightweight parent
  const { ref: visibilityRef, isVisible } = useVisibilityTrigger({ threshold: 0.1 }); 

  useEffect(() => {
    // Only start the initial delay timer if visible
    if (!isVisible) return;
    
    // Tiny delay to ensure we don't start fetch immediately if user is just scrolling past quickly
    // or to stagger the start
    const timer = setTimeout(() => {
      setShouldAnimate(true);
    }, startDelay);
    return () => clearTimeout(timer);
  }, [startDelay, isVisible]);

  return (
    <div 
      ref={visibilityRef}
      className={`fixed inset-0 z-50 overflow-hidden bg-slate-50 dark:bg-slate-900 transition-opacity duration-500 ${shouldAnimate ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      {shouldAnimate && (
        <Suspense fallback={null}>
          <FireTruckAnimationContent onComplete={onComplete} />
        </Suspense>
      )}
    </div>
  );
};

export default FireTruckAnimation;

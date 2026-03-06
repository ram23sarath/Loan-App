import React from "react";

interface LoadingButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  isLoading: boolean;
  ariaLabel: string;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading,
  disabled,
  children,
  ariaLabel,
  onClick,
  className = "",
  type = "button",
  ...rest
}) => {
  const isDisabled = Boolean(disabled || isLoading);

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      aria-busy={isLoading ? "true" : undefined}
      disabled={isDisabled}
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-2 ${className}`.trim()}
      {...rest}
    >
      {isLoading ? (
        <>
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeOpacity="0.3"
              strokeWidth="4"
            />
            <path
              d="M22 12a10 10 0 0 0-10-10"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
          <span aria-hidden="true">Updating...</span>
          <span className="sr-only" role="status" aria-live="polite">
            Updating...
          </span>        </>
      ) : (
        children
      )}
    </button>
  );
};

export default LoadingButton;
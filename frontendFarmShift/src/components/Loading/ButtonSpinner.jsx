// src/components/Loading/ButtonSpinner.jsx
// Hiệu ứng Spinner quay công nghệ cao cho Nút bấm (Button Loading State)
import React from 'react';

export const ButtonSpinner = ({
  size = 16,
  color = 'currentColor',
  secondaryColor = 'rgba(255, 255, 255, 0.25)',
  className = '',
  style = {}
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`farmshift-btn-spinner ${className}`}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        animation: 'farmshiftSpin 0.75s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        ...style
      }}
      aria-hidden="true"
    >
      {/* Background track circle */}
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke={secondaryColor}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      {/* Active rotating arc */}
      <path
        d="M12 2.5C17.2467 2.5 21.5 6.75329 21.5 12C21.5 14.4754 20.5516 16.7291 19 18.4"
        stroke={color}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default ButtonSpinner;

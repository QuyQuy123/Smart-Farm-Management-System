// src/components/Input/Input.jsx
import React, { forwardRef, useId } from 'react';
import styles from './Input.module.css';

/**
 * Design-system TextInput — implements DESIGN.md text-input + text-input-focus.
 *
 * @param {string}  label    — visible label text
 * @param {string}  error    — shows red error message below the field
 * @param {string}  helper   — shows muted helper text below the field
 * @param {string}  id       — optional; auto-generated if omitted
 */
export const Input = forwardRef(function Input(
  { label, error, helper, id: externalId, className = '', ...props },
  ref
) {
  const autoId  = useId();
  const inputId = externalId || autoId;

  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`${styles.field} ${error ? styles.hasError : ''}`}
        aria-describedby={error ? `${inputId}-err` : helper ? `${inputId}-help` : undefined}
        aria-invalid={!!error}
        {...props}
      />
      {error  && <span id={`${inputId}-err`}  className={styles.errorMsg}>{error}</span>}
      {helper && !error && <span id={`${inputId}-help`} className={styles.helper}>{helper}</span>}
    </div>
  );
});

// src/components/CurrencyInput/CurrencyInput.jsx
import React, { forwardRef, useId } from 'react';
import {
  formatShortVietnameseCurrency,
  formatThousandsVi,
  parseCurrencyDigits,
} from '../../utils/selectFormatters';
import styles from './CurrencyInput.module.css';

/**
 * Standard FarmShift CurrencyInput (Micro-UX Playbook 1.1):
 * - Live thousand separator formatting (52000 -> 52.000)
 * - Blocks mouse wheel accidental changes
 * - Auto-selects "0" on focus
 * - inputMode="numeric" for mobile PWA keypad
 * - Optional suffix ("đ", "đ/kg") & short Vietnamese reading hint >= 1.000.000
 */
export const CurrencyInput = forwardRef(function CurrencyInput(
  {
    value,
    onChange,
    onValueChange,
    onFocus,
    onWheel,
    label,
    suffix = 'đ',
    showWords = true,
    error,
    warning,
    helper,
    id: externalId,
    className = '',
    inputClassName = '',
    name,
    ...props
  },
  ref
) {
  const autoId = useId();
  const inputId = externalId || autoId;

  const formattedValue = formatThousandsVi(value);
  const wordsHint = showWords ? formatShortVietnameseCurrency(value) : '';
  const hasSuffix = Boolean(suffix);
  const wideSuffix = hasSuffix && suffix.length > 2;

  const handleChange = (e) => {
    const parsed = parseCurrencyDigits(e.target.value);
    const isNeg = parsed.startsWith('-');
    const digits = isNeg ? parsed.slice(1) : parsed;
    const normalizedDigits = digits.replace(/^0+(?=\d)/, '');
    const normalized = isNeg ? `-${normalizedDigits}` : normalizedDigits;
    if (onValueChange) {
      onValueChange(normalized, e);
    }
    if (onChange) {
      // Provide synthetic event with clean numeric string in e.target.value
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          name: name ?? e.target.name,
          value: normalized,
        },
        currentTarget: {
          ...e.currentTarget,
          name: name ?? e.currentTarget?.name,
          value: normalized,
        },
      };
      onChange(syntheticEvent);
    }
  };

  const handleFocus = (e) => {
    const digits = parseCurrencyDigits(e.target.value);
    if (digits === '0') {
      e.target.select();
    }
    if (onFocus) onFocus(e);
  };

  const handleWheel = (e) => {
    e.currentTarget.blur();
    if (onWheel) onWheel(e);
  };

  const inputClasses = [
    styles.field,
    hasSuffix ? (wideSuffix ? styles.withWideSuffix : styles.withSuffix) : '',
    error ? styles.hasError : warning ? styles.hasWarning : '',
    inputClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <div className={styles.inputWrap}>
        <input
          ref={ref}
          id={inputId}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={formattedValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onWheel={handleWheel}
          className={inputClasses}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {hasSuffix && (
          <span className={styles.suffix} aria-hidden="true">
            {suffix}
          </span>
        )}
      </div>
      {wordsHint && !error && <span className={styles.wordsHint}>{wordsHint}</span>}
      {error && <span className={styles.errorMsg}>{error}</span>}
      {!error && warning && <span className={styles.warningMsg}>{warning}</span>}
      {!error && !warning && helper && <span className={styles.helper}>{helper}</span>}
    </div>
  );
});

export default CurrencyInput;

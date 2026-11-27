// src/components/QuantityInput/QuantityInput.jsx
import React, { forwardRef, useId } from 'react';
import {
  formatQuantityVi,
} from '../../utils/selectFormatters';
import styles from './QuantityInput.module.css';

/**
 * Standard FarmShift QuantityInput (Micro-UX Playbook 1.2):
 * - Blocks mouse wheel accidental changes
 * - Auto-selects "0" on focus
 * - allowDecimal toggles inputMode="decimal" vs "numeric" (accepts "," or ".")
 * - Optional suffix ("con", "kg", "bao", "chai", "lọ", ...)
 * - Optional max: warns in red when exceeded & renders quick "Tất cả" button
 * - Optional warning: soft guardrail yellow border & message
 */
export const QuantityInput = forwardRef(function QuantityInput(
  {
    value,
    onChange,
    onValueChange,
    onFocus,
    onWheel,
    onKeyDown,
    allowDecimal = false,
    suffix = '',
    max,
    showMaxButton = false,
    maxButtonLabel = 'Tất cả',
    suppressMaxError = false,
    label,
    error,
    warning,
    helper,
    id: externalId,
    className = '',
    inputClassName = '',
    name,
    disabled,
    readOnly,
    ...props
  },
  ref
) {
  const autoId = useId();
  const inputId = externalId || autoId;

  const stringValue = value === null || value === undefined ? '' : String(value);
  const numericMax = max !== null && max !== undefined && max !== '' ? Number(max) : null;
  const hasValidMax = numericMax !== null && Number.isFinite(numericMax) && numericMax > 0;
  const numericValue = stringValue !== '' ? Number(stringValue.replace(',', '.')) : null;
  const isOverMax =
    hasValidMax && numericValue !== null && Number.isFinite(numericValue) && numericValue > numericMax;

  const effectiveError =
    error ||
    (!suppressMaxError && isOverMax
      ? `Vượt quá giới hạn tối đa (${formatQuantityVi(numericMax, allowDecimal ? 3 : 0)}${suffix ? ` ${suffix}` : ''})`
      : '');

  const emitChange = (nextVal, e) => {
    if (onValueChange) {
      onValueChange(nextVal, e);
    }
    if (onChange) {
      const syntheticEvent = {
        ...(e || {}),
        target: {
          ...(e?.target || {}),
          name: name ?? e?.target?.name,
          value: nextVal,
        },
        currentTarget: {
          ...(e?.currentTarget || {}),
          name: name ?? e?.currentTarget?.name,
          value: nextVal,
        },
      };
      onChange(syntheticEvent);
    }
  };

  const handleChange = (e) => {
    emitChange(e.target.value, e);
  };

  const handleKeyDown = (e) => {
    // Block scientific notation 'e'/'E' and '+' in numeric inputs
    if (e.key === 'e' || e.key === 'E' || e.key === '+') {
      e.preventDefault();
    }
    if (!allowDecimal && (e.key === '.' || e.key === ',')) {
      e.preventDefault();
    }
    if (onKeyDown) onKeyDown(e);
  };

  const handleFocus = (e) => {
    const trimmed = String(e.target.value).trim();
    if (trimmed === '0' || trimmed === '0.0' || trimmed === '0,0') {
      e.target.select();
    }
    if (onFocus) onFocus(e);
  };

  const handleWheel = (e) => {
    e.currentTarget.blur();
    if (onWheel) onWheel(e);
  };

  const handleFillMax = () => {
    if (!hasValidMax || disabled || readOnly) return;
    emitChange(String(numericMax), null);
  };

  const hasSuffix = Boolean(suffix);
  const wideSuffix = hasSuffix && suffix.length > 3;

  const inputClasses = [
    styles.field,
    hasSuffix ? (wideSuffix ? styles.withWideSuffix : styles.withSuffix) : '',
    effectiveError ? styles.hasError : warning ? styles.hasWarning : '',
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
      <div className={styles.row}>
        <div className={styles.inputWrap}>
          <input
            ref={ref}
            id={inputId}
            name={name}
            type="number"
            step="any"
            inputMode={allowDecimal ? 'decimal' : 'numeric'}
            autoComplete="off"
            value={stringValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onWheel={handleWheel}
            disabled={disabled}
            readOnly={readOnly}
            className={inputClasses}
            aria-invalid={Boolean(effectiveError)}
            {...props}
          />
          {hasSuffix && (
            <span className={styles.suffix} aria-hidden="true">
              {suffix}
            </span>
          )}
        </div>
        {showMaxButton && hasValidMax && (
          <button
            type="button"
            className={styles.maxBtn}
            onClick={handleFillMax}
            disabled={disabled || readOnly}
            title={`Điền toàn bộ (${formatQuantityVi(numericMax, allowDecimal ? 3 : 0)}${suffix ? ` ${suffix}` : ''})`}
          >
            {maxButtonLabel}
          </button>
        )}
      </div>
      {effectiveError && <span className={styles.errorMsg}>{effectiveError}</span>}
      {!effectiveError && warning && <span className={styles.warningMsg}>{warning}</span>}
      {!effectiveError && !warning && helper && <span className={styles.helper}>{helper}</span>}
    </div>
  );
});

export default QuantityInput;

import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CurrencyInput } from '../components/CurrencyInput/CurrencyInput';
import { QuantityInput } from '../components/QuantityInput/QuantityInput';
import { Modal } from '../components/Modal/Modal';
import { Dialog } from '../features/farmshift/FarmAreaDialogs';
import {
  formatBarnOption,
  sortBarnsForOperation,
  formatInventoryOption,
  formatStockAfterExport,
  formatShortVietnameseCurrency,
  formatThousandsVi,
  parseCurrencyDigits,
} from '../utils/selectFormatters';

describe('CurrencyInput', () => {
  it('formats thousand separators live and emits clean digits in onChange', () => {
    const Wrapper = () => {
      const [val, setVal] = useState('52000');
      return <CurrencyInput aria-label="Đơn giá" value={val} onChange={e => setVal(e.target.value)} suffix="đ/kg" />;
    };
    render(<Wrapper />);
    const input = screen.getByLabelText('Đơn giá');
    expect(input).toHaveValue('52.000');
    expect(input).toHaveAttribute('inputmode', 'numeric');

    fireEvent.change(input, { target: { value: '295.100.000' } });
    expect(input).toHaveValue('295.100.000');
    expect(screen.getByText('295,1 triệu đồng')).toBeInTheDocument();
  });

  it('auto-selects 0 on focus and blurs on wheel', () => {
    render(<CurrencyInput aria-label="Tiền" value="0" onChange={() => {}} />);
    const input = screen.getByLabelText('Tiền');
    const selectSpy = vi.spyOn(input, 'select');
    const blurSpy = vi.spyOn(input, 'blur');

    fireEvent.focus(input);
    expect(selectSpy).toHaveBeenCalledTimes(1);

    fireEvent.wheel(input);
    expect(blurSpy).toHaveBeenCalledTimes(1);
  });
});

describe('QuantityInput', () => {
  it('supports decimal input, max warning, and Tất cả quick button', () => {
    const Wrapper = () => {
      const [val, setVal] = useState('');
      return (
        <QuantityInput
          aria-label="Số lượng"
          allowDecimal
          suffix="bao"
          max={45}
          showMaxButton
          value={val}
          onChange={e => setVal(e.target.value)}
        />
      );
    };
    render(<Wrapper />);
    const input = screen.getByLabelText('Số lượng');
    expect(input).toHaveAttribute('inputmode', 'decimal');

    fireEvent.change(input, { target: { value: '13.5' } });
    expect(input).toHaveValue(13.5);

    fireEvent.change(input, { target: { value: '50' } });
    expect(screen.getByText(/Vượt quá giới hạn tối đa/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }));
    expect(input).toHaveValue(45);
    expect(screen.queryByText(/Vượt quá giới hạn tối đa/)).not.toBeInTheDocument();
  });

  it('uses numeric inputMode when allowDecimal is false and displays soft guardrail warning', () => {
    render(
      <QuantityInput
        aria-label="Hao hụt"
        value="200"
        onChange={() => {}}
        warning="Hao hụt vượt quá 5% đàn"
      />
    );
    const input = screen.getByLabelText('Hao hụt');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByText('Hao hụt vượt quá 5% đàn')).toBeInTheDocument();

    const blurSpy = vi.spyOn(input, 'blur');
    fireEvent.wheel(input);
    expect(blurSpy).toHaveBeenCalledTimes(1);
  });

  it('still blocks scientific notation and decimals when a custom onKeyDown is passed', () => {
    const customKeyDown = vi.fn();
    render(
      <QuantityInput
        aria-label="Số con"
        value="10"
        onChange={() => {}}
        onKeyDown={customKeyDown}
      />
    );
    const input = screen.getByLabelText('Số con');

    const eEvent = new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true });
    input.dispatchEvent(eEvent);
    expect(eEvent.defaultPrevented).toBe(true);

    const dotEvent = new KeyboardEvent('keydown', { key: '.', bubbles: true, cancelable: true });
    input.dispatchEvent(dotEvent);
    expect(dotEvent.defaultPrevented).toBe(true);

    expect(customKeyDown).toHaveBeenCalledTimes(2);
  });
});

describe('selectFormatters', () => {
  it('formats active and empty barns and sorts empty barns last', () => {
    const active = { id: 1, name: 'Nhà A1', activeCycleCode: 'L000004', current: 2450, ageDays: 38 };
    const dtoActive = { id: 3, name: 'Nhà A3', activeCycleCode: 'L000009', currentQuantity: 1200, ageDays: 14 };
    const empty = { id: 2, name: 'Nhà A2', current: 0, capacity: 3000 };

    expect(formatBarnOption(active)).toBe('Nhà A1 · L000004 (Còn 2.450 con · 38 ngày)');
    expect(formatBarnOption(dtoActive)).toBe('Nhà A3 · L000009 (Còn 1.200 con · 14 ngày)');
    expect(formatBarnOption(empty)).toBe('Nhà A2 · Trống (Sức chứa 3.000 con)');

    const sorted = sortBarnsForOperation([empty, active, dtoActive], { emptyLast: true });
    expect(sorted[0].id).toBe(1);
    expect(sorted[1].id).toBe(3);
    expect(sorted[2].id).toBe(2);
  });

  it('formats inventory option and stock-after-export preview', () => {
    expect(formatInventoryOption({ name: 'Cám CP 511', stock: 45, unit: 'bao' })).toBe('Cám CP 511 · Tồn: 45 bao');

    const ok = formatStockAfterExport(45, 4, 'bao');
    expect(ok.isExceeded).toBe(false);
    expect(ok.text).toBe('Tồn hiện tại: 45 bao -> Sau khi xuất còn: 41 bao');

    const over = formatStockAfterExport(10, 15, 'bao');
    expect(over.isExceeded).toBe(true);
    expect(over.text).toContain('Vượt tồn kho 5 bao');

    expect(formatShortVietnameseCurrency(1250000000)).toBe('1,25 tỷ đồng');
    expect(formatShortVietnameseCurrency(500000)).toBe('');

    // Regression: numeric BigDecimal values with decimals must round, never multiply by 10x/100x
    expect(parseCurrencyDigits(52500.5)).toBe('52501');
    expect(formatThousandsVi(52500.5)).toBe('52.501');
    expect(formatThousandsVi(-10000)).toBe('-10.000');
  });
});

describe('Modal dirty backdrop guard', () => {
  it('blocks backdrop close when isDirty is true and allows when false', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen title="Form" isDirty onClose={onClose}>
        <div>Body</div>
      </Modal>
    );
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <Modal isOpen title="Form" isDirty={false} onClose={onClose}>
        <div>Body</div>
      </Modal>
    );
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('blocks native Dialog backdrop click and cancel when isDirty or busy is true, and allows when clean', () => {
    const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
    const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value() { this.setAttribute('open', ''); },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value() { this.removeAttribute('open'); },
    });
    try {
      const onClose = vi.fn();
      const { rerender, unmount } = render(
        <Dialog title="Test Dialog" labelId="test-dialog-title" isDirty onClose={onClose}>
          <div>Nội dung</div>
        </Dialog>
      );
      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);
      fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(onClose).not.toHaveBeenCalled();

      rerender(
        <Dialog title="Test Dialog" labelId="test-dialog-title" isDirty={false} busy onClose={onClose}>
          <div>Nội dung</div>
        </Dialog>
      );
      fireEvent.click(dialog);
      expect(onClose).not.toHaveBeenCalled();

      rerender(
        <Dialog title="Test Dialog" labelId="test-dialog-title" isDirty={false} busy={false} onClose={onClose}>
          <div>Nội dung</div>
        </Dialog>
      );
      fireEvent.click(dialog);
      fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(onClose).toHaveBeenCalledTimes(2);
      unmount();
    } finally {
      if (originalShow) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShow);
      else delete HTMLDialogElement.prototype.showModal;
      if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose);
      else delete HTMLDialogElement.prototype.close;
    }
  });
});

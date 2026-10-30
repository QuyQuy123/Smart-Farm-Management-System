import React from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { WeightSlipCapture } from '../features/farmshift/WeightSlipCapture';

it('captures a camera image and stops all media tracks', async () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  const stop = vi.fn(), stream = { getTracks: () => [{ stop }] }, onFile = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() });
  const blob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['photo'], { type: 'image/jpeg' })));
  try {
    const view = render(<WeightSlipCapture onFile={onFile} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Chụp ảnh trực tiếp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bật camera' }));
    await waitFor(() => expect(view.container.querySelector('video')).not.toBeNull());
    const video = view.container.querySelector('video');
    Object.defineProperty(video, 'videoWidth', { configurable: true, value: 640 });
    Object.defineProperty(video, 'videoHeight', { configurable: true, value: 480 });
    fireEvent.loadedData(video);
    fireEvent.click(screen.getByRole('button', { name: 'Chụp và bóc tách' }));
    expect(onFile).toHaveBeenCalledWith(expect.any(File));
    expect(onFile.mock.calls[0][0].type).toBe('image/jpeg');
    expect(stop).toHaveBeenCalled();
    view.unmount();
  } finally {
    context.mockRestore(); blob.mockRestore();
    if (previous) Object.defineProperty(navigator, 'mediaDevices', previous); else delete navigator.mediaDevices;
  }
});
it('stops a camera stream that arrives after the capture dialog closes', async () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  const stop = vi.fn(); let grant;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(() => new Promise(resolve => { grant = resolve; })) } });
  try {
    const view = render(<WeightSlipCapture onFile={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Chụp ảnh trực tiếp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bật camera' })); view.unmount();
    await act(async () => { grant({ getTracks: () => [{ stop }] }); });
    expect(stop).toHaveBeenCalledOnce();
  } finally {
    if (previous) Object.defineProperty(navigator, 'mediaDevices', previous); else delete navigator.mediaDevices;
  }
});

it('shows the upload tab by default and accepts a dropped document', () => {
  const onFile = vi.fn();
  render(<WeightSlipCapture onFile={onFile} onClose={vi.fn()} />);
  expect(screen.getByRole('tab', { name: 'Tải file / Kéo thả' })).toHaveAttribute('aria-selected', 'true');
  const file = new File(['pdf'], 'phieu.pdf', { type: 'application/pdf' });
  fireEvent.drop(screen.getByRole('button', { name: 'Chọn hoặc kéo thả phiếu cân' }), { dataTransfer: { files: [file] } });
  expect(onFile).toHaveBeenCalledWith(file);
});
it('rejects multiple dropped files and closes from the footer', () => {
  const onFile = vi.fn(), onClose = vi.fn();
  render(<WeightSlipCapture onFile={onFile} onClose={onClose} />);
  const file = new File(['pdf'], 'phieu.pdf', { type: 'application/pdf' });
  fireEvent.drop(screen.getByRole('button', { name: 'Chọn hoặc kéo thả phiếu cân' }), { dataTransfer: { files: [file, file] } });
  expect(screen.getByRole('alert')).toHaveTextContent('một phiếu cân');
  expect(onFile).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Đóng', exact: true }));
  expect(onClose).toHaveBeenCalled();
});

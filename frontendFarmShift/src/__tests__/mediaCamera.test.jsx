import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MediaCamera } from '../features/farmshift/MediaCamera';
import { api } from '../utils/api';
vi.mock('../utils/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }));
it('loads the saved stream and persists a new path without RTSP credentials', async () => {
  api.get.mockResolvedValue({ data: { data: { streamPath: 'cam-chuong-1' } } });
  api.put.mockResolvedValue({ data: { data: { streamPath: 'cam-chuong-2' } } });
  render(<MediaCamera barn={{ id: 11, name: 'Chuồng 1' }} />);
  const frame = await screen.findByTitle('Camera trực tiếp Chuồng 1');
  expect(frame.src).toContain('http://localhost:8889/cam-chuong-1/');
  fireEvent.change(screen.getByLabelText('Stream path'), { target: { value: 'cam-chuong-2' } });
  fireEvent.click(screen.getByText('Lưu camera'));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/barns/11/camera', { streamPath: 'cam-chuong-2' }));
  await waitFor(() => expect(screen.getByTitle('Camera trực tiếp Chuồng 1').src).toContain('/cam-chuong-2/'));
});

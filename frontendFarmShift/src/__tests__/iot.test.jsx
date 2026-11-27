import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../utils/api';
import { IotEventLog } from '../features/farmshift/IotEventLog';
import { IotView } from '../features/farmshift/IotView';
import { listBarns, listFarmAreas } from '../services/farmAreaService';
import { connectEsp32, ESP32_TOPIC_PREFIX, relayStatusTopics } from '../services/esp32MqttService';

vi.mock('../utils/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ children }) => <main>{children}</main> }));
vi.mock('../services/farmAreaService', () => ({ listBarns: vi.fn(), listFarmAreas: vi.fn(), FARM_AREAS_CHANGED: 'farm-areas-changed' }));
vi.mock('../services/esp32MqttService', { spy: true });
const originalShow = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterAll(() => {
  HTMLDialogElement.prototype.showModal = originalShow;
  HTMLDialogElement.prototype.close = originalClose;
});
beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockResolvedValue({ data: { data: [] } });
  api.post.mockResolvedValue({ data: {} });
  localStorage.removeItem('farmshift-esp32-temperature');
  connectEsp32.mockResolvedValue({ disconnect: vi.fn() });
  listFarmAreas.mockResolvedValue([{ id: 1, name: 'Khu Mía' }, { id: 2, name: 'Khu Hồ' }]);
  listBarns.mockResolvedValue([{ id: 11, name: 'Chuồng A1', areaId: 1 }, { id: 12, name: 'Chuồng B1', areaId: 2 }]);
});
const open = () => render(<MemoryRouter><IotView /></MemoryRouter>);

it('automates a configured fan and yields to its manual switch', async () => {
  const publishRelay = vi.fn().mockResolvedValue(undefined);
  let receive;
  connectEsp32.mockImplementation(async ({ onConnection, onMessage }) => {
    receive = onMessage;
    onConnection('connected');
    return { disconnect: vi.fn(), publishRelay };
  });
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết Chuồng A1' }));
  await screen.findByText('Đã kết nối thiết bị phần cứng');
  const group = screen.getByRole('switch', { name: 'Bật tắt toàn bộ Quạt gió' }).closest('article');
  group.querySelector('details').open = true;
  fireEvent.click(within(group).getByRole('button', { name: 'Chỉnh sửa' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).queryByLabelText('Relay ESP32')).not.toBeInTheDocument();
  expect(within(dialog).queryByLabelText(/Công suất/)).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByLabelText('Điều khiển tự động'));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thiết bị' }));
  act(() => {
    receive({ topic: `${ESP32_TOPIC_PREFIX}/temp1`, payload: '41' });
    receive({ topic: `${ESP32_TOPIC_PREFIX}/temp3`, payload: '43' });
  });
  await waitFor(() => expect(publishRelay).toHaveBeenCalledWith(4, 'ON'), { timeout: 4500 });
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/barns/11/iot-events', expect.objectContaining({ deviceType: 'FAN', mode: 'AUTO' })));
  act(() => receive({ topic: relayStatusTopics[3], payload: 'ON' }));
  fireEvent.click(within(group).getByRole('switch', { name: 'Bật tắt Quạt gió' }));
  expect(publishRelay).toHaveBeenLastCalledWith(4, 'OFF');
  expect(within(group).getByText('Điều khiển tay')).toBeInTheDocument();
});

it('opens only the requested barn when following the environment shortcut', async () => {
  render(<MemoryRouter initialEntries={['/iot?barn=11']}><IotView /></MemoryRouter>);
  expect(await screen.findByRole('region', { name: 'Thiết bị Chuồng A1' })).toBeInTheDocument();
  expect(screen.getByLabelText('Camera Chuồng A1')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Môi trường Chuồng A1' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Camera Chuồng B1')).not.toBeInTheDocument();
  expect(screen.queryByText('Camera theo khu nuôi')).not.toBeInTheDocument();
});

it('groups database barns under their areas and filters camera cards', async () => {
  open();
  const mia = await screen.findByRole('region', { name: 'Khu Mía' });
  expect(within(mia).getByRole('button', { name: 'Xem chi tiết Chuồng A1' })).toBeInTheDocument();
  expect(within(mia).queryByText('Chuồng B1')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Camera Chuồng B1')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Tìm khu hoặc chuồng'), { target: { value: 'B1' } });
  expect(screen.queryByRole('button', { name: 'Xem chi tiết Chuồng A1' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xem chi tiết Chuồng B1' })).toBeInTheDocument();
});

it('sends commands for assigned relays individually and as a group', async () => {
  const publishRelay = vi.fn();
  connectEsp32.mockImplementation(async ({ onConnection, onMessage }) => {
    publishRelay.mockImplementation(async (relay, payload) => onMessage({ topic: relayStatusTopics[relay - 1], payload }));
    onConnection('connected');
    return { publishRelay, disconnect: vi.fn() };
  });
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết Chuồng A1' }));
  const fanName = 'Bật tắt toàn bộ Quạt gió';
  await screen.findByText('Đã kết nối thiết bị phần cứng');
  expect(screen.getByRole('switch', { name: fanName })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Tất cả camera' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết Chuồng B1' }));
  await screen.findByText(/Đã kết nối thiết bị phần cứng/);
  expect(screen.getByRole('switch', { name: fanName })).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Thêm thiết bị' }));
  let dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText(/Tên thiết bị/), { target: { value: 'Đèn dự phòng' } });
  fireEvent.change(within(dialog).getByLabelText('Loại thiết bị'), { target: { value: 'LIGHT' } });
  fireEvent.change(within(dialog).getByLabelText('Relay ESP32'), { target: { value: '1' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thiết bị' }));
  screen.getByText('2 thiết bị', { selector: 'summary' }).closest('details').open = true;
  const allLights = screen.getByRole('switch', { name: 'Bật tắt toàn bộ Hệ thống đèn chiếu sáng' });
  const spareLight = screen.getByRole('switch', { name: 'Bật tắt Đèn dự phòng' });
  const defaultLight = screen.getByRole('switch', { name: 'Bật tắt Hệ thống Đèn chiếu sáng' });
  fireEvent.click(within(defaultLight.closest('article')).getByRole('button', { name: 'Chỉnh sửa' }));
  dialog = screen.getByRole('dialog');
  expect(within(dialog).queryByLabelText('Relay ESP32')).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thiết bị' }));
  fireEvent.click(allLights);
  expect(publishRelay).toHaveBeenCalledWith(2, 'ON');
  expect(publishRelay).toHaveBeenCalledWith(1, 'ON');
  expect(spareLight).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(spareLight);
  expect(publishRelay).toHaveBeenLastCalledWith(1, 'OFF');
  expect(allLights).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByRole('switch', { name: 'Bật tắt Hệ thống Đèn chiếu sáng' })).toHaveAttribute('aria-checked', 'true');
  let card = screen.getByRole('heading', { name: 'Đèn dự phòng' }).closest('article');
  fireEvent.click(within(card).getByRole('button', { name: 'Chỉnh sửa' }));
  dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText(/Tên thiết bị/), { target: { value: 'Đèn mới' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thiết bị' }));
  card = screen.getByRole('heading', { name: 'Đèn mới' }).closest('article');
  fireEvent.click(within(card).getByRole('button', { name: 'Xóa' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xóa thiết bị' }));
  expect(screen.queryByRole('heading', { name: 'Đèn mới' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tất cả camera' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết Chuồng A1' }));
  await screen.findByText('Đã kết nối thiết bị phần cứng');
  expect(screen.getByRole('switch', { name: fanName })).toBeEnabled();
});

it('reports a failed database request and retries', async () => {
  listBarns.mockRejectedValueOnce(new Error('Không thể tải chuồng'));
  open();
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByRole('button', { name: 'Xem chi tiết Chuồng A1' })).toBeInTheDocument();
});

it('shows an empty temperature history until actual readings arrive', async () => {
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết Chuồng A1' }));
  const environment = screen.getByRole('region', { name: 'Môi trường Chuồng A1' });
  expect(within(environment).getAllByText(/Nhiệt độ hiện tại/)).toHaveLength(2);
  expect(within(environment).getAllByText(/Độ ẩm hiện tại/)).toHaveLength(2);
  expect(within(environment).getAllByText('Chưa có dữ liệu')).toHaveLength(4);
  expect(within(environment).getByText('Chưa có lịch sử nhiệt độ')).toBeInTheDocument();
});

it('displays MQTT readings from the two installed sensor channels', async () => {
  connectEsp32.mockImplementation(async ({ onConnection, onMessage }) => {
    onConnection('connected');
    for (const [key, payload] of Object.entries({ temp1: '27.1', humi1: '95', temp3: '28.4', humi3: '83' })) {
      onMessage({ topic: `${ESP32_TOPIC_PREFIX}/${key}`, payload });
    }
    return { disconnect: vi.fn() };
  });
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết Chuồng A1' }));
  const environment = screen.getByRole('region', { name: 'Môi trường Chuồng A1' });
  for (const value of ['27,1', '95', '28,4', '83']) {
    expect(await within(environment).findByText(value, {}, { timeout: 4500 })).toBeInTheDocument();
  }
  const chart = within(environment).getByRole('group', { name: 'Biểu đồ nhiệt độ Chuồng A1' });
  const marker = chart.querySelector('circle');
  vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 700, height: 235 });
  fireEvent.pointerMove(chart, { clientX: Number(marker.getAttribute('cx')), clientY: Number(marker.getAttribute('cy')) });
  expect(within(environment).getByText(/Cảm biến 1 · .* · 27,1 °C/)).toBeInTheDocument();
  fireEvent.click(within(environment).getByRole('button', { name: '7 ngày' }));
  expect(chart.querySelectorAll('circle')).toHaveLength(2);
  fireEvent.click(within(environment).getByRole('button', { name: 'Nhiệt độ trung bình' }));
  expect(chart.querySelectorAll('polyline')).toHaveLength(1);
  fireEvent.click(chart.querySelector('circle'));
  expect(within(environment).getByText(/Trung bình hai cảm biến · .* · 27,75 °C/)).toBeInTheDocument();
});


it('refreshes temperatures every three seconds and logs the latest raw readings on activation', async () => {
  let receive;
  const publishRelay = vi.fn().mockResolvedValue(undefined);
  connectEsp32.mockImplementation(async ({ onConnection, onMessage }) => {
    receive = onMessage;
    onConnection('connected');
    return { disconnect: vi.fn(), publishRelay };
  });
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  render(<MemoryRouter initialEntries={['/iot?barn=11']}><IotView /></MemoryRouter>);
  await screen.findByText('Đã kết nối thiết bị phần cứng');
  try {
    const environment = screen.getByRole('region', { name: 'Môi trường Chuồng A1' });
    act(() => {
      receive({ topic: `${ESP32_TOPIC_PREFIX}/temp1`, payload: '30' });
      receive({ topic: `${ESP32_TOPIC_PREFIX}/temp3`, payload: '32' });
    });
    act(() => vi.advanceTimersByTime(2999));
    expect(within(environment).getAllByText('Chưa có dữ liệu')).toHaveLength(4);
    act(() => vi.advanceTimersByTime(1));
    expect(within(environment).getByText('30', { selector: 'strong' })).toBeInTheDocument();
    act(() => receive({ topic: `${ESP32_TOPIC_PREFIX}/temp1`, payload: '35' }));
    expect(within(environment).queryByText('35', { selector: 'strong' })).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('switch', { name: 'Bật tắt toàn bộ Quạt gió' })));
    expect(api.post).toHaveBeenCalledWith('/barns/11/iot-events', expect.objectContaining({
      deviceType: 'FAN', mode: 'MANUAL', temperature1: 35, temperature3: 32,
    }));
    act(() => vi.advanceTimersByTime(3000));
    expect(within(environment).getByText('35', { selector: 'strong' })).toBeInTheDocument();
    api.post.mockClear();
    publishRelay.mockRejectedValueOnce(new Error('offline'));
    await act(async () => fireEvent.click(screen.getByRole('switch', { name: 'Bật tắt Hệ thống phun sương' })));
    expect(api.post).not.toHaveBeenCalled();
    api.post.mockRejectedValueOnce(new Error('database offline'));
    await act(async () => fireEvent.click(screen.getByRole('switch', { name: 'Bật tắt Hệ thống phun sương' })));
    const failedEvent = api.post.mock.calls[0][1];
    expect(failedEvent).toMatchObject({ deviceType: 'WATER', mode: 'MANUAL', temperature1: 35 });
    expect(screen.getByText(/Đã gửi lệnh bật nhưng chưa lưu được nhật ký/)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Lưu lại 1 nhật ký chưa lưu' })));
    expect(api.post.mock.calls[1][1].id).toBe(failedEvent.id);
    expect(screen.queryByRole('button', { name: 'Lưu lại 1 nhật ký chưa lưu' })).not.toBeInTheDocument();
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 16000);
    try {
      await act(async () => fireEvent.click(screen.getByRole('switch', { name: 'Bật tắt Hệ thống phun sương' })));
      expect(api.post.mock.calls.at(-1)[1]).toMatchObject({ temperature1: null, temperature3: null });
    } finally { clock.mockRestore(); }
  } finally { vi.useRealTimers(); }
});


it('shows persisted activation history with temperatures and manual or automatic mode', async () => {
  api.get.mockResolvedValueOnce({ data: { data: [{
    id: 'event-1', deviceName: 'Quạt thông gió', relay: 4, mode: 'AUTO',
    temperature1: 40, temperature3: 42, occurredAt: '2026-01-01T00:00:00Z', actor: 'owner@example.com',
  }] } });
  render(<IotEventLog barnId={11} revision={0} />);
  expect(await screen.findByText('Đã gửi lệnh bật Quạt thông gió · Relay 4')).toBeInTheDocument();
  expect(screen.getByText('40 °C')).toBeInTheDocument();
  expect(screen.getByText('42 °C')).toBeInTheDocument();
  expect(screen.getByText('41 °C')).toBeInTheDocument();
  expect(screen.getByText(/^Tự động/)).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/barns/11/iot-events', { params: { page: 0 }, skipCache: true });
});

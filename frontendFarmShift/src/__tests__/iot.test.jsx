import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
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
import { stopIotSession } from '../services/iotSession';
afterEach(() => stopIotSession());
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
  localStorage.clear();
  connectEsp32.mockResolvedValue({ disconnect: vi.fn() });
  listFarmAreas.mockResolvedValue([{ id: 1, name: 'Khu Mía' }, { id: 2, name: 'Khu Hồ' }]);
  listBarns.mockResolvedValue([{ id: 11, name: 'Chuồng A1', areaId: 1 }, { id: 12, name: 'Chuồng B1', areaId: 2 }]);
});
const open = () => render(<MemoryRouter><IotView /></MemoryRouter>);

it('pages activation history five events at a time', async () => {
  const events = Array.from({ length: 6 }, (_, id) => ({
    id, deviceName: `Quạt ${id}`, relay: 4, mode: 'MANUAL',
    occurredAt: '2026-01-01T00:00:00Z', actor: 'owner@example.com',
  }));
  api.get.mockImplementation((url, { params }) => Promise.resolve({
    data: { data: events.slice(params.page * 5, (params.page + 1) * 5) },
  }));
  render(<IotEventLog barnId={11} revision={0} />);
  await screen.findByText('Đã gửi lệnh bật Quạt 0 · Relay 4');
  expect(screen.getAllByRole('row')).toHaveLength(6);
  expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await screen.findByText('Đã gửi lệnh bật Quạt 5 · Relay 4');
  expect(screen.getAllByRole('row')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
  expect(api.get).toHaveBeenLastCalledWith('/barns/11/iot-events', { params: { page: 1 }, skipCache: true });
  fireEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
  await screen.findByText('Đã gửi lệnh bật Quạt 0 · Relay 4');
});

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
  await screen.findByText('Đã kết nối');
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

it('shows cached history without using it to trigger automatic controls', async () => {
  localStorage.setItem(`farmshift-iot-hour:${ESP32_TOPIC_PREFIX}`, JSON.stringify([
    { sensor: 'temp1', time: Date.now() - 5000, value: 45 },
    { sensor: 'temp3', time: Date.now() - 5000, value: 45 },
  ]));
  const publishRelay = vi.fn();
  connectEsp32.mockImplementation(async ({ onConnection, onMessage }) => {
    onConnection('connected');
    for (const sensor of ['temp1', 'temp3']) {
      onMessage({ topic: `${ESP32_TOPIC_PREFIX}/${sensor}`, payload: '45', retained: true });
    }
    return { disconnect: vi.fn(), publishRelay };
  });
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  try {
    render(<MemoryRouter initialEntries={['/iot?barn=11']}><IotView /></MemoryRouter>);
    await screen.findByText('Đã kết nối');
    const chart = screen.getByRole('group', { name: 'Biểu đồ nhiệt độ Chuồng A1' });
    expect(chart.querySelectorAll('circle')).toHaveLength(2);
    const group = screen.getByRole('switch', { name: 'Bật tắt toàn bộ Quạt gió' }).closest('article');
    group.querySelector('details').open = true;
    fireEvent.click(within(group).getByRole('button', { name: 'Chỉnh sửa' }));
    fireEvent.click(screen.getByLabelText('Điều khiển tự động'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thiết bị' }));
    act(() => vi.advanceTimersByTime(3000));
    expect(publishRelay).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});

it('opens only the requested barn when following the environment shortcut', async () => {
  render(<MemoryRouter initialEntries={['/iot?barn=11']}><IotView /></MemoryRouter>);
  expect(await screen.findByRole('region', { name: 'Thiết bị Chuồng A1' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Camera Chuồng A1')).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Môi trường Chuồng A1' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Camera Chuồng B1')).not.toBeInTheDocument();
  expect(screen.queryByText('Camera theo khu nuôi')).not.toBeInTheDocument();
});

it('groups database barns under their areas and filters device cards', async () => {
  open();
  const mia = await screen.findByRole('region', { name: 'Khu Mía' });
  expect(within(mia).getByRole('button', { name: 'Xem chi tiết Chuồng A1' })).toBeInTheDocument();
  expect(within(mia).queryByText('Chuồng B1')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Camera Chuồng B1')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Thiết bị IoT theo khu nuôi' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Tìm khu hoặc chuồng'), { target: { value: 'B1' } });
  expect(screen.queryByRole('button', { name: 'Xem chi tiết Chuồng A1' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xem chi tiết Chuồng B1' })).toBeInTheDocument();
});

it('keeps one connection and readings when navigating between barns', async () => {
  let receive;
  const disconnect = vi.fn();
  const publishRelay = vi.fn();
  connectEsp32.mockImplementation(async ({ onConnection, onMessage }) => {
    receive = onMessage;
    publishRelay.mockImplementation(async (relay, payload) => onMessage({ topic: relayStatusTopics[relay - 1], payload }));
    onConnection('connected');
    return { publishRelay, disconnect };
  });
  const view = open();
  fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết Chuồng A1' }));
  await screen.findByText('Đã kết nối');
  act(() => {
    receive({ topic: `${ESP32_TOPIC_PREFIX}/temp1`, payload: '30' });
    receive({ topic: `${ESP32_TOPIC_PREFIX}/temp3`, payload: '32' });
  });
  await screen.findByText('30', { selector: 'strong' }, { timeout: 4500 });
  fireEvent.click(screen.getByRole('switch', { name: 'Bật tắt toàn bộ Quạt gió' }));
  await waitFor(() => expect(publishRelay).toHaveBeenCalledWith(4, 'ON'));
  fireEvent.click(screen.getByRole('button', { name: 'Tất cả chuồng' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết Chuồng B1' }));
  expect(screen.getByText('30', { selector: 'strong' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Biểu đồ nhiệt độ Chuồng B1' }).querySelectorAll('circle')).toHaveLength(2);
  expect(screen.getByRole('switch', { name: 'Bật tắt toàn bộ Quạt gió' })).toHaveAttribute('aria-checked', 'true');
  expect(connectEsp32).toHaveBeenCalledTimes(1);
  expect(disconnect).not.toHaveBeenCalled();
  view.unmount();
  render(<MemoryRouter initialEntries={['/iot?barn=11']}><IotView /></MemoryRouter>);
  await screen.findByText('Đã kết nối');
  expect(connectEsp32).toHaveBeenCalledTimes(1);
  expect(screen.getByText('30', { selector: 'strong' })).toBeInTheDocument();
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
  fireEvent.click(within(environment).getByRole('button', { name: '1 giờ gần nhất' }));
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
  await screen.findByText('Đã kết nối');
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

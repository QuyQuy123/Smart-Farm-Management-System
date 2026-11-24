import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IotView } from '../features/farmshift/IotView';
import { listBarns, listFarmAreas } from '../services/farmAreaService';
import { connectEsp32, ESP32_TOPIC_PREFIX, relayStatusTopics, syncIotTelemetrySnapshot } from '../services/esp32MqttService';

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
  localStorage.clear();
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
  fireEvent.change(within(dialog).getByLabelText('Relay ESP32'), { target: { value: '1' } });
  fireEvent.click(within(dialog).getByLabelText('Điều khiển tự động'));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thiết bị' }));
  act(() => {
    receive({ topic: `${ESP32_TOPIC_PREFIX}/temp1`, payload: '41' });
    receive({ topic: `${ESP32_TOPIC_PREFIX}/temp3`, payload: '43' });
  });
  await waitFor(() => expect(publishRelay).toHaveBeenCalledWith(1, 'ON'));
  act(() => receive({ topic: relayStatusTopics[0], payload: 'ON' }));
  fireEvent.click(within(group).getByRole('switch', { name: 'Bật tắt Quạt gió' }));
  expect(publishRelay).toHaveBeenLastCalledWith(1, 'OFF');
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
  fireEvent.change(within(dialog).getByLabelText('Relay ESP32'), { target: { value: '2' } });
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
    expect(await within(environment).findByText(value)).toBeInTheDocument();
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

it('syncs first sensor snapshot immediately after relay status and syncs connected=false on disconnect', async () => {
  let setConn;
  let receive;
  connectEsp32.mockImplementation(async ({ onConnection, onMessage }) => {
    setConn = onConnection;
    receive = onMessage;
    onConnection('connected');
    return { disconnect: vi.fn(), publishRelay: vi.fn() };
  });
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết Chuồng A1' }));
  await screen.findByText('Đã kết nối thiết bị phần cứng');

  // Relay arrives first, then sensor reading immediately after
  act(() => {
    receive({ topic: relayStatusTopics[3], payload: 'ON' });
  });
  act(() => {
    receive({ topic: `${ESP32_TOPIC_PREFIX}/temp1`, payload: '31.5' });
    receive({ topic: `${ESP32_TOPIC_PREFIX}/humi1`, payload: '70' });
  });

  await waitFor(() => {
    expect(syncIotTelemetrySnapshot).toHaveBeenCalledWith(expect.objectContaining({
      barnId: 11,
      connected: true,
      temp1: 31.5,
      humi1: 70,
    }));
  });

  // On disconnect, backend registry must be notified connected: false
  act(() => {
    setConn('disconnected');
  });

  await waitFor(() => {
    expect(syncIotTelemetrySnapshot).toHaveBeenLastCalledWith({
      barnId: 11,
      connected: false,
      source: 'ESP32_MQTT',
    });
  });
});

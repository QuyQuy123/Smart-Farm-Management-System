import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { IotView } from '../features/farmshift/IotView';
import { listBarns, listFarmAreas } from '../services/farmAreaService';
import { connectEsp32, ESP32_TOPIC_PREFIX, relayStatusTopics } from '../services/esp32MqttService';

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
  connectEsp32.mockResolvedValue({ disconnect: vi.fn() });
  listFarmAreas.mockResolvedValue([{ id: 1, name: 'Khu Mía' }, { id: 2, name: 'Khu Hồ' }]);
  listBarns.mockResolvedValue([{ id: 11, name: 'Chuồng A1', areaId: 1 }, { id: 12, name: 'Chuồng B1', areaId: 2 }]);
});
const open = () => render(<MemoryRouter><IotView /></MemoryRouter>);

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
  expect(screen.getByRole('switch', { name: fanName })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Tất cả camera' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết Chuồng B1' }));
  await screen.findByText(/Đã kết nối MQTT/);
  expect(screen.getByRole('switch', { name: fanName })).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Thêm thiết bị' }));
  let dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText(/Tên thiết bị/), { target: { value: 'Đèn dự phòng' } });
  fireEvent.change(within(dialog).getByLabelText('Loại thiết bị'), { target: { value: 'LIGHT' } });
  fireEvent.change(within(dialog).getByLabelText('Relay ESP32'), { target: { value: '4' } });
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
  expect(publishRelay).toHaveBeenCalledWith(4, 'ON');
  expect(spareLight).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(spareLight);
  expect(publishRelay).toHaveBeenLastCalledWith(4, 'OFF');
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
  expect(screen.getByRole('switch', { name: fanName })).toBeDisabled();
});

it('reports a failed database request and retries', async () => {
  listBarns.mockRejectedValueOnce(new Error('Không thể tải chuồng'));
  open();
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByRole('button', { name: 'Xem chi tiết Chuồng A1' })).toBeInTheDocument();
});

it('shows disconnected sensor values and lets the user explore a clearly labeled example chart', async () => {
  open();
  fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết Chuồng A1' }));
  const environment = screen.getByRole('region', { name: 'Môi trường Chuồng A1' });
  expect(within(environment).getAllByText(/Nhiệt độ hiện tại/)).toHaveLength(2);
  expect(within(environment).getAllByText(/Độ ẩm hiện tại/)).toHaveLength(2);
  expect(within(environment).getAllByText('Chưa có dữ liệu')).toHaveLength(4);
  fireEvent.click(within(environment).getByRole('button', { name: 'Xem minh họa biểu đồ' }));
  expect(within(environment).getByRole('group', { name: 'Biểu đồ nhiệt độ minh họa 24 giờ của Chuồng A1' })).toBeInTheDocument();
  fireEvent.click(within(environment).getByRole('button', { name: '12:00: 29.4 °C, minh họa' }));
  expect(within(environment).getByText('12:00 · 29,4 °C (minh họa)')).toBeInTheDocument();
  fireEvent.click(within(environment).getByRole('button', { name: '7 ngày' }));
  expect(within(environment).getByRole('group', { name: 'Biểu đồ nhiệt độ minh họa 7 ngày của Chuồng A1' })).toBeInTheDocument();
  fireEvent.click(within(environment).getByRole('button', { name: 'Ẩn minh họa' }));
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
});

import { api } from '../utils/api';
export async function extractWeightSlip(file, signal) {
  const body = new FormData(); body.append('file', file);
  return (await api.post('/sales/orders/ocr', body, { signal, timeout: 110000, headers: { 'Content-Type': undefined } })).data.data;
}
export async function confirmWeightSlip(data, file) {
  const body = new FormData();
  body.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  body.append('file', file);
  return (await api.post('/sales/orders/weight-slip', body, { timeout: 110000, headers: { 'Content-Type': undefined } })).data.data;
}

export async function previewWeightSlip(file, signal) {
  const body = new FormData(); body.append('file', file);
  return (await api.post('/sales/orders/weight-slip/preview', body, { signal, timeout: 30000, headers: { 'Content-Type': undefined } })).data.data;
}

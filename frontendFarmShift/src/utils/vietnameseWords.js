// src/utils/vietnameseWords.js
// Chuyển đổi số tiền thành chữ tiếng Việt chuẩn kế toán chứng từ
const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const UNITS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

function readThreeDigits(n, readZeroHundreds = false) {
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const ones = n % 10;
  let res = '';

  if (hundreds > 0 || readZeroHundreds) {
    res += DIGITS[hundreds] + ' trăm ';
  }

  if (tens > 1) {
    res += DIGITS[tens] + ' mươi ';
    if (ones === 1) res += 'mốt ';
    else if (ones === 5) res += 'lăm ';
    else if (ones > 0) res += DIGITS[ones] + ' ';
  } else if (tens === 1) {
    res += 'mười ';
    if (ones === 5) res += 'lăm ';
    else if (ones > 0) res += DIGITS[ones] + ' ';
  } else if (tens === 0 && (hundreds > 0 || readZeroHundreds) && ones > 0) {
    res += 'lẻ ' + DIGITS[ones] + ' ';
  } else if (hundreds === 0 && !readZeroHundreds && ones > 0) {
    res += DIGITS[ones] + ' ';
  }

  return res.trim();
}

/**
 * Đọc số tiền thành chữ tiếng Việt.
 * Ví dụ: 16750000 -> "Mười sáu triệu bảy trăm năm mươi nghìn đồng chẵn."
 */
export function readMoneyToVietnameseWords(amount) {
  const n = Math.round(Number(amount) || 0);
  if (n <= 0) return 'Không đồng chẵn.';

  let num = n;
  const groups = [];
  while (num > 0) {
    groups.push(num % 1000);
    num = Math.floor(num / 1000);
  }

  let words = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g > 0) {
      const readZero = i < groups.length - 1;
      const s = readThreeDigits(g, readZero);
      words += s + ' ' + UNITS[i] + ' ';
    }
  }

  words = words.trim();
  if (!words) return 'Không đồng chẵn.';
  return words.charAt(0).toUpperCase() + words.slice(1) + ' đồng chẵn.';
}

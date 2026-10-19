package com.farmshift.backendFarmShift.service.ocr;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * High-accuracy rule-based parser for Vietnamese agricultural and commercial invoices,
 * delivery notes, and purchase vouchers processed by PaddleOCR.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PaddleInvoiceParser {

    private final ObjectMapper mapper;

    private static final List<String> COMMON_UNITS = List.of(
            "Bao (50kg)", "Bao (40kg)", "Bao (25kg)", "Bao (20kg)", "Bao (10kg)", "Bao (5kg)", "Bao",
            "Can (5 lít)", "Can (5 lit)", "Can",
            "Lọ (1000 liều)", "Lo (1000 lieu)", "Lọ", "Lo", "Chai", "Liều", "Lieu", "Gói", "Goi",
            "Kg", "Tấn", "Tan",
            "Ống", "Ong", "Con", "Thùng", "Thung", "Hộp", "Hop", "Cái", "Cai",
            "Bịch", "Bich", "Vỉ", "Vi", "Túi", "Tui", "Bình", "Binh"
    );

    private static final Pattern DATE_PATTERN_1 = Pattern.compile(
            "(?i)(?:ngày|ngay)\\s*(\\d{1,2})\\s*(?:tháng|thang|/|-|\\.)\\s*(\\d{1,2})\\s*(?:năm|nam|/|-|\\.)\\s*(\\d{4})"
    );
    private static final Pattern DATE_PATTERN_2 = Pattern.compile(
            "\\b(\\d{1,2})[/\\-\\.](\\d{1,2})[/\\-\\.](\\d{4})\\b"
    );

    private static final Pattern TAX_CODE_PATTERN = Pattern.compile(
            "(?i)(?:mã số thuế|ma so thue|mst|m\\.s\\.t|tax code|số thuế|so thue)[:\\s]*([0-9]{10}(?:-[0-9]{3})?)"
    );

    private static final Pattern STANDALONE_TAX_CODE = Pattern.compile(
            "\\b([0-9]{10}(?:-[0-9]{3})?)\\b"
    );

    private static final Pattern SERIAL_PATTERN = Pattern.compile(
            "(?i)(?:ký hiệu|ky hieu|kh|mẫu số|mau so|mẫu|mau|serial|series)[:\\s]*([A-Z0-9/\\-]+)"
    );

    private static final Pattern INVOICE_NO_PATTERN = Pattern.compile(
            "(?i)(?:(?:số|so)\\s*(?:hóa đơn|hoa don|hđ|hd|phiếu|phieu|ct|chứng từ|chung tu)?|(?:số|so)\\s*:\\s*|no\\.?|inv(?:oice)?(?:\\s*no)?)[:\\s]*([A-Z0-9/\\-]+)"
    );

    public JsonNode parse(PaddleOcrEngine.OcrDocumentResult ocrResult) {
        String fullText = ocrResult.fullText();
        List<PaddleOcrEngine.RecognizedBlock> blocks = ocrResult.blocks();

        // 1. Assemble visual lines using spatial block coordinates (crucial for OCR tables)
        List<String> visualLines = assembleVisualLines(blocks);
        List<String> rawLines = new ArrayList<>(visualLines);

        // Also add fullText individual lines as supplementary fallback
        if (fullText != null) {
            for (String l : fullText.split("\\r?\\n")) {
                String trimmed = l.strip();
                if (!trimmed.isEmpty() && !rawLines.contains(trimmed)) {
                    rawLines.add(trimmed);
                }
            }
        }
        if (rawLines.isEmpty() && blocks != null) {
            for (var b : blocks) {
                if (b.text() != null && !b.text().isBlank()) {
                    rawLines.add(b.text().strip());
                }
            }
        }

        boolean isInvoice = checkIsInvoice(fullText, rawLines);
        String supplierName = extractSupplierName(rawLines);
        String taxCode = extractTaxCode(rawLines, fullText);
        String referenceCode = extractReferenceCode(rawLines);
        String invoiceDate = extractInvoiceDate(rawLines);

        List<ParsedItem> items = extractItems(!visualLines.isEmpty() ? visualLines : rawLines);
        if (items.isEmpty() && !visualLines.isEmpty()) {
            items = extractItems(rawLines);
        }
        Totals totals = extractTotals(!visualLines.isEmpty() ? visualLines : rawLines, items);

        List<String> warnings = new ArrayList<>();
        long calculatedItemsTotal = items.stream().mapToLong(it -> Math.round(it.qty * it.unitPrice)).sum();
        long netCalculatedTotal = Math.max(0L, calculatedItemsTotal - totals.discountAmount + totals.otherCost + totals.vatAmount);
        long finalTotal = totals.totalAmount > 0 ? totals.totalAmount : netCalculatedTotal;

        if (totals.totalAmount > 0 && calculatedItemsTotal > 0 && Math.abs(totals.totalAmount - netCalculatedTotal) > 1000) {
            warnings.add(String.format(Locale.ROOT,
                    "Tổng tiền trên chứng từ (%,d đ) chưa khớp với tổng chi tiết hàng hóa (%,d đ).",
                    totals.totalAmount, netCalculatedTotal).replace(',', '.'));
        }

        double confidence = calculateConfidence(ocrResult.averageScore(), isInvoice, supplierName, taxCode, items, totals);

        // Build Jackson JsonNode
        ObjectNode root = mapper.createObjectNode();
        root.put("isInvoice", isInvoice);
        if (supplierName != null) root.put("supplierName", supplierName);
        else root.putNull("supplierName");

        if (taxCode != null) root.put("supplierTaxCode", taxCode);
        else root.putNull("supplierTaxCode");

        if (invoiceDate != null) root.put("invoiceDate", invoiceDate);
        else root.putNull("invoiceDate");

        if (referenceCode != null) root.put("referenceCode", referenceCode);
        else root.putNull("referenceCode");

        ArrayNode itemsArray = root.putArray("items");
        for (ParsedItem item : items) {
            ObjectNode itemNode = itemsArray.addObject();
            itemNode.put("name", item.name);
            itemNode.put("qty", item.qty);
            itemNode.put("unit", item.unit);
            itemNode.put("unitPrice", item.unitPrice);
            itemNode.put("amount", item.amount);
            if (item.vatRate != null) itemNode.put("vatRate", item.vatRate);
            else itemNode.putNull("vatRate");
        }

        root.put("discountAmount", totals.discountAmount);
        root.put("vatAmount", totals.vatAmount);
        root.put("otherCost", totals.otherCost);
        root.put("totalAmount", finalTotal);
        root.put("confidence", confidence);

        ArrayNode warningsArray = root.putArray("warnings");
        for (String w : warnings) {
            warningsArray.add(w);
        }

        return root;
    }

    private boolean checkIsInvoice(String fullText, List<String> lines) {
        if (fullText == null || fullText.isBlank()) return false;
        String lower = normalize(fullText);
        String[] keywords = {
                "hoa don", "phieu xuat", "phieu giao", "phieu nhap", "bien nhan",
                "chung tu", "ban hang", "gtgt", "vat", "thanh tien", "tong cong",
                "cong ty", "don vi ban", "mst", "ma so thue", "so luong", "don gia"
        };
        for (String kw : keywords) {
            if (lower.contains(kw)) return true;
        }
        return false;
    }

    private String extractSupplierName(List<String> lines) {
        // Pass 1: Look for explicit seller label
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            String norm = normalize(line);
            if (norm.contains("don vi ban") || norm.contains("nguoi ban") || norm.contains("ben ban") ||
                norm.contains("cua hang") || norm.contains("nha cung cap")) {
                if (norm.contains("nguoi mua") || norm.contains("don vi mua") || norm.contains("ben mua")) {
                    continue;
                }
                int colonIdx = line.indexOf(':');
                if (colonIdx >= 0 && colonIdx < line.length() - 2) {
                    String after = cleanSupplierName(line.substring(colonIdx + 1));
                    if (after.length() >= 4) return after;
                }
                if (i + 1 < lines.size()) {
                    String next = cleanSupplierName(lines.get(i + 1));
                    if (next.length() >= 4 && !isLabelLine(next)) return next;
                }
            }
        }

        // Pass 2: Look for prominent company name in top 40% of lines
        int searchLimit = Math.min(lines.size(), 12);
        for (int i = 0; i < searchLimit; i++) {
            String line = lines.get(i);
            String norm = normalize(line);
            if ((norm.startsWith("cong ty") || norm.startsWith("cty") || norm.startsWith("htx") ||
                 norm.startsWith("hop tac xa") || norm.startsWith("doanh nghiep") || norm.startsWith("trang trai") ||
                 norm.contains("cp chan nuoi") || norm.contains("viet nam"))
                && !norm.contains("nguoi mua") && !norm.contains("khach hang") && !norm.contains("don vi mua")) {
                int colonIdx = line.indexOf(':');
                String candidate = colonIdx >= 0 ? line.substring(colonIdx + 1) : line;
                String cleaned = cleanSupplierName(candidate);
                if (cleaned.length() >= 4) return cleaned;
            }
        }
        return null;
    }

    private String cleanSupplierName(String raw) {
        String s = raw.strip();
        // Remove trailing labels like "Mã số thuế:", "MST:", "Địa chỉ:"
        int stopIdx = -1;
        String norm = normalize(s);
        String[] stopWords = {"ma so thue", "mst", "dia chi", "tel", "dien thoai", "dt"};
        for (String sw : stopWords) {
            int idx = norm.indexOf(sw);
            if (idx > 0) {
                if (stopIdx == -1 || idx < stopIdx) stopIdx = idx;
            }
        }
        if (stopIdx > 0) {
            s = s.substring(0, stopIdx).strip();
        }
        return s.replaceAll("^[\\-\\:\\s]+", "").replaceAll("[\\-\\:\\s]+$", "");
    }

    private boolean isLabelLine(String text) {
        String norm = normalize(text);
        return norm.startsWith("ma so thue") || norm.startsWith("mst") ||
               norm.startsWith("dia chi") || norm.startsWith("dien thoai") ||
               norm.startsWith("so tai khoan");
    }

    private String extractTaxCode(List<String> lines, String fullText) {
        for (String line : lines) {
            Matcher m = TAX_CODE_PATTERN.matcher(line);
            if (m.find()) {
                return m.group(1).strip();
            }
        }
        // Fallback: search lines containing "thuế" or "mst" for 10-13 digit numbers
        for (String line : lines) {
            String norm = normalize(line);
            if (norm.contains("thue") || norm.contains("mst")) {
                Matcher m = STANDALONE_TAX_CODE.matcher(line);
                if (m.find()) {
                    return m.group(1).strip();
                }
            }
        }
        return null;
    }

    private String extractReferenceCode(List<String> lines) {
        String serial = null;
        String no = null;

        for (String line : lines) {
            if (serial == null) {
                Matcher sm = SERIAL_PATTERN.matcher(line);
                if (sm.find()) {
                    serial = sm.group(1).strip();
                }
            }
            if (no == null) {
                Matcher nm = INVOICE_NO_PATTERN.matcher(line);
                if (nm.find()) {
                    String found = nm.group(1).strip();
                    if (!found.equalsIgnoreCase(serial) && found.matches(".*\\d.*")) {
                        no = found;
                    }
                }
            }
        }

        if (serial != null && no != null) {
            return serial + "-" + no;
        }
        if (no != null) return no;
        if (serial != null) return serial;
        return null;
    }

    private String extractInvoiceDate(List<String> lines) {
        for (String line : lines) {
            Matcher m1 = DATE_PATTERN_1.matcher(line);
            if (m1.find()) {
                try {
                    int day = Integer.parseInt(m1.group(1));
                    int month = Integer.parseInt(m1.group(2));
                    int year = Integer.parseInt(m1.group(3));
                    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
                        return String.format(Locale.ROOT, "%04d-%02d-%02d", year, month, day);
                    }
                } catch (Exception ignored) {}
            }

            Matcher m2 = DATE_PATTERN_2.matcher(line);
            if (m2.find()) {
                try {
                    int day = Integer.parseInt(m2.group(1));
                    int month = Integer.parseInt(m2.group(2));
                    int year = Integer.parseInt(m2.group(3));
                    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
                        return String.format(Locale.ROOT, "%04d-%02d-%02d", year, month, day);
                    }
                } catch (Exception ignored) {}
            }
        }
        return null;
    }

    record ParsedItem(
            String name,
            double qty,
            String unit,
            double unitPrice,
            double amount,
            Double vatRate
    ) {}

    private record UnitMatch(String unit, int start, int end) {}

    private UnitMatch findUnitInLine(String line) {
        if (line == null || line.isBlank()) return null;
        for (String u : COMMON_UNITS) {
            Pattern p = Pattern.compile("(?i)(?<![a-zA-Z0-9])" + Pattern.quote(u) + "(?![a-zA-Z0-9])");
            Matcher m = p.matcher(line);
            if (m.find()) {
                return new UnitMatch(u, m.start(), m.end());
            }
        }
        return null;
    }

    private boolean isTableHeader(String norm) {
        return (norm.contains("ten hang") || norm.contains("mat hang") || norm.contains("san pham") || norm.contains("noi dung"))
            && (norm.contains("so luong") || norm.contains("dvt") || norm.contains("don gia") || norm.contains("thanh tien") || norm.contains("stt"));
    }

    private boolean isTableEnd(String norm) {
        return norm.startsWith("cong tien hang") || norm.startsWith("tong cong") ||
               norm.startsWith("tong tien") || norm.startsWith("tien thue") ||
               norm.startsWith("chiet khau") || norm.startsWith("so tien viet bang chu") ||
               norm.startsWith("nguoi mua") || norm.startsWith("nguoi ban");
    }

    private List<ParsedItem> extractItems(List<String> lines) {
        List<ParsedItem> items = new ArrayList<>();
        boolean inTable = false;

        for (String line : lines) {
            String norm = normalize(line);

            if (!inTable) {
                if (isTableHeader(norm)) {
                    inTable = true;
                }
            } else {
                if (isTableEnd(norm)) {
                    break;
                }
                ParsedItem item = tryParseItemLine(line);
                if (item != null) {
                    items.add(item);
                }
            }
        }

        // If table header parsing didn't find items, fallback to scanning for item lines
        if (items.isEmpty()) {
            for (String line : lines) {
                String norm = normalize(line);
                if (isTableHeader(norm) || isTableEnd(norm)) continue;
                ParsedItem item = tryParseItemLine(line);
                if (item != null) items.add(item);
            }
        }

        return items;
    }

    /**
     * Assembles visual lines from 2D OCR blocks by clustering blocks that share the same
     * horizontal band (Y overlap), and sorting each clustered line left-to-right (X coordinate).
     */
    private List<String> assembleVisualLines(List<PaddleOcrEngine.RecognizedBlock> blocks) {
        if (blocks == null || blocks.isEmpty()) return Collections.emptyList();

        List<PaddleOcrEngine.RecognizedBlock> sorted = new ArrayList<>(blocks);
        sorted.sort(Comparator.comparingInt(PaddleOcrEngine.RecognizedBlock::y)
                .thenComparingInt(PaddleOcrEngine.RecognizedBlock::x));

        List<List<PaddleOcrEngine.RecognizedBlock>> rowClusters = new ArrayList<>();

        for (var block : sorted) {
            if (block.text() == null || block.text().isBlank()) continue;

            int blockY = block.y();
            int blockH = Math.max(block.height(), 14);
            int blockCenterY = blockY + blockH / 2;

            boolean added = false;
            for (var cluster : rowClusters) {
                int clusterMinY = cluster.stream().mapToInt(PaddleOcrEngine.RecognizedBlock::y).min().orElse(blockY);
                int clusterMaxY = cluster.stream().mapToInt(b -> b.y() + b.height()).max().orElse(blockY + blockH);
                int clusterAvgH = (int) cluster.stream().mapToInt(PaddleOcrEngine.RecognizedBlock::height).average().orElse(blockH);
                int clusterCenterY = clusterMinY + (clusterMaxY - clusterMinY) / 2;

                int tolerance = Math.max(14, (int) (clusterAvgH * 0.65));

                if (Math.abs(blockCenterY - clusterCenterY) <= tolerance ||
                    (blockY >= clusterMinY - tolerance && blockY + blockH <= clusterMaxY + tolerance)) {
                    cluster.add(block);
                    added = true;
                    break;
                }
            }

            if (!added) {
                List<PaddleOcrEngine.RecognizedBlock> newCluster = new ArrayList<>();
                newCluster.add(block);
                rowClusters.add(newCluster);
            }
        }

        // Sort clusters from top to bottom
        rowClusters.sort(Comparator.comparingInt(c -> c.stream().mapToInt(PaddleOcrEngine.RecognizedBlock::y).min().orElse(0)));

        // Within each cluster, sort blocks left-to-right (by x) and join with space
        List<String> assembledLines = new ArrayList<>();
        for (var cluster : rowClusters) {
            cluster.sort(Comparator.comparingInt(PaddleOcrEngine.RecognizedBlock::x));
            StringBuilder lineBuilder = new StringBuilder();
            for (var b : cluster) {
                if (!lineBuilder.isEmpty()) lineBuilder.append(" ");
                lineBuilder.append(b.text().strip());
            }
            String line = lineBuilder.toString().strip();
            if (!line.isEmpty()) {
                assembledLines.add(line);
            }
        }

        return assembledLines;
    }

    private ParsedItem tryParseItemLine(String line) {
        if (line == null || line.isBlank()) return null;

        // Clean spaces around decimal and thousand dots/commas
        String cleanLine = line.replaceAll("(?<=\\d)\\s*\\.\\s*(?=\\d)", ".")
                               .replaceAll("(?<=\\d)\\s*,\\s*(?=\\d)", ",");
        String norm = normalize(cleanLine);

        // Exclude header or footer / summary / party meta lines
        if (norm.startsWith("tong cong") || norm.startsWith("tong tien") || norm.startsWith("cong tien hang") ||
            norm.startsWith("tien thue") || norm.startsWith("thue gtgt") || norm.startsWith("chiet khau") ||
            norm.startsWith("don vi ban") || norm.startsWith("don vi mua") || norm.startsWith("ma so thue") ||
            norm.startsWith("dia chi") || norm.startsWith("dien thoai") || norm.startsWith("fax") ||
            norm.startsWith("so tai khoan") || norm.startsWith("tai khoan") || norm.startsWith("hinh thuc") ||
            norm.startsWith("ngay ") || norm.startsWith("ngay:") || norm.startsWith("stt ") || norm.equals("stt") ||
            norm.startsWith("ten hang") || norm.contains("so tien viet bang chu") ||
            norm.contains("nguoi mua") || norm.contains("nguoi ban") || norm.startsWith("chi nhanh") ||
            norm.startsWith("mau so") || norm.startsWith("ky hieu") || norm.startsWith("so hd") || norm.startsWith("so:")) {
            return null;
        }

        UnitMatch unitMatch = findUnitInLine(cleanLine);
        List<NumberMatch> numbers = extractNumbers(cleanLine);
        if (numbers.isEmpty()) return null;

        // Case 1: Unit was detected with word boundary
        if (unitMatch != null) {
            String matchedUnit = unitMatch.unit();
            int unitStart = unitMatch.start();
            int unitEnd = unitMatch.end();

            List<NumberMatch> postNums = new ArrayList<>();
            for (var nm : numbers) {
                if (nm.startIndex >= unitEnd) {
                    postNums.add(nm);
                }
            }

            List<NumberMatch> preNums = new ArrayList<>();
            for (var nm : numbers) {
                if (nm.endIndex <= unitStart) {
                    preNums.add(nm);
                }
            }

            // Case 1A: Unit before Qty (Format A: Name ... Unit ... Qty ... Price ... Amount)
            // e.g. "1 Cam Ga um Higro 01 Bao (25kg) 50 345.000 17.250.000"
            if (postNums.size() >= 3) {
                String namePart = cleanLine.substring(0, unitStart).strip();
                namePart = stripItemLeadingIndex(namePart);
                if (namePart.length() >= 2) {
                    double qty = postNums.get(0).value;
                    double price = postNums.get(1).value;
                    double amount = postNums.get(2).value;
                    if (qty <= 0) qty = 1.0;
                    if (price <= 0 && amount > 0) price = amount / qty;
                    return new ParsedItem(namePart, qty, matchedUnit, price, amount, null);
                }
            }

            // Case 1B: Qty before Unit (Format B: Name ... Qty ... Unit ... Price ... Amount)
            // e.g. "1. Cam Ga thit Higro 02 50 Bao (25kg) 335.000 16.750.000"
            if (postNums.size() == 2 && !preNums.isEmpty()) {
                NumberMatch qtyMatch = preNums.get(preNums.size() - 1);
                double qty = qtyMatch.value;
                double price = postNums.get(0).value;
                double amount = postNums.get(1).value;

                String namePart = cleanLine.substring(0, qtyMatch.startIndex).strip();
                namePart = stripItemLeadingIndex(namePart);
                if (namePart.length() >= 2) {
                    if (qty <= 0) qty = 1.0;
                    if (price <= 0 && amount > 0) price = amount / qty;
                    return new ParsedItem(namePart, qty, matchedUnit, price, amount, null);
                }
            }

            // Case 1C: Exactly 2 numbers after unit and no preNums qty (Qty defaults to 1.0)
            if (postNums.size() == 2 && preNums.isEmpty()) {
                String namePart = cleanLine.substring(0, unitStart).strip();
                namePart = stripItemLeadingIndex(namePart);
                if (namePart.length() >= 2) {
                    double qty = 1.0;
                    double price = postNums.get(0).value;
                    double amount = postNums.get(1).value;
                    return new ParsedItem(namePart, qty, matchedUnit, price, amount, null);
                }
            }

            // Case 1D: Exactly 1 number after unit (Price = Amount, Qty from preNums or 1.0)
            if (postNums.size() == 1) {
                double qty = !preNums.isEmpty() ? preNums.get(preNums.size() - 1).value : 1.0;
                int nameEnd = !preNums.isEmpty() ? preNums.get(preNums.size() - 1).startIndex : unitStart;
                String namePart = cleanLine.substring(0, nameEnd).strip();
                namePart = stripItemLeadingIndex(namePart);
                double price = postNums.get(0).value;
                double amount = qty * price;
                if (namePart.length() >= 2) {
                    return new ParsedItem(namePart, qty, matchedUnit, price, amount, null);
                }
            }
        }

        // Case 2: No unit detected or numbers fallback
        if (numbers.size() >= 2) {
            NumberMatch lastNum = numbers.get(numbers.size() - 1);
            NumberMatch prevNum = numbers.get(numbers.size() - 2);

            double qty = 1.0;
            double price = prevNum.value;
            double amount = lastNum.value;
            int nameEndIndex = prevNum.startIndex;

            if (numbers.size() >= 3) {
                NumberMatch qtyNum = numbers.get(numbers.size() - 3);
                if (qtyNum.value > 0 && qtyNum.value <= 100000) {
                    qty = qtyNum.value;
                    nameEndIndex = qtyNum.startIndex;
                }
            }

            String namePart = cleanLine.substring(0, nameEndIndex).strip();
            namePart = stripItemLeadingIndex(namePart);
            if (namePart.length() >= 2) {
                return new ParsedItem(namePart, qty, "Cái", price, amount, null);
            }
        }

        return null;
    }

    private String stripItemLeadingIndex(String text) {
        return text.replaceAll("^\\s*\\d{1,2}[\\.\\)\\-\\s]+", "").strip();
    }

    record NumberMatch(double value, int startIndex, int endIndex) {}

    private List<NumberMatch> extractNumbers(String text) {
        List<NumberMatch> res = new ArrayList<>();
        if (text == null || text.isBlank()) return res;

        // Clean spaces around dots and commas in numbers: e.g. "20. 000. 000" -> "20.000.000"
        String cleaned = text.replaceAll("(?<=\\d)\\s*\\.\\s*(?=\\d)", ".")
                             .replaceAll("(?<=\\d)\\s*,\\s*(?=\\d)", ",");

        Pattern p = Pattern.compile("(?<![a-zA-Z0-9])([0-9]{1,3}(?:\\.[0-9]{3})+(?:,[0-9]+)?|[0-9]+(?:,[0-9]+)?|[0-9]+)(?![a-zA-Z0-9])");
        Matcher m = p.matcher(cleaned);
        while (m.find()) {
            String raw = m.group(1);
            try {
                // Vietnamese number: '.' is thousand separator, ',' is decimal separator
                String clean = raw.replace(".", "").replace(',', '.');
                double val = Double.parseDouble(clean);
                res.add(new NumberMatch(val, m.start(), m.end()));
            } catch (Exception ignored) {}
        }
        return res;
    }

    record Totals(long totalAmount, long vatAmount, long discountAmount, long otherCost) {}

    private Totals extractTotals(List<String> lines, List<ParsedItem> items) {
        long totalAmount = 0L;
        long vatAmount = 0L;
        long discountAmount = 0L;
        long otherCost = 0L;

        for (String line : lines) {
            String norm = normalize(line);
            List<NumberMatch> nums = extractNumbers(line);
            if (nums.isEmpty()) continue;
            long val = Math.round(nums.get(nums.size() - 1).value);

            if (norm.contains("tong cong tien thanh toan") || norm.contains("tong tien thanh toan") ||
                norm.contains("tong cong thanh toan") || norm.contains("tong thanh toan") ||
                norm.contains("thanh tien thanh toan") ||
                (norm.startsWith("tong cong") && !norm.contains("so luong"))) {
                if (val > totalAmount) totalAmount = val;
            } else if (norm.contains("thue gtgt") || norm.contains("tien thue")) {
                if (val > vatAmount) vatAmount = val;
            } else if (norm.contains("chiet khau") || norm.contains("giam gia")) {
                if (val > discountAmount) discountAmount = val;
            } else if (norm.contains("phi van chuyen") || norm.contains("cuoc van chuyen") || norm.contains("chi phi khac") || norm.contains("van chuyen")) {
                if (val > otherCost) otherCost = val;
            }
        }

        // If totalAmount was not found explicitly, sum item amounts
        if (totalAmount <= 0) {
            long itemsSum = items.stream().mapToLong(it -> Math.round(it.qty * it.unitPrice)).sum();
            totalAmount = itemsSum + vatAmount + otherCost - discountAmount;
        }

        return new Totals(totalAmount, vatAmount, discountAmount, otherCost);
    }

    private double calculateConfidence(double ocrScore, boolean isInvoice, String supplier, String taxCode, List<ParsedItem> items, Totals totals) {
        if (!isInvoice) return 10.0;
        double base = ocrScore > 0 ? ocrScore * 100 : 75.0;
        if (supplier != null) base += 5.0;
        if (taxCode != null) base += 5.0;
        if (!items.isEmpty()) base += 10.0;
        if (totals.totalAmount > 0) base += 5.0;
        return Math.min(99.0, Math.max(50.0, Math.round(base * 10) / 10.0));
    }

    private static int indexOfIgnoreCase(String source, String target) {
        String s = normalize(source);
        String t = normalize(target);
        return s.indexOf(t);
    }

    private static String normalize(String value) {
        if (value == null) return "";
        String noAccent = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd')
                .replace('Đ', 'D');
        return noAccent.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .strip();
    }
}

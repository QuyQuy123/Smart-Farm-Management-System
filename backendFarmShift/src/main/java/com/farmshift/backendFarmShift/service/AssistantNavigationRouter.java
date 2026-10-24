package com.farmshift.backendFarmShift.service;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Bộ định tuyến màn hình cho Trợ lý AI (Navigation Router).
 *
 * <p>Thay thế chuỗi {@code if / else if contains(...)} cũ vốn dễ nhầm (ví dụ "mở ghi nhật ký" chứa chuỗi con
 * "nha" trong "nh<b>a</b>t" nên bị chuyển nhầm sang {@code /barns}). Nguyên tắc:
 * <ol>
 *   <li>Khớp theo <b>ranh giới từ</b> (không khớp chuỗi con trong từ khác).</li>
 *   <li>Mỗi màn hình có nhiều cụm từ; cụm <b>dài / nhiều từ hơn được ưu tiên</b> (longest-phrase-wins).</li>
 *   <li>Từ khóa chung chung ("nhà", "chuồng", "kho") chỉ là cụm yếu, luôn thua cụm cụ thể.</li>
 *   <li>Không bao giờ fallback về {@code /barns} nếu không có cụm nào khớp — trả về {@code null}.</li>
 * </ol>
 * Tất cả đầu vào là văn bản đã bỏ dấu, chữ thường (xem {@link VietnameseSpeechNormalizer#removeVietnameseDiacritics}).
 */
public final class AssistantNavigationRouter {

    public record Route(String path, String label) {
    }

    private record Entry(String path, String label, List<String> phrases) {
    }

    /** Thứ tự chỉ dùng để phá hòa điểm. */
    private static final List<Entry> ENTRIES = List.of(
            new Entry("/dashboard", "Bảng tin", List.of(
                    "bang tin", "dashboard", "trang chu", "tong quan", "man hinh chinh")),
            new Entry("/journal", "Ghi nhật ký chăn nuôi", List.of(
                    "ghi nhat ky", "nhat ky", "nhat ky cham soc", "nhat ky chan nuoi", "nhat ky cho an",
                    "nhat ky can mau", "nhat ky hao hut", "nhat ky vac xin", "ghi cam", "ghi can mau", "ghi hao hut",
                    "so nhat ky", "nhat ki")),
            new Entry("/today-tasks", "Việc hôm nay", List.of(
                    "viec hom nay", "cong viec hom nay", "cong viec", "nhiem vu hom nay", "danh sach viec")),
            new Entry("/barns", "Khu nuôi & Chuồng trại", List.of(
                    "khu nuoi chuong trai", "khu nuoi", "chuong trai", "danh sach chuong", "quan ly chuong",
                    "chuong nuoi", "danh sach nha", "khu vuc nuoi", "khu vuc", "chuong", "nha")),
            new Entry("/inventory", "Kho hàng hóa", List.of(
                    "kho hang hoa", "kho hang", "hang hoa", "kho vat tu", "kho thuoc", "kho cam", "vat tu", "kho")),
            new Entry("/transfers", "Xuất nhập nội bộ", List.of(
                    "xuat nhap noi bo", "xuat nhap kho", "xuat nhap", "chuyen kho", "dieu chuyen kho",
                    "xuat kho noi bo", "noi bo")),
            new Entry("/purchases", "Hóa đơn nhập hàng", List.of(
                    "hoa don nhap hang", "hoa don nhap", "don nhap hang", "hoa don mua hang", "hoa don",
                    "nhap hang", "mua hang", "nha cung cap", "cong no nha cung cap")),
            new Entry("/sales", "Quản lý bán hàng", List.of(
                    "quan ly ban hang", "ban hang", "xuat ban", "phieu xuat ban", "doanh thu ban hang")),
            new Entry("/cashbook", "Sổ quỹ & Dòng tiền", List.of(
                    "so quy dong tien", "so quy", "dong tien", "thu chi", "so thu chi", "quy tien")),
            new Entry("/account", "Tài khoản & Nhân sự", List.of(
                    "tai khoan nhan su", "tai khoan", "nhan su", "nhan vien", "ho so ca nhan", "ho so")),
            new Entry("/reports", "Báo cáo & Thống kê", List.of(
                    "bao cao thong ke", "bao cao", "thong ke")),
            new Entry("/catalog-settings", "Thiết lập danh mục", List.of(
                    "thiet lap danh muc", "cai dat danh muc", "danh muc hang hoa", "danh muc", "catalog")),
            new Entry("/breeding-settings", "Thiết lập chăn nuôi", List.of(
                    "thiet lap chan nuoi", "cai dat chan nuoi", "chuong trinh nuoi", "quy trinh nuoi",
                    "chi tieu tang truong", "loai thu hoach")),
            new Entry("/general-settings", "Thiết lập chung", List.of(
                    "thiet lap chung", "cai dat chung", "cai dat he thong", "cai dat", "thiet lap", "thong bao"))
    );

    /** Động từ mở đầu câu lệnh điều hướng (đã bỏ dấu). */
    private static final Pattern NAV_VERB = Pattern.compile(
            "^(?:mo ra|mo giup|mo|chuyen sang|chuyen den|chuyen toi|chuyen qua|di toi|di den|di sang|den|vao xem|vao|xem|"
                    + "truy cap|hien thi|quay lai|quay ve|ve|dua toi|dua den|nhay sang|nhay den|cho xem|go to|open)\\b\\s*(.*)$");

    private static final Pattern FILLER_PREFIX = Pattern.compile(
            "^(?:(?:xin|vui long|hay|oi|nay|ban oi|giup toi|giup minh|giup|cho toi|cho minh|toi muon|minh muon|toi can|toi)\\s+)+");

    private static final Pattern FILLER_SUFFIX = Pattern.compile(
            "(?:\\s+(?:giup toi|giup minh|giup|cho toi|di|nhe|ngay|luon|ra|len|di nao))+$");

    /** Các cụm cho thấy đây là truy vấn / thao tác dữ liệu, không phải điều hướng thuần. */
    private static final List<String> NON_NAVIGATION_SIGNALS = List.of(
            "ton kho", "tinh trang", "cong no", "con bao nhieu", "bao nhieu", "nhiet do",
            "kho tho", "kho khe", "phan sap", "phan trang", "cau trung", "ngap",
            "sua ", "doi ", "cap nhat", "thanh toan", "tra no", "huy ", "xoa ", "tao ", "them ",
            "chuyen dan", "tach dan", "nhap kho", "xac nhan", "hoan thanh", "xong viec");

    private AssistantNavigationRouter() {
    }

    /**
     * Phân giải màn hình đích từ câu lệnh. Trả về {@code null} nếu không phải lệnh điều hướng rõ ràng.
     *
     * @param norm câu lệnh đã bỏ dấu, chữ thường
     */
    public static Route resolve(String norm) {
        if (norm == null || norm.isBlank()) return null;
        String text = norm.trim().replaceAll("\\s+", " ");
        if (hasNonNavigationSignal(text)) return null;

        String body = extractNavigationBody(text);
        if (body == null) return null;
        return bestMatch(body);
    }

    /** Dùng cho handler cũ (đã xác định đang ở nhánh điều hướng) — bỏ qua kiểm tra động từ. */
    public static Route resolveTarget(String norm) {
        if (norm == null || norm.isBlank()) return null;
        String text = norm.trim().replaceAll("\\s+", " ");
        String stripped = stripFillers(text);
        var m = NAV_VERB.matcher(stripped);
        return bestMatch(m.matches() ? m.group(1) : stripped);
    }

    // ───────────────────────────── nội bộ ─────────────────────────────

    private static boolean hasNonNavigationSignal(String text) {
        String padded = text + " ";
        for (String s : NON_NAVIGATION_SIGNALS) {
            if (padded.contains(s)) return true;
        }
        return false;
    }

    /**
     * @return phần nội dung sau động từ điều hướng; hoặc toàn bộ câu nếu câu chính là tên màn hình;
     * {@code null} nếu không phải lệnh điều hướng.
     */
    private static String extractNavigationBody(String text) {
        String stripped = stripFillers(text);
        var verb = NAV_VERB.matcher(stripped);
        if (verb.matches()) {
            String rest = verb.group(1).replaceFirst("^(?:man hinh|trang|muc|tab)\\s+", "").trim();
            return rest.isEmpty() ? null : rest;
        }
        if (stripped.matches("^(?:man hinh|trang)\\s+.+")) {
            return stripped.replaceFirst("^(?:man hinh|trang)\\s+", "");
        }
        // Câu chỉ gồm tên màn hình, ví dụ "ghi nhật ký", "sổ quỹ".
        if (isExactScreenName(stripped)) return stripped;
        return null;
    }

    private static String stripFillers(String text) {
        String s = FILLER_PREFIX.matcher(text).replaceFirst("");
        s = FILLER_SUFFIX.matcher(s).replaceFirst("");
        return s.trim();
    }

    private static boolean isExactScreenName(String text) {
        for (Entry e : ENTRIES) {
            for (String p : e.phrases()) {
                if (p.equals(text)) return true;
            }
        }
        return false;
    }

    private static Route bestMatch(String body) {
        String padded = " " + body + " ";
        Entry best = null;
        int bestScore = 0;
        for (Entry e : ENTRIES) {
            for (String phrase : e.phrases()) {
                if (!padded.contains(" " + phrase + " ")) continue;
                int words = phrase.split(" ").length;
                int score = words * 100 + phrase.length();
                if (score > bestScore) {
                    bestScore = score;
                    best = e;
                }
            }
        }
        return best == null ? null : new Route(best.path(), best.label());
    }
}

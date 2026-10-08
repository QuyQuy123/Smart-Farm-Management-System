# BẢNG ĐẶC TẢ THÔNG ĐIỆP HỆ THỐNG (SYSTEM MESSAGES SPECIFICATION) - FARMSHIFT

> **Dự án**: Nền tảng Quản lý Trang trại Chăn nuôi Thông minh FarmShift (Smart Farm Management System)  
> **Phiên bản tài liệu**: 2.0 (Đã tinh chỉnh, chuẩn hóa song ngữ và áp dụng đồng bộ vào mã nguồn dự án)  
> **Ngôn ngữ mặc định hệ thống**: Tiếng Việt (Bản địa hóa hoàn toàn) & Tiếng Anh (Chuẩn mã gốc)

---

## 1. PHÂN LOẠI HÌNH THỨC HIỂN THỊ (MESSAGE TYPES)

Hệ thống quy định 6 hình thức hiển thị thông điệp nhằm tối ưu trải nghiệm người dùng:

1. **In line / Empty state**: Hiển thị trực tiếp trong dòng dữ liệu bảng (`DataTable`), dưới ô tìm kiếm hoặc trạng thái trống khi không có bản ghi phù hợp.
2. **In red, under the text box**: Báo lỗi kiểm tra hợp lệ dữ liệu (Form validation error) hiển thị dòng chữ màu đỏ (`color: #e11d48`) ngay phía dưới ô nhập liệu tương ứng.
3. **Toast message**: Thông báo dạng thanh nổi (Toast Notification) xuất hiện ở góc trên bên phải màn hình trong 4.5 giây (Màu xanh: Thành công, Màu đỏ: Lỗi, Màu vàng: Cảnh báo).
4. **Warning banner / Advisory banner / Information banner**: Thanh thông báo nổi bật nằm đầu trang hoặc chân khung chức năng để cảnh báo rủi ro vận hành (IoT mất kết nối, AI OCR nháp, Khuyến cáo thú y AI, Khung giờ yên tĩnh).
5. **Confirmation dialog**: Hộp thoại chặn yêu cầu người dùng xác nhận dứt khoát trước khi thực hiện hành động ảnh hưởng dữ liệu hoặc giao dịch quan trọng.
6. **Critical alert / Push notification**: Cảnh báo khẩn cấp mức độ cao nhất kèm âm thanh/còi báo động khi chỉ số môi trường chuồng nuôi vượt ngưỡng nguy hiểm cho vật nuôi.

---

## 2. BẢNG DANH MỤC 60 THÔNG ĐIỆP HỆ THỐNG ĐÃ CHUYỂN ĐỔI TIẾNG VIỆT (MSG01 - MSG60)

| # | Message code | Message Type | Ngữ cảnh phát sinh (Context) | Nội dung Tiếng Việt (Áp dụng hệ thống) | Nội dung Tiếng Anh gốc (Content) |
|:---|:---|:---|:---|:---|:---|
| 1 | **MSG01** | In line | Tìm kiếm hoặc bộ lọc không trả về bản ghi nào phù hợp | Không tìm thấy kết quả phù hợp. | No results found. |
| 2 | **MSG02** | In red, under the text box | Bỏ trống một trường thông tin bắt buộc khi gửi biểu mẫu | Trường này là bắt buộc. | This field is required. |
| 3 | **MSG03** | Toast message | Thao tác tạo mới / cập nhật / lưu dữ liệu hoàn tất thành công | Đã lưu các thay đổi thành công. | Changes saved successfully. |
| 4 | **MSG04** | Toast message | Thao tác tạo mới / cập nhật / lưu dữ liệu không thể hoàn thành do lỗi hệ thống/mạng | Không thể lưu thay đổi. Vui lòng thử lại. | Unable to save changes. Please try again. |
| 5 | **MSG05** | Toast / error message | Người dùng cố gắng thực hiện hành động vượt quá vai trò hoặc phạm vi dữ liệu được cấp quyền | Bạn không có quyền thực hiện hành động này. | You do not have permission to perform this action. |
| 6 | **MSG06** | Toast message | Phiên làm việc đã hết hạn (Token JWT hết hiệu lực) | Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại. | Your session has expired. Please sign in again. |
| 7 | **MSG07** | In red, under the text box | Giá trị nhập vào sai định dạng hoặc giá trị không hợp lệ | Giá trị không hợp lệ. Vui lòng kiểm tra và thử lại. | Invalid value. Please check and try again. |
| 8 | **MSG08** | In red, under the text box | Giá trị nhập vào vượt quá độ dài tối đa được cấu hình | Không được vượt quá {max_length} ký tự. | Must not exceed {max_length} characters. |
| 9 | **MSG09** | In line | Tên đăng nhập/email hoặc mật khẩu nhập không chính xác khi đăng nhập | Tên đăng nhập/email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại. | Incorrect username or password. Please check again. |
| 10 | **MSG10** | In line | Tài khoản đăng nhập sai liên tiếp 5 lần | Quá nhiều lần đăng nhập thất bại. Tài khoản của bạn đã bị khóa trong 30 phút. | Too many failed sign-in attempts. Your account is locked for 30 minutes. |
| 11 | **MSG11** | In line | Tài khoản đang ở trạng thái ngừng hoạt động (`is_active = false`) cố gắng đăng nhập | Tài khoản này đang bị vô hiệu hóa. Vui lòng liên hệ Chủ trang trại. | This account is inactive. Please contact the Farm Owner. |
| 12 | **MSG12** | Confirmation dialog | Người dùng nhấn nút Đăng xuất khỏi hệ thống | Đăng xuất khỏi FarmShift? Phiên làm việc hiện tại của bạn sẽ kết thúc. | Log out of FarmShift? Your current session will end. |
| 13 | **MSG13** | Toast message | Thông tin hồ sơ cá nhân của người dùng được cập nhật thành công | Hồ sơ cá nhân đã được cập nhật thành công. | Profile updated successfully. |
| 14 | **MSG14** | In line / toast message | Người dùng cố gắng chỉnh sửa các trường được bảo vệ từ trang hồ sơ của mình | Vai trò, trạng thái tài khoản và phân quyền không thể tự thay đổi từ hồ sơ cá nhân. | Role, account status, and permission scope cannot be changed from your profile. |
| 15 | **MSG15** | Toast message | Mã xác thực đặt lại mật khẩu đã được gửi đi thành công | Mã xác thực gồm 6 chữ số đã được gửi đến email/kênh liên hệ đã đăng ký của bạn. | A 6-digit verification code has been sent to your registered contact channel. |
| 16 | **MSG16** | In red, under the text box | Mã OTP xác thực đặt lại mật khẩu không chính xác hoặc đã quá thời hạn | Mã xác thực không hợp lệ hoặc đã hết hạn. | The verification code is invalid or has expired. |
| 17 | **MSG17** | In red, under the text box | Mật khẩu mới có độ dài ít hơn 8 ký tự | Mật khẩu phải chứa ít nhất 8 ký tự. | Password must contain at least 8 characters. |
| 18 | **MSG18** | In red, under the text box | Mật khẩu mới và Mật khẩu xác nhận lại không khớp nhau | Mật khẩu xác nhận không khớp. | Password confirmation does not match. |
| 19 | **MSG19** | Toast message | Đổi mật khẩu tài khoản thành công | Đổi mật khẩu thành công. | Password updated successfully. |
| 20 | **MSG20** | Toast message | Lưu tùy chọn nhận thông báo cá nhân thành công | Tùy chọn thông báo đã được lưu thành công. | Notification preferences updated successfully. |
| 21 | **MSG21** | In line / empty state | Một phân mục trên bảng tin hoặc danh sách không có dữ liệu để hiển thị | Không có dữ liệu khả dụng cho mục này. | No data is available for this section. |
| 22 | **MSG22** | Warning banner | Dữ liệu đo đạc cảm biến IoT bị mất, bị quá hạn (>5 phút) hoặc không hợp lệ | Dữ liệu cảm biến trực tiếp không khả dụng hoặc bị cũ. Chế độ điều khiển tự động sẽ không dùng dữ liệu này. | Live sensor data is unavailable or outdated. Automatic control will not use this data. |
| 23 | **MSG23** | In red / toast message | Số lượng gia cầm phân bổ hoặc chuyển vào chuồng vượt quá sức chứa tối đa | Số lượng phân bổ vượt quá sức chứa của chuồng. Vui lòng giảm số lượng hoặc chọn chuồng khác. | Allocation exceeds the coop capacity. Reduce the quantity or select another coop. |
| 24 | **MSG24** | In red / toast message | Số lượng gia cầm yêu cầu điều chuyển vượt quá số lượng gà sống hiện có | Số lượng vượt quá tổng số gà sống hiện có trong đàn. | Quantity exceeds the available live bird count. |
| 25 | **MSG25** | In red, under the text box | Số lượng gà chết hoặc loại thải bằng 0, số âm, hoặc lớn hơn số gà sống | Số lượng phải lớn hơn 0 và không được vượt quá số gà sống hiện có. | Quantity must be greater than 0 and cannot exceed the current live bird count. |
| 26 | **MSG26** | Toast / warning message | Cố gắng thêm nhật ký, điều chuyển, hoặc thu hoạch vào một lứa nuôi đã đóng | Lứa nuôi này đã đóng. Không thể thêm nhật ký chăn nuôi, điều chuyển đàn hoặc bản ghi thu hoạch mới. | This batch is closed. New farming logs, flock movements, and harvest records cannot be added. |
| 27 | **MSG27** | In red / toast message | Xuất kho, điều chuyển, trả hàng hoặc điều chỉnh làm số dư tồn kho khả dụng bị âm | Tồn kho khả dụng không đủ. Giao dịch này sẽ làm cho số dư tồn kho bị âm. | Insufficient available stock. This transaction would make the stock balance negative. |
| 28 | **MSG28** | In red / toast message | Chọn một lô hàng thuốc / vắc-xin đã quá hạn sử dụng để xuất dùng cho trại | Lô hàng được chọn đã hết hạn và không thể xuất dùng cho trang trại. | The selected lot is expired and cannot be issued for farm use. |
| 29 | **MSG29** | Confirmation dialog | Xác nhận giao dịch có làm thay đổi tồn kho (xuất kho, chuyển kho, cân đối kiểm kê) | Xác nhận giao dịch này? Tồn kho sẽ chỉ được cập nhật sau khi xác nhận. | Confirm this transaction? Stock will be updated only after confirmation. |
| 30 | **MSG30** | Warning banner | Dữ liệu được trích xuất tự động từ AI OCR hóa đơn hoặc Voice-to-Data nhật ký | Dữ liệu trích xuất từ AI chỉ là bản nháp. Vui lòng kiểm tra và xác nhận mọi trường trước khi lưu bản ghi chính thức. | AI-extracted data is a draft. Review and confirm all fields before saving the official record. |
| 31 | **MSG31** | In red, under the text box | Phiếu cân gà xuất bán có trọng lượng tổng, bì hoặc tịnh không hợp lệ | Khối lượng tịnh phải lớn hơn 0 và bằng khối lượng tổng trừ khối lượng bì. | Net weight must be greater than 0 and equal gross weight minus tare weight. |
| 32 | **MSG32** | In red / toast message | Số lượng gà xuất bán vượt quá số gà sống hiện có trong lứa | Số lượng xuất bán vượt quá số lượng gà sống hiện có trong đàn. | Dispatch quantity exceeds the available live bird count. |
| 33 | **MSG33** | Toast / error message | Người dùng không phải Chủ trại cố gắng chỉnh sửa ngưỡng cảnh báo IoT hoặc luật tự động | Chỉ Chủ trang trại mới có quyền thay đổi ngưỡng cảnh báo hoặc quy tắc tự động hóa. | Only the Farm Owner may change alert thresholds or automation rules. |
| 34 | **MSG34** | Critical alert / push notification | Chỉ số cảm biến IoT thực tế vượt ngưỡng nguy cấp (nhiệt độ quá cao/quá thấp, khí độc) | Ngưỡng môi trường nguy cấp bị vượt tại {coop_name}. Kiểm tra chuồng ngay lập tức! | Critical environmental threshold exceeded in {coop_name}. Check the coop immediately. |
| 35 | **MSG35** | Toast / warning message | Lệnh điều khiển thiết bị không nhận được phản hồi xác nhận từ phần cứng | Lệnh điều khiển thiết bị thất bại hoặc chưa được phản hồi. Kiểm tra kết nối và thử lại. | Device command failed or was not confirmed. Check the connection and try again. |
| 36 | **MSG36** | In line / empty state | Báo cáo không có dữ liệu giao dịch đã xác nhận nào khớp với bộ lọc và khoảng thời gian | Không có bản ghi đã xác nhận nào khớp với bộ lọc và kỳ báo cáo đã chọn. | No confirmed records match the selected filters and reporting period. |
| 37 | **MSG37** | Toast message | Xuất file báo cáo thành công | Xuất báo cáo thành công. | Report generated successfully. |
| 38 | **MSG38** | Advisory banner | Trợ lý ảo AI Farm Assistant đưa ra khuyến cáo/tư vấn sức khỏe đàn gà | Hướng dẫn của AI chỉ mang tính tham khảo và không được coi là chẩn đoán hoặc quyết định điều trị tự động. | AI guidance is advisory only and must not be treated as an automatic diagnosis or treatment decision. |
| 39 | **MSG39** | Toast / warning message | Người dùng cố gắng xóa cứng một bản ghi giao dịch đã quyết toán | Bản ghi đã quyết toán không thể bị xóa. Vui lòng sử dụng điều chỉnh hoặc đính chính được cấp quyền. | Finalized records cannot be deleted. Use an authorized correction or adjustment instead. |
| 40 | **MSG40** | Toast / error message | Người dùng không phải Chủ trại cố gắng tạo hoặc giao việc chăm sóc trang trại | Chỉ Chủ trang trại mới có quyền tạo hoặc phân công công việc trang trại. | Only the Farm Owner may create or assign farm tasks. |
| 41 | **MSG41** | Toast / error message | Công nhân trang trại cố gắng cập nhật tiến độ công việc không được giao cho mình | Bạn chỉ có thể cập nhật các công việc được phân công cho mình. | You can update only tasks assigned to you. |
| 42 | **MSG42** | In red / toast message | Giao dịch điều chuyển, tách đàn, gộp chuồng không bảo toàn tổng số lượng gà | Tổng số lượng chuyển đi phải bằng tổng số lượng nhận vào. | The total quantity moved out must equal the total quantity moved in. |
| 43 | **MSG43** | In red / toast message | Bản ghi tác nghiệp tham chiếu đến lứa/chuồng không hợp lệ hoặc thời gian ngoài kỳ nuôi | Bản ghi phải liên kết với một lứa nuôi đang hoạt động, chuồng hợp lệ và thời gian trong kỳ nuôi. | The record must reference an active batch, a valid coop assignment, and a time within the production period. |
| 44 | **MSG44** | Toast / error message | Người dùng cố gắng truy cập tệp tải lên hoặc chứng từ mà không có quyền | Bạn không có quyền truy cập tệp tin hoặc chứng từ này. | You are not authorized to access this file or evidence record. |
| 45 | **MSG45** | Toast message | Quá trình tải tệp tin lên máy chủ thất bại | Tải tệp lên thất bại. Vui lòng kiểm tra lại tệp và thử lại. | File upload failed. Please check the file and try again. |
| 46 | **MSG46** | In red, under the text box | Tạo hoặc sửa thông tin nhân viên với tên đăng nhập (username) đã tồn tại | Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên đăng nhập khác. | This username is already in use. Please choose another username. |
| 47 | **MSG47** | In red, under the text box | Tạo hoặc sửa thông tin nhân viên với địa chỉ email đã tồn tại trong hệ thống | Địa chỉ email này đã được sử dụng. Vui lòng chọn email khác. | This email address is already in use. |
| 48 | **MSG48** | In red / toast message | Tài khoản nhân viên được gán vai trò khác ngoài Kế toán hoặc Công nhân | Tài khoản nhân viên chỉ có thể được gán vai trò Kế toán hoặc Công nhân. | Employee accounts can only be assigned the Accountant or Worker role. |
| 49 | **MSG49** | Toast / warning message | Cố gắng đóng lứa nuôi khi số lượng đàn, bản ghi thu hoạch và chi phí chưa được đối soát | Lứa nuôi này chưa thể đóng cho đến khi số lượng đàn, bản ghi thu hoạch/xuất bán và dữ liệu vận hành được đối soát hoàn tất. | This batch cannot be closed until flock quantities, harvest/dispatch records, and required operational data are reconciled. |
| 50 | **MSG50** | Toast / warning message | Gán thêm chương trình nuôi mới cho lứa nuôi đang có chương trình đang chạy | Lứa nuôi này đã có chương trình chăn nuôi đang hoạt động. Hãy kết thúc hoặc thay thế chương trình hiện tại trước khi gán chương trình khác. | This batch already has an active farming program. End or replace the current program before assigning another one. |
| 51 | **MSG51** | Toast / error message | Công nhân cố gắng ghi nhật ký tác nghiệp ngoài phạm vi lứa/chuồng được phân công | Bạn chỉ có thể ghi nhận hoạt động cho các lứa nuôi và chuồng được phân công cho mình. | You can record farm activities only for batches and coops assigned to you. |
| 52 | **MSG52** | Toast / error message | Cố gắng nhập sửa trực tiếp số lượng tồn kho trên sổ sách mà không qua chứng từ | Số dư tồn kho không thể chỉnh sửa trực tiếp. Vui lòng sử dụng phiếu kiểm kê hoặc điều chỉnh được cấp quyền. | Inventory balances cannot be edited directly. Use a stocktake or authorized adjustment. |
| 53 | **MSG53** | Warning banner / alert | Lô hàng hóa trong kho sắp đến ngưỡng ngày hết hạn | {item_name} lô {lot_code} sắp hết hạn vào ngày {expiry_date}. | {item_name} lot {lot_code} is near expiry on {expiry_date}. |
| 54 | **MSG54** | Toast / error message | Cố gắng nhập đè trực tiếp số dư nợ phải trả NCC hoặc nợ phải thu của khách hàng | Số dư công nợ không thể chỉnh sửa trực tiếp. Vui lòng ghi nhận giao dịch mua, bán hoặc thanh quyết toán tương ứng. | Outstanding balances cannot be edited directly. Record the related purchase, sale, or settlement transaction instead. |
| 55 | **MSG55** | Warning banner | Kết quả OCR hoặc Voice-to-Data có trường có độ tin cậy thấp (<80%) | Một số trường do AI trích xuất có thể không chính xác. Vui lòng kiểm tra kỹ các trường được làm nổi bật trước khi xác nhận. | Some AI-extracted fields may be inaccurate. Review the highlighted fields before confirmation. |
| 56 | **MSG56** | Toast message | Đơn nhập hàng được xác nhận duyệt thành công, tồn kho cập nhật tự động | Đã xác nhận phiếu nhập hàng. Tồn kho đã được cập nhật theo số lượng thực nhận. | Purchase receipt confirmed. Inventory has been updated using the accepted quantities. |
| 57 | **MSG57** | Toast message | Đơn xuất bán gà thịt được xác nhận thành công, tồn đàn cập nhật tự động | Đã xác nhận xuất bán. Số lượng gà sống trong đàn và sản lượng bán đã được cập nhật. | Sale confirmed. The batch live flock and sold quantity have been updated. |
| 58 | **MSG58** | Toast / error message | Người dùng không được cấp quyền điều khiển thiết bị cố gắng bật/tắt thiết bị | Bạn không có quyền điều khiển thiết bị này. | You are not authorized to control this device. |
| 59 | **MSG59** | Information banner | Bật chế độ Khung giờ yên tĩnh nhưng cảnh báo IoT khẩn cấp vẫn được kích hoạt | Các cảnh báo IoT nguy cấp vẫn có thể được phát chuông trong Khung giờ yên tĩnh. | Critical IoT alerts may still be delivered during Quiet Hours. |
| 60 | **MSG60** | Confirmation dialog | Hộp thoại xác nhận dứt điểm trước khi thực hiện hành động chốt số liệu quan trọng | Xác nhận thực hiện hành động này? Bản ghi sau khi quyết toán không thể bị xóa; việc sửa đổi sau này bắt buộc phải dùng phiếu điều chỉnh hoặc thay đổi trạng thái được cấp quyền. | Confirm this action? The finalized record cannot be hard-deleted; later corrections must use an authorized adjustment or status change. |

---

## 3. THAM SỐ ĐỘNG TRONG TIẾNG VIỆT

| Biến tham số | Tên biến trong code | Ví dụ giá trị hiển thị tiếng Việt | Mã áp dụng |
|:---|:---|:---|:---|
| `{max_length}` | `max_length` | `255` -> *"Không được vượt quá 255 ký tự."* | MSG08 |
| `{coop_name}` | `coop_name` | `Nhà A1 (Khu Mía)` -> *"Ngưỡng môi trường nguy cấp bị vượt tại Nhà A1 (Khu Mía). Kiểm tra chuồng ngay lập tức!"* | MSG34 |
| `{item_name}` | `item_name` | `Cám Higro 02` | MSG53 |
| `{lot_code}` | `lot_code` | `LOT-2026-X09` | MSG53 |
| `{expiry_date}` | `expiry_date` | `20/11/2026` -> *"Cám Higro 02 lô LOT-2026-X09 sắp hết hạn vào ngày 20/11/2026."* | MSG53 |

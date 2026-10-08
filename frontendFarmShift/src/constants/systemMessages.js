// frontendFarmShift/src/constants/systemMessages.js
// Từ điển danh mục 60 Thông điệp Hệ thống FarmShift (MSG01 -> MSG60)
// Hỗ trợ song ngữ (Tiếng Anh & Tiếng Việt) kèm thay thế tham số động (placeholders)

export const SYSTEM_MESSAGES = {
  MSG01: {
    code: 'MSG01',
    type: 'inline',
    context: 'A search or filter returns no matching records',
    en: 'No results found.',
    vi: 'Không tìm thấy kết quả phù hợp.'
  },
  MSG02: {
    code: 'MSG02',
    type: 'field_error',
    context: 'A required field is empty',
    en: 'This field is required.',
    vi: 'Trường này là bắt buộc.'
  },
  MSG03: {
    code: 'MSG03',
    type: 'toast_success',
    context: 'A generic create/update/save operation completes successfully',
    en: 'Changes saved successfully.',
    vi: 'Đã lưu các thay đổi thành công.'
  },
  MSG04: {
    code: 'MSG04',
    type: 'toast_error',
    context: 'A create/update/save operation cannot be completed',
    en: 'Unable to save changes. Please try again.',
    vi: 'Không thể lưu thay đổi. Vui lòng thử lại.'
  },
  MSG05: {
    code: 'MSG05',
    type: 'toast_error',
    context: 'The user attempts an action outside their authorized role or data scope',
    en: 'You do not have permission to perform this action.',
    vi: 'Bạn không có quyền thực hiện hành động này.'
  },
  MSG06: {
    code: 'MSG06',
    type: 'toast_warning',
    context: 'The authenticated session has expired',
    en: 'Your session has expired. Please sign in again.',
    vi: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  },
  MSG07: {
    code: 'MSG07',
    type: 'field_error',
    context: 'An entered value has an invalid format or value',
    en: 'Invalid value. Please check and try again.',
    vi: 'Giá trị không hợp lệ. Vui lòng kiểm tra và thử lại.'
  },
  MSG08: {
    code: 'MSG08',
    type: 'field_error',
    context: 'Input value exceeds the configured maximum length',
    en: 'Must not exceed {max_length} characters.',
    vi: 'Không được vượt quá {max_length} ký tự.'
  },
  MSG09: {
    code: 'MSG09',
    type: 'inline',
    context: 'Email/username or password is incorrect when signing in',
    en: 'Incorrect username or password. Please check again.',
    vi: 'Tên đăng nhập/email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
  },
  MSG10: {
    code: 'MSG10',
    type: 'inline',
    context: 'The account reaches 5 consecutive failed sign-in attempts',
    en: 'Too many failed sign-in attempts. Your account is locked for 30 minutes.',
    vi: 'Quá nhiều lần đăng nhập thất bại. Tài khoản của bạn đã bị khóa trong 30 phút.'
  },
  MSG11: {
    code: 'MSG11',
    type: 'inline',
    context: 'An inactive account attempts to sign in',
    en: 'This account is inactive. Please contact the Farm Owner.',
    vi: 'Tài khoản này đang bị vô hiệu hóa. Vui lòng liên hệ Chủ trang trại.'
  },
  MSG12: {
    code: 'MSG12',
    type: 'confirm_dialog',
    context: 'The user selects Logout',
    en: 'Log out of FarmShift? Your current session will end.',
    vi: 'Đăng xuất khỏi FarmShift? Phiên làm việc hiện tại của bạn sẽ kết thúc.'
  },
  MSG13: {
    code: 'MSG13',
    type: 'toast_success',
    context: "The user's permitted profile information is updated successfully",
    en: 'Profile updated successfully.',
    vi: 'Hồ sơ cá nhân đã được cập nhật thành công.'
  },
  MSG14: {
    code: 'MSG14',
    type: 'toast_warning',
    context: 'A user attempts to modify protected account fields from their own profile',
    en: 'Role, account status, and permission scope cannot be changed from your profile.',
    vi: 'Vai trò, trạng thái tài khoản và phân quyền không thể tự thay đổi từ hồ sơ cá nhân.'
  },
  MSG15: {
    code: 'MSG15',
    type: 'toast_info',
    context: 'A password-change verification code is sent',
    en: 'A 6-digit verification code has been sent to your registered contact channel.',
    vi: 'Mã xác thực gồm 6 chữ số đã được gửi đến email/kênh liên hệ đã đăng ký của bạn.'
  },
  MSG16: {
    code: 'MSG16',
    type: 'field_error',
    context: 'The password-change verification code is invalid or expired',
    en: 'The verification code is invalid or has expired.',
    vi: 'Mã xác thực không hợp lệ hoặc đã hết hạn.'
  },
  MSG17: {
    code: 'MSG17',
    type: 'field_error',
    context: 'The new password contains fewer than 8 characters',
    en: 'Password must contain at least 8 characters.',
    vi: 'Mật khẩu phải chứa ít nhất 8 ký tự.'
  },
  MSG18: {
    code: 'MSG18',
    type: 'field_error',
    context: 'New Password and Confirm New Password do not match',
    en: 'Password confirmation does not match.',
    vi: 'Mật khẩu xác nhận không khớp.'
  },
  MSG19: {
    code: 'MSG19',
    type: 'toast_success',
    context: "The user's password is changed successfully",
    en: 'Password updated successfully.',
    vi: 'Đổi mật khẩu thành công.'
  },
  MSG20: {
    code: 'MSG20',
    type: 'toast_success',
    context: 'Notification preferences are saved successfully',
    en: 'Notification preferences updated successfully.',
    vi: 'Tùy chọn thông báo đã được lưu thành công.'
  },
  MSG21: {
    code: 'MSG21',
    type: 'inline_empty',
    context: 'A dashboard or list section has no available data',
    en: 'No data is available for this section.',
    vi: 'Không có dữ liệu khả dụng cho mục này.'
  },
  MSG22: {
    code: 'MSG22',
    type: 'warning_banner',
    context: 'IoT telemetry is missing, stale, or invalid',
    en: 'Live sensor data is unavailable or outdated. Automatic control will not use this data.',
    vi: 'Dữ liệu cảm biến trực tiếp không khả dụng hoặc bị cũ. Chế độ điều khiển tự động sẽ không dùng dữ liệu này.'
  },
  MSG23: {
    code: 'MSG23',
    type: 'field_or_toast_error',
    context: 'A flock allocation or movement would exceed coop capacity',
    en: 'Allocation exceeds the coop capacity. Reduce the quantity or select another coop.',
    vi: 'Số lượng phân bổ vượt quá sức chứa của chuồng. Vui lòng giảm số lượng hoặc chọn chuồng khác.'
  },
  MSG24: {
    code: 'MSG24',
    type: 'field_or_toast_error',
    context: 'A requested flock quantity exceeds the available live bird quantity',
    en: 'Quantity exceeds the available live bird count.',
    vi: 'Số lượng vượt quá tổng số gà sống hiện có trong đàn.'
  },
  MSG25: {
    code: 'MSG25',
    type: 'field_error',
    context: 'Mortality or culling quantity is zero, negative, or greater than the available live flock',
    en: 'Quantity must be greater than 0 and cannot exceed the current live bird count.',
    vi: 'Số lượng phải lớn hơn 0 và không được vượt quá số gà sống hiện có.'
  },
  MSG26: {
    code: 'MSG26',
    type: 'toast_warning',
    context: 'A user attempts to add an operational record to a closed batch',
    en: 'This batch is closed. New farming logs, flock movements, and harvest records cannot be added.',
    vi: 'Lứa nuôi này đã đóng. Không thể thêm nhật ký chăn nuôi, điều chuyển đàn hoặc bản ghi thu hoạch mới.'
  },
  MSG27: {
    code: 'MSG27',
    type: 'field_or_toast_error',
    context: 'A stock issue, transfer, return, or adjustment would make available stock negative',
    en: 'Insufficient available stock. This transaction would make the stock balance negative.',
    vi: 'Tồn kho khả dụng không đủ. Giao dịch này sẽ làm cho số dư tồn kho bị âm.'
  },
  MSG28: {
    code: 'MSG28',
    type: 'field_or_toast_error',
    context: 'An expired lot is selected for farm use',
    en: 'The selected lot is expired and cannot be issued for farm use.',
    vi: 'Lô hàng được chọn đã hết hạn và không thể xuất dùng cho trang trại.'
  },
  MSG29: {
    code: 'MSG29',
    type: 'confirm_dialog',
    context: 'The user confirms an inventory-changing transaction',
    en: 'Confirm this transaction? Stock will be updated only after confirmation.',
    vi: 'Xác nhận giao dịch này? Tồn kho sẽ chỉ được cập nhật sau khi xác nhận.'
  },
  MSG30: {
    code: 'MSG30',
    type: 'warning_banner',
    context: 'OCR or Voice-to-Data has extracted draft information',
    en: 'AI-extracted data is a draft. Review and confirm all fields before saving the official record.',
    vi: 'Dữ liệu trích xuất từ AI chỉ là bản nháp. Vui lòng kiểm tra và xác nhận mọi trường trước khi lưu bản ghi chính thức.'
  },
  MSG31: {
    code: 'MSG31',
    type: 'field_error',
    context: 'A weighing-based sale has invalid gross, tare, or net weight',
    en: 'Net weight must be greater than 0 and equal gross weight minus tare weight.',
    vi: 'Khối lượng tịnh phải lớn hơn 0 và bằng khối lượng tổng trừ khối lượng bì.'
  },
  MSG32: {
    code: 'MSG32',
    type: 'field_or_toast_error',
    context: 'Sale or dispatch quantity exceeds available live birds',
    en: 'Dispatch quantity exceeds the available live bird count.',
    vi: 'Số lượng xuất bán vượt quá số lượng gà sống hiện có trong đàn.'
  },
  MSG33: {
    code: 'MSG33',
    type: 'toast_error',
    context: 'A non-owner attempts to configure IoT alert thresholds or automation rules',
    en: 'Only the Farm Owner may change alert thresholds or automation rules.',
    vi: 'Chỉ Chủ trang trại mới có quyền thay đổi ngưỡng cảnh báo hoặc quy tắc tự động hóa.'
  },
  MSG34: {
    code: 'MSG34',
    type: 'critical_alert',
    context: 'Valid IoT telemetry exceeds a configured critical threshold',
    en: 'Critical environmental threshold exceeded in {coop_name}. Check the coop immediately.',
    vi: 'Ngưỡng môi trường nguy cấp bị vượt tại {coop_name}. Kiểm tra chuồng ngay lập tức!'
  },
  MSG35: {
    code: 'MSG35',
    type: 'toast_warning',
    context: 'A farm-equipment control command is not confirmed by the device',
    en: 'Device command failed or was not confirmed. Check the connection and try again.',
    vi: 'Lệnh điều khiển thiết bị thất bại hoặc chưa được phản hồi. Kiểm tra kết nối và thử lại.'
  },
  MSG36: {
    code: 'MSG36',
    type: 'inline_empty',
    context: 'A report has no confirmed records matching the selected filters and period',
    en: 'No confirmed records match the selected filters and reporting period.',
    vi: 'Không có bản ghi đã xác nhận nào khớp với bộ lọc và kỳ báo cáo đã chọn.'
  },
  MSG37: {
    code: 'MSG37',
    type: 'toast_success',
    context: 'A report or export is generated successfully',
    en: 'Report generated successfully.',
    vi: 'Xuất báo cáo thành công.'
  },
  MSG38: {
    code: 'MSG38',
    type: 'advisory_banner',
    context: 'The AI Farm Assistant returns animal-health guidance',
    en: 'AI guidance is advisory only and must not be treated as an automatic diagnosis or treatment decision.',
    vi: 'Hướng dẫn của AI chỉ mang tính tham khảo và không được coi là chẩn đoán hoặc quyết định điều trị tự động.'
  },
  MSG39: {
    code: 'MSG39',
    type: 'toast_warning',
    context: 'A user attempts to hard-delete a finalized transactional record',
    en: 'Finalized records cannot be deleted. Use an authorized correction or adjustment instead.',
    vi: 'Bản ghi đã quyết toán không thể bị xóa. Vui lòng sử dụng điều chỉnh hoặc đính chính được cấp quyền.'
  },
  MSG40: {
    code: 'MSG40',
    type: 'toast_error',
    context: 'A non-owner attempts to create or assign a farm task',
    en: 'Only the Farm Owner may create or assign farm tasks.',
    vi: 'Chỉ Chủ trang trại mới có quyền tạo hoặc phân công công việc trang trại.'
  },
  MSG41: {
    code: 'MSG41',
    type: 'toast_error',
    context: 'A Farm Worker attempts to update a task that is not assigned to them',
    en: 'You can update only tasks assigned to you.',
    vi: 'Bạn chỉ có thể cập nhật các công việc được phân công cho mình.'
  },
  MSG42: {
    code: 'MSG42',
    type: 'field_or_toast_error',
    context: 'A transfer, split, or merge does not conserve bird quantity',
    en: 'The total quantity moved out must equal the total quantity moved in.',
    vi: 'Tổng số lượng chuyển đi phải bằng tổng số lượng nhận vào.'
  },
  MSG43: {
    code: 'MSG43',
    type: 'field_or_toast_error',
    context: 'An operational record references an invalid batch/coop scope or time',
    en: 'The record must reference an active batch, a valid coop assignment, and a time within the production period.',
    vi: 'Bản ghi phải liên kết với một lứa nuôi đang hoạt động, chuồng hợp lệ và thời gian trong kỳ nuôi.'
  },
  MSG44: {
    code: 'MSG44',
    type: 'toast_error',
    context: 'A user attempts to access an uploaded file or evidence record without permission',
    en: 'You are not authorized to access this file or evidence record.',
    vi: 'Bạn không có quyền truy cập tệp tin hoặc chứng từ này.'
  },
  MSG45: {
    code: 'MSG45',
    type: 'toast_error',
    context: 'An evidence/document upload fails',
    en: 'File upload failed. Please check the file and try again.',
    vi: 'Tải tệp lên thất bại. Vui lòng kiểm tra lại tệp và thử lại.'
  },
  MSG46: {
    code: 'MSG46',
    type: 'field_error',
    context: 'A Farm Owner creates or updates an employee using a username that already exists',
    en: 'This username is already in use. Please choose another username.',
    vi: 'Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên đăng nhập khác.'
  },
  MSG47: {
    code: 'MSG47',
    type: 'field_error',
    context: 'A Farm Owner creates or updates an employee using an email address that already exists',
    en: 'This email address is already in use.',
    vi: 'Địa chỉ email này đã được sử dụng. Vui lòng chọn email khác.'
  },
  MSG48: {
    code: 'MSG48',
    type: 'field_or_toast_error',
    context: 'An employee account is assigned a role other than Accountant or Worker',
    en: 'Employee accounts can only be assigned the Accountant or Worker role.',
    vi: 'Tài khoản nhân viên chỉ có thể được gán vai trò Kế toán hoặc Công nhân.'
  },
  MSG49: {
    code: 'MSG49',
    type: 'toast_warning',
    context: 'The Farm Owner attempts to close a batch before required operational and quantity records are reconciled',
    en: 'This batch cannot be closed until flock quantities, harvest/dispatch records, and required operational data are reconciled.',
    vi: 'Lứa nuôi này chưa thể đóng cho đến khi số lượng đàn, bản ghi thu hoạch/xuất bán và dữ liệu vận hành được đối soát hoàn tất.'
  },
  MSG50: {
    code: 'MSG50',
    type: 'toast_warning',
    context: 'The Farm Owner attempts to assign another active farming program to a batch',
    en: 'This batch already has an active farming program. End or replace the current program before assigning another one.',
    vi: 'Lứa nuôi này đã có chương trình chăn nuôi đang hoạt động. Hãy kết thúc hoặc thay thế chương trình hiện tại trước khi gán chương trình khác.'
  },
  MSG51: {
    code: 'MSG51',
    type: 'toast_error',
    context: 'A Farm Worker attempts to create or edit an operational log outside their assigned batch/coop scope',
    en: 'You can record farm activities only for batches and coops assigned to you.',
    vi: 'Bạn chỉ có thể ghi nhận hoạt động cho các lứa nuôi và chuồng được phân công cho mình.'
  },
  MSG52: {
    code: 'MSG52',
    type: 'toast_error',
    context: 'A user attempts to directly edit an inventory on-hand balance',
    en: 'Inventory balances cannot be edited directly. Use a stocktake or authorized adjustment.',
    vi: 'Số dư tồn kho không thể chỉnh sửa trực tiếp. Vui lòng sử dụng phiếu kiểm kê hoặc điều chỉnh được cấp quyền.'
  },
  MSG53: {
    code: 'MSG53',
    type: 'warning_banner',
    context: 'An inventory lot is approaching its configured expiry threshold',
    en: '{item_name} lot {lot_code} is near expiry on {expiry_date}.',
    vi: '{item_name} lô {lot_code} sắp hết hạn vào ngày {expiry_date}.'
  },
  MSG54: {
    code: 'MSG54',
    type: 'toast_error',
    context: 'A user attempts to directly overwrite a supplier payable or customer receivable balance',
    en: 'Outstanding balances cannot be edited directly. Record the related purchase, sale, or settlement transaction instead.',
    vi: 'Số dư công nợ không thể chỉnh sửa trực tiếp. Vui lòng ghi nhận giao dịch mua, bán hoặc thanh quyết toán tương ứng.'
  },
  MSG55: {
    code: 'MSG55',
    type: 'warning_banner',
    context: 'OCR or Voice-to-Data contains low-confidence extracted fields',
    en: 'Some AI-extracted fields may be inaccurate. Review the highlighted fields before confirmation.',
    vi: 'Một số trường do AI trích xuất có thể không chính xác. Vui lòng kiểm tra kỹ các trường được làm nổi bật trước khi xác nhận.'
  },
  MSG56: {
    code: 'MSG56',
    type: 'toast_success',
    context: 'A purchase receipt is confirmed successfully',
    en: 'Purchase receipt confirmed. Inventory has been updated using the accepted quantities.',
    vi: 'Đã xác nhận phiếu nhập hàng. Tồn kho đã được cập nhật theo số lượng thực nhận.'
  },
  MSG57: {
    code: 'MSG57',
    type: 'toast_success',
    context: 'A sale/dispatch is confirmed successfully',
    en: 'Sale confirmed. The batch live flock and sold quantity have been updated.',
    vi: 'Đã xác nhận xuất bán. Số lượng gà sống trong đàn và sản lượng bán đã được cập nhật.'
  },
  MSG58: {
    code: 'MSG58',
    type: 'toast_error',
    context: 'A user without device-control permission attempts to operate farm equipment',
    en: 'You are not authorized to control this device.',
    vi: 'Bạn không có quyền điều khiển thiết bị này.'
  },
  MSG59: {
    code: 'MSG59',
    type: 'info_banner',
    context: 'The user enables Quiet Hours while critical IoT alerts are enabled',
    en: 'Critical IoT alerts may still be delivered during Quiet Hours.',
    vi: 'Các cảnh báo IoT nguy cấp vẫn có thể được phát chuông trong Khung giờ yên tĩnh.'
  },
  MSG60: {
    code: 'MSG60',
    type: 'confirm_dialog',
    context: 'The user confirms a critical or finalizing business action',
    en: 'Confirm this action? The finalized record cannot be hard-deleted; later corrections must use an authorized adjustment or status change.',
    vi: 'Xác nhận thực hiện hành động này? Bản ghi sau khi quyết toán không thể bị xóa; việc sửa đổi sau này bắt buộc phải dùng phiếu điều chỉnh hoặc thay đổi trạng thái được cấp quyền.'
  }
};

/**
 * Lấy nội dung thông điệp theo mã code và tự động điền các tham số động
 * @param {string} code - Ví dụ 'MSG08', 'MSG34'
 * @param {Object} [params={}] - Ví dụ { max_length: 50, coop_name: 'Chuồng A1' }
 * @param {'vi'|'en'} [lang='vi'] - Ngôn ngữ hiển thị (mặc định là 'vi' - tiếng Việt)
 * @returns {string} Chuỗi thông điệp đã format
 */
export function getSystemMessage(code, params = {}, lang = 'vi') {
  const item = SYSTEM_MESSAGES[code];
  if (!item) {
    return code;
  }

  let text = item[lang] || item.vi || item.en || '';
  if (params && typeof params === 'object') {
    Object.keys(params).forEach((key) => {
      text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), params[key]);
    });
  }

  return text;
}

export default SYSTEM_MESSAGES;

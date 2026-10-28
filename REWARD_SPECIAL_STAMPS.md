# Workshop bắt buộc cho mốc quà

Trong form tạo/sửa mốc quà, mở dropdown **Workshop bắt buộc trong tổng số booth** và tick các workshop cần yêu cầu. Danh sách lấy toàn bộ booth loại `workshop` hiện có, bao gồm khai mạc, tọa đàm và các hội thảo khác. Có thể chọn nhiều mục hoặc bỏ hết lựa chọn.
Mốc 20 chọn 3 workshop yêu cầu ít nhất 17 booth loại `booth` và đủ đúng 3 workshop đã chọn. Workshop khác không thay thế workshop bắt buộc hay booth thường. Không chọn workshop nào thì giữ nguyên cách đếm tổng booth cũ. Số workshop được chọn không được vượt quá tổng số booth yêu cầu.

Các mốc cũ bật yêu cầu hai dấu vẫn dùng hai booth dưới đây cho đến khi admin sửa lựa chọn trong dropdown.

| Điểm quét | Mã QR cố định | Tài khoản |
| --- | --- | --- |
| Tọa đàm kỹ năng nghề nghiệp | REWARD-CAREER-TALK | toadam@jobfair |
| Lễ khai mạc | REWARD-OPENING | khaimac@jobfair |

Chạy `npm run seed:reward-stamps` với cấu hình database của môi trường cần sử dụng. Bản build dùng `npm run seed:reward-stamps:prod`. Seed chỉ thêm cột `requires_special_stamps` mặc định false, hai booth và tài khoản còn thiếu; không đồng bộ schema khác, không xóa lịch sử, không đổi mật khẩu tài khoản đã có. Chạy lại không tạo bản sao.

Mật khẩu ngẫu nhiên của tài khoản mới được ghi vào `reward-stamp-credentials.csv` (Tên,Email,Mật khẩu); file được Git bỏ qua. Đăng nhập tài khoản tương ứng để quét QR sinh viên bằng scanner hiện tại. Tài khoản có quyền `business_admin`, chỉ quét booth được gán; việc xác nhận đổi quà vẫn dùng tài khoản admin hiện tại.

Không dùng `seed:workshops` để tạo hai dấu này: script cũ xóa toàn bộ booth workshop. Seed mới là thao tác bổ sung riêng, chạy sau seed dữ liệu chung nếu khởi tạo lại database.

API tạo/sửa mốc nhận `requiredWorkshopIds: string[]` chứa UUID workshop; `[]` để xóa yêu cầu workshop. Backend kiểm tra workshop tồn tại, đúng loại và không trùng. Cột `required_workshop_ids` lưu lựa chọn; null giữ tương thích cờ `requiresSpecialStamps` cũ. Seed trên bổ sung cột này nếu chưa có. Tiến trình và danh sách sinh viên, tạo mã đổi quà, xác nhận và quét mã đổi quà cùng kiểm tra điều kiện. Mỗi booth chỉ được đếm một lần dù có nhiều bản ghi quét.

# Rà soát điểm danh hội thảo — 19/10/2026

Phạm vi: backend NestJS và frontend Next.js tại WebstormProjects/dut-job-fair-frontend. Chưa có mã nguồn giao diện sinh viên/WordPress nên chưa xác minh được luồng sinh viên tự quét QR hoặc khôi phục tài khoản trên website đó. Kết luận dưới đây dựa trên mã nguồn, chưa kiểm thử trên production.

## 1. Tạo QR và điểm danh

- Tạo hội thảo qua `POST /api/school-admin/workshops` sẽ tạo Business, Booth loại `workshop`, và tài khoản quản lý trong cùng transaction. `qrCode` của đơn vị là `WS-` + 8 ký tự đầu của UUID ngẫu nhiên (bỏ dấu gạch, viết hoa). Dữ liệu seed cũ dùng `WORKSHOP-01`, `WORKSHOP-02`, v.v.
- Trường này là chuỗi định danh tĩnh trong database, chưa phải ảnh QR hoặc token điểm danh có hạn sử dụng. Trang chi tiết hội thảo hiện hiển thị chuỗi đó. Không thấy API nhận `WS-...` rồi giải mã ra hội thảo để sinh viên tự điểm danh.
- QR cá nhân sinh viên do script import tạo bằng thư viện `qrcode`, chứa MSSV thuần hoặc JSON có `ma_so_sinh_vien`, `ho_ten`, lớp và các thông tin tùy chọn. QR cá nhân có thể dùng ở nhiều đơn vị.
- Trong frontend hiện có, nhân viên đăng nhập tài khoản hội thảo, mở scanner và quét QR sinh viên. Frontend gửi MSSV tới `/api/scanner/scan` hoặc JSON tới `/api/scanner/scan-qr`, kèm `boothId` của tài khoản.
- Backend kiểm tra quyền đơn vị. MSSV thuần yêu cầu hồ sơ tồn tại; JSON sẽ upsert hồ sơ theo MSSV, giữ ID cũ và các quan hệ điểm danh. Không tạo tài khoản đăng nhập khi upsert.
- Scanner dùng transaction và PostgreSQL advisory lock theo cặp sinh viên/đơn vị để chống hai lượt quét đồng thời. Một sinh viên chỉ được ghi nhận một lần cho cùng `boothId`, kể cả quét vào ngày khác; hội thảo khác có `boothId` khác vẫn điểm danh được.

## 2. Trùng MSSV và tài khoản cũ

- `students.student_code` có ràng buộc unique. `POST /api/students` từ chối hồ sơ có MSSV đã tồn tại bằng HTTP 409.
- `users` là bảng tài khoản riêng, có email unique và mật khẩu băm. Chưa có `studentId`, `studentCode` hoặc quan hệ tới `students`. DTO đăng ký cũng không nhận MSSV.
- Do đó không thể đồng nhất “đã tham gia” với “đã có tài khoản đăng nhập”. Quét QR hoặc import có thể tạo hồ sơ mà chưa có tài khoản. API đăng ký tài khoản hiện chỉ chặn email trùng; chưa chặn nhiều tài khoản khác email cho cùng sinh viên.
- Chưa thấy API quên mật khẩu hoặc giao diện đăng ký sinh viên trong hai dự án đã kiểm tra. Không thể sửa đúng tài khoản cũ trên một hệ thống chưa có mã nguồn/quyền truy cập.

Hướng xử lý đã chọn để triển khai khi có mã nguồn sinh viên:

1. Giữ một hồ sơ chuẩn theo MSSV, liên kết duy nhất tới tài khoản sinh viên; không xóa hồ sơ và không đổi ID để bảo toàn lịch sử.
2. Nếu đã có tài khoản, hướng về đăng nhập/Quên mật khẩu. Gửi liên kết đặt lại mật khẩu một lần, có thời hạn, tới email đã xác minh của tài khoản cũ; không dùng email mới nhập để chiếm tài khoản.
3. Nếu mới có hồ sơ từ import/điểm danh, xác minh danh tính qua email trường/SSO trước khi liên kết tài khoản. Không cho nhận tài khoản chỉ bằng MSSV, họ tên hoặc QR cá nhân vì các dữ liệu này có thể được chia sẻ.
4. Không còn truy cập email cũ thì BTC xác minh danh tính và hỗ trợ đổi email/khôi phục. Không đặt mật khẩu mặc định bằng MSSV.

Chưa triển khai khôi phục tài khoản: cần xác định mã nguồn hoặc hệ thống thực sự quản lý tài khoản sinh viên, phương thức xác minh và dịch vụ gửi email/SSO.

## 3. Hội thảo so với booth

| Nội dung | Hội thảo | Booth doanh nghiệp |
| --- | --- | --- |
| Ai quét trong frontend hiện có | Nhân viên quét QR sinh viên | Nhân viên quét QR sinh viên |
| Phân loại | `booths.type = workshop` | `booths.type = booth` |
| Cơ chế lưu | Bảng checkins, studentId + boothId | Cùng cơ chế |
| Báo cáo | Danh sách điểm danh, xuất CSV/Excel theo hội thảo | Danh sách khách ghé và thống kê doanh nghiệp |
| Chống trùng scanner | Một lượt/sinh viên/hội thảo | Một lượt/sinh viên/booth |
| Điều kiện riêng về giờ, vị trí, thời lượng | Chưa thấy kiểm tra khi ghi nhận | Chưa thấy kiểm tra khi ghi nhận |

Rewards hiện đếm `COUNT(DISTINCT boothId)` trên toàn bộ checkins, không lọc loại đơn vị. Lượt hội thảo và tốt nghiệp cũng có thể tăng tiến độ quà. Đây là hành vi hiện tại; cần quyết định nghiệp vụ trước khi thay đổi.

## 4. Vấn đề cần xử lý tiếp

- `POST /api/checkins` chưa có guard và nhận trực tiếp studentId/boothId. Có thể ghi nhận mà không đi qua kiểm tra quyền và khóa chống trùng của ScannerService. Nhánh điểm danh thủ công cũng chưa dùng cùng khóa với scanner. Vì vậy chống trùng của scanner chưa bảo đảm cho mọi đường ghi dữ liệu.
- Payload QR cá nhân chưa có chữ ký xác thực; nhánh JSON upsert có thể cập nhật hồ sơ cũ theo nội dung QR. Không nên coi QR này là bằng chứng sở hữu tài khoản.
- Luồng đăng ký public nhận role do client cung cấp, chưa giới hạn role bằng cơ chế cấp quyền trong AuthService. Cần rà soát riêng quyền đăng ký trước khi mở rộng đăng nhập sinh viên.

## 5. Sửa và kiểm tra trong lần rà soát

Đã sửa ScannerService để chuẩn hóa MSSV trước cả upsert và tra cứu. Trước đó, JSON có khoảng trắng đầu/cuối MSSV được lưu bằng giá trị đã trim nhưng lại tìm bằng giá trị chưa trim, khiến đồng bộ báo lỗi dù dữ liệu đã được ghi. MSSV thuần cũng được trim; MSSV hoặc họ tên chỉ có khoảng trắng bị từ chối trước khi cập nhật hồ sơ.

Thêm sáu kiểm thử cho việc tái sử dụng hồ sơ cũ, phản hồi quét trùng, chuẩn hóa MSSV, từ chối MSSV/họ tên rỗng và ngăn quét khác đơn vị. Unit test dùng repository/transaction giả lập, chưa chứng minh hành vi cạnh tranh trên PostgreSQL thật.

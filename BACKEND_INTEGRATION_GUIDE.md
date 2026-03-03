# TÀI LIỆU HƯỚNG DẪN IMPLEMENT BACKEND CỤ THỂ (DUT Job Fair Checkin)

Tài liệu này được tổng hợp từ toàn bộ source code frontend Next.js của dự án. Mục tiêu là cung cấp một bản thiết kế backend (API và logic) cho phép bạn sử dụng bất kỳ ngôn ngữ/framework nào (Node.js/NestJS/Express, Spring Boot, Laravel, Python) cũng có thể code backend thỏa mãn ngay lập tức các tính năng mà frontend đang gọi qua `api-client.ts`.

## 1. Cấu hình & Base Config
1. **Base URL**: Backend nên chạy ở `http://localhost:3001` (Cấu hình proxy cho FE để connect). Prefix API là `/api/`.
2. **Authentication**: Sử dụng **JWT (JSON Web Token)**. API Auth cần trả về Bearer Token đóng gói trong Header. FE lưu state thông qua thẻ `localStorage.getItem('auth_token')`. Cần thiết lập CORS allow domain của frontend.

---

## 2. Các Entities Database (Database Schema)

Dựa trên `lib/database-models.ts`, hệ thống của bạn cần setup các Models/Tables cơ bản với Reference Keys sau:

### Core Users & Auth
- **UserAccount**: `id`, `email`, `phone`, `role` (visitor, school_admin, business_admin, superadmin, booth_staff), `status`, `linkedProfileId`, `lastLogin`
- **AccessControl**: Bảng mapping Permissions (canViewStudents, canExportData,...)

### School & Student
- **School**: `id`, `name`, `code`, `address`, `phone`, `email`, `principalName`
- **StudentProfile**: Liên kết `userId` hoặc `linkedProfileId`. Chứa `mssv`, `fullName`, `email`, `phone`, `gender`, `schoolId`, `major`, `year`, `skills`, `interests`.

### Business & Event
- **BusinessProfile**: `id`, `name`, `industry`, `description`, `contact`
- **JobFairEvent**: Bảng quản lý sự kiện lớn
- **Booth (Gian hàng)**: `id`, `businessId`, `boothName`, `location`, `capacity`, `scheduleStart`, `scheduleEnd`
- **JobPosition (Vị trí tuyển dụng)**: `boothId`, `title`, `description`, `quantity`, `level`, `salary`

### Scanning / Check-in Interaction
- **StudentCheckIn / ScanRecord**: `id`, `studentId/visitorId`, `boothId`, `timestamp`, `status` (success, duplicate, error, pending), `duration`, `notes`
- **InteractionLog**: Lưu dấu vết (check_in, message, application, interview)
- **MatchingScore**: Table cho các điểm matching AI/Rules (nếu có)

---

## 3. Danh sách API (RESTful Endpoints)

Từ file `lib/constants.ts` và `lib/types.ts`, đây là cách bạn cần define các HTTP Routes ở HTTP Server:

### 3.1. Authentication (`/api/auth`)
| Method | Endpoint | Mô tả & Payload dự kiến |
|---|---|---|
| `POST` | `/auth/login` | **Body:** `{ email, password }` <br/> **Response:** `{ data: { id, email, name, role, token, refreshToken } }` |
| `POST` | `/auth/register` | Đăng ký Visitor / Business. |
| `POST` | `/auth/logout` | Huy JWT / Logout session. |
| `POST` | `/auth/refresh` | **Body:** `{ refreshToken }` để lấy token mới. |
| `GET`  | `/auth/me` | Lấy profile user đang login dựa trên JWT Bearer token. |

### 3.2. QR Scanner (`/api/scanner`)
Các user có quyền scan tại booth sẽ gọi API này:
| Method | Endpoint | Mô tả & Payload dự kiến |
|---|---|---|
| `POST` | `/scanner/scan` | **Body:** `{ visitorCode: "20T..., mã sinh viên", boothId: "uuid" }` <br/> **Response (`ScanResponse`):** `{ success: true, status: 'success'|'duplicate', message: '...', visitor: { id, fullName, studentCode, major... }, scanId: string }` |
| `GET`  | `/scanner/visitor/:visitorId` | Lấy detail một visitor cụ thể sau khi scan. |
| `GET`  | `/scanner/scans` | Lấy lịch sử tất cả các lượt check-in của booth. Hỗ trợ Query phân trang `?page=1&pageSize=10`. |
| `GET`  | `/scanner/recent-scans` | Lấy nhanh khoảng 5-10 scan mới nhất. |

### 3.3. Dashboard School Admin (`/api/school-admin`)
| Method | Endpoint | Mô tả & Payload dự kiến |
|---|---|---|
| `GET`  | `/school-admin/dashboard` | **Response (`SchoolAdminDashboard`):** Trả về summary toàn bộ dự án (`stats`, `booths`, `prizes`, `recentScans`). Xem chi tiết `DashboardStats` để trả về các metric đếm tổng số tương ứng. |
| `GET`  | `/school-admin/stats` | Trả về statistics chi tiết hơn dạng Trends. |
| `GET`  | `/school-admin/booths` | Lấy danh sách toàn bộ gian hàng. |
| `GET`  | `/school-admin/prizes` | Lấy danh sách phần thưởng cho sinh viên. |
| `PUT`  | `/school-admin/prizes/:prizeId` | Cập nhật số lượng hoặc trạng thái prize. |
| `GET`  | `/school-admin/visitors` | Lấy danh sách toàn bộ sinh viên. (Có Phân trang `PaginationParams`). |
| `POST` | `/school-admin/export` | Yêu cầu trích xuất dữ liệu. |

### 3.4. Dashboard Business Admin (`/api/business-admin`)
| Method | Endpoint | Mô tả & Payload dự kiến |
|---|---|---|
| `GET`  | `/business-admin/dashboard` | **Response (`BusinessAdminDashboard`):** Tổng quan cho riêng business đó (các thông số Check In của riêng booth họ quản lý). |
| `GET`  | `/business-admin/booth/:boothId` | Lấy thống kê của một booth cụ thể. |
| `GET`  | `/business-admin/visitors` | Lấy danh sách sinh viên CÓ CHECK-IN VÀO BOOTH ĐÓ. |
| `POST` | `/business-admin/export-visitors` | Phục vụ chức năng Export File Excel sinh viên tham gia. |
| `PATCH`| `/business-admin/booth/:boothId/settings` | Cài đặt gian hàng (staff, name, vị trí). |

---

## 4. Dấu hiệu Wrapper & Tiêu chuẩn Response API
Trong file `lib/api-client.ts`, Frontend đã xây sẵn 1 HTTP Client fetcher có format Response mặc định như sau. **MỌI API BACKEND KHI TRẢ VỀ ĐỀU PHẢI Wrap theo format này:**

```json
// KHI THÀNH CÔNG: HTTP 200, 201
{
  "data": { ... your object payload ... },
  "status": 200
  // message là tùy chọn
}

// KHI THẤT BẠI: HTTP 400, 401, 403, 404, 500
{
  "error": "Tên lỗi ngắn gọn gọn",
  "message": "Chi tiết lỗi ví dụ 'Mật khẩu sai' hay 'Sinh viên chưa đăng ký'",
  "status": 400,
  "code": "ERROR_CODE_TUI_TUY_CHINH"
}
```

**Ví dụ:** Nếu token không hợp lệ, trả về HTTP 401:
```json
{
  "message": "Token expired or invalid",
  "status": 401
}
```

## 5. Dữ liệu MockData frontend (gợi ý)
Nên Insert Script hoặc Seed data tương tự file `lib/mock-data.ts` khi dev backend để frontend không bị vỡ giao diện:
- Tạo sẵn Booths: 'Google Vietnam', 'Samsung Electronics', 'FPT Software'
- Sinh viên có MSSV, Ngành học, Năm học (1-4).
- Số giờ lưu Database cần tuân theo Timezone chuẩn.

---
## Lời Khuyên cho Triển Khai Thực Tế

1. Cấu trúc DB trên đã rất chuẩn với **Relational DB** (PostgreSQL / MySQL) -> Bạn có thể dùng **Prisma ORM** hoặc **TypeORM** ở backend.
2. Endpoint checkin `/scanner/scan` là cốt lõi (Cần xử lý Concurrency (race condition) tốt vì tại sự kiện có nhiều thiết bị scan cùng lúc).
3. Đề nghị setup 1 cronjob nếu cần quét kết quả tự động matching học sinh và doanh nghiệp.

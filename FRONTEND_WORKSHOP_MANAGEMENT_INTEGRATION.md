# Tích Hợp UI Cho Hội Thảo Và Quản Lý Workshop Bên School Admin

Tài liệu này dành cho frontend triển khai:

- Màn hình điểm danh hội thảo
- Thêm thủ công và xoá khỏi danh sách điểm danh
- Màn hình school admin quản lý workshop
- Trang chi tiết workshop
- Modal tạo tài khoản cho workshop

## 1. Base URL

- Base URL backend: `https://your-domain.com/api`

Các nhóm API dùng trong tài liệu này:

- Hội thảo: `/business-admin`
- School admin: `/school-admin`

Tất cả API đều cần Bearer token.

## 2. Màn Hình Hội Thảo

### 2.1. Lấy danh sách điểm danh hội thảo

API:

`GET /api/business-admin/workshop-attendance`

Response mẫu:

```json
{
  "data": {
    "workshop": {
      "id": "booth-id",
      "name": "Hội thảo CV Ấn tượng – Phỏng vấn tự tin",
      "displayName": "Hội thảo Kỹ năng chuyên đề “CV Ấn tượng – Phỏng vấn tự tin”",
      "location": "Khu hội thảo - Phòng WS01",
      "business": "Hội thảo Kỹ năng chuyên đề “CV Ấn tượng – Phỏng vấn tự tin”",
      "type": "workshop"
    },
    "total": 3,
    "items": [
      {
        "stt": 1,
        "studentId": "student-id",
        "workshopName": "Hội thảo Kỹ năng chuyên đề “CV Ấn tượng – Phỏng vấn tự tin”",
        "fullName": "Nguyễn Văn A",
        "studentCode": "102230313",
        "className": "23T_DT4",
        "department": "Khoa Công nghệ Thông tin",
        "phone": "0385544281",
        "checkInTime": "2026-04-01 08:15:23"
      }
    ]
  },
  "status": 200
}
```

Frontend nên ưu tiên hiển thị:

- `workshop.displayName`
- `items[].workshopName`

để ra đúng tên đầy đủ:

`Hội thảo Kỹ năng chuyên đề “CV Ấn tượng – Phỏng vấn tự tin”`

### 2.2. Xuất CSV và Excel

CSV:

`GET /api/business-admin/workshop-attendance/export`

Excel:

`GET /api/business-admin/workshop-attendance/export/excel`

Cả 2 file đều có các cột:

- `STT`
- `Tên hội thảo`
- `Họ và tên`
- `MSSV`
- `Lớp`
- `Khoa`
- `SĐT`
- `Thời gian điểm danh`

Tên sheet Excel:

- `Điểm danh hội thảo`

### 2.3. Thêm sinh viên bằng tay

API:

`POST /api/business-admin/workshop-attendance/manual`

Body mẫu:

```json
{
  "fullName": "Nguyễn Văn A",
  "studentCode": "102230000",
  "className": "23T_DT3",
  "department": "Khoa Công nghệ Thông tin",
  "phone": "0123456789",
  "email": "example@gmail.com",
  "checkInTime": "2026-04-01T08:15:23+07:00"
}
```

Lưu ý:

- `fullName` và `studentCode` là bắt buộc
- `checkInTime` là tùy chọn
- nếu không truyền `checkInTime`, backend dùng thời gian hiện tại
- backend tự tính `year` từ MSSV
- backend không dùng `major`
- nếu MSSV đã tồn tại, backend cập nhật lại hồ sơ sinh viên
- nếu sinh viên đã có trong danh sách hội thảo đó rồi, backend trả lỗi `400`

Response thành công:

```json
{
  "data": {
    "message": "Đã thêm sinh viên vào danh sách điểm danh hội thảo",
    "workshop": {
      "id": "booth-id",
      "name": "Hội thảo CV Ấn tượng – Phỏng vấn tự tin",
      "displayName": "Hội thảo Kỹ năng chuyên đề “CV Ấn tượng – Phỏng vấn tự tin”",
      "type": "workshop"
    },
    "item": {
      "stt": 15,
      "studentId": "student-id",
      "workshopName": "Hội thảo Kỹ năng chuyên đề “CV Ấn tượng – Phỏng vấn tự tin”",
      "fullName": "Nguyễn Văn A",
      "studentCode": "102230000",
      "className": "23T_DT3",
      "department": "Khoa Công nghệ Thông tin",
      "phone": "0123456789",
      "checkInTime": "2026-04-01 08:15:23"
    }
  },
  "status": 201
}
```

### 2.4. Xoá sinh viên khỏi danh sách điểm danh

API:

`DELETE /api/business-admin/workshop-attendance/:studentCode`

Ví dụ:

`DELETE /api/business-admin/workshop-attendance/102230000`

Response thành công:

```json
{
  "data": {
    "message": "Đã xoá sinh viên khỏi danh sách điểm danh hội thảo",
    "deletedStudentCode": "102230000",
    "deletedCheckins": 1,
    "workshop": {
      "id": "booth-id",
      "name": "Hội thảo CV Ấn tượng – Phỏng vấn tự tin",
      "displayName": "Hội thảo Kỹ năng chuyên đề “CV Ấn tượng – Phỏng vấn tự tin”",
      "type": "workshop"
    }
  },
  "status": 200
}
```

### 2.5. Gợi ý UI cho màn hội thảo

Đầu trang nên có:

- tên hội thảo: dùng `workshop.displayName`
- địa điểm
- tổng số sinh viên điểm danh

Toolbar nên có:

- `Tải Excel`
- `Tải CSV`
- `Thêm bằng tay`

Bảng nên có cột:

- `STT`
- `Họ và tên`
- `MSSV`
- `Lớp`
- `Khoa`
- `SĐT`
- `Thời gian điểm danh`
- `Thao tác`

Ở cột `Thao tác`:

- nút `Xoá`

### 2.6. Flow UI cho modal thêm bằng tay

Form đề xuất:

- `Họ và tên` - bắt buộc
- `MSSV` - bắt buộc
- `Lớp`
- `Khoa`
- `SĐT`
- `Email`
- `Thời gian điểm danh`

Flow:

1. User bấm `Thêm bằng tay`
2. Mở modal
3. Submit tới `POST /api/business-admin/workshop-attendance/manual`
4. Nếu thành công:
   - đóng modal
   - gọi lại `GET /api/business-admin/workshop-attendance`
   - hoặc chèn `item` mới vào bảng và đánh lại `STT`
5. Nếu backend trả lỗi trùng:
   - hiển thị `Sinh viên này đã có trong danh sách điểm danh của hội thảo`

### 2.7. Flow UI cho xoá

1. User bấm `Xoá`
2. Mở confirm dialog
3. Nội dung xác nhận nên có:
   - họ tên
   - MSSV
   - tên hội thảo
4. Nếu xác nhận:
   - gọi `DELETE /api/business-admin/workshop-attendance/:studentCode`
5. Nếu thành công:
   - reload lại danh sách
   - hoặc xoá local row rồi đánh lại `STT`

Đề xuất câu xác nhận:

`Bạn có chắc muốn xoá sinh viên này khỏi danh sách điểm danh hội thảo không?`

## 3. School Admin: Quản Lý Workshop

### 3.1. Danh sách workshop

API:

`GET /api/school-admin/workshops`

Response mẫu:

```json
{
  "data": [
    {
      "id": "booth-id",
      "name": "Hội thảo CV Ấn tượng – Phỏng vấn tự tin",
      "displayName": "Hội thảo Kỹ năng chuyên đề “CV Ấn tượng – Phỏng vấn tự tin”",
      "location": "Khu hội thảo - Phòng WS01",
      "capacity": 200,
      "qrCode": "WORKSHOP-WS01",
      "type": "workshop",
      "totalScans": 180,
      "uniqueStudents": 170,
      "hasAccount": true,
      "account": {
        "id": "user-id",
        "email": "cv-workshop@jobfair",
        "name": "Tài khoản hội thảo CV Ấn tượng",
        "isActive": true,
        "createdAt": "2026-04-08T09:00:00.000Z"
      }
    }
  ],
  "status": 200
}
```

Màn danh sách workshop nên có các cột:

- `Tên hội thảo`
- `Địa điểm`
- `Sức chứa`
- `Tổng lượt quét`
- `Sinh viên duy nhất`
- `Tài khoản`
- `Trạng thái`
- `Thao tác`

Gợi ý render:

- tên hiển thị: dùng `displayName`
- cột `Tài khoản`:
  - nếu `hasAccount = true` -> hiện email
  - nếu `hasAccount = false` -> hiện `Chưa có tài khoản`
- cột `Thao tác`:
  - `Xem chi tiết`
  - `Tạo tài khoản` nếu chưa có account

### 3.2. Chi tiết workshop

API:

`GET /api/school-admin/workshops/:boothId`

Response mẫu:

```json
{
  "data": {
    "workshop": {
      "id": "booth-id",
      "name": "Hội thảo CV Ấn tượng – Phỏng vấn tự tin",
      "displayName": "Hội thảo Kỹ năng chuyên đề “CV Ấn tượng – Phỏng vấn tự tin”",
      "businessId": "business-id",
      "business": "Hội thảo Kỹ năng chuyên đề “CV Ấn tượng – Phỏng vấn tự tin”",
      "location": "Khu hội thảo - Phòng WS01",
      "capacity": 200,
      "qrCode": "WORKSHOP-WS01",
      "type": "workshop"
    },
    "account": {
      "id": "user-id",
      "email": "cv-workshop@jobfair",
      "name": "Tài khoản hội thảo CV Ấn tượng",
      "isActive": true,
      "createdAt": "2026-04-08T09:00:00.000Z"
    },
    "stats": {
      "totalScans": 180,
      "uniqueStudents": 170
    },
    "departmentDistribution": [
      {
        "department": "Khoa Công nghệ Thông tin",
        "count": 55
      }
    ],
    "recentCheckins": [
      {
        "id": "checkin-id",
        "checkInTime": "2026-04-01T01:15:23.000Z",
        "student": {
          "id": "student-id",
          "fullName": "Nguyễn Văn A",
          "studentCode": "102230313",
          "className": "23T_DT4",
          "department": "Khoa Công nghệ Thông tin",
          "phone": "0385544281"
        }
      }
    ]
  },
  "status": 200
}
```

Trang chi tiết workshop nên có:

- khối thông tin workshop
- khối thông tin tài khoản
- KPI:
  - `Tổng lượt quét`
  - `Sinh viên duy nhất`
- bảng `Khoa tham gia`
- bảng `Lượt check-in gần nhất`

### 3.3. Tạo tài khoản workshop

API:

`POST /api/school-admin/workshops/:boothId/account`

Body mẫu:

```json
{
  "email": "cv-workshop@jobfair",
  "password": "password123",
  "name": "Tài khoản hội thảo CV Ấn tượng"
}
```

Lưu ý:

- `email` và `password` là bắt buộc
- `name` là tùy chọn
- nếu không truyền `name`, backend sẽ dùng tên hội thảo
- backend chặn nếu workshop đã có account
- backend chặn nếu email đã tồn tại

Response thành công:

```json
{
  "data": {
    "message": "Đã tạo tài khoản cho workshop",
    "workshop": {
      "id": "booth-id",
      "name": "Hội thảo CV Ấn tượng – Phỏng vấn tự tin",
      "displayName": "Hội thảo Kỹ năng chuyên đề “CV Ấn tượng – Phỏng vấn tự tin”",
      "type": "workshop"
    },
    "account": {
      "id": "user-id",
      "email": "cv-workshop@jobfair",
      "name": "Tài khoản hội thảo CV Ấn tượng",
      "role": "business_admin",
      "isActive": true,
      "boothId": "booth-id"
    }
  },
  "status": 201
}
```

### 3.4. Flow UI cho modal tạo tài khoản workshop

Form đề xuất:

- `Email đăng nhập` - bắt buộc
- `Mật khẩu` - bắt buộc
- `Tên hiển thị tài khoản`

Flow:

1. User vào màn danh sách workshop
2. Bấm `Tạo tài khoản` ở workshop chưa có account
3. Mở modal
4. Submit tới `POST /api/school-admin/workshops/:boothId/account`
5. Nếu thành công:
   - đóng modal
   - reload `GET /api/school-admin/workshops`
   - hoặc update local row
6. Nếu lỗi:
   - `Workshop này đã có tài khoản`
   - `Email đã được sử dụng`

### 3.5. Gợi ý màn school admin

Màn `Quản lý workshop` nên có:

- tab hoặc menu riêng `Workshop`
- bảng danh sách workshop
- nút `Xem chi tiết`
- nút `Tạo tài khoản` cho workshop chưa có account

Màn `Chi tiết workshop` nên có:

- thông tin workshop
- thông tin tài khoản
- thống kê tổng quan
- phân bố theo khoa
- danh sách check-in gần nhất

## 4. Mapping UI Đề Xuất

- `displayName` -> tên hiển thị chính
- `name` -> tên ngắn nội bộ của booth
- `business` -> tên đầy đủ của hội thảo
- `department` -> label UI là `Khoa`
- `checkInTime` -> label UI là `Thời gian điểm danh`
- `hasAccount` -> dùng để quyết định hiện `Tạo tài khoản` hay `Đã có tài khoản`

## 5. Tóm Tắt Nhanh

### Cho tài khoản hội thảo

1. Gọi `GET /api/business-admin/workshop-attendance`
2. Hiển thị tên hội thảo bằng `workshop.displayName`
3. Render bảng điểm danh
4. Gắn `Thêm bằng tay`
5. Gắn `Xoá` cho từng dòng
6. Export:
   - CSV: `/api/business-admin/workshop-attendance/export`
   - Excel: `/api/business-admin/workshop-attendance/export/excel`

### Cho school admin

1. Gọi `GET /api/school-admin/workshops`
2. Render danh sách workshop
3. Gọi `GET /api/school-admin/workshops/:boothId`` khi vào chi tiết
4. Nếu workshop chưa có account:
   - mở modal tạo account
   - gọi `POST /api/school-admin/workshops/:boothId/account`

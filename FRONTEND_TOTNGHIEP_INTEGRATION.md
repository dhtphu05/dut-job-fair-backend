# Frontend Totnghiep Integration Guide

Tai lieu nay danh cho frontend admin va frontend account `Totnghiep`.

Muc tieu:

- Hien thi tab rieng cho `Totnghiep`
- Quan ly danh sach, tao moi, tao/cap nhat account `Totnghiep`
- Hien thi thong ke rieng cua `Totnghiep`
- Ho tro diem danh thu cong va export du lieu cho account `Totnghiep`

## 1. Base URL

- Base URL backend: `https://your-domain.com/api`
- Prefix school admin: `/school-admin`
- Prefix business admin: `/business-admin`

## 2. Auth

### School admin APIs

Can Bearer token cua:

- `school_admin`
- `system_admin`

### Totnghiep attendance APIs

Can Bearer token cua:

- `business_admin` duoc gan vao booth `type = totnghiep`
- `school_admin`
- `system_admin`

## 3. Type moi can FE xu ly

He thong da mo rong them 1 type moi:

```ts
type BusinessType = "booth" | "workshop" | "totnghiep";
type BoothType = "booth" | "workshop" | "totnghiep";
```

Frontend can cap nhat cac logic dang hardcode chi co `booth` va `workshop`.

Khi render tab hoac badge:

- `booth`: gian hang doanh nghiep
- `workshop`: workshop
- `totnghiep`: khu/nhom Totnghiep

## 4. School Admin APIs cho tab Totnghiep

### 4.1. Lay danh sach Totnghiep

API:

`GET /api/school-admin/totnghieps`

Response mau:

```json
{
  "data": [
    {
      "id": "booth-id",
      "name": "Tot nghiep 2026",
      "displayName": "Tot nghiep 2026",
      "location": null,
      "capacity": 100,
      "qrCode": "TN-AB12CD34",
      "type": "totnghiep",
      "totalScans": 35,
      "uniqueStudents": 28,
      "account": {
        "id": "user-id",
        "email": "totnghiep@jobfair",
        "name": "Tai khoan Totnghiep 2026",
        "isActive": true,
        "createdAt": "2026-04-24T09:00:00.000Z"
      },
      "hasAccount": true
    }
  ],
  "status": 200
}
```

Y nghia:

- `id`: booth id cua Totnghiep
- `displayName`: ten uu tien de render
- `type`: luon la `totnghiep`
- `totalScans`: tong luot quet
- `uniqueStudents`: tong sinh vien unique
- `account`: thong tin account da gan, neu chua co thi `null`
- `hasAccount`: frontend co the dung de hien nut `Tao tai khoan`

### 4.2. Lay chi tiet 1 Totnghiep

API:

`GET /api/school-admin/totnghieps/:boothId`

Response mau:

```json
{
  "data": {
    "totnghiep": {
      "id": "booth-id",
      "name": "Tot nghiep 2026",
      "displayName": "Tot nghiep 2026",
      "businessId": "business-id",
      "business": "Tot nghiep 2026",
      "location": null,
      "capacity": 100,
      "qrCode": "TN-AB12CD34",
      "type": "totnghiep"
    },
    "account": {
      "id": "user-id",
      "email": "totnghiep@jobfair",
      "name": "Tai khoan Totnghiep 2026",
      "isActive": true,
      "createdAt": "2026-04-24T09:00:00.000Z"
    },
    "stats": {
      "totalScans": 35,
      "uniqueStudents": 28
    },
    "departmentDistribution": [
      {
        "department": "Cong nghe thong tin",
        "count": 15
      }
    ],
    "recentCheckins": [
      {
        "id": "checkin-id",
        "checkInTime": "2026-04-24T09:30:00.000Z",
        "student": {
          "id": "student-id",
          "fullName": "Nguyen Van A",
          "studentCode": "102230001",
          "className": "22TCLC1",
          "department": "Cong nghe thong tin",
          "phone": "0905000001"
        }
      }
    ]
  },
  "status": 200
}
```

### 4.3. Tao Totnghiep moi

API:

`POST /api/school-admin/totnghieps`

Body:

```json
{
  "name": "Tot nghiep 2026",
  "email": "totnghiep@jobfair",
  "password": "password123"
}
```

Response:

```json
{
  "data": {
    "message": "Tạo Totnghiep và tài khoản thành công",
    "data": {
      "business": {
        "id": "business-id",
        "name": "Tot nghiep 2026",
        "type": "totnghiep"
      },
      "booth": {
        "id": "booth-id",
        "name": "Tot nghiep 2026",
        "type": "totnghiep",
        "qrCode": "TN-AB12CD34"
      },
      "account": {
        "id": "user-id",
        "email": "totnghiep@jobfair",
        "name": "Tot nghiep 2026"
      }
    }
  },
  "status": 201
}
```

### 4.4. Tao account cho Totnghiep da co san

API:

`POST /api/school-admin/totnghieps/:boothId/account`

Body:

```json
{
  "email": "totnghiep@jobfair",
  "password": "password123",
  "name": "Tai khoan Totnghiep 2026"
}
```

### 4.5. Cap nhat account Totnghiep

API:

`PATCH /api/school-admin/totnghieps/:boothId/account`

Body:

```json
{
  "email": "totnghiep-new@jobfair",
  "password": "newpassword123",
  "name": "Tai khoan Totnghiep moi"
}
```

## 5. School Admin dashboard/stats da duoc mo rong

Frontend can cap nhat cac type map o dashboard chung.

### 5.1. `GET /api/school-admin/dashboard`

Trong `stats` da co them:

```json
{
  "totalBooths": 40,
  "totalWorkshops": 6,
  "totalTotnghieps": 3,
  "byType": {
    "booth": {
      "totalUnits": 40,
      "totalCheckins": 1200,
      "uniqueVisitors": 900
    },
    "workshop": {
      "totalUnits": 6,
      "totalCheckins": 180,
      "uniqueVisitors": 160
    },
    "totnghiep": {
      "totalUnits": 3,
      "totalCheckins": 95,
      "uniqueVisitors": 80
    }
  }
}
```

Frontend nen:

- them card/tile `Totnghiep`
- them tab/filter `totnghiep`
- khong hardcode `byType` chi co 2 key

### 5.2. `GET /api/school-admin/stats`

`checkinTypeDistribution` gio co the tra ve:

```json
[
  { "type": "booth", "count": 1200, "uniqueStudents": 900 },
  { "type": "workshop", "count": 180, "uniqueStudents": 160 },
  { "type": "totnghiep", "count": 95, "uniqueStudents": 80 }
]
```

### 5.3. `GET /api/school-admin/checkins`

Moi item `booth.type` co the la `totnghiep`.

Vi du:

```json
{
  "booth": {
    "id": "booth-id",
    "name": "Tot nghiep 2026",
    "displayName": "Tot nghiep 2026",
    "business": "Tot nghiep 2026",
    "type": "totnghiep"
  }
}
```

### 5.4. `GET /api/school-admin/booth-stats`

Moi item cung co the co:

```json
{
  "type": "totnghiep"
}
```

## 6. Business Admin APIs cho account Totnghiep

Luot report/export cua `Totnghiep` duoc tach rieng, mirror 1:1 voi workshop.

### 6.1. Lay danh sach diem danh Totnghiep

API:

`GET /api/business-admin/totnghiep-attendance`

Neu la `system_admin` hoac `school_admin`, co the truyen them:

`GET /api/business-admin/totnghiep-attendance?boothId=<boothId>`

Response mau:

```json
{
  "data": {
    "totnghiep": {
      "id": "booth-id",
      "name": "Tot nghiep 2026",
      "displayName": "Tot nghiep 2026",
      "location": null,
      "business": "Tot nghiep 2026",
      "type": "totnghiep"
    },
    "total": 2,
    "items": [
      {
        "stt": 1,
        "studentId": "student-id",
        "totnghiepName": "Tot nghiep 2026",
        "fullName": "Nguyen Van A",
        "studentCode": "102230001",
        "className": "22TCLC1",
        "department": "Cong nghe thong tin",
        "phone": "0905000001",
        "checkInTime": "2026-04-24 16:20:10"
      }
    ]
  },
  "status": 200
}
```

Luu y:

- field ten don vi la `totnghiepName`
- frontend khong dung `workshopName` cho route nay

### 6.2. Lay data de frontend tu export

API:

`GET /api/business-admin/totnghiep-attendance/export-data`

Response se co:

- `fileName`
- `sheetName`
- `columns`
- `rows`
- `total`

Vi du:

```json
{
  "data": {
    "fileName": "totnghiep-attendance-tot-nghiep-2026.xls",
    "sheetName": "Điểm danh Totnghiep",
    "columns": [
      { "key": "stt", "title": "STT" },
      { "key": "totnghiepName", "title": "Tên Totnghiep" },
      { "key": "fullName", "title": "Họ và tên" }
    ],
    "rows": [
      {
        "stt": 1,
        "totnghiepName": "Tot nghiep 2026",
        "fullName": "Nguyen Van A",
        "studentCode": "102230001",
        "className": "22TCLC1",
        "department": "Cong nghe thong tin",
        "phone": "0905000001",
        "checkInTime": "2026-04-24 16:20:10"
      }
    ],
    "total": 1
  },
  "status": 200
}
```

### 6.3. Export file tu backend

Frontend co the goi truc tiep:

- `GET /api/business-admin/totnghiep-attendance/export`
- `GET /api/business-admin/totnghiep-attendance/export/excel`

Neu can target 1 booth cu the bang quyen admin:

- `GET /api/business-admin/totnghiep-attendance/export?boothId=<boothId>`
- `GET /api/business-admin/totnghiep-attendance/export/excel?boothId=<boothId>`

### 6.4. Them diem danh thu cong

API:

`POST /api/business-admin/totnghiep-attendance/manual`

Body:

```json
{
  "studentCode": "102230001",
  "fullName": "Nguyen Van A",
  "phone": "0905000001",
  "className": "22TCLC1",
  "department": "Cong nghe thong tin",
  "email": "102230001@sv.dut.edu.vn",
  "checkInTime": "2026-04-24T09:20:10.000Z"
}
```

### 6.5. Xoa diem danh

API:

`DELETE /api/business-admin/totnghiep-attendance/:studentCode`

Vi du:

```http
DELETE /api/business-admin/totnghiep-attendance/102230001
Authorization: Bearer <access_token>
```

## 7. Business Admin dashboard da co bucket Totnghiep

API:

`GET /api/business-admin/dashboard?businessId=<businessId>`

`stats` da co them:

```json
{
  "totalBooths": 2,
  "totalWorkshops": 1,
  "totalTotnghieps": 1,
  "byType": {
    "booth": {
      "totalUnits": 2,
      "totalVisitors": 100,
      "uniqueVisitors": 90
    },
    "workshop": {
      "totalUnits": 1,
      "totalVisitors": 40,
      "uniqueVisitors": 35
    },
    "totnghiep": {
      "totalUnits": 1,
      "totalVisitors": 25,
      "uniqueVisitors": 22
    }
  }
}
```

Frontend business admin neu dang render chart/tab theo loai can them `totnghiep`.

## 8. Goi y type cho frontend

```ts
export type BusinessType = "booth" | "workshop" | "totnghiep";
export type BoothType = BusinessType;

export type SchoolAdminTypeStats = {
  totalUnits: number;
  totalCheckins?: number;
  totalVisitors?: number;
  uniqueVisitors?: number;
};

export type ManagedTotnghiepItem = {
  id: string;
  name: string;
  displayName: string;
  location: string | null;
  capacity: number;
  qrCode: string | null;
  type: "totnghiep";
  totalScans: number;
  uniqueStudents: number;
  account: {
    id: string;
    email: string;
    name: string;
    isActive: boolean;
    createdAt: string;
  } | null;
  hasAccount: boolean;
};

export type TotnghiepAttendanceRow = {
  stt: number;
  studentId: string;
  totnghiepName: string;
  fullName: string;
  studentCode: string;
  className: string | null;
  department: string | null;
  phone: string | null;
  checkInTime: string;
};
```

## 9. Checklist FE can update

- Them tab `Totnghiep` o school admin
- Them route/page danh sach `Totnghiep`
- Them form `Tao Totnghiep`
- Them form `Tao/Cap nhat account Totnghiep`
- Cap nhat dashboard cards va charts de nhan `totalTotnghieps` va `byType.totnghiep`
- Cap nhat bang check-in/booth-stats de badge `type = totnghiep`
- Neu co business admin UI cho workshop attendance, co the clone sang `totnghiep-attendance`

## 10. Luu y tuong thich

- `Totnghiep` van dung `role = business_admin`, khong co role moi.
- Cac route cu cua `workshop` va `business-accounts` van giu nguyen.
- `displayName` nen duoc uu tien de render thay vi tu xu ly theo `name`/`business`.

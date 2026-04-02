# Frontend Rewards Integration Guide

Tai lieu nay danh cho frontend ben thu 3, dac biet la WordPress co chen React de render giao dien va QR doi qua.

## 1. Muc tieu

Frontend can ho tro 2 flow rieng:

1. Sinh vien xem tien do check-in va tao QR doi qua.
2. Quay qua quet QR va redeem one-time.

## 2. Base URL

- Base URL backend: `https://your-domain.com/api`
- Prefix rewards: `/rewards`
- Prefix checkins public: `/checkins`

Vi du:

- `GET /api/rewards/public/progress/:studentCode`
- `GET /api/rewards/public/student-status/:studentCode`
- `GET /api/checkins/public/by-student-code/:studentCode`
- `POST /api/rewards/public/claim-request`
- `GET /api/rewards/public/claim-status/:requestCode`
- `POST /api/rewards/redeem`

## 2b. API cho man sinh vien hien thi doanh nghiep da check-in

Frontend student neu muon hien thi danh sach doanh nghiep da ghe, tong so booth da tham gia, va logo doanh nghiep thi goi:

`GET /api/checkins/public/by-student-code/:studentCode`

Vi du:

```http
GET /api/checkins/public/by-student-code/DUT000001
```

Response mau:

```json
{
  "data": {
    "studentCode": "DUT000001",
    "fullName": "Nguyen Van A",
    "checkedInBooths": 5,
    "totalBusinesses": 4,
    "businesses": [
      {
        "businessId": "4a6d1fb7-3d08-4378-b63b-17b5ef1cb16d",
        "businessName": "FPT Software Miền Trung",
        "publicId": "FPT_Software_ewuyrj",
        "logoUrl": "https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/FPT_Software_ewuyrj.png",
        "industry": null,
        "website": null,
        "boothId": "00f35b2f-6bb3-44a4-9931-cf3c8e4d53fa",
        "boothName": "Gian hàng FPT Software Miền Trung",
        "lastCheckInTime": "2026-04-01T06:32:15.000Z"
      }
    ]
  },
  "status": 200
}
```

Y nghia field:

- `checkedInBooths`: tong so booth duy nhat sinh vien da check-in
- `totalBusinesses`: tong so doanh nghiep duy nhat sinh vien da ghe
- `businesses[].logoUrl`: URL day du de frontend render logo bang the `img`
- `businesses[].publicId`: id asset de frontend dung them neu can mapping/styling rieng
- `businesses[].lastCheckInTime`: lan check-in moi nhat cua sinh vien voi doanh nghiep do

Frontend co the render card don gian nhu sau:

```tsx
type VisitedBusiness = {
  businessId: string;
  businessName: string;
  publicId: string | null;
  logoUrl: string | null;
  industry: string | null;
  website: string | null;
  boothId: string;
  boothName: string;
  lastCheckInTime: string;
};

function VisitedBusinessCard({ business }: { business: VisitedBusiness }) {
  return (
    <article>
      {business.logoUrl ? (
        <img
          src={business.logoUrl}
          alt={business.businessName}
          width={64}
          height={64}
          style={{ objectFit: 'contain' }}
        />
      ) : null}
      <h3>{business.businessName}</h3>
      <p>{business.boothName}</p>
      <p>{new Date(business.lastCheckInTime).toLocaleString('vi-VN')}</p>
    </article>
  );
}
```

Frontend nen uu tien `logoUrl` de hien thi truc tiep. Khong can tu ghep URL tu `publicId`.

## 3. Flow cho frontend sinh vien

### Buoc 1: Lay tien do nhan qua

API:

`GET /api/rewards/public/progress/:studentCode`

Vi du:

```http
GET /api/rewards/public/progress/102230313
```

Response mau:

```json
{
  "data": {
    "studentCode": "102230313",
    "fullName": "Nguyen Van A",
    "checkedInBooths": 4,
    "milestones": [
      {
        "id": "milestone-1",
        "name": "Moc khoa DUT Job Fair",
        "description": "Qua tang cho sinh vien du 3 booth",
        "requiredBooths": 3,
        "eligible": true,
        "claimed": false,
        "pendingClaim": null
      },
      {
        "id": "milestone-2",
        "name": "Ao thun DUT Job Fair",
        "description": "Qua tang cho sinh vien du 5 booth",
        "requiredBooths": 5,
        "eligible": false,
        "claimed": false,
        "pendingClaim": null
      }
    ],
    "nextMilestone": {
      "id": "milestone-2",
      "name": "Ao thun DUT Job Fair",
      "requiredBooths": 5,
      "remainingBooths": 1
    }
  },
  "status": 200
}
```

Frontend nen hien:

- So booth da check-in: `checkedInBooths`
- Danh sach moc qua
- Trang thai moi moc:
  - chua du dieu kien
  - da du dieu kien nhung chua tao claim
  - dang co QR pending
  - da nhan qua

### Logic render cho moi milestone

- `eligible = false`:
  - disable nut `Nhan qua`
  - hien `Con thieu X booth`
- `eligible = true` va `claimed = false` va `pendingClaim = null`:
  - hien nut `Nhan qua`
- `pendingClaim != null`:
  - hien QR dang cho redeem
  - hien `requestCode`
  - hien `expiresAt`
- `claimed = true`:
  - hien `Da nhan qua`

### Buoc 1b: Lay trang thai tong hop theo studentCode cho progress bar

API:

`GET /api/rewards/public/student-status/:studentCode`

API nay danh cho frontend muon render thanh tien trinh tong hop theo MSSV ma khong can phu thuoc vao `requestCode`.

Vi du:

```http
GET /api/rewards/public/student-status/102230313
```

Response mau:

```json
{
  "data": {
    "studentCode": "102230313",
    "fullName": "Nguyen Van A",
    "checkedInBooths": 4,
    "summary": {
      "totalMilestones": 2,
      "claimedMilestones": 1,
      "eligibleMilestones": 1,
      "hasPendingClaim": false
    },
    "activePendingClaim": null,
    "milestones": [
      {
        "id": "milestone-1",
        "name": "Moc khoa DUT Job Fair",
        "description": "Qua tang cho sinh vien du 3 booth",
        "requiredBooths": 3,
        "sortOrder": 0,
        "isActive": true,
        "eligible": true,
        "claimed": true,
        "status": "claimed",
        "remainingBooths": 0,
        "pendingClaim": null
      },
      {
        "id": "milestone-2",
        "name": "Ao thun DUT Job Fair",
        "description": "Qua tang cho sinh vien du 5 booth",
        "requiredBooths": 5,
        "sortOrder": 1,
        "isActive": true,
        "eligible": false,
        "claimed": false,
        "status": "locked",
        "remainingBooths": 1,
        "pendingClaim": null
      }
    ],
    "nextMilestone": {
      "id": "milestone-2",
      "name": "Ao thun DUT Job Fair",
      "requiredBooths": 5,
      "remainingBooths": 1
    }
  },
  "status": 200
}
```

Y nghia field:

- `summary.totalMilestones`: tong so moc qua dang active
- `summary.claimedMilestones`: so moc da nhan qua
- `summary.eligibleMilestones`: so moc da du dieu kien
- `summary.hasPendingClaim`: hien tai co QR pending hay khong
- `activePendingClaim`: pending claim dang con hieu luc neu co
- `milestones[].status`:
  - `locked`: chua du dieu kien
  - `eligible`: da du dieu kien, chua tao claim
  - `pending`: dang co QR cho redeem
  - `claimed`: da nhan qua
- `milestones[].remainingBooths`: con thieu bao nhieu booth de mo moc do

Frontend nen dung API nay cho:

- thanh tien trinh tong hop
- badge tong so moc da nhan
- trang thai hien tai cua tung moc
- phan hoi nhanh sau khi sinh vien reload trang

Frontend van co the dung `GET /api/rewards/public/progress/:studentCode` neu chi can flow co ban. Tuy nhien neu muon render progress bar day du, nen uu tien `student-status`.

## 4. Tao QR doi qua

API:

`POST /api/rewards/public/claim-request`

Body:

```json
{
  "studentCode": "102230313",
  "milestoneId": "milestone-1"
}
```

Response mau:

```json
{
  "data": {
    "id": "claim-id",
    "status": "pending",
    "requestCode": "RW-AB12CD34",
    "expiresAt": "2026-03-19T10:15:00.000Z",
    "qrPayload": "RW-AB12CD34",
    "milestone": {
      "id": "milestone-1",
      "name": "Moc khoa DUT Job Fair",
      "requiredBooths": 3
    }
  },
  "status": 201
}
```

Frontend chi can render QR tu:

- `data.qrPayload`

Khong can tu ky, ma hoa hoac tu tao payload rieng.

## 5. Hien thi QR tren React

Bat ky thu vien render QR nao cung duoc, vi du `qrcode.react`.

Mau component:

```tsx
import { QRCodeSVG } from 'qrcode.react';

type RewardQrProps = {
  requestCode: string;
  expiresAt: string;
};

export function RewardQr({ requestCode, expiresAt }: RewardQrProps) {
  return (
    <div>
      <QRCodeSVG value={requestCode} size={220} />
      <p>Ma doi qua: {requestCode}</p>
      <p>Het han: {new Date(expiresAt).toLocaleString()}</p>
    </div>
  );
}
```

## 6. Kiem tra lai trang thai QR

API:

`GET /api/rewards/public/claim-status/:requestCode`

Dung khi:

- reload trang
- sinh vien dong modal roi mo lai
- muon kiem tra claim da duoc redeem hay chua
- muon poll nhe trong luc QR dang mo

Response mau:

```json
{
  "data": {
    "id": "claim-id",
    "requestCode": "RW-AB12CD34",
    "status": "pending",
    "requestedAt": "2026-03-19T10:00:00.000Z",
    "expiresAt": "2026-03-19T10:15:00.000Z",
    "claimedAt": null,
    "student": {
      "id": "student-id",
      "studentCode": "102230313",
      "fullName": "Nguyen Van A"
    },
    "milestone": {
      "id": "milestone-1",
      "name": "Moc khoa DUT Job Fair",
      "requiredBooths": 3
    }
  },
  "status": 200
}
```

Neu `status = claimed`:

- dong QR modal
- hien `Da nhan qua thanh cong`
- refresh lai progress

Neu `status = expired`:

- hien `Ma doi qua da het han`
- cho phep tao claim moi

## 7. Khuyen nghi UX cho frontend sinh vien

Khi sinh vien bam `Nhan qua`:

1. Goi `claim-request`
2. Neu thanh cong:
   - mo modal
   - hien QR
   - hien requestCode dang text de staff co the nhap tay neu can
   - hien dong ho dem nguoc theo `expiresAt`
3. Trong luc modal dang mo:
   - poll `claim-status` moi 5-10 giay, hoac
   - them nut `Kiem tra lai`
4. Khi status chuyen sang `claimed`:
   - hien trang thai thanh cong
   - disable tao lai claim cho cung milestone

## 8. Flow cho frontend quay qua

Tam thoi frontend quay qua hay dung account `school admin`.

Ly do:

- Backend `POST /api/rewards/redeem` chi cho phep role `school_admin` hoac `system_admin`
- Hien tai de frontend tich hop nhanh, staff co the dang nhap bang tai khoan `school admin`

## 9. API admin xem danh sach sinh vien theo tung moc qua

API nay danh cho frontend admin/quay qua khi can xem theo tung moc:

- ai da du dieu kien
- ai da claim
- ai da nhan qua

API:

`GET /api/rewards/milestones/:id/students`

API nay can Bearer token cua `school_admin` hoac `system_admin`.

### Query params

- `status`: `all` | `eligible` | `pending` | `claimed` | `expired` | `cancelled`
- `page`: mac dinh `1`
- `pageSize`: mac dinh `20`
- `search`: tim theo MSSV hoac ho ten

Vi du:

```http
GET /api/rewards/milestones/9c4d2b74-3b65-4f87-9b44-6fc5dfc6c2d9/students?status=eligible&page=1&pageSize=20
Authorization: Bearer <access_token>
```

Response mau:

```json
{
  "data": {
    "milestone": {
      "id": "9c4d2b74-3b65-4f87-9b44-6fc5dfc6c2d9",
      "name": "Moc 5 booth",
      "requiredBooths": 5,
      "description": "Qua cho sinh vien check-in du 5 booth",
      "isActive": true
    },
    "summary": {
      "totalEligible": 120,
      "totalPending": 8,
      "totalClaimed": 34,
      "totalExpired": 2,
      "totalCancelled": 0
    },
    "filter": {
      "status": "eligible",
      "search": null
    },
    "items": [
      {
        "student": {
          "id": "student-id",
          "studentCode": "102280313",
          "fullName": "Sinh vien Demo 102280313",
          "email": "102280313@sv.dut.edu.vn",
          "phone": "0900000313",
          "major": "Ky thuat phan mem",
          "department": "Cong nghe Thong tin",
          "className": "22TH1",
          "year": 4,
          "school": "Truong Dai hoc Bach khoa – Dai hoc Da Nang"
        },
        "checkedInBooths": 7,
        "requiredBooths": 5,
        "remainingBooths": 0,
        "eligible": true,
        "status": "eligible",
        "claim": null
      }
    ],
    "total": 120,
    "page": 1,
    "pageSize": 20,
    "hasMore": true
  },
  "status": 200
}
```

### Y nghia status

- `eligible`: da du so booth cho moc nay, nhung chua co claim active va chua nhan qua
- `pending`: da tao claim, dang cho xac nhan/redeem
- `claimed`: da nhan qua
- `expired`: claim da het han
- `cancelled`: claim da bi huy
- `all`: gom tat ca sinh vien thuoc cac nhom tren

### Logic render de xuat cho frontend admin

- Tab `Du dieu kien`: goi `status=eligible`
- Tab `Dang cho nhan qua`: goi `status=pending`
- Tab `Da nhan qua`: goi `status=claimed`
- Tab `Tat ca`: goi `status=all`

Moi dong co the hien:

- MSSV
- ho ten
- so booth da check-in
- so booth can dat (`requiredBooths`)
- trang thai hien tai
- thong tin claim neu co: `requestCode`, `requestedAt`, `claimedAt`

Neu `claim.confirmedBy` khac `null`, frontend co the hien them nguoi da xac nhan nhan qua.

Tai khoan seed dev hien co:

- email: `school@example.com`
- password: `password123`

Frontend staff can dang nhap truoc de lay `accessToken`.

API login:

`POST /api/auth/login`

Body:

```json
{
  "email": "school@example.com",
  "password": "password123"
}
```

Response mau:

```json
{
  "data": {
    "id": "user-id",
    "email": "school@example.com",
    "name": "School Admin",
    "role": "school_admin",
    "accessToken": "jwt-access-token",
    "refreshToken": "jwt-refresh-token",
    "boothId": null
  },
  "status": 200
}
```

Frontend can:

- luu `accessToken` cho app quay qua
- gan header `Authorization: Bearer <accessToken>` khi goi redeem
- neu `401` thi yeu cau dang nhap lai hoac refresh token neu app da ho tro

API redeem:

`POST /api/rewards/redeem`

Body:

```json
{
  "requestCode": "RW-AB12CD34"
}
```

Response co 4 nhom ket qua quan trong:

### `claimed_now`

Ma vua duoc redeem thanh cong o request nay.

```json
{
  "data": {
    "result": "claimed_now",
    "message": "Đổi quà thành công",
    "claim": {
      "id": "claim-id",
      "requestCode": "RW-AB12CD34",
      "status": "claimed",
      "claimedAt": "2026-03-19T10:03:00.000Z",
      "student": {
        "studentCode": "102230313",
        "fullName": "Nguyen Van A"
      },
      "milestone": {
        "name": "Moc khoa DUT Job Fair"
      }
    }
  },
  "status": 201
}
```

UI nen hien mau xanh:

- Doi qua thanh cong
- Ten sinh vien
- Moc qua
- Thoi gian da doi

### `already_claimed`

Ma nay da duoc redeem truoc do.

```json
{
  "data": {
    "result": "already_claimed",
    "message": "Mã này đã được đổi quà trước đó",
    "claim": {
      "requestCode": "RW-AB12CD34",
      "status": "claimed",
      "claimedAt": "2026-03-19T10:03:00.000Z"
    }
  },
  "status": 200
}
```

UI nen hien mau vang/do:

- Da doi qua roi
- Khong phat qua them lan nua

### `expired`

Ma da het han.

```json
{
  "data": {
    "result": "expired",
    "message": "Mã đổi quà đã hết hạn"
  },
  "status": 200
}
```

UI nen hien:

- Ma da het han
- Yeu cau sinh vien tao lai QR moi

### `invalid_state`

Claim da bi huy hoac khong con hop le.

```json
{
  "data": {
    "result": "invalid_state",
    "message": "Mã đổi quà không còn hiệu lực"
  },
  "status": 200
}
```

## 9. Xu ly mang yeu / timeout cho quay qua

Day la phan rat quan trong.

Neu may quay QR goi redeem nhung bi timeout:

- khong duoc tu doan la that bai
- khong duoc phat qua lan nua ngay lap tuc neu chua kiem tra lai

Frontend quay qua nen lam:

1. Quet QR
2. Goi `/api/rewards/redeem`
3. Neu timeout/network error:
   - hien `Dang kiem tra lai`
   - cho nut `Thu lai`
4. Khi thu lai:
   - neu backend tra `claimed_now`: doi qua vua thanh cong
   - neu backend tra `already_claimed`: request truoc da thanh cong roi

Chinh vi vay backend da duoc thiet ke idempotent cho cung mot `requestCode`.

## 10. Mau service cho WordPress + React

```ts
const API_BASE = 'https://your-domain.com/api';

export async function fetchRewardProgress(studentCode: string) {
  const res = await fetch(`${API_BASE}/rewards/public/progress/${studentCode}`);
  const json = await res.json();
  return json.data;
}

export async function fetchRewardStudentStatus(studentCode: string) {
  const res = await fetch(
    `${API_BASE}/rewards/public/student-status/${studentCode}`,
  );
  const json = await res.json();
  return json.data;
}

export async function createRewardClaim(
  studentCode: string,
  milestoneId: string,
) {
  const res = await fetch(`${API_BASE}/rewards/public/claim-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentCode, milestoneId }),
  });
  const json = await res.json();
  return json.data;
}

export async function fetchClaimStatus(requestCode: string) {
  const res = await fetch(
    `${API_BASE}/rewards/public/claim-status/${requestCode}`,
  );
  const json = await res.json();
  return json.data;
}
```

## 11. Mau service cho quay qua

```ts
const API_BASE = 'https://your-domain.com/api';

export async function loginSchoolAdmin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const json = await res.json();
  return json.data;
}

export async function redeemReward(requestCode: string, token: string) {
  const res = await fetch(`${API_BASE}/rewards/redeem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ requestCode }),
  });

  const json = await res.json();
  return json.data;
}
```

## 12. Cac case frontend phai handle

### Phia sinh vien

- MSSV khong ton tai
- Chua du dieu kien nhan qua
- Da co pending claim
- Claim da het han
- Claim da duoc redeem trong luc modal dang mo

### Phia quay qua

- QR sai
- QR da doi roi
- QR het han
- Timeout mang
- Staff token het han
- Login sai email/password
- Dang nhap dung nhung role khong phai `school_admin` hoac `system_admin`

## 13. Luu y cho WordPress

- Neu React widget chay trong WordPress khac domain backend, phai mo CORS dung domain frontend.
- Khong luu token quay qua tren public page cua sinh vien.
- Frontend sinh vien va quay qua nen tach app hoac it nhat tach route / context xac thuc.
- App quay qua nen la route rieng, vi du `/staff/rewards`, va yeu cau login truoc khi mo man hinh scan.
- Trong giai doan tam thoi nay, `school admin` la tai khoan staff de redeem. Khi co staff account rieng sau nay, frontend chi can thay buoc login, khong can doi flow redeem.

## 14. Tom tat nhanh

### Sinh vien

1. Goi `student-status` hoac `progress`
2. Chon moc qua da du dieu kien
3. Goi claim-request
4. Render QR tu `qrPayload`
5. Poll claim-status
6. Khi `claimed` thi cap nhat UI

### Quay qua

1. Dang nhap bang account `school admin`
2. Quet QR de lay `requestCode`
3. Goi redeem kem Bearer `accessToken`
4. Hien `claimed_now` hoac `already_claimed`
5. Neu timeout thi thu lai, khong tu xac nhan bang tay

# WordPress Rewards Integration Guide

Tai lieu nay chi danh cho frontend WordPress nhung React widget o phia sinh vien.

Khong bao gom flow staff redeem va khong yeu cau token dang nhap admin.

## 1. Muc tieu

WordPress frontend can ho tro:

1. Nhap `studentCode`
2. Goi API lay trang thai nhan qua theo MSSV
3. Render thanh tien trinh va danh sach moc qua
4. Cho sinh vien tao QR doi qua
5. Poll lai trang thai claim khi QR dang mo

## 2. Base URL

- Base URL backend: `https://your-domain.com/api`
- Prefix rewards: `/rewards`

Cac API WordPress can dung:

- `GET /api/rewards/public/student-status/:studentCode`
- `POST /api/rewards/public/claim-request`
- `GET /api/rewards/public/claim-status/:requestCode`

## 3. API chinh cho WordPress

### 3.1. Lay trang thai nhan qua theo MSSV

API:

`GET /api/rewards/public/student-status/:studentCode`

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

- `checkedInBooths`: so booth sinh vien da check-in
- `summary.claimedMilestones`: so moc da nhan qua
- `summary.eligibleMilestones`: so moc da du dieu kien
- `summary.hasPendingClaim`: dang co QR pending hay khong
- `activePendingClaim`: claim pending dang con hieu luc neu co
- `milestones[].status`:
  - `locked`: chua du dieu kien
  - `eligible`: da du dieu kien, chua tao claim
  - `pending`: dang co QR cho redeem
  - `claimed`: da nhan qua
- `milestones[].remainingBooths`: con thieu bao nhieu booth de mo moc do

### 3.2. Tao QR doi qua

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
    "expiresAt": "2026-03-20T10:15:00.000Z",
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

WordPress frontend chi can render QR tu:

- `data.qrPayload`

Khong can tu ky ma hoa payload.

### 3.3. Kiem tra lai trang thai QR

API:

`GET /api/rewards/public/claim-status/:requestCode`

Vi du:

```http
GET /api/rewards/public/claim-status/RW-AB12CD34
```

Response mau:

```json
{
  "data": {
    "id": "claim-id",
    "requestCode": "RW-AB12CD34",
    "status": "pending",
    "requestedAt": "2026-03-20T10:00:00.000Z",
    "expiresAt": "2026-03-20T10:15:00.000Z",
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
- refresh lai `student-status`

Neu `status = expired`:

- hien `Ma doi qua da het han`
- cho phep tao claim moi

## 4. Logic render tren WordPress

### 4.1. Render thanh tien trinh

Frontend nen hien:

- Ho ten sinh vien
- So booth da check-in
- Tong so moc qua da nhan
- Moc sap toi neu co

WordPress co the render progress bar theo:

- `checkedInBooths`
- `nextMilestone.requiredBooths`
- `summary.claimedMilestones / summary.totalMilestones`

### 4.2. Render tung milestone

- `status = locked`
  - disable nut `Nhan qua`
  - hien `Con thieu X booth`
- `status = eligible`
  - hien nut `Nhan qua`
- `status = pending`
  - hien QR hien tai
  - hien `requestCode`
  - hien `expiresAt`
- `status = claimed`
  - hien `Da nhan qua`

## 5. UX de nghi

Khi sinh vien bam `Nhan qua`:

1. Goi `claim-request`
2. Neu thanh cong:
   - mo modal
   - hien QR
   - hien requestCode dang text
   - hien dong ho dem nguoc theo `expiresAt`
3. Trong luc modal dang mo:
   - poll `claim-status` moi 5-10 giay, hoac
   - them nut `Kiem tra lai`
4. Khi `claim-status` tra `claimed`:
   - dong modal
   - hien thong bao thanh cong
   - goi lai `student-status`

## 6. Mau service cho WordPress + React

```ts
const API_BASE = 'https://your-domain.com/api';

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

## 7. QR component mau

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

## 8. Cac case frontend phai handle

- MSSV khong ton tai
- Chua du dieu kien nhan qua
- Da co pending claim
- Claim da het han
- Claim da duoc redeem trong luc modal dang mo
- Reload trang khi dang co QR pending

## 9. Luu y cho WordPress

- Neu WordPress chay khac domain backend, backend phai mo CORS dung domain frontend.
- Day la public flow, khong luu token admin/staff trong trang WordPress sinh vien.
- Frontend WordPress chi dung 3 API public neu o phia sinh vien.

## 10. Tom tat nhanh

1. Goi `student-status`
2. Render progress bar + danh sach moc qua
3. Khi sinh vien du dieu kien, goi `claim-request`
4. Render QR tu `qrPayload`
5. Poll `claim-status`
6. Khi claim da `claimed`, refresh lai `student-status`

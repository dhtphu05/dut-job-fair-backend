# Frontend Admin Rewards Milestone Students

Tai lieu nay danh cho frontend admin / quay qua khi can hien thi danh sach sinh vien theo tung moc qua.

Muc tieu:

- Xem ai da du dieu kien nhan qua
- Xem ai dang cho nhan qua
- Xem ai da nhan qua
- Xem lich su claim het han / bi huy
- Ho tro tim kiem theo MSSV hoac ho ten

## 1. Base URL

- Base URL backend: `https://your-domain.com/api`
- Prefix rewards: `/rewards`

Endpoint chinh:

- `GET /api/rewards/milestones`
- `GET /api/rewards/milestones/:id/students`
- `GET /api/rewards/claims/pending`

## 2. Auth

API nay can Bearer token cua:

- `school_admin`
- `system_admin`

Vi du:

```http
Authorization: Bearer <access_token>
```

## 3. API lay danh sach sinh vien theo tung moc qua

API:

`GET /api/rewards/milestones/:id/students`

### Query params

- `status`: `all | eligible | pending | claimed | expired | cancelled`
- `page`: mac dinh `1`
- `pageSize`: mac dinh `20`
- `search`: tim theo MSSV hoac ho ten

### Vi du request

```http
GET /api/rewards/milestones/9c4d2b74-3b65-4f87-9b44-6fc5dfc6c2d9/students?status=eligible&page=1&pageSize=20
Authorization: Bearer <access_token>
```

Tim kiem:

```http
GET /api/rewards/milestones/9c4d2b74-3b65-4f87-9b44-6fc5dfc6c2d9/students?status=all&page=1&pageSize=20&search=102280313
Authorization: Bearer <access_token>
```

## 4. Response structure

Response luon theo wrapper chung:

```json
{
  "data": {},
  "status": 200
}
```

Response mau day du:

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
      "status": "claimed",
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
          "school": "Truong Dai hoc Bach khoa - Dai hoc Da Nang"
        },
        "checkedInBooths": 7,
        "requiredBooths": 5,
        "remainingBooths": 0,
        "eligible": true,
        "status": "claimed",
        "claim": {
          "id": "claim-id",
          "requestCode": "RW-AB12CD34",
          "status": "claimed",
          "requestedAt": "2026-04-01T09:00:00.000Z",
          "expiresAt": "2026-04-01T09:15:00.000Z",
          "claimedAt": "2026-04-01T09:05:00.000Z",
          "confirmedByUserId": "user-id",
          "confirmedBy": {
            "id": "user-id",
            "name": "Admin quay qua",
            "email": "giftdesk@example.com"
          }
        }
      }
    ],
    "total": 34,
    "page": 1,
    "pageSize": 20,
    "hasMore": true
  },
  "status": 200
}
```

## 5. Y nghia field

### `milestone`

Thong tin moc qua dang xem:

- `id`: id moc qua
- `name`: ten moc qua
- `requiredBooths`: so booth can dat
- `description`: mo ta moc qua
- `isActive`: moc qua con active hay khong

### `summary`

Tong hop so luong sinh vien theo tung nhom trong milestone hien tai:

- `totalEligible`: da du booth, chua co claim active/final
- `totalPending`: da tao claim va dang cho nhan qua
- `totalClaimed`: da nhan qua
- `totalExpired`: claim het han
- `totalCancelled`: claim bi huy

Luu y:

- `totalEligible` chi dem dung nhom `eligible`
- `totalEligible` khong cong don `pending` hoac `claimed`

### `filter`

Phan frontend dang query:

- `status`: status FE dang chon
- `search`: chuoi tim kiem goc, neu khong co se la `null`

### `items[]`

Moi item la 1 sinh vien trong milestone hien tai.

#### `student`

Thong tin de frontend render truc tiep:

- `id`
- `studentCode`
- `fullName`
- `email`
- `phone`
- `major`
- `department`
- `className`
- `year`
- `school`

#### `checkedInBooths`

Tong so booth unique sinh vien da check-in.

#### `requiredBooths`

So booth can dat cua milestone nay.

#### `remainingBooths`

So booth con thieu de dat milestone.

- Neu da du dieu kien thi se la `0`

#### `eligible`

Cho biet sinh vien da du so booth hay chua.

Luu y:

- `eligible = true` co the xuat hien o `eligible`, `pending`, `claimed`, `expired`, `cancelled`
- de render tab, FE nen uu tien `status`

#### `status`

Gia tri co the la:

- `eligible`
- `pending`
- `claimed`
- `expired`
- `cancelled`

#### `claim`

- `null` neu student dang o nhom `eligible`
- co object neu status la `pending`, `claimed`, `expired`, `cancelled`

Field trong `claim`:

- `id`: id claim
- `requestCode`: ma doi qua
- `status`: trang thai claim hien tai
- `requestedAt`: thoi diem tao claim
- `expiresAt`: thoi diem het han
- `claimedAt`: thoi diem da nhan qua, co the `null`
- `confirmedByUserId`: id user xac nhan
- `confirmedBy`: object nguoi xac nhan, co the `null`

`confirmedBy` co dang:

```json
{
  "id": "user-id",
  "name": "Admin quay qua",
  "email": "giftdesk@example.com"
}
```

## 6. Y nghia status

- `eligible`: da du so booth cho moc nay, chua co claim active va chua nhan qua
- `pending`: da tao claim, dang cho xac nhan / redeem
- `claimed`: da nhan qua
- `expired`: claim da het han
- `cancelled`: claim da bi huy
- `all`: gom tat ca cac nhom tren

Frontend nen coi `status` la source of truth de render tab va badge.

## 7. Mapping tab de xuat cho frontend

- Tab `Du dieu kien`: goi `status=eligible`
- Tab `Dang cho nhan qua`: goi `status=pending`
- Tab `Da nhan qua`: goi `status=claimed`
- Tab `Het han`: goi `status=expired`
- Tab `Da huy`: goi `status=cancelled`
- Tab `Tat ca`: goi `status=all`

## 8. De xuat UI cho moi dong

Moi dong co the hien:

- MSSV: `student.studentCode`
- Ho ten: `student.fullName`
- Email / so dien thoai neu can
- Nganh / khoa / lop / nam hoc
- So booth da check-in: `checkedInBooths`
- So booth can dat: `requiredBooths`
- Trang thai hien tai: `status`
- Ma claim: `claim.requestCode`
- Thoi diem tao claim: `claim.requestedAt`
- Thoi diem het han: `claim.expiresAt`
- Thoi diem da nhan qua: `claim.claimedAt`
- Nguoi xac nhan: `claim.confirmedBy.name`

## 9. Logic render de xuat

### Neu `status = eligible`

- hien badge `Du dieu kien`
- `claim = null`
- co the hien `Da check-in X / Y booth`

### Neu `status = pending`

- hien badge `Dang cho nhan qua`
- hien `requestCode`
- hien `requestedAt`
- hien `expiresAt`

### Neu `status = claimed`

- hien badge `Da nhan qua`
- hien `requestCode`
- hien `claimedAt`
- neu co `confirmedBy` thi hien ten nguoi xac nhan

### Neu `status = expired`

- hien badge `Da het han`
- co the cho phep FE hien lich su claim cu

### Neu `status = cancelled`

- hien badge `Da huy`

## 10. TypeScript types de FE su dung

```ts
export type RewardMilestoneStudentStatus =
  | 'eligible'
  | 'pending'
  | 'claimed'
  | 'expired'
  | 'cancelled';

export type RewardMilestoneStudentItem = {
  student: {
    id: string;
    studentCode: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    major: string | null;
    department: string | null;
    className: string | null;
    year: number | null;
    school: string | null;
  };
  checkedInBooths: number;
  requiredBooths: number;
  remainingBooths: number;
  eligible: boolean;
  status: RewardMilestoneStudentStatus;
  claim: null | {
    id: string;
    requestCode: string;
    status: Exclude<RewardMilestoneStudentStatus, 'eligible'>;
    requestedAt: string | null;
    expiresAt: string | null;
    claimedAt: string | null;
    confirmedByUserId: string | null;
    confirmedBy: null | {
      id: string;
      name: string;
      email: string;
    };
  };
};

export type RewardMilestoneStudentsResponse = {
  milestone: {
    id: string;
    name: string;
    requiredBooths: number;
    description: string | null;
    isActive: boolean;
  };
  summary: {
    totalEligible: number;
    totalPending: number;
    totalClaimed: number;
    totalExpired: number;
    totalCancelled: number;
  };
  filter: {
    status: 'all' | RewardMilestoneStudentStatus;
    search: string | null;
  };
  items: RewardMilestoneStudentItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};
```

## 11. Vi du fetch o frontend

```ts
async function fetchMilestoneStudents(
  milestoneId: string,
  params: {
    status?: 'all' | 'eligible' | 'pending' | 'claimed' | 'expired' | 'cancelled';
    page?: number;
    pageSize?: number;
    search?: string;
  },
  accessToken: string,
) {
  const query = new URLSearchParams();

  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);

  const res = await fetch(
    `/api/rewards/milestones/${milestoneId}/students?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error('Khong the lay danh sach sinh vien theo moc qua');
  }

  const json = await res.json();
  return json.data as RewardMilestoneStudentsResponse;
}
```

## 12. Luu y tich hop

- FE nen dung `summary` de render so luong o cac tab.
- FE nen dung `items[].status` de render badge, khong tu suy ra bang `eligible`.
- FE nen dung `hasMore` de quyet dinh co hien nut `Load more` hay khong.
- Tat ca field thoi gian la ISO string UTC, FE tu format theo `vi-VN`.
- `search` tim theo MSSV hoac ho ten, khong phan biet hoa thuong.
- Khi can refresh sau khi quay qua xac nhan nhan qua, goi lai endpoint voi tab hien tai.

## 13. API lien quan

### Lay danh sach milestone

`GET /api/rewards/milestones`

Dung de render dropdown / tabs milestone.

### Lay danh sach claim pending rieng cho quay qua

`GET /api/rewards/claims/pending`

Dung khi FE muon co man rieng chi hien thi claim dang cho xac nhan.

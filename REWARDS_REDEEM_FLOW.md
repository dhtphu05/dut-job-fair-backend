# Rewards Redeem Flow

Tai lieu nay mo ta flow nhan qua theo QR one-time cho sinh vien va quay qua.

## Muc tieu

- Sinh vien check-in du so booth theo moc qua.
- Sinh vien bam "Nhan qua" tren web/app cua minh.
- Backend tao mot `reward claim` o trang thai `pending`.
- Frontend sinh vien hien thi QR doi qua. QR chi can chua `requestCode`.
- Quay qua quet QR do mot lan.
- Backend redeem trong transaction.
- Neu quet lai cung ma, he thong tra ve trang thai da doi qua roi.

## Bang du lieu

### `reward_milestones`

- `id`
- `name`
- `description`
- `requiredBooths`
- `sortOrder`
- `isActive`

### `reward_claims`

- `id`
- `studentId`
- `milestoneId`
- `status`: `pending | claimed | expired | cancelled`
- `requestCode`
- `confirmedByUserId`
- `requestedAt`
- `expiresAt`
- `claimedAt`

## API cho frontend sinh vien

### 1. Xem tien do nhan qua

`GET /api/rewards/public/progress/:studentCode`

Response tra ve:

- `checkedInBooths`
- danh sach `milestones`
- `pendingClaim` neu sinh vien da tao ma doi qua nhung chua redeem
- `pendingClaim.qrPayload` de frontend render QR

### 2. Tao ma doi qua

`POST /api/rewards/public/claim-request`

Body:

```json
{
  "studentCode": "102230313",
  "milestoneId": "uuid-of-milestone"
}
```

Response:

```json
{
  "id": "claim-id",
  "status": "pending",
  "requestCode": "RW-AB12CD34",
  "expiresAt": "2026-03-19T10:15:00.000Z",
  "qrPayload": "RW-AB12CD34",
  "milestone": {
    "id": "milestone-id",
    "name": "Ao thun",
    "requiredBooths": 5
  }
}
```

Frontend sinh vien nen render QR tu `qrPayload`.

### 3. Kiem tra trang thai ma doi qua

`GET /api/rewards/public/claim-status/:requestCode`

Dung khi:

- app sinh vien mo lai modal
- can kiem tra claim da doi hay chua
- muon dong bo trang thai sau khi quay qua quet thanh cong

## API cho quay qua

Tat ca API quay qua deu can dang nhap bang account co quyen `school_admin` hoac `system_admin`.

### 1. Redeem ma doi qua

`POST /api/rewards/redeem`

Body:

```json
{
  "requestCode": "RW-AB12CD34"
}
```

Response co the tra ve cac ket qua sau:

#### `claimed_now`

Request nay vua redeem thanh cong.

```json
{
  "result": "claimed_now",
  "message": "Doi qua thanh cong",
  "claim": {
    "id": "claim-id",
    "requestCode": "RW-AB12CD34",
    "status": "claimed",
    "claimedAt": "2026-03-19T10:03:00.000Z"
  }
}
```

#### `already_claimed`

Ma nay da duoc redeem truoc do. Case nay rat quan trong cho mang yeu/timeout.

```json
{
  "result": "already_claimed",
  "message": "Ma nay da duoc doi qua truoc do",
  "claim": {
    "id": "claim-id",
    "requestCode": "RW-AB12CD34",
    "status": "claimed",
    "claimedAt": "2026-03-19T10:03:00.000Z"
  }
}
```

#### `expired`

Ma doi qua da het han.

```json
{
  "result": "expired",
  "message": "Ma doi qua da het han"
}
```

#### `invalid_state`

Claim da bi huy hoac khong con hop le.

```json
{
  "result": "invalid_state",
  "message": "Ma doi qua khong con hieu luc"
}
```

## Xu ly mang yeu / timeout

Backend redeem theo kieu idempotent:

- Neu request dau tien da thanh cong nhung may quet khong nhan duoc response vi timeout, quay qua chi can quet lai cung ma.
- Lan quet lai se nhan `already_claimed`, khong bi doi qua trung.

Frontend quay qua nen xu ly nhu sau:

1. Quet QR
2. Goi `/api/rewards/redeem`
3. Neu timeout:
   - khong tu xac nhan bang tay
   - cho phep bam "Thu lai"
4. Khi thu lai:
   - neu nhan `claimed_now` thi vua doi qua thanh cong
   - neu nhan `already_claimed` thi lan truoc da thanh cong roi

## Transaction va chong race condition

Backend redeem bang transaction + pessimistic row lock:

1. Tim `reward_claim` theo `requestCode`
2. Khoa ban ghi (`FOR UPDATE`)
3. Kiem tra:
   - ton tai
   - chua het han
   - chua claimed
4. Cap nhat `pending -> claimed`
5. Luu `confirmedByUserId`, `claimedAt`
6. Commit

Nho do, neu 2 may quay qua quet cung mot QR gan nhu dong thoi:

- chi 1 request co the `claimed_now`
- request con lai se nhan `already_claimed`

## Khuyen nghi frontend

### Frontend sinh vien

- Hien so booth da check-in.
- Hien moc qua dat duoc.
- Khi tao claim request:
  - hien `requestCode`
  - hien QR render tu `qrPayload`
  - hien `expiresAt`
- Neu claim het han:
  - cho phep tao lai claim moi

### Frontend quay qua

- Scan QR va lay `requestCode`
- Goi `/api/rewards/redeem`
- Hien ro 4 trang thai:
  - doi qua thanh cong
  - da doi qua roi
  - ma het han
  - ma khong hop le
- Neu timeout, bat buoc cho "thu lai", khong cho staff tu suy doan trang thai

## Luu y van hanh

- `requestCode` chi nen dung nhu ma tam thoi, khong nhung thong tin nhay cam vao QR.
- `expiresAt` mac dinh hien tai la 15 phut.
- Muon quan ly moc qua bang UI, frontend admin dung cac API:
  - `GET /api/rewards/milestones`
  - `POST /api/rewards/milestones`
  - `PATCH /api/rewards/milestones/:id`

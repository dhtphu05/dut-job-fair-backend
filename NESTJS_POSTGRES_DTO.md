# Cấu trúc API Request/Response DTO và TypeORM Entities (Hỗ trợ PostgreSQL)

Dựa trên file `IMPLEMENTATION.md` hiện tại, do hệ thống database được thiết kế bằng **PostgreSQL**, dưới đây là bản tóm tắt các Require, Request/Response payload, Data Wrapper và cấu trúc Entity NestJS khớp chuẩn.

---

## 1. Trả về chung (Global Response Interceptor Interface)

API phía Frontend (`api-client.ts`) được code để nhận định dạng Wrapper như sau. Thiết kế API NestJS phải map chuẩn lại format này để tránh frontend parse lỗi (Đặc biệt HTTP ERROR - `40x` phải parse được field `message`):

```typescript
// src/common/interfaces/api-response.interface.ts
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];       // Type data mảng
  total: number;    // Tổng số item records
  page: number;     // Index trang hiện tại
  pageSize: number; // Item trên 1 trang 
  hasMore: boolean; // Flag (tùy chọn) NextPage=True/False
}
```

---

## 2. API Routes / DTO Các luồng chính

Cài đặt package để parse Data NestJS:
`npm i class-validator class-transformer @nestjs/typeorm typeorm pg`

### 2.1. Quét QR Gian Hàng (Checkins - POST `/api/checkins`)
Đây là logic xử lý scanner tại booth. 

**Payload (Tương ứng file app):**
```typescript
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateCheckinDto {
  @IsUUID('4', { message: 'Invalid Student ID Format' })
  @IsNotEmpty()
  studentId: string; // Tách chiết ra từ mã Bar/QR của Sinh Viên

  @IsUUID('4')
  @IsNotEmpty()
  boothId: string;
}
```
**Response Format (Trả lại dạng CreateResponse<T>):**
```typescript
{
  "success": true,
  "id": "e4f8d384-2a62...", // Checkin ID postgres gen uuid
  "data": {
    "studentId": "uuid..",
    "boothId": "uuid.."
  },
  "createdAt": "2023-01-01T23:54..."
}
```

### 2.2 Auth DTOs 
(Dành cho các Admin portal hoặc Business portal login)
```typescript
// POST: /api/auth/login
export class LoginDto {
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() password: string;
}

// POST: /api/auth/refresh
export class RefreshTokenDto {
  @IsString() @IsNotEmpty() refreshToken: string;
}
```

---

## 3. Bản Mẫu Mapping PostgreSQL qua NestJS TypeORM Entity

Trong file PostgreSQL schema cũ, bạn có bảng `checkins`, `students`, và `booths`. TypeORM sẽ cần mapping như sau để PostgreSQL auto-gen `uuid` tương ứng với `gen_random_uuid()`. 

**Bảng Học Sinh (Student Entity)**
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string; // PostgreSQL UUID tự generate. 

  // Mapping tới FK PostgreSQL schools table
  @Column({ name: 'school_id', type: 'uuid' })
  schoolId: string; 

  @Column({ name: 'student_code', length: 50, unique: true })
  studentCode: string;

  @Column({ name: 'full_name', length: 255 })
  fullName: string;

  @Column({ length: 255, unique: true, nullable: true })
  email: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 100, nullable: true })
  major: string;

  @Column('int', { nullable: true })
  year: number; // Có thể Validate (between 1 and 4) tại app layer Controller.

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // TypeORM Relations: 
  @OneToMany(() => Checkin, checkin => checkin.student)
  checkins: Checkin[];
}
```

**Bảng Checkin (Checkin Entity)**
```typescript
@Entity('checkins')
export class Checkin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ name: 'booth_id', type: 'uuid' })
  boothId: string;

  @CreateDateColumn({ name: 'check_in_time' }) // Tương đương check_in_time
  checkInTime: Date;

  @Column('int', { name: 'duration_minutes', nullable: true })
  durationMinutes: number;

  @Column('text', { nullable: true })
  notes: string;

  // TypeORM Relations Setup
  @ManyToOne(() => Student, student => student.checkins, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @ManyToOne(() => Booth, booth => booth.checkins, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booth_id' })
  booth: Booth;
}
```

**Bảng Gian Hàng (Booth Entity)**
```typescript
@Entity('booths')
export class Booth {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100, nullable: true })
  position: string;

  @OneToMany(() => Checkin, checkin => checkin.booth)
  checkins: Checkin[];
}
```
*(Code này hoàn toàn khớp cú pháp TypeORM + PosgreSQL cho NodeJs Backend).*

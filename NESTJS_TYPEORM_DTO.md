# Thiết kế Request / Response DTO cho NestJS & TypeORM

Tài liệu này bao gồm các payload bắt buộc, các Interface và DTO mẫu sử dụng thư viện `class-validator` và `class-transformer` của NestJS để tích hợp cùng TypeORM.

## 1. API Response Wrapper

Sử dụng format này như một chuẩn chung trả về (tại interceptor):

```typescript
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
  status: number;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

---

## 2. Authentication DTOs (`/api/auth`)

### 2.1. Đăng nhập (`POST /auth/login`)
**Request (LoginDto):**
```typescript
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Mật khẩu phải từ 6 ký tự' })
  password: string;
}
```

**Response (AuthResponseDto):**
```typescript
export class AuthResponseDto {
  id: string;
  email: string;
  name: string;
  role: 'visitor' | 'school_admin' | 'business_admin' | 'superadmin' | 'booth_staff';
  token: string;
  refreshToken?: string;
}
```

### 2.2. Đăng ký & Refresh (`POST /auth/refresh`)
**Request (RefreshTokenDto):**
```typescript
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
```

---

## 3. Scanner DTOs (`/api/scanner`)

### 3.1. Submit Quét Mã QR (`POST /scanner/scan`)
**Request (ScanRequestDto):**
```typescript
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ScanRequestDto {
  @IsString()
  @IsNotEmpty()
  visitorCode: string; // Mã sinh viên

  @IsUUID()
  @IsNotEmpty()
  boothId: string; // ID của gian hàng
}
```

**Response (ScanResponseDto):**
```typescript
export class ScanResponseDto {
  success: boolean;
  status: 'success' | 'duplicate' | 'error' | 'pending';
  message: string;
  visitor?: {
    id: string;
    studentCode: string; // Tương đương mssv
    fullName: string;
    major: string;
    year: number;
  };
  scanId?: string;
}
```

---

## 4. Query & Filter Pagination DTOs

**Request Variables (PaginationParamsDto):**
```typescript
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class PaginationParamsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString()
  search?: string;
}
```

---

## 5. Cấu trúc bảng Database tương ứng bằng TypeORM (Gợi ý)

Dưới đây là một số bảng đặc trưng để các bạn hình dung ánh xạ (mapping).

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';

@Entity('student_profiles')
export class StudentProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  mssv: string; // Trùng khớp visitorCode

  @Column()
  fullName: string;

  @Column()
  major: string;

  @Column('int')
  year: number;

  @OneToMany(() => ScanRecord, (scan) => scan.visitor)
  scanRecords: ScanRecord[];
}

@Entity('booths')
export class Booth {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @OneToMany(() => ScanRecord, (scan) => scan.booth)
  scanRecords: ScanRecord[];
}

@Entity('scan_records')
export class ScanRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ['success', 'duplicate', 'error', 'pending'],
    default: 'success'
  })
  status: string;

  @CreateDateColumn()
  timestamp: Date;

  @ManyToOne(() => StudentProfile, (student) => student.scanRecords)
  @JoinColumn({ name: 'visitor_id' })
  visitor: StudentProfile;

  @ManyToOne(() => Booth, (booth) => booth.scanRecords)
  @JoinColumn({ name: 'booth_id' })
  booth: Booth;
}
```

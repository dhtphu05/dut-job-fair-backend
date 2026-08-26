# DUT Job Fair Backend

Backend service for the DUT Job Fair platform. This API powers authentication, QR check-in flows, booth and business management, school operations, and rewards workflows used by both scanner and admin applications.

## Tech Stack

- Framework: NestJS 11, Node.js, TypeScript
- Database: PostgreSQL
- ORM: TypeORM
- Authentication: JWT, Passport, bcryptjs
- Validation and Serialization: class-validator, class-transformer
- API Documentation: Swagger (OpenAPI)
- Testing: Jest, Supertest
- DevOps and Runtime: Docker, docker-compose
- Code Quality: ESLint, Prettier

## Key Features

- Role-based authentication and session handling for school admins, business admins, and scanner users
- QR code check-in APIs for recording and tracking student visits at booths
- Modular domain architecture for schools, students, businesses, booths, check-in, scanner, and rewards
- Reward milestone and claim management to support event engagement campaigns
- Business and school admin endpoints for analytics, reports, and operational dashboards
- Seed scripts for initializing demo and development data
- Swagger-based API contract for frontend integration and typed client generation

## Project Structure

```
src/
  auth/            # Authentication, guards, strategies, DTOs
  scanner/         # Scanner-specific APIs
  checkin/         # Check-in domain logic
  rewards/         # Reward milestone and claim logic
  school-admin/    # School admin dashboards and reports
  business-admin/  # Business admin dashboards and reports
  schools/         # School management APIs
  students/        # Student management APIs
  businesses/      # Business management APIs
  booths/          # Booth management APIs
  entities/        # TypeORM entity definitions
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file with your database configuration:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=dut_job_fair
JWT_SECRET=your_secret
```

### 3. Run in development

```bash
npm run start:dev
```

### 4. Build and run in production mode

```bash
npm run build
npm run start:prod
```

## Scripts

- `npm run start:dev` - Start in watch mode
- `npm run build` - Build the project
- `npm run start:prod` - Run compiled build
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:cov` - Run tests with coverage
- `npm run seed` - Seed database data
- `npm run seed:shared-accounts` - Đồng bộ các tài khoản cố định cho local/production

### Đồng bộ tài khoản local và production

Sao chép `.env.example` thành `.env`, sau đó đặt cùng giá trị cho
`SEED_ADMIN_PASSWORD` và `SEED_BUSINESS_PASSWORD` ở local lẫn môi trường seed
trên production. Chạy lệnh sau ở cả hai môi trường:

```bash
npm run seed:shared-accounts
```

Script không xóa dữ liệu. Nó tạo hoặc cập nhật ba tài khoản nội bộ
(`checkin@admin.com`, `system@example.com`, `scanner@example.com`) và toàn bộ
tài khoản doanh nghiệp/hội thảo với email cố định. Các hội thảo dùng email theo
mã QR, ví dụ `workshop-01@jobfair`. Khi chạy lại, mật khẩu của các tài khoản
này sẽ được đặt lại theo hai biến môi trường trên.

Trong Docker production, dùng `npm run seed:shared-accounts:prod` (hoặc chạy
trực tiếp `node dist/scripts/seed-shared-accounts.js`).

## API Docs

After starting the server, OpenAPI/Swagger JSON is available for frontend code generation and integration.

## License

This project is proprietary software for DUT Job Fair.

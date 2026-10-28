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

### 1. Prerequisites and dependencies

Use Node.js 22 LTS (or newer supported LTS) and start Docker Desktop with
Linux containers enabled. Run all commands from this project's directory.

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` (PowerShell):

```powershell
Copy-Item .env.example .env
```

Skip copying if `.env` already exists. Set separate random values for
`JWT_SECRET` and `JWT_REFRESH_SECRET`, plus local passwords for
`SEED_ADMIN_PASSWORD` and `SEED_BUSINESS_PASSWORD`.
The default database is `dut_job_fair`, served at `127.0.0.1:5499` with
username/password `postgres`/`postgres`. Keep `DB_PORT=5499` when using the
development Docker database. TypeORM creates/updates the schema at startup;
use a dedicated local database.

### 3. Start the local database and create login accounts

```bash
npm run db:up
npm run seed:shared-accounts
```

The seed creates `checkin@admin.com` (school admin), `system@example.com`
(system admin), and `scanner@example.com`, using `SEED_ADMIN_PASSWORD`.
Business/workshop accounts use `SEED_BUSINESS_PASSWORD`. Rerunning this
command resets these accounts' passwords to the configured values.

### 4. Run in development

```bash
npm run start:local
```

This waits for PostgreSQL to be healthy, then starts NestJS in watch mode.
If the database is already running, `npm run start:dev` also works.

- API: http://localhost:3000/api
- Swagger UI: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/docs-json

Press Ctrl+C to stop NestJS. `npm run db:down` stops the local database
while keeping its data in the Docker volume. `npm run db:logs` shows its logs.
If a port is occupied, change `PORT` or `DB_PORT` in `.env`, then rerun
`npm run start:local`. Stop the database before changing `DB_PORT`.

### 5. Build and run in production mode

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

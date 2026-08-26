import * as XLSX from 'xlsx';
import * as QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { generateStudentTemplate } from './create-excel-template';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DEFAULT_GRADUATION_BATCH = 'TN2026_dot_2';

export interface StudentRecord {
  studentCode: string;
  fullName: string;
  className?: string;
  department?: string;
  email?: string;
  phone?: string;
  major?: string;
  degreeTitle?: string;
  dotTotNghiep: string;
  sheetName?: string;
  year?: number;
}

const FACULTY_MAP: Record<string, string> = {
  'CK': 'Khoa Cơ khí',
  'CKGT': 'Khoa Cơ khí Giao thông',
  'Nhiệt': 'Khoa Công nghệ Nhiệt - Điện lạnh',
  'CNTT': 'Khoa Công nghệ Thông tin',
  'Điện': 'Khoa Điện',
  'ĐTVT': 'Khoa Điện tử - Viễn thông',
  'Hóa': 'Khoa Hóa',
  'FAST': 'Khoa Khoa học Công nghệ Tiên tiến (FAST)',
  'Kiến trúc': 'Khoa Kiến trúc',
  'Môi trường': 'Khoa Môi trường',
  'QLDA': 'Khoa Quản lý Dự án',
  'XDCĐ': 'Khoa Xây dựng Cầu đường',
  'XDCTT': 'Khoa Xây dựng Công trình thủy',
  'XDDD': 'Khoa Xây dựng Dân dụng & Công nghiệp',
};

function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function deriveYearFromStudentCode(studentCode: string): number | null {
  const code = studentCode.trim();
  if (code.length < 5) return null;
  const yearStr = code.slice(3, 5);
  const yearMap: Record<string, number> = {
    '25': 1,
    '24': 2,
    '23': 3,
    '22': 4,
    '21': 5,
    '20': 6,
    '19': 7,
    '18': 8,
  };
  return yearMap[yearStr] ?? null;
}

function toSafeFolderName(value: string): string {
  const safeValue = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/[. ]+$/g, '');

  return safeValue || 'Khac';
}

function parseAllSheets(
  filePath: string,
  defaultGraduationBatch: string,
  selectedSheetNames: string[] = [],
): StudentRecord[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy file: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    throw new Error('File Excel không có sheet nào.');
  }

  const selectedSheetKeys = new Set(
    selectedSheetNames.map((sheetName) => normalizeKey(sheetName)),
  );
  const sheetsToImport = selectedSheetKeys.size
    ? sheetNames.filter((sheetName) => selectedSheetKeys.has(normalizeKey(sheetName)))
    : sheetNames;

  if (selectedSheetKeys.size && sheetsToImport.length === 0) {
    throw new Error(
      `Không tìm thấy sheet khoa "${selectedSheetNames.join(', ')}". Các sheet có trong file: ${sheetNames.join(', ')}`,
    );
  }

  const parsedStudents: StudentRecord[] = [];
  const seenMssv = new Set<string>();

  for (const sheetName of sheetsToImport) {
    const worksheet = workbook.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    const defaultDepartment = FACULTY_MAP[sheetName] || sheetName;

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const normalizedRow: Record<string, any> = {};

      for (const rawKey of Object.keys(row)) {
        normalizedRow[normalizeKey(rawKey)] = row[rawKey];
      }

      // Check MSSV aliases
      let studentCode = '';
      for (const [k, v] of Object.entries(normalizedRow)) {
        if (k.includes('mssv') || k.includes('masv') || k.includes('masosinhvien') || k.includes('studentcode')) {
          studentCode = (v ?? '').toString().trim();
          if (studentCode) break;
        }
      }
      if (!studentCode && normalizedRow['code']) {
        studentCode = normalizedRow['code'].toString().trim();
      }

      // Check Full Name aliases
      let fullName = '';
      for (const [k, v] of Object.entries(normalizedRow)) {
        if (k.includes('hovaten') || k.includes('hoten') || k.includes('fullname')) {
          fullName = (v ?? '').toString().trim();
          if (fullName) break;
        }
      }
      if (!fullName && normalizedRow['name']) {
        fullName = normalizedRow['name'].toString().trim();
      }

      if (!studentCode || !fullName) {
        continue;
      }

      // Class
      let className = (
        normalizedRow['lop'] ||
        normalizedRow['classname'] ||
        normalizedRow['class'] ||
        ''
      ).toString().trim();

      // Email
      let email = '';
      for (const [k, v] of Object.entries(normalizedRow)) {
        if (k.includes('email') || k.includes('mail')) {
          email = (v ?? '').toString().trim();
          if (email) break;
        }
      }

      // Phone
      let phone = '';
      for (const [k, v] of Object.entries(normalizedRow)) {
        if (k.includes('sdt') || k.includes('sodienthoai') || k.includes('phone')) {
          phone = (v ?? '').toString().trim();
          if (phone) break;
        }
      }

      // Major
      let major = '';
      for (const [k, v] of Object.entries(normalizedRow)) {
        if (k.includes('nganh') || k.includes('chuyennganh') || k.includes('major')) {
          major = (v ?? '').toString().trim();
          if (major) break;
        }
      }

      // Degree title
      let degreeTitle = (
        normalizedRow['danhhieubang'] ||
        normalizedRow['danhhieu'] ||
        ''
      ).toString().trim();

      // Department
      let department = '';
      for (const [k, v] of Object.entries(normalizedRow)) {
        if (k.includes('khoa') || k.includes('department') || k.includes('faculty')) {
          department = (v ?? '').toString().trim();
          if (department) break;
        }
      }
      if (!department) {
        department = defaultDepartment;
      }

      const dotTotNghiep = (
        normalizedRow['dottotnghiep'] ||
        normalizedRow['graduationbatch'] ||
        defaultGraduationBatch
      )
        .toString()
        .trim();

      parsedStudents.push({
        studentCode,
        fullName,
        className: className || undefined,
        department: department || undefined,
        email: email || undefined,
        phone: phone || undefined,
        major: major || undefined,
        degreeTitle: degreeTitle || undefined,
        dotTotNghiep,
        sheetName,
        year: deriveYearFromStudentCode(studentCode) ?? undefined,
      });

      seenMssv.add(studentCode);
    }
  }

  return parsedStudents;
}

export function buildDutQrPayload(student: StudentRecord): string {
  const payload: Record<string, string> = {
    ho_ten: student.fullName,
    ma_so_sinh_vien: student.studentCode,
    lop: student.className || '',
    dot_tot_nghiep: student.dotTotNghiep || DEFAULT_GRADUATION_BATCH,
  };
  if (student.department) payload.khoa = student.department;
  // Optional fields must not make a valid QR fail backend validation. Invalid
  // email values from source spreadsheets are omitted instead of encoded.
  if (student.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email.trim())) {
    payload.email = student.email.trim();
  }
  if (student.phone) payload.phone = student.phone;

  return JSON.stringify(payload);
}

async function syncToDatabaseDirectly(students: StudentRecord[]) {
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'dut_job_fair',
    connectionTimeoutMillis: 3000,
  });

  try {
    await client.connect();

    // Drop legacy unique constraint on email if it still exists
    try {
      await client.query(`ALTER TABLE students DROP CONSTRAINT IF EXISTS "UQ_25985d58c714a4a427ced57507b"`);
    } catch {}

    // Script có thể chạy trước khi NestJS khởi động lần đầu sau khi cập nhật
    // entity, nên tự đảm bảo cột mã đợt đã tồn tại.
    await client.query(
      'ALTER TABLE students ADD COLUMN IF NOT EXISTS dot_tot_nghiep varchar(100)',
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS "IDX_STUDENTS_GRADUATION_BATCH" ON students (dot_tot_nghiep)',
    );
    await client.query(
      'ALTER TABLE checkins ADD COLUMN IF NOT EXISTS dot_tot_nghiep varchar(100)',
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS "IDX_CHECKINS_GRADUATION_BATCH_TIME" ON checkins (dot_tot_nghiep, check_in_time)',
    );

    let schoolRes = await client.query(`SELECT id FROM schools WHERE code = 'DUT' LIMIT 1`);
    let schoolId: string;
    if (schoolRes.rows.length === 0) {
      const inserted = await client.query(
        `INSERT INTO schools (name, code, address, student_count) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ['Trường Đại học Bách khoa – Đại học Đà Nẵng', 'DUT', '54 Nguyễn Lương Bằng, Liên Chiểu, Đà Nẵng', 0],
      );
      schoolId = inserted.rows[0].id;
    } else {
      schoolId = schoolRes.rows[0].id;
    }

    let insertedCount = 0;
    for (const s of students) {
      const cleanEmail = s.email && s.email.trim() ? s.email.trim() : null;
      const cleanPhone = s.phone && s.phone.trim() ? s.phone.trim() : null;

      await client.query(
        `INSERT INTO students (student_code, full_name, class_name, department, email, phone, major, year, school_id, dot_tot_nghiep, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         ON CONFLICT (student_code) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           class_name = EXCLUDED.class_name,
           department = EXCLUDED.department,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           major = EXCLUDED.major,
           year = EXCLUDED.year,
           dot_tot_nghiep = EXCLUDED.dot_tot_nghiep,
           updated_at = NOW()`,
        [
          s.studentCode,
          s.fullName,
          s.className ?? null,
          s.department ?? null,
          cleanEmail,
          cleanPhone,
          s.major ?? null,
          s.year ?? null,
          schoolId,
          s.dotTotNghiep,
        ],
      );
      insertedCount++;
    }

    await client.end();
    return { success: true, count: insertedCount };
  } catch (error: any) {
    try {
      await client.end();
    } catch {}
    return { success: false, error: error.message };
  }
}

function generateHtmlBadgeGallery(
  studentsWithQr: Array<{ student: StudentRecord; qrDataUri: string; qrPayload: string }>,
  outputHtmlPath: string,
) {
  // Group counts by department
  const deptCounts: Record<string, number> = {};
  for (const item of studentsWithQr) {
    const dept = item.student.department || 'Khác';
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  }

  const studentsJson = JSON.stringify(
    studentsWithQr.map((item, idx) => ({
      idx: idx + 1,
      mssv: item.student.studentCode,
      name: item.student.fullName,
      className: item.student.className || '',
      department: item.student.department || '',
      email: item.student.email || '',
      phone: item.student.phone || '',
      major: item.student.major || '',
      degree: item.student.degreeTitle || '',
      dotTotNghiep: item.student.dotTotNghiep,
      qr: item.qrDataUri,
    })),
  );

  const departmentsJson = JSON.stringify(Object.keys(deptCounts).sort());

  const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thẻ QR Sinh Viên DUT Job Fair (${studentsWithQr.length} sinh viên)</title>
  <style>
    :root {
      --primary: #1d4ed8;
      --primary-dark: #1e40af;
      --primary-light: #eff6ff;
      --accent: #0284c7;
      --bg: #f1f5f9;
      --card-bg: #ffffff;
      --text: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      padding: 24px;
      min-height: 100vh;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%);
      color: white;
      padding: 28px 36px;
      border-radius: 20px;
      margin-bottom: 24px;
      box-shadow: 0 10px 30px -5px rgba(2, 132, 199, 0.25);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .header h1 {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }
    .header p {
      font-size: 14px;
      opacity: 0.92;
    }
    .header-badge {
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(8px);
      padding: 8px 18px;
      border-radius: 30px;
      font-weight: 700;
      font-size: 15px;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .panel {
      background: var(--card-bg);
      border-radius: 16px;
      padding: 20px 24px;
      margin-bottom: 24px;
      border: 1px solid var(--border);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .search-box {
      flex: 1;
      min-width: 280px;
      position: relative;
    }
    .search-input {
      width: 100%;
      padding: 12px 18px;
      border: 1.5px solid var(--border);
      border-radius: 12px;
      font-size: 14px;
      outline: none;
      transition: all 0.2s;
      background: #f8fafc;
    }
    .search-input:focus {
      background: white;
      border-color: var(--primary);
      box-shadow: 0 0 0 4px rgba(29, 78, 216, 0.1);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 22px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      text-decoration: none;
    }
    .btn-primary {
      background-color: var(--primary);
      color: white;
    }
    .btn-primary:hover {
      background-color: var(--primary-dark);
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(29, 78, 216, 0.25);
    }
    .faculty-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
    }
    .faculty-pill {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      background: #f1f5f9;
      color: #475569;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s;
      user-select: none;
    }
    .faculty-pill:hover {
      background: #e2e8f0;
      color: #1e293b;
    }
    .faculty-pill.active {
      background: var(--primary);
      color: white;
      box-shadow: 0 2px 8px rgba(29, 78, 216, 0.25);
    }
    .stats-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
      font-size: 14px;
      color: var(--muted);
      font-weight: 600;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      transition: all 0.2s;
      display: flex;
      flex-direction: column;
    }
    .card:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 24px -6px rgba(0, 0, 0, 0.1);
      border-color: #cbd5e1;
    }
    .card-top {
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      color: white;
      padding: 12px 16px;
      text-align: center;
    }
    .card-top .sub {
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      opacity: 0.9;
      font-weight: 700;
    }
    .card-top .main {
      font-size: 13.5px;
      font-weight: 800;
      margin-top: 1px;
    }
    .card-body {
      padding: 18px;
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
    }
    .qr-container {
      background: white;
      padding: 8px;
      border: 2px dashed #cbd5e1;
      border-radius: 14px;
      margin-bottom: 12px;
    }
    .qr-container img {
      width: 170px;
      height: 170px;
      display: block;
    }
    .student-name {
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
      text-align: center;
      margin-bottom: 4px;
      line-height: 1.3;
    }
    .student-code {
      display: inline-block;
      background: var(--primary-light);
      color: var(--primary);
      font-weight: 700;
      padding: 3px 12px;
      border-radius: 20px;
      font-size: 12.5px;
      margin-bottom: 12px;
    }
    .info-list {
      width: 100%;
      font-size: 12px;
      color: #334155;
      border-top: 1px solid var(--border);
      padding-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
    }
    .info-label {
      color: var(--muted);
      flex-shrink: 0;
    }
    .info-value {
      font-weight: 600;
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .card-footer {
      padding: 10px 16px;
      background: #f8fafc;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn-download {
      font-size: 11.5px;
      color: var(--primary);
      text-decoration: none;
      font-weight: 700;
    }
    .btn-download:hover {
      text-decoration: underline;
    }
    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      margin-top: 32px;
      margin-bottom: 40px;
    }
    .page-btn {
      padding: 8px 14px;
      border: 1px solid var(--border);
      background: white;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .page-btn:hover:not(:disabled) {
      border-color: var(--primary);
      color: var(--primary);
    }
    .page-btn.active {
      background: var(--primary);
      color: white;
      border-color: var(--primary);
    }
    .page-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    @media print {
      body {
        padding: 0;
        background: white;
      }
      .header, .panel, .pagination, .card-footer, .stats-bar {
        display: none !important;
      }
      .grid {
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 12px !important;
        display: grid !important;
      }
      .card {
        box-shadow: none !important;
        border: 1px solid #94a3b8;
        page-break-inside: avoid;
      }
      .qr-container img {
        width: 140px !important;
        height: 140px !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>🎓 THẺ QR CHECK-IN TỐT NGHIỆP DUT 2026</h1>
        <p>Trường Đại học Bách khoa – Đại học Đà Nẵng | Định dạng QR JSON chuẩn DUT Scanner</p>
      </div>
      <div class="header-badge">Tổng số: ${studentsWithQr.length} sinh viên</div>
    </div>

    <div class="panel">
      <div class="toolbar">
        <div class="search-box">
          <input type="text" id="searchInput" class="search-input" placeholder="🔍 Tìm theo MSSV, Họ tên, Lớp, Khoa, Chuyên ngành...">
        </div>
        <button class="btn btn-primary" onclick="printFilteredCards()">🖨️ In thẻ đang xem (Print / PDF)</button>
      </div>

      <div class="faculty-filters" id="facultyFilters">
        <div class="faculty-pill active" data-dept="ALL">Tất cả (${studentsWithQr.length})</div>
      </div>
    </div>

    <div class="stats-bar">
      <span id="resultCount">Đang hiển thị...</span>
      <span id="pageInfo">Trang 1</span>
    </div>

    <div class="grid" id="cardsGrid"></div>

    <div class="pagination" id="pagination"></div>
  </div>

  <script>
    const ALL_STUDENTS = ${studentsJson};
    const DEPARTMENTS = ${departmentsJson};
    const PAGE_SIZE = 48; // 48 cards per page for fast rendering

    let currentDept = 'ALL';
    let currentSearch = '';
    let currentPage = 1;
    let filteredStudents = [...ALL_STUDENTS];

    // Initialize faculty filter buttons
    const facultyContainer = document.getElementById('facultyFilters');
    DEPARTMENTS.forEach(dept => {
      const count = ALL_STUDENTS.filter(s => s.department === dept).length;
      const pill = document.createElement('div');
      pill.className = 'faculty-pill';
      pill.setAttribute('data-dept', dept);
      pill.textContent = \`\${dept} (\${count})\`;
      pill.addEventListener('click', () => {
        document.querySelectorAll('.faculty-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentDept = dept;
        currentPage = 1;
        applyFilters();
      });
      facultyContainer.appendChild(pill);
    });

    document.querySelector('.faculty-pill[data-dept="ALL"]').addEventListener('click', (e) => {
      document.querySelectorAll('.faculty-pill').forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      currentDept = 'ALL';
      currentPage = 1;
      applyFilters();
    });

    // Search input handler
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.toLowerCase().trim();
      currentPage = 1;
      applyFilters();
    });

    function applyFilters() {
      filteredStudents = ALL_STUDENTS.filter(s => {
        const matchesDept = (currentDept === 'ALL' || s.department === currentDept);
        if (!matchesDept) return false;
        if (!currentSearch) return true;
        const text = \`\${s.mssv} \${s.name} \${s.className} \${s.department} \${s.major}\`.toLowerCase();
        return text.includes(currentSearch);
      });

      renderCards();
      renderPagination();
    }

    function renderCards() {
      const grid = document.getElementById('cardsGrid');
      const resultCount = document.getElementById('resultCount');
      const pageInfo = document.getElementById('pageInfo');

      resultCount.textContent = \`Tìm thấy \${filteredStudents.length} / \${ALL_STUDENTS.length} sinh viên\`;
      
      const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE) || 1;
      if (currentPage > totalPages) currentPage = totalPages;
      pageInfo.textContent = \`Trang \${currentPage} / \${totalPages}\`;

      const start = (currentPage - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      const pageItems = filteredStudents.slice(start, end);

      if (pageItems.length === 0) {
        grid.innerHTML = '<div style=\"grid-column: 1/-1; text-align: center; padding: 48px; color: #94a3b8; font-size: 16px;\">Không tìm thấy sinh viên nào phù hợp.</div>';
        return;
      }

      grid.innerHTML = pageItems.map(s => \`
        <div class="card">
          <div class="card-top">
            <div class="sub">DUT TỐT NGHIỆP 2026</div>
            <div class="main">THẺ CHECK-IN SINH VIÊN</div>
          </div>
          <div class="card-body">
            <div class="qr-container">
              <img src="\${s.qr}" alt="QR \${s.mssv}">
            </div>
            <div class="student-name">\${s.name}</div>
            <div class="student-code">MSSV: \${s.mssv}</div>
            <div class="info-list">
              <div class="info-row">
                <span class="info-label">Lớp:</span>
                <span class="info-value">\${s.className || 'Chưa cập nhật'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Khoa:</span>
                <span class="info-value" title="\${s.department}">\${s.department || 'Chưa cập nhật'}</span>
              </div>
              \${s.major ? \`<div class="info-row"><span class="info-label">Ngành:</span><span class="info-value" title="\${s.major}">\${s.major}</span></div>\` : ''}
              \${s.email ? \`<div class="info-row"><span class="info-label">Email:</span><span class="info-value" title="\${s.email}">\${s.email}</span></div>\` : ''}
              \${s.phone ? \`<div class="info-row"><span class="info-label">SĐT:</span><span class="info-value">\${s.phone}</span></div>\` : ''}
            </div>
          </div>
          <div class="card-footer">
            <span style="font-size: 11px; color: #94a3b8;">#\${s.idx}</span>
            <a href="\${s.qr}" download="QR_\${s.mssv}_\${s.name.replace(/\\s+/g, '_')}.png" class="btn-download">💾 Tải ảnh QR</a>
          </div>
        </div>
      \`).join('');
    }

    function renderPagination() {
      const pagination = document.getElementById('pagination');
      const totalPages = Math.ceil(filteredStudents.length / PAGE_SIZE) || 1;

      if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
      }

      let html = '';
      html += \`<button class="page-btn" onclick="goToPage(1)" \${currentPage === 1 ? 'disabled' : ''}>« Đầu</button>\`;
      html += \`<button class="page-btn" onclick="goToPage(\${currentPage - 1})" \${currentPage === 1 ? 'disabled' : ''}>‹ Trước</button>\`;

      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, startPage + 4);
      if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
      }

      for (let p = startPage; p <= endPage; p++) {
        html += \`<button class="page-btn \${p === currentPage ? 'active' : ''}" onclick="goToPage(\${p})">\${p}</button>\`;
      }

      html += \`<button class="page-btn" onclick="goToPage(\${currentPage + 1})" \${currentPage === totalPages ? 'disabled' : ''}>Sau ›</button>\`;
      html += \`<button class="page-btn" onclick="goToPage(\${totalPages})" \${currentPage === totalPages ? 'disabled' : ''}>Cuối »</button>\`;

      pagination.innerHTML = html;
    }

    function goToPage(page) {
      currentPage = page;
      renderCards();
      renderPagination();
      window.scrollTo({ top: 200, behavior: 'smooth' });
    }

    function printFilteredCards() {
      // Temporarily render all filtered students for print
      const grid = document.getElementById('cardsGrid');
      const originalHtml = grid.innerHTML;
      grid.innerHTML = filteredStudents.map(s => \`
        <div class="card">
          <div class="card-top">
            <div class="sub">DUT TỐT NGHIỆP 2026</div>
            <div class="main">THẺ CHECK-IN SINH VIÊN</div>
          </div>
          <div class="card-body">
            <div class="qr-container">
              <img src="\${s.qr}" alt="QR \${s.mssv}">
            </div>
            <div class="student-name">\${s.name}</div>
            <div class="student-code">MSSV: \${s.mssv}</div>
            <div class="info-list">
              <div class="info-row"><span class="info-label">Lớp:</span><span class="info-value">\${s.className || ''}</span></div>
              <div class="info-row"><span class="info-label">Khoa:</span><span class="info-value">\${s.department || ''}</span></div>
            </div>
          </div>
        </div>
      \`).join('');

      window.print();

      // Restore paginated view after print dialog closes
      renderCards();
    }

    // Initial render
    applyFilters();
  </script>
</body>
</html>`;

  fs.writeFileSync(outputHtmlPath, htmlContent, 'utf8');
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a.trim() !== '\\' && a.trim() !== '');
  let excelFile = args.find((a) => !a.startsWith('--'));
  if (excelFile) {
    excelFile = excelFile.replace(/^["']|["']$/g, '').trim();
  }
  const skipDb = args.includes('--no-db') || args.includes('--skip-db');
  const dryRun = args.includes('--dry-run');
  const qrFormat = args.find((a) => a.startsWith('--format='))?.split('=')[1] || 'json';
  const graduationBatch =
    args.find((a) => a.startsWith('--dot-tot-nghiep='))?.split('=').slice(1).join('=').trim() ||
    DEFAULT_GRADUATION_BATCH;
  const requestedFaculties = (args.find((a) => a.startsWith('--khoa='))?.split('=').slice(1).join('=') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  console.log('\n=============================================================');
  console.log('🚀 CÔNG CỤ NHẬP FILE XLSX VÀ TẠO MÃ QR CODE CHO DUT JOB FAIR');
  console.log('=============================================================\n');

  if (!excelFile) {
    const defaultTemplate = path.resolve(process.cwd(), 'mau_danh_sach_sinh_vien.xlsx');
    if (!fs.existsSync(defaultTemplate)) {
      console.log('ℹ️  Chưa chỉ định file Excel, đang tạo file mẫu: mau_danh_sach_sinh_vien.xlsx...');
      generateStudentTemplate(defaultTemplate);
    }
    excelFile = defaultTemplate;
    console.log(`📄 Sử dụng file: ${excelFile}\n`);
  }

  const resolvedExcelPath = path.resolve(process.cwd(), excelFile);
  console.log(`🔍 Đang đọc dữ liệu từ: ${resolvedExcelPath}...`);
  const students = parseAllSheets(resolvedExcelPath, graduationBatch, requestedFaculties);
  const sheetScope = requestedFaculties.length
    ? `sheet khoa: ${requestedFaculties.join(', ')}`
    : 'tất cả các sheet';
  console.log(`✅ Đã trích xuất thành công: ${students.length} sinh viên từ ${sheetScope}!\n`);
  console.log(`🎓 Mã đợt tốt nghiệp mặc định: ${graduationBatch}\n`);
  if (requestedFaculties.length) {
    console.log(`🏫 Chỉ xử lý sheet khoa: ${requestedFaculties.join(', ')}\n`);
  }

  if (students.length === 0) {
    console.log('⚠️  Không có dòng dữ liệu hợp lệ nào.');
    return;
  }

  if (dryRun) {
    console.log('🔎 Chế độ kiểm tra: không đồng bộ database và không tạo QR (--dry-run).');
    return;
  }

  // Database sync if available
  if (!skipDb) {
    console.log('📦 [1/3] Đang đồng bộ vào Cơ sở dữ liệu PostgreSQL...');
    const dbResult = await syncToDatabaseDirectly(students);
    if (dbResult.success) {
      console.log(`✅ Đã lưu/cập nhật thành công ${dbResult.count} sinh viên vào Database PostgreSQL!\n`);
    } else {
      console.warn(`⚠️  Không thể kết nối Database PostgreSQL trực tiếp (${dbResult.error}).`);
      console.warn('💡 Ghi chú: Định dạng QR JSON chuẩn DUT chứa sẵn thông tin sinh viên.');
      console.warn('✨ Khi máy quét quét mã QR này tại gian hàng, hệ thống sẽ TỰ ĐỘNG ĐĂNG KÝ sinh viên vào hệ thống và ghi nhận check-in ngay lập tức!\n');
    }
  } else {
    console.log('⏭️  [1/3] Bỏ qua bước ghi DB (--skip-db được bật).\n');
  }

  // Generate QR codes. Mỗi sheet khoa có thư mục và thư viện thẻ QR riêng,
  // tránh lẫn file của những lần import hoặc khoa khác.
  console.log(`🎨 [2/3] Đang tạo ${students.length} mã QR Code theo từng khoa...`);
  const outputDir = path.resolve(process.cwd(), 'qr-output');
  const studentsBySheet = new Map<string, StudentRecord[]>();
  for (const student of students) {
    const sheetName = student.sheetName || 'Khac';
    const sheetStudents = studentsBySheet.get(sheetName) ?? [];
    sheetStudents.push(student);
    studentsBySheet.set(sheetName, sheetStudents);
  }

  const BATCH_SIZE = 50;
  let generatedTotal = 0;
  const facultyOutputDirs: string[] = [];

  for (const [sheetName, sheetStudents] of studentsBySheet) {
    const facultyDir = path.join(outputDir, toSafeFolderName(sheetName));
    const pngDir = path.join(facultyDir, 'png');
    fs.mkdirSync(pngDir, { recursive: true });

    const studentsWithQr: Array<{
      student: StudentRecord;
      qrDataUri: string;
      qrPayload: string;
    }> = [];

    console.log(`\n   🏫 ${sheetName}: đang tạo ${sheetStudents.length} mã QR...`);
    for (let i = 0; i < sheetStudents.length; i += BATCH_SIZE) {
      const batch = sheetStudents.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (student) => {
          const payload = qrFormat === 'code' ? student.studentCode : buildDutQrPayload(student);

          const qrDataUri = await QRCode.toDataURL(payload, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 300,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
          });

          const safeName = student.fullName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]/g, '_');
          const pngPath = path.join(pngDir, `${student.studentCode}_${safeName}.png`);
          await QRCode.toFile(pngPath, payload, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 400,
          });

          studentsWithQr.push({
            student,
            qrDataUri,
            qrPayload: payload,
          });
        }),
      );

      const progress = Math.min(i + BATCH_SIZE, sheetStudents.length);
      process.stdout.write(
        `\r      ⏳ ${sheetName}: ${progress}/${sheetStudents.length} QR codes (${Math.round((progress / sheetStudents.length) * 100)}%)...`,
      );
    }

    const htmlPath = path.join(facultyDir, 'danh_sach_the_sinh_vien.html');
    generateHtmlBadgeGallery(studentsWithQr, htmlPath);
    generatedTotal += studentsWithQr.length;
    facultyOutputDirs.push(facultyDir);
    console.log(`\n      ✅ ${sheetName}: ${studentsWithQr.length} PNG → ${pngDir}`);
  }

  console.log('\n📄 [3/3] Đã tạo thư viện thẻ QR riêng cho từng khoa.');

  console.log('=============================================================');
  console.log('🎉 HOÀN TẤT THÀNH CÔNG!');
  console.log(`📊 Tổng số sinh viên: ${generatedTotal}`);
  console.log(`📁 Thư mục kết quả: ${outputDir}`);
  console.log('🗂️  Thư mục từng khoa:');
  facultyOutputDirs.forEach((dir) => console.log(`   ${dir}`));
  console.log('🌐 Mỗi thư mục khoa có file danh_sach_the_sinh_vien.html để xem/in thẻ QR.');
  console.log('=============================================================\n');
}

main().catch((err) => {
  console.error('❌ Có lỗi xảy ra:', err);
  process.exit(1);
});

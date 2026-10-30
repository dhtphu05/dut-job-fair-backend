import { randomInt } from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
import { normalizeFaculty } from '../common/faculties';
import { BoothType } from '../entities/booth.entity';
import {
  SEED_CHECKIN_STUDENTS,
  SEED_CHECKIN_TIME_CONFIG,
  SeedCheckinStudent,
} from '../seed-data/checkin-students';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

type BoothRow = {
  id: string;
  name: string;
  type: BoothType;
  qr_code: string | null;
  location: string | null;
  business_name: string | null;
};

type ExistingDataProfile = {
  storageTimezone: string;
  boothCheckinDate: string;
  defaultSchoolId: string | null;
  defaultGraduationBatch: string | null;
  useFacultyPrefix: boolean;
  defaultStatus: 'active' | 'completed';
};

type PlannedCheckin = {
  studentId: string;
  studentCode: string;
  studentName: string;
  boothId: string;
  boothName: string;
  boothType: BoothType;
  isoTimestampVn: string;
  epochMs: number;
  graduationBatch: string | null;
};

function stripAccents(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
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

function parseTimeToSeconds(hms: string): number {
  const parts = hms.trim().split(':').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Định dạng giờ không hợp lệ (cần HH:mm:ss): ${hms}`);
  }
  const [h, m, s] = parts;
  return h * 3600 + m * 60 + s;
}

function secondsToHms(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatDurationSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}p${String(s).padStart(2, '0')}s`;
}

/**
 * Chuẩn hóa chuỗi thời gian Workshop do người dùng nhập trong `checkin-students.ts`
 * về định dạng chuẩn ISO 8601 theo giờ Việt Nam (`YYYY-MM-DDTHH:mm:ss+07:00`).
 * Hỗ trợ:
 * - '2026-10-30T13:17:33+07:00'
 * - '2026-10-30 13:17:33' hoặc '2026-10-30T13:17:33'
 * - '30/10/2026 13:17:33' hoặc '13:17:33 30/10/2026'
 * - '13h17p33s 30/10/2026' hoặc '30/10/2026 13h17p33s'
 */
export function normalizeVnTimestampInput(rawInput: string): string {
  const raw = rawInput.trim();
  if (!raw) {
    throw new Error('Thời gian check-in workshop không được để trống.');
  }

  const pad2 = (v: string | number) => String(v).padStart(2, '0');

  // 1. Định dạng chuẩn YYYY-MM-DD[T ]HH:mm:ss(.sss)?(+07:00|Z)?
  const isoMatch = raw.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.\d+)?([+-]\d{2}:\d{2}|Z)?$/i,
  );
  if (isoMatch) {
    const [, yyyy, mm, dd, hh, mi, ss = '00', tz = '+07:00'] = isoMatch;
    const normalizedTz = tz.toUpperCase() === 'Z' ? 'Z' : tz;
    const candidate = `${yyyy}-${pad2(mm)}-${pad2(dd)}T${pad2(hh)}:${pad2(mi)}:${pad2(ss)}${normalizedTz}`;
    if (Number.isNaN(new Date(candidate).getTime())) {
      throw new Error(`Thời gian check-in workshop không hợp lệ: "${rawInput}"`);
    }
    return candidate;
  }

  // Chuẩn hóa dạng "13h17p33s" hoặc "13h17p" về "13:17:33"
  const normalizedHms = raw
    .replace(
      /(\d{1,2})\s*h\s*(\d{1,2})\s*(?:p|phút|m)?\s*(\d{1,2})?\s*(?:s|giây)?/i,
      (_m, hh: string, mi: string, ss?: string) =>
        `${pad2(hh)}:${pad2(mi)}:${pad2(ss ?? '00')}`,
    )
    .trim();

  // 2. Định dạng DD/MM/YYYY HH:mm:ss (hoặc DD-MM-YYYY HH:mm:ss)
  const dmyFirstMatch = normalizedHms.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/,
  );
  if (dmyFirstMatch) {
    const [, dd, mm, yyyy, hh, mi, ss = '00'] = dmyFirstMatch;
    const candidate = `${yyyy}-${pad2(mm)}-${pad2(dd)}T${pad2(hh)}:${pad2(mi)}:${pad2(ss)}+07:00`;
    if (Number.isNaN(new Date(candidate).getTime())) {
      throw new Error(`Thời gian check-in workshop không hợp lệ: "${rawInput}"`);
    }
    return candidate;
  }

  // 3. Định dạng HH:mm:ss DD/MM/YYYY (hoặc HH:mm:ss DD-MM-YYYY)
  const timeFirstMatch = normalizedHms.match(
    /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s+(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/,
  );
  if (timeFirstMatch) {
    const [, hh, mi, ss = '00', dd, mm, yyyy] = timeFirstMatch;
    const candidate = `${yyyy}-${pad2(mm)}-${pad2(dd)}T${pad2(hh)}:${pad2(mi)}:${pad2(ss)}+07:00`;
    if (Number.isNaN(new Date(candidate).getTime())) {
      throw new Error(`Thời gian check-in workshop không hợp lệ: "${rawInput}"`);
    }
    return candidate;
  }

  throw new Error(
    `Định dạng thời gian workshop không hợp lệ: "${rawInput}". Hãy dùng dạng "2026-10-30T13:17:33+07:00", "30/10/2026 13:17:33" hoặc "13h17p33s 30/10/2026".`,
  );
}

function attachMicroseconds(isoWithOffset: string): string {
  const normalized = normalizeVnTimestampInput(isoWithOffset);
  const micro = String(randomInt(100000, 999999));
  // Chèn phần thập phân giây (.xxxxxx) trước +07:00 hoặc Z để giống hệt DEFAULT now() của PostgreSQL
  return normalized.replace(/([+-]\d{2}:\d{2}|Z)$/, `.${micro}$1`);
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Sinh `count` mốc giây (seconds-of-day) nằm gọn trong khoảng [startSec, endSec],
 * phân bổ rải rác tự nhiên đến từng phút và giây, đồng thời ĐẢM BẢO khoảng cách
 * giữa 2 mốc liên tiếp bất kỳ luôn >= `minGapSec` (mặc định 300s = 5 phút).
 */
export function generateScatteredSecondsInWindow(
  count: number,
  startSec: number,
  endSec: number,
  minGapSec: number,
  usedSeconds: Set<number>,
): number[] {
  if (count <= 0) return [];
  const totalSpan = endSec - startSec;
  if (totalSpan < 0) {
    throw new Error(`Khoảng thời gian không hợp lệ: ${startSec} -> ${endSec}`);
  }

  if (count === 1) {
    let chosen =
      endSec > startSec ? randomInt(startSec, endSec + 1) : startSec;
    let attempts = 0;
    while (usedSeconds.has(chosen) && attempts < 50 && endSec > startSec) {
      chosen = randomInt(startSec, endSec + 1);
      attempts++;
    }
    usedSeconds.add(chosen);
    return [chosen];
  }

  const requiredSpan = (count - 1) * minGapSec;
  if (totalSpan < requiredSpan) {
    throw new Error(
      `Khung giờ ${secondsToHms(startSec)} - ${secondsToHms(endSec)} (${Math.floor(totalSpan / 60)} phút) không đủ chỗ để xếp ${count} booth cách nhau tối thiểu ${Math.floor(minGapSec / 60)} phút.`,
    );
  }

  // Bijection: sec[i] = startSec + i * minGapSec + slackOffset[i]
  // với slackOffset[i] thuộc [lowSlack_i, highSlack_i] và highSlack_{i-1} <= lowSlack_i
  // => Đảm bảo tuyệt đối sec[i] - sec[i-1] >= minGapSec cho mọi i!
  const totalSlack = totalSpan - requiredSpan;
  const results: number[] = [];

  for (let i = 0; i < count; i++) {
    const lowSlack = Math.floor((i * totalSlack) / count);
    const highSlack = Math.floor(((i + 1) * totalSlack) / count);

    let offset =
      highSlack > lowSlack ? randomInt(lowSlack, highSlack + 1) : lowSlack;
    let chosen = startSec + i * minGapSec + offset;

    let attempts = 0;
    while (usedSeconds.has(chosen) && attempts < 40 && highSlack > lowSlack) {
      offset = randomInt(lowSlack, highSlack + 1);
      chosen = startSec + i * minGapSec + offset;
      attempts++;
    }

    usedSeconds.add(chosen);
    results.push(chosen);
  }

  return results;
}

function resolveWorkshopIsoTime(
  booth: BoothRow,
  studentSeed: SeedCheckinStudent,
): {
  label: string;
  isoWithOffset: string;
} {
  const combined = stripAccents(
    `${booth.name ?? ''} ${booth.business_name ?? ''} ${booth.qr_code ?? ''}`,
  );
  const qr = (booth.qr_code ?? '').trim().toUpperCase();

  if (
    qr === 'WORKSHOP-01' ||
    qr === 'REWARD-CAREER-TALK' ||
    combined.includes('toa dam') ||
    combined.includes('ky nang nghe nghiep') ||
    combined.includes('career talk')
  ) {
    const rawTime =
      studentSeed.workshopCheckinTimes?.careerTalk?.trim() ||
      SEED_CHECKIN_TIME_CONFIG.workshops.careerTalk;
    return {
      label: 'Tọa đàm kỹ năng nghề nghiệp',
      isoWithOffset: normalizeVnTimestampInput(rawTime),
    };
  }

  if (
    qr === 'WORKSHOP-02' ||
    qr === 'REWARD-OPENING' ||
    combined.includes('khai mac') ||
    combined.includes('opening')
  ) {
    const rawTime =
      studentSeed.workshopCheckinTimes?.openingCeremony?.trim() ||
      SEED_CHECKIN_TIME_CONFIG.workshops.openingCeremony;
    return {
      label: 'Lễ khai mạc',
      isoWithOffset: normalizeVnTimestampInput(rawTime),
    };
  }

  // Fallback nếu trong DB có thêm workshop khác
  const fallbackRaw =
    studentSeed.workshopCheckinTimes?.careerTalk?.trim() ||
    SEED_CHECKIN_TIME_CONFIG.workshops.careerTalk;
  return {
    label: booth.business_name ?? booth.name,
    isoWithOffset: normalizeVnTimestampInput(fallbackRaw),
  };
}

/**
 * Phát hiện chính xác cách dữ liệu có sẵn trong DB đang lưu trữ timezone,
 * ngày check-in booth, school_id, dot_tot_nghiep và định dạng tên Khoa.
 */
async function inspectExistingDataProfile(
  client: Client,
): Promise<ExistingDataProfile> {
  const tzRes = await client.query<{ db_tz: string }>(
    `SELECT current_setting('TIMEZONE') AS db_tz`,
  );
  const dbTz = tzRes.rows[0]?.db_tz ?? 'UTC';

  // Kiểm tra các bản ghi check-in có sẵn để đồng bộ 100% múi giờ lưu trong cột timestamp without time zone
  const checkinHoursRes = await client.query<{
    total: number;
    early_utc_hours: number;
    late_vn_hours: number;
    career_talk_avg_hour: number | null;
  }>(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM c.check_in_time) < 7)::int AS early_utc_hours,
      COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM c.check_in_time) >= 11)::int AS late_vn_hours,
      AVG(EXTRACT(HOUR FROM c.check_in_time)) FILTER (
        WHERE b.type = 'workshop'
          AND (
            b.qr_code IN ('WORKSHOP-01', 'REWARD-CAREER-TALK')
            OR b.name ILIKE '%tọa đàm%'
            OR b.name ILIKE '%kỹ năng%'
          )
      )::float AS career_talk_avg_hour
    FROM checkins c
    INNER JOIN booths b ON b.id = c.booth_id
    WHERE b.type IN ('booth', 'workshop')
  `);

  const stats = checkinHoursRes.rows[0];
  let storageTimezone = dbTz;

  if (stats && stats.total > 0) {
    if (stats.career_talk_avg_hour !== null) {
      // Tọa đàm diễn ra lúc 13:17 (UTC+7) tức 06:17 (UTC)
      storageTimezone =
        stats.career_talk_avg_hour < 10 ? 'UTC' : 'Asia/Ho_Chi_Minh';
    } else if (stats.early_utc_hours > 0 && stats.late_vn_hours === 0) {
      storageTimezone = 'UTC';
    } else if (stats.late_vn_hours > 0 && stats.early_utc_hours === 0) {
      storageTimezone = 'Asia/Ho_Chi_Minh';
    }
  } else {
    const upperTz = dbTz.toUpperCase();
    if (upperTz === 'UTC' || upperTz === 'ETC/UTC' || upperTz === 'GMT') {
      storageTimezone = 'UTC';
    } else if (
      upperTz.includes('ASIA/HO_CHI_MINH') ||
      upperTz.includes('ASIA/SAIGON') ||
      upperTz.includes('ASIA/BANGKOK') ||
      upperTz.includes('+07')
    ) {
      storageTimezone = 'Asia/Ho_Chi_Minh';
    }
  }

  // Xác định ngày check-in booth doanh nghiệp đồng bộ với dữ liệu có sẵn trong sự kiện tháng 10/2026
  let boothCheckinDate = SEED_CHECKIN_TIME_CONFIG.fallbackBoothDate;
  if (SEED_CHECKIN_TIME_CONFIG.boothCheckinDate !== 'auto') {
    boothCheckinDate = SEED_CHECKIN_TIME_CONFIG.boothCheckinDate;
  } else {
    const boothDateRes = await client.query<{ vn_date: string; cnt: number }>(
      `
        SELECT
          to_char((c.check_in_time::timestamp AT TIME ZONE $1) AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS vn_date,
          COUNT(*)::int AS cnt
        FROM checkins c
        INNER JOIN booths b ON b.id = c.booth_id
        WHERE b.type = 'booth'
          AND to_char((c.check_in_time::timestamp AT TIME ZONE $1) AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') = '2026-10'
        GROUP BY vn_date
        ORDER BY cnt DESC
        LIMIT 1
      `,
      [storageTimezone],
    );
    if (boothDateRes.rows[0]?.vn_date) {
      boothCheckinDate = boothDateRes.rows[0].vn_date;
    }
  }

  // Đồng bộ school_id với dữ liệu sinh viên hiện có
  const studentSchoolRes = await client.query<{
    school_id: string | null;
    cnt: number;
  }>(`
    SELECT s.school_id, COUNT(*)::int AS cnt
    FROM students s
    LEFT JOIN checkins c ON c.student_id = s.id
    GROUP BY s.school_id
    ORDER BY COUNT(c.id) DESC, cnt DESC
    LIMIT 1
  `);

  let defaultSchoolId: string | null = null;
  if (studentSchoolRes.rows.length > 0) {
    defaultSchoolId = studentSchoolRes.rows[0].school_id;
  } else {
    const dutSchool = await client.query<{ id: string }>(
      `SELECT id FROM schools WHERE code = 'DUT' LIMIT 1`,
    );
    defaultSchoolId = dutSchool.rows[0]?.id ?? null;
  }

  // Đồng bộ dot_tot_nghiep với các bản ghi check-in booth/workshop hiện có
  const batchRes = await client.query<{
    dot_tot_nghiep: string | null;
    cnt: number;
  }>(`
    SELECT c.dot_tot_nghiep, COUNT(*)::int AS cnt
    FROM checkins c
    INNER JOIN booths b ON b.id = c.booth_id
    WHERE b.type IN ('booth', 'workshop')
    GROUP BY c.dot_tot_nghiep
    ORDER BY cnt DESC
    LIMIT 1
  `);
  let defaultGraduationBatch: string | null = null;
  if (batchRes.rows.length > 0) {
    defaultGraduationBatch = batchRes.rows[0].dot_tot_nghiep;
  } else {
    const studentBatchRes = await client.query<{
      dot_tot_nghiep: string | null;
      cnt: number;
    }>(`
      SELECT dot_tot_nghiep, COUNT(*)::int AS cnt
      FROM students
      GROUP BY dot_tot_nghiep
      ORDER BY cnt DESC
      LIMIT 1
    `);
    defaultGraduationBatch = studentBatchRes.rows[0]?.dot_tot_nghiep ?? null;
  }

  // Đồng bộ định dạng tên Khoa (có tiền tố "Khoa " hay không)
  const deptFormatRes = await client.query<{
    with_prefix: number;
    without_prefix: number;
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE department ILIKE 'Khoa %')::int AS with_prefix,
      COUNT(*) FILTER (WHERE department IS NOT NULL AND BTRIM(department) <> '' AND department NOT ILIKE 'Khoa %')::int AS without_prefix
    FROM students
  `);
  const deptStats = deptFormatRes.rows[0];
  const useFacultyPrefix =
    !deptStats ||
    deptStats.with_prefix >= deptStats.without_prefix ||
    deptStats.without_prefix === 0;

  // Đồng bộ trạng thái status của checkin (mặc định ScannerService luôn tạo 'active')
  const statusRes = await client.query<{
    status: 'active' | 'completed';
    cnt: number;
  }>(`
    SELECT c.status, COUNT(*)::int AS cnt
    FROM checkins c
    INNER JOIN booths b ON b.id = c.booth_id
    WHERE b.type IN ('booth', 'workshop')
    GROUP BY c.status
    ORDER BY cnt DESC
    LIMIT 1
  `);
  const defaultStatus = statusRes.rows[0]?.status ?? 'active';

  return {
    storageTimezone,
    boothCheckinDate,
    defaultSchoolId,
    defaultGraduationBatch,
    useFacultyPrefix,
    defaultStatus,
  };
}

function formatDepartment(
  rawDepartment: string,
  useFacultyPrefix: boolean,
): string {
  const normalized = normalizeFaculty(rawDepartment);
  if (useFacultyPrefix) {
    return normalized;
  }
  return normalized.replace(/^Khoa\s+/i, '').trim();
}

async function ensureStudentRecord(
  client: Client,
  studentSeed: SeedCheckinStudent,
  profile: ExistingDataProfile,
  earliestIsoVn: string,
  latestIsoVn: string,
): Promise<{
  id: string;
  studentCode: string;
  fullName: string;
  graduationBatch: string | null;
  createdNew: boolean;
}> {
  const studentCode = studentSeed.studentCode.trim();
  const fullName = studentSeed.fullName.trim();
  if (!studentCode || !fullName) {
    throw new Error(
      'Mỗi sinh viên trong SEED_CHECKIN_STUDENTS phải có đủ studentCode và fullName.',
    );
  }

  const department = studentSeed.department
    ? formatDepartment(studentSeed.department, profile.useFacultyPrefix)
    : null;
  const className = studentSeed.className?.trim() || null;
  const email = studentSeed.email?.trim() || null;
  const phone = studentSeed.phone?.trim() || null;
  const major =
    studentSeed.major !== undefined ? studentSeed.major?.trim() || null : null;
  const year =
    studentSeed.year !== undefined && studentSeed.year !== null
      ? studentSeed.year
      : deriveYearFromStudentCode(studentCode);
  const graduationBatch =
    studentSeed.graduationBatch !== undefined
      ? studentSeed.graduationBatch?.trim() || null
      : profile.defaultGraduationBatch;

  const existingRes = await client.query<{
    id: string;
    student_code: string;
    full_name: string;
    dot_tot_nghiep: string | null;
  }>(
    `SELECT id, student_code, full_name, dot_tot_nghiep FROM students WHERE student_code = $1 LIMIT 1`,
    [studentCode],
  );

  if (existingRes.rows.length > 0) {
    const existing = existingRes.rows[0];
    // Đồng bộ thông tin hồ sơ sinh viên nếu người dùng sửa file checkin-students.ts (giống ScannerService.upsertStudentFromQr),
    // hoàn toàn không tác động đến các bản ghi check-in đã có
    const updatedRes = await client.query<{
      id: string;
      student_code: string;
      full_name: string;
      dot_tot_nghiep: string | null;
    }>(
      `
        UPDATE students
        SET
          full_name = $2,
          class_name = COALESCE($3, class_name),
          department = COALESCE($4, department),
          email = COALESCE($5, email),
          phone = COALESCE($6, phone),
          major = COALESCE($7, major),
          year = COALESCE($8, year)
        WHERE id = $1
        RETURNING id, student_code, full_name, dot_tot_nghiep
      `,
      [
        existing.id,
        fullName,
        className,
        department,
        email,
        phone,
        major,
        year,
      ],
    );
    const updated = updatedRes.rows[0] ?? existing;
    return {
      id: updated.id,
      studentCode: updated.student_code,
      fullName: updated.full_name,
      graduationBatch: updated.dot_tot_nghiep ?? graduationBatch,
      createdNew: false,
    };
  }

  const inserted = await client.query<{
    id: string;
    student_code: string;
    full_name: string;
    dot_tot_nghiep: string | null;
  }>(
    `
      INSERT INTO students (
        school_id,
        student_code,
        full_name,
        email,
        phone,
        major,
        department,
        class_name,
        year,
        gpa,
        dot_tot_nghiep,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        NULL,
        $10,
        ($11::timestamptz AT TIME ZONE $13),
        ($12::timestamptz AT TIME ZONE $13)
      )
      RETURNING id, student_code, full_name, dot_tot_nghiep
    `,
    [
      profile.defaultSchoolId,
      studentCode,
      fullName,
      email,
      phone,
      major,
      department,
      className,
      year,
      graduationBatch,
      earliestIsoVn,
      latestIsoVn,
      profile.storageTimezone,
    ],
  );

  const row = inserted.rows[0];
  return {
    id: row.id,
    studentCode: row.student_code,
    fullName: row.full_name,
    graduationBatch: row.dot_tot_nghiep,
    createdNew: true,
  };
}

async function main() {
  if (!SEED_CHECKIN_STUDENTS.length) {
    throw new Error(
      'Danh sách SEED_CHECKIN_STUDENTS trong src/seed-data/checkin-students.ts đang trống.',
    );
  }

  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'dut_job_fair',
    connectionTimeoutMillis: 5000,
  });

  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('seed-student-checkins'))",
    );

    // Dọn dẹp sinh viên mẫu mặc định ban đầu (nếu người dùng đã thay đổi MSSV trong checkin-students.ts)
    const configuredCodes = new Set(
      SEED_CHECKIN_STUDENTS.map((s) => s.studentCode.trim()),
    );
    const legacyTemplateCodes = ['102220156', '106230084'].filter(
      (code) => !configuredCodes.has(code),
    );
    if (legacyTemplateCodes.length > 0) {
      const legacyStudentsRes = await client.query<{
        id: string;
        student_code: string;
        full_name: string;
      }>(
        `SELECT id, student_code, full_name FROM students WHERE student_code = ANY($1::varchar[])`,
        [legacyTemplateCodes],
      );
      if (legacyStudentsRes.rows.length > 0) {
        const legacyIds = legacyStudentsRes.rows.map((r) => r.id);
        await client.query(
          `DELETE FROM reward_claims WHERE student_id = ANY($1::uuid[])`,
          [legacyIds],
        );
        await client.query(
          `DELETE FROM checkins WHERE student_id = ANY($1::uuid[])`,
          [legacyIds],
        );
        await client.query(
          `DELETE FROM students WHERE id = ANY($1::uuid[])`,
          [legacyIds],
        );
        console.log(
          `ℹ Đã dọn dẹp ${legacyStudentsRes.rows.length} sinh viên mẫu cũ không còn trong checkin-students.ts: ${legacyStudentsRes.rows
            .map((s) => `${s.full_name} (${s.student_code})`)
            .join(', ')}`,
        );
      }
    }

    // Đảm bảo mọi booth workshop đều có bản ghi businesses (type = 'workshop') gắn kết để hiển thị đầy đủ khi tra cứu SV
    const orphanWorkshopBooths = await client.query<{
      id: string;
      name: string;
    }>(`
      SELECT id, name
      FROM booths
      WHERE type = 'workshop' AND business_id IS NULL
    `);
    for (const wsBooth of orphanWorkshopBooths.rows) {
      const existingBiz = await client.query<{ id: string }>(
        `SELECT id FROM businesses WHERE name = $1 AND type = 'workshop' LIMIT 1`,
        [wsBooth.name],
      );
      let bizId = existingBiz.rows[0]?.id;
      if (!bizId) {
        const createdBiz = await client.query<{ id: string }>(
          `
            INSERT INTO businesses (name, description, type)
            VALUES ($1, $2, 'workshop')
            RETURNING id
          `,
          [wsBooth.name, 'Hội thảo chuyên đề tại DUT Job Fair 2026.'],
        );
        bizId = createdBiz.rows[0]?.id;
      }
      if (bizId) {
        await client.query(
          `UPDATE booths SET business_id = $2 WHERE id = $1`,
          [wsBooth.id, bizId],
        );
      }
    }

    const profile = await inspectExistingDataProfile(client);

    const boothsRes = await client.query<BoothRow>(`
      SELECT
        b.id,
        b.name,
        b.type,
        b.qr_code,
        b.location,
        biz.name AS business_name
      FROM booths b
      LEFT JOIN businesses biz ON biz.id = b.business_id
      WHERE b.type IN ('booth', 'workshop')
      ORDER BY b.created_at ASC, b.id ASC
    `);

    const boothRows: BoothRow[] = boothsRes.rows;
    const companyBooths: BoothRow[] = boothRows.filter(
      (b) => b.type === BoothType.BOOTH,
    );
    const workshopBooths: BoothRow[] = boothRows.filter(
      (b) => b.type === BoothType.WORKSHOP,
    );

    if (companyBooths.length === 0 && workshopBooths.length === 0) {
      throw new Error(
        'Không tìm thấy booth doanh nghiệp hoặc workshop nào trong database. Hãy chạy seed booth/workshop trước.',
      );
    }

    // Đồng bộ required_workshop_ids trong reward_milestones nếu đang trỏ tới UUID workshop cũ đã bị xóa
    if (workshopBooths.length > 0) {
      const activeWorkshopIds = workshopBooths.map((w) => w.id);
      const activeWorkshopIdSet = new Set(activeWorkshopIds);
      const milestonesRes = await client.query<{
        id: string;
        name: string;
        requires_special_stamps: boolean;
        required_workshop_ids: string[] | null;
      }>(`
        SELECT id, name, requires_special_stamps, required_workshop_ids
        FROM reward_milestones
        WHERE requires_special_stamps = true
           OR (required_workshop_ids IS NOT NULL AND cardinality(required_workshop_ids) > 0)
      `);

      for (const ms of milestonesRes.rows) {
        const currentIds = ms.required_workshop_ids ?? [];
        const hasMissingId =
          currentIds.length === 0 ||
          currentIds.some((id) => !activeWorkshopIdSet.has(id));
        if (hasMissingId) {
          const targetLen =
            currentIds.length > 0
              ? Math.min(currentIds.length, activeWorkshopIds.length)
              : Math.min(2, activeWorkshopIds.length);
          const validKept = currentIds.filter((id) =>
            activeWorkshopIdSet.has(id),
          );
          const replacements = activeWorkshopIds.filter(
            (id) => !validKept.includes(id),
          );
          const updatedIds = [
            ...validKept,
            ...replacements.slice(0, Math.max(0, targetLen - validKept.length)),
          ];
          await client.query(
            `
              UPDATE reward_milestones
              SET required_workshop_ids = $2::uuid[],
                  requires_special_stamps = true
              WHERE id = $1
            `,
            [ms.id, updatedIds],
          );
          console.log(
            `ℹ Đã đồng bộ required_workshop_ids cho mốc quà "${ms.name}" -> [${updatedIds.join(', ')}]`,
          );
        }
      }
    }

    const minBoothGapMinutes =
      SEED_CHECKIN_TIME_CONFIG.minBoothGapMinutes ?? 5;
    const minBoothGapSec = Math.max(0, Math.round(minBoothGapMinutes * 60));

    console.log('\n============================================================');
    console.log('  SEED BỔ SUNG SINH VIÊN CHECK-IN ĐỦ BOOTH & WORKSHOP');
    console.log('============================================================');
    console.log(`- Múi giờ lưu trữ DB phát hiện : ${profile.storageTimezone}`);
    console.log(`- Ngày check-in booth (UTC+7)  : ${profile.boothCheckinDate}`);
    console.log(
      `- Khoảng cách tối thiểu 2 booth: >= ${minBoothGapMinutes} phút (${minBoothGapSec} giây)`,
    );
    console.log(`- Số booth doanh nghiệp hiện có: ${companyBooths.length}`);
    console.log(`- Số workshop hiện có          : ${workshopBooths.length}`);
    console.log(`- Số sinh viên trong danh sách : ${SEED_CHECKIN_STUDENTS.length}`);

    const boothStartSec = parseTimeToSeconds(
      SEED_CHECKIN_TIME_CONFIG.boothWindow.start,
    );
    const boothEndSec = parseTimeToSeconds(
      SEED_CHECKIN_TIME_CONFIG.boothWindow.end,
    );
    const boothWindowSpan = boothEndSec - boothStartSec;
    const maxBoothCapacity =
      minBoothGapSec > 0
        ? Math.floor(boothWindowSpan / minBoothGapSec) + 1
        : companyBooths.length;

    console.log(
      `- Khung giờ booth (UTC+7)      : ${SEED_CHECKIN_TIME_CONFIG.boothWindow.start} -> ${SEED_CHECKIN_TIME_CONFIG.boothWindow.end}`,
    );

    const usedBoothSeconds = new Set<number>();
    const allPlannedCheckins: PlannedCheckin[] = [];
    let updatedWorkshopCheckinsCount = 0;
    let updatedBoothCheckinsCount = 0;

    for (const [studentIdx, studentSeed] of SEED_CHECKIN_STUDENTS.entries()) {
      // Xáo trộn ngẫu nhiên danh sách booth doanh nghiệp cho từng sinh viên
      const shuffledBooths = shuffleArray(companyBooths);
      const totalBooths = shuffledBooths.length;

      if (totalBooths > maxBoothCapacity) {
        throw new Error(
          `Tổng số booth doanh nghiệp (${totalBooths}) vượt quá sức chứa tối đa (${maxBoothCapacity}) của khung giờ ${SEED_CHECKIN_TIME_CONFIG.boothWindow.start} - ${SEED_CHECKIN_TIME_CONFIG.boothWindow.end} khi yêu cầu cách nhau tối thiểu ${minBoothGapMinutes} phút.`,
        );
      }

      const combinedBoothSeconds = generateScatteredSecondsInWindow(
        totalBooths,
        boothStartSec,
        boothEndSec,
        minBoothGapSec,
        usedBoothSeconds,
      );

      // Kiểm tra nghiêm ngặt: mọi cặp thời gian check-in booth liên tiếp của sinh viên đều cách nhau >= minBoothGapSec
      for (let i = 1; i < combinedBoothSeconds.length; i++) {
        const gapSec = combinedBoothSeconds[i] - combinedBoothSeconds[i - 1];
        if (gapSec < minBoothGapSec) {
          throw new Error(
            `Lỗi nội bộ: Khoảng cách giữa 2 booth liên tiếp (${gapSec}s) nhỏ hơn mức tối thiểu ${minBoothGapSec}s.`,
          );
        }
      }

      // Tính mốc thời gian sớm nhất & muộn nhất của sinh viên để gán created_at / updated_at hợp lý
      const candidateTimestamps: string[] = [];
      for (const ws of workshopBooths) {
        candidateTimestamps.push(
          attachMicroseconds(
            resolveWorkshopIsoTime(ws, studentSeed).isoWithOffset,
          ),
        );
      }
      for (const sec of combinedBoothSeconds) {
        candidateTimestamps.push(
          attachMicroseconds(
            `${profile.boothCheckinDate}T${secondsToHms(sec)}+07:00`,
          ),
        );
      }
      const sortedCandidateTimes = [...candidateTimestamps].sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime(),
      );
      const earliestIsoVn =
        sortedCandidateTimes[0] ??
        normalizeVnTimestampInput(SEED_CHECKIN_TIME_CONFIG.workshops.careerTalk);
      const latestIsoVn =
        sortedCandidateTimes[sortedCandidateTimes.length - 1] ?? earliestIsoVn;

      const studentRecord = await ensureStudentRecord(
        client,
        studentSeed,
        profile,
        earliestIsoVn,
        latestIsoVn,
      );

      // Kiểm tra các booth/workshop mà sinh viên này đã check-in trước đó (nếu có)
      type ExistingCheckinRow = {
        id: string;
        booth_id: string;
        vn_iso_sec: string;
        vn_hms: string;
      };
      const existingCheckinsRes = await client.query<ExistingCheckinRow>(
        `
          SELECT
            id,
            booth_id,
            to_char(
              (check_in_time::timestamp AT TIME ZONE $2) AT TIME ZONE 'Asia/Ho_Chi_Minh',
              'YYYY-MM-DD"T"HH24:MI:SS"+07:00"'
            ) AS vn_iso_sec,
            to_char(
              (check_in_time::timestamp AT TIME ZONE $2) AT TIME ZONE 'Asia/Ho_Chi_Minh',
              'HH24:MI:SS'
            ) AS vn_hms
          FROM checkins
          WHERE student_id = $1
        `,
        [studentRecord.id, profile.storageTimezone],
      );
      const existingRows: ExistingCheckinRow[] = existingCheckinsRes.rows;
      const existingByBoothId = new Map<string, ExistingCheckinRow>(
        existingRows.map((r) => [r.booth_id, r]),
      );

      console.log(
        `\n[${studentIdx + 1}] Sinh viên: ${studentRecord.fullName} (${studentRecord.studentCode}) - ${
          studentRecord.createdNew
            ? 'Tạo mới'
            : 'Đã tồn tại trong DB (đã đồng bộ thông tin)'
        }`,
      );

      // Lên lịch chèn mới Workshop hoặc đồng bộ lại thời gian Workshop nếu người dùng sửa thủ công trong checkin-students.ts
      for (const ws of workshopBooths) {
        const resolved = resolveWorkshopIsoTime(ws, studentSeed);
        const existingWs = existingByBoothId.get(ws.id);

        if (existingWs) {
          const targetSecIso = `${resolved.isoWithOffset.slice(0, 19)}+07:00`;
          if (existingWs.vn_iso_sec !== targetSecIso) {
            const newIsoTimestampVn = attachMicroseconds(
              resolved.isoWithOffset,
            );
            await client.query(
              `
                UPDATE checkins
                SET check_in_time = ($2::timestamptz AT TIME ZONE $3)
                WHERE id = $1
              `,
              [existingWs.id, newIsoTimestampVn, profile.storageTimezone],
            );
            updatedWorkshopCheckinsCount++;
            console.log(
              `    ↻ Đã cập nhật giờ check-in Workshop "${ws.business_name ?? ws.name}": ${existingWs.vn_iso_sec.slice(0, 19)} -> ${newIsoTimestampVn.slice(0, 19)} (UTC+7)`,
            );
          }
          continue;
        }

        const isoTimestampVn = attachMicroseconds(resolved.isoWithOffset);
        allPlannedCheckins.push({
          studentId: studentRecord.id,
          studentCode: studentRecord.studentCode,
          studentName: studentRecord.fullName,
          boothId: ws.id,
          boothName: ws.business_name ?? ws.name,
          boothType: BoothType.WORKSHOP,
          isoTimestampVn,
          epochMs: new Date(isoTimestampVn).getTime(),
          graduationBatch: studentRecord.graduationBatch,
        });
      }

      // Kiểm tra các lượt check-in booth doanh nghiệp đã có của sinh viên này (nếu đã chạy seed trước đó với khung giờ cũ)
      const existingCompanyCheckins = shuffledBooths
        .map((b) => existingByBoothId.get(b.id))
        .filter((row): row is ExistingCheckinRow => Boolean(row));

      const existingSecsSorted = existingCompanyCheckins
        .map((r) => parseTimeToSeconds(r.vn_hms))
        .sort((a, b) => a - b);

      let existingBoothsNeedReschedule = false;
      for (let i = 0; i < existingSecsSorted.length; i++) {
        const sec = existingSecsSorted[i];
        if (sec < boothStartSec || sec > boothEndSec) {
          existingBoothsNeedReschedule = true;
          break;
        }
        if (i > 0 && sec - existingSecsSorted[i - 1] < minBoothGapSec) {
          existingBoothsNeedReschedule = true;
          break;
        }
      }

      if (existingBoothsNeedReschedule) {
        // Nếu sinh viên trong SEED_CHECKIN_STUDENTS từng được seed ở khung giờ cũ (ngoài 09:00 - 11:30),
        // cập nhật lại thời gian các booth đó về đúng khung 09:00 - 11:30 và chèn các booth còn thiếu
        for (let i = 0; i < shuffledBooths.length; i++) {
          const booth = shuffledBooths[i];
          const sec = combinedBoothSeconds[i];
          const hms = secondsToHms(sec);
          const isoTimestampVn = attachMicroseconds(
            `${profile.boothCheckinDate}T${hms}+07:00`,
          );
          const existingRow = existingByBoothId.get(booth.id);
          if (existingRow) {
            await client.query(
              `
                UPDATE checkins
                SET check_in_time = ($2::timestamptz AT TIME ZONE $3)
                WHERE id = $1
              `,
              [existingRow.id, isoTimestampVn, profile.storageTimezone],
            );
            updatedBoothCheckinsCount++;
          } else {
            allPlannedCheckins.push({
              studentId: studentRecord.id,
              studentCode: studentRecord.studentCode,
              studentName: studentRecord.fullName,
              boothId: booth.id,
              boothName: booth.business_name ?? booth.name,
              boothType: BoothType.BOOTH,
              isoTimestampVn,
              epochMs: new Date(isoTimestampVn).getTime(),
              graduationBatch: studentRecord.graduationBatch,
            });
          }
        }
        console.log(
          `    ↻ Đã đồng bộ lại ${existingCompanyCheckins.length} lượt check-in booth doanh nghiệp của sinh viên này về khung giờ ${SEED_CHECKIN_TIME_CONFIG.boothWindow.start} - ${SEED_CHECKIN_TIME_CONFIG.boothWindow.end}.`,
        );
      } else {
        // Lên lịch chèn các Booth doanh nghiệp còn thiếu theo thứ tự đã xáo trộn ngẫu nhiên
        const missingCompanyBooths = shuffledBooths.filter(
          (b) => !existingByBoothId.has(b.id),
        );
        const preservedBoothCount =
          shuffledBooths.length - missingCompanyBooths.length;
        if (preservedBoothCount > 0) {
          console.log(
            `    ℹ Giữ nguyên ${preservedBoothCount} lượt check-in booth doanh nghiệp đã có sẵn của sinh viên này.`,
          );
        }

        for (let i = 0; i < missingCompanyBooths.length; i++) {
          const booth = missingCompanyBooths[i];
          const sec = combinedBoothSeconds[i];
          const hms = secondsToHms(sec);
          const isoTimestampVn = attachMicroseconds(
            `${profile.boothCheckinDate}T${hms}+07:00`,
          );
          allPlannedCheckins.push({
            studentId: studentRecord.id,
            studentCode: studentRecord.studentCode,
            studentName: studentRecord.fullName,
            boothId: booth.id,
            boothName: booth.business_name ?? booth.name,
            boothType: BoothType.BOOTH,
            isoTimestampVn,
            epochMs: new Date(isoTimestampVn).getTime(),
            graduationBatch: studentRecord.graduationBatch,
          });
        }
      }
    }

    // Sắp xếp toàn bộ lượt check-in theo đúng trình tự thời gian thực tế trước khi INSERT vào DB
    allPlannedCheckins.sort((a, b) => a.epochMs - b.epochMs);

    let insertedCheckinsCount = 0;
    for (const item of allPlannedCheckins) {
      await client.query(
        `
          INSERT INTO checkins (
            student_id,
            booth_id,
            check_in_time,
            duration_minutes,
            status,
            notes,
            dot_tot_nghiep
          )
          VALUES (
            $1,
            $2,
            ($3::timestamptz AT TIME ZONE $6),
            NULL,
            $4,
            NULL,
            $5
          )
        `,
        [
          item.studentId,
          item.boothId,
          item.isoTimestampVn,
          profile.defaultStatus,
          item.graduationBatch,
          profile.storageTimezone,
        ],
      );
      insertedCheckinsCount++;
    }

    await client.query('COMMIT');

    console.log('\n------------------------------------------------------------');
    console.log(
      `✅ Hoàn tất! Đã chèn thêm ${insertedCheckinsCount} bản ghi check-in mới${
        updatedWorkshopCheckinsCount + updatedBoothCheckinsCount > 0
          ? ` (đồng bộ lại ${updatedWorkshopCheckinsCount} workshop và ${updatedBoothCheckinsCount} booth doanh nghiệp của 3 sinh viên cấu hình)`
          : ''
      }.`,
    );
    console.log(
      '✔ Toàn bộ dữ liệu check-in của các sinh viên khác trong hệ thống được giữ nguyên 100%.',
    );

    for (const student of SEED_CHECKIN_STUDENTS) {
      const studentPlans = allPlannedCheckins.filter(
        (p) => p.studentCode === student.studentCode.trim(),
      );
      const wsPlans = studentPlans.filter(
        (p) => p.boothType === BoothType.WORKSHOP,
      );
      const boothPlans = studentPlans
        .filter((p) => p.boothType === BoothType.BOOTH)
        .sort((a, b) => a.epochMs - b.epochMs);

      console.log(
        `\n📌 ${student.fullName} (${student.studentCode}): +${wsPlans.length} workshop mới, +${boothPlans.length} booth doanh nghiệp mới`,
      );
      for (const ws of wsPlans) {
        console.log(
          `   [Workshop] ${ws.isoTimestampVn.slice(0, 19)} (UTC+7) -> ${ws.boothName}`,
        );
      }
      if (boothPlans.length > 0) {
        const firstBooth = boothPlans[0];
        const lastBooth = boothPlans[boothPlans.length - 1];
        let minObservedGapSec = Number.POSITIVE_INFINITY;
        for (let i = 1; i < boothPlans.length; i++) {
          const gapSec = Math.round(
            (boothPlans[i].epochMs - boothPlans[i - 1].epochMs) / 1000,
          );
          if (gapSec < minObservedGapSec) {
            minObservedGapSec = gapSec;
          }
        }
        console.log(
          `   [Booth đầu tiên] ${firstBooth.isoTimestampVn.slice(0, 19)} (UTC+7) -> ${firstBooth.boothName}`,
        );
        console.log(
          `   [Booth cuối cùng] ${lastBooth.isoTimestampVn.slice(0, 19)} (UTC+7) -> ${lastBooth.boothName}`,
        );
        if (Number.isFinite(minObservedGapSec)) {
          console.log(
            `   [Khoảng cách nhỏ nhất giữa 2 booth liên tiếp] ${formatDurationSeconds(minObservedGapSec)} (yêu cầu >= ${minBoothGapMinutes}p00s)`,
          );
        }
      }
    }
    console.log('============================================================\n');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.stack || error.message : String(error);
    console.error('\n[seed-student-checkins] Lỗi:', message);
    process.exitCode = 1;
  });
}

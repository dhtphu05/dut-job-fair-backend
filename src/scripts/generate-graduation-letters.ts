import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import * as XLSX from 'xlsx';

const DEFAULT_TEMPLATE_PATH = 'T:\\Design\\Tot Nghiep\\Template.png';
const DEFAULT_FONT_PATH = 'T:\\Font\\LuxuriousScript-Regular.ttf';
const DEFAULT_GRADUATION_BATCH = 'Thang_8_nam_2026';

// Các tọa độ được lấy theo file mẫu 2480 x 3507 px.
const LAYOUT = {
  nameCenterY: 1460,
  nameMaxWidth: 1100,
  nameFontSize: 200,
  qr: { left: 1042, top: 2576, size: 396 },
} as const;

interface StudentRecord {
  studentCode: string;
  fullName: string;
  className: string;
  department: string;
  email: string;
  phone: string;
  major: string;
  degreeTitle: string;
  sheetName: string;
}

interface CliOptions {
  excelPath?: string;
  dot?: string;
  outputPath: string;
  templatePath: string;
  fontPath: string;
  faculties: string[];
  limit?: number;
  dryRun: boolean;
}

interface SkippedRow {
  sheetName: string;
  rowNumber: number;
  reason: string;
}

const FACULTY_MAP: Record<string, string> = {
  CK: 'Khoa Cơ khí',
  CKGT: 'Khoa Cơ khí Giao thông',
  Nhiệt: 'Khoa Công nghệ Nhiệt - Điện lạnh',
  CNTT: 'Khoa Công nghệ Thông tin',
  Điện: 'Khoa Điện',
  ĐTVT: 'Khoa Điện tử - Viễn thông',
  Hóa: 'Khoa Hóa',
  FAST: 'Khoa Khoa học Công nghệ Tiên tiến (FAST)',
  'Kiến trúc': 'Khoa Kiến trúc',
  'Môi trường': 'Khoa Môi trường',
  QLDA: 'Khoa Quản lý Dự án',
  XDCĐ: 'Khoa Xây dựng Cầu đường',
  XDCTT: 'Khoa Xây dựng Công trình thủy',
  XDDD: 'Khoa Xây dựng Dân dụng & Công nghiệp',
};

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function cleanValue(value: unknown): string {
  return String(value ?? '').trim();
}

function defaultIfBlank(value: string): string {
  return value || DEFAULT_GRADUATION_BATCH;
}

function findValue(
  row: Record<string, unknown>,
  acceptableKeys: string[],
): string {
  for (const [key, value] of Object.entries(row)) {
    if (!acceptableKeys.includes(key)) continue;
    const result = cleanValue(value);
    if (result) return result;
  }
  return '';
}

function findContainsValue(
  row: Record<string, unknown>,
  fragment: string,
): string {
  for (const [key, value] of Object.entries(row)) {
    if (!key.includes(fragment)) continue;
    const result = cleanValue(value);
    if (result) return result;
  }
  return '';
}

function safeName(value: string): string {
  const result = value
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();

  return result || 'Không rõ tên';
}

function configureFontCache(): void {
  // Fontconfig của sharp cần một cache writable để nạp font TTF ngoài hệ thống.
  if (process.env.XDG_CACHE_HOME) return;
  const cacheDir = path.resolve(
    process.cwd(),
    '.cache',
    'dut-graduation-letter-fontconfig',
  );
  fs.mkdirSync(cacheDir, { recursive: true });
  process.env.XDG_CACHE_HOME = cacheDir;
}

// Nạp sharp sau configureFontCache để Fontconfig dùng được thư mục cache tạm.
function createSharp(input: unknown): any {
  const sharpFactory = require('sharp') as (source: unknown) => any;
  return sharpFactory(input);
}

function parseCliArgs(args: string[]): CliOptions {
  let excelPath: string | undefined;
  let dot: string | undefined;
  let outputPath = path.resolve(process.cwd(), 'letter-output');
  let templatePath = DEFAULT_TEMPLATE_PATH;
  let fontPath = DEFAULT_FONT_PATH;
  let faculties: string[] = [];
  let limit: number | undefined;
  let dryRun = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const equalAt = arg.indexOf('=');
    const option = equalAt >= 0 ? arg.slice(0, equalAt) : arg;
    let value = equalAt >= 0 ? arg.slice(equalAt + 1) : '';

    if (option === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (
      [
        '--dot',
        '--output',
        '--template',
        '--font',
        '--khoa',
        '--limit',
      ].includes(option)
    ) {
      if (!value) value = args[++index] || '';
      if (!value || value.startsWith('--')) {
        throw new Error('Thiếu giá trị cho ' + option + '.');
      }
      if (option === '--dot') dot = value.trim();
      if (option === '--output') outputPath = path.resolve(value);
      if (option === '--template') templatePath = path.resolve(value);
      if (option === '--font') fontPath = path.resolve(value);
      if (option === '--khoa') {
        faculties = value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }
      if (option === '--limit') {
        limit = Number.parseInt(value, 10);
        if (!Number.isInteger(limit) || limit <= 0) {
          throw new Error('--limit phải là số nguyên dương.');
        }
      }
      continue;
    }

    if (arg.startsWith('--')) throw new Error('Tùy chọn không hợp lệ: ' + arg);
    if (excelPath) throw new Error('Không nhận diện được đối số: ' + arg);
    excelPath = path.resolve(arg);
  }

  return {
    excelPath,
    dot,
    outputPath,
    templatePath,
    fontPath,
    faculties,
    limit,
    dryRun,
  };
}

function isSelected(student: StudentRecord, faculties: string[]): boolean {
  if (!faculties.length) return true;
  const candidates = [
    normalizeKey(student.sheetName),
    normalizeKey(student.department),
    normalizeKey(FACULTY_MAP[student.sheetName] || ''),
  ];

  return faculties.some((faculty) =>
    candidates.includes(normalizeKey(faculty)),
  );
}

function parseStudents(
  excelPath: string,
  faculties: string[],
): {
  students: StudentRecord[];
  skippedRows: SkippedRow[];
  sheetNames: string[];
} {
  const workbook = XLSX.readFile(excelPath, {
    cellText: true,
    cellDates: false,
  });
  if (!workbook.SheetNames.length)
    throw new Error('File XLSX không có sheet nào.');

  const students: StudentRecord[] = [];
  const skippedRows: SkippedRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets[sheetName],
      { header: 1, defval: '', raw: false },
    );
    const headerRowIndex = rows.findIndex((row) =>
      row.some((value) => cleanValue(value)),
    );
    if (headerRowIndex < 0) continue;

    const headers = rows[headerRowIndex].map((value) =>
      normalizeKey(cleanValue(value)),
    );
    const hasStudentCode = headers.some(
      (header) =>
        header.includes('mssv') ||
        ['masv', 'masosinhvien', 'studentcode', 'code'].includes(header),
    );
    const hasFullName = headers.some((header) =>
      ['hovaten', 'hoten', 'fullname', 'name'].includes(header),
    );
    if (!hasStudentCode || !hasFullName) {
      const missingColumns = [
        !hasStudentCode ? 'MSSV' : '',
        !hasFullName ? 'Họ và tên' : '',
      ].filter(Boolean);
      throw new Error(
        'Sheet "' +
          sheetName +
          '" thiếu cột bắt buộc: ' +
          missingColumns.join(', ') +
          '.',
      );
    }

    for (
      let rowIndex = headerRowIndex + 1;
      rowIndex < rows.length;
      rowIndex++
    ) {
      const values = rows[rowIndex];
      const normalized: Record<string, unknown> = {};
      for (let columnIndex = 0; columnIndex < headers.length; columnIndex++) {
        const header = headers[columnIndex];
        if (header) normalized[header] = values[columnIndex];
      }

      const studentCode =
        findContainsValue(normalized, 'mssv') ||
        findValue(normalized, ['masv', 'masosinhvien', 'studentcode', 'code']);
      const fullName = findValue(normalized, [
        'hovaten',
        'hoten',
        'fullname',
        'name',
      ]);
      if (!studentCode || !fullName) {
        if (values.some((value) => cleanValue(value))) {
          const reason =
            !studentCode && !fullName
              ? 'thiếu MSSV và Họ và tên'
              : !studentCode
                ? 'thiếu MSSV'
                : 'thiếu Họ và tên';
          skippedRows.push({ sheetName, rowNumber: rowIndex + 1, reason });
          console.warn(
            'Cảnh báo: Bỏ qua dòng ' +
              (rowIndex + 1) +
              ' (sheet "' +
              sheetName +
              '"): ' +
              reason +
              '.',
          );
        }
        continue;
      }

      const student: StudentRecord = {
        studentCode,
        fullName,
        className: defaultIfBlank(
          findValue(normalized, ['lop', 'classname', 'class']),
        ),
        department: defaultIfBlank(
          findValue(normalized, ['khoa', 'department', 'faculty']),
        ),
        email: defaultIfBlank(
          findContainsValue(normalized, 'email') ||
            findValue(normalized, ['mail']),
        ),
        phone: defaultIfBlank(
          findValue(normalized, ['sdt', 'sodienthoai', 'phone']),
        ),
        major: defaultIfBlank(
          findContainsValue(normalized, 'nganh') ||
            findValue(normalized, ['major']),
        ),
        degreeTitle: defaultIfBlank(
          findValue(normalized, ['danhhieubang', 'danhhieu', 'degreetitle']),
        ),
        sheetName,
      };

      if (isSelected(student, faculties)) students.push(student);
    }
  }

  return { students, skippedRows, sheetNames: workbook.SheetNames };
}

function buildQrPayload(student: StudentRecord, dot: string): string {
  return JSON.stringify({
    ho_ten: student.fullName,
    ma_so_sinh_vien: student.studentCode,
    lop: student.className,
    khoa: student.department,
    email: student.email,
    phone: student.phone,
    dot_tot_nghiep: DEFAULT_GRADUATION_BATCH + '-' + dot,
  });
}

function escapePango(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function buildNameLayers(
  fullName: string,
  fontPath: string,
): Promise<Array<{ input: Buffer; left: number; top: number }>> {
  const nameText =
    '<span foreground="#ffffff" font_family="Luxurious Script" size="' +
    LAYOUT.nameFontSize * 1000 +
    '">' +
    escapePango(fullName) +
    '</span>';
  const nameImage = createSharp({
    text: {
      text: nameText,
      font: 'Luxurious Script',
      fontfile: fontPath,
      rgba: true,
    },
  });
  const initial = await nameImage.png().toBuffer({ resolveWithObject: true });
  const result =
    initial.info.width > LAYOUT.nameMaxWidth
      ? await createSharp(initial.data)
          .resize({ width: LAYOUT.nameMaxWidth, withoutEnlargement: true })
          .png()
          .toBuffer({ resolveWithObject: true })
      : initial;
  const left = Math.round((2480 - result.info.width) / 2);
  const top = Math.round(LAYOUT.nameCenterY - result.info.height / 2);
  const gradient = Buffer.from(
    '<svg width="' +
      result.info.width +
      '" height="' +
      result.info.height +
      '" ' +
      'viewBox="0 0 ' +
      result.info.width +
      ' ' +
      result.info.height +
      '">' +
      '<defs><linearGradient id="nameGradient" x1="0" y1="0" x2="0" y2="' +
      result.info.height +
      '" gradientUnits="userSpaceOnUse">' +
      '<stop offset="0%" stop-color="#fcc028"/>' +
      '<stop offset="100%" stop-color="#f9e852"/>' +
      '</linearGradient></defs><rect width="100%" height="100%" fill="url(#nameGradient)"/></svg>',
  );
  const nameWithGradient = await createSharp(gradient)
    .composite([{ input: result.data, blend: 'dest-in' }])
    .png()
    .toBuffer();

  return [{ input: nameWithGradient, left, top }];
}

async function generateLetter(
  student: StudentRecord,
  templateBuffer: Buffer,
  fontPath: string,
  dot: string,
  targetPath: string,
): Promise<void> {
  const qr = await QRCode.toBuffer(buildQrPayload(student, dot), {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: LAYOUT.qr.size,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  const nameLayers = await buildNameLayers(student.fullName, fontPath);

  await createSharp(templateBuffer)
    .composite([
      ...nameLayers,
      { input: qr, left: LAYOUT.qr.left, top: LAYOUT.qr.top },
    ])
    .png()
    .toFile(targetPath);
}

function outputPathFor(outputDir: string, student: StudentRecord): string {
  return path.join(
    outputDir,
    safeName(student.studentCode) + '_' + safeName(student.fullName) + '.png',
  );
}

function printUsage(): void {
  console.log('Cách dùng:');
  console.log(
    '  npm run generate:letters -- "C:\\duong-dan\\danh-sach.xlsx" --dot=dot_1',
  );
  console.log('');
  console.log('Tùy chọn:');
  console.log(
    '  --dot=dot_1              Bắt buộc: tên đợt dùng cho thư mục kết quả và QR',
  );
  console.log(
    '  --khoa=CK,Điện          Chỉ tạo giấy mời cho khoa/sheet đã chọn',
  );
  console.log(
    '  --output="D:\\thu-moi"   Đổi thư mục kết quả (mặc định: letter-output)',
  );
  console.log('  --template="...png"     Đổi file mẫu giấy mời');
  console.log('  --font="...ttf"         Đổi font chữ tên sinh viên');
  console.log(
    '  --limit=5                Chỉ tạo N giấy mời đầu tiên để thử mẫu',
  );
  console.log(
    '  --dry-run                Chỉ kiểm tra dữ liệu, không tạo file',
  );
  console.log('');
  console.log('Yêu cầu tối thiểu của XLSX: MSSV và Họ và tên.');
  console.log(
    'Các trường QR còn thiếu được thay bằng "' +
      DEFAULT_GRADUATION_BATCH +
      '".',
  );
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  if (!options.excelPath || !options.dot) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  if (path.extname(options.excelPath).toLowerCase() !== '.xlsx') {
    throw new Error('File đầu vào phải có đuôi .xlsx: ' + options.excelPath);
  }
  if (!fs.existsSync(options.excelPath)) {
    throw new Error('Không tìm thấy file XLSX: ' + options.excelPath);
  }
  if (!fs.existsSync(options.templatePath)) {
    throw new Error(
      'Không tìm thấy file mẫu giấy mời: ' + options.templatePath,
    );
  }
  if (!fs.existsSync(options.fontPath)) {
    throw new Error('Không tìm thấy font chữ: ' + options.fontPath);
  }

  const parsed = parseStudents(options.excelPath, options.faculties);
  if (!parsed.students.length) {
    const scope = options.faculties.length
      ? ' cho khoa: ' + options.faculties.join(', ')
      : '';
    throw new Error(
      'Không tìm thấy sinh viên hợp lệ' +
        scope +
        '. Sheet hiện có: ' +
        parsed.sheetNames.join(', '),
    );
  }

  const students = options.limit
    ? parsed.students.slice(0, options.limit)
    : parsed.students;
  const outputDir = path.join(options.outputPath, safeName(options.dot));
  console.log('Đã đọc ' + parsed.students.length + ' sinh viên hợp lệ.');
  if (parsed.skippedRows.length) {
    const skippedByReason = new Map<string, number>();
    for (const skippedRow of parsed.skippedRows) {
      skippedByReason.set(
        skippedRow.reason,
        (skippedByReason.get(skippedRow.reason) || 0) + 1,
      );
    }
    console.log('Đã bỏ qua ' + parsed.skippedRows.length + ' dòng:');
    for (const [reason, count] of skippedByReason) {
      console.log('  - ' + reason + ': ' + count + ' dòng');
    }
  }
  if (options.faculties.length) {
    console.log('Phạm vi khoa: ' + options.faculties.join(', ') + '.');
  }
  if (options.limit)
    console.log(
      'Chế độ giới hạn: tạo ' + students.length + ' giấy mời đầu tiên.',
    );
  console.log(
    'dot_tot_nghiep trong QR: ' +
      DEFAULT_GRADUATION_BATCH +
      '-' +
      options.dot +
      '.',
  );

  if (options.dryRun) {
    console.log('Dry run hoàn tất: không có file nào được tạo.');
    return;
  }
  configureFontCache();
  const metadata = await createSharp(options.templatePath).metadata();
  if (metadata.width !== 2480 || metadata.height !== 3507) {
    throw new Error(
      'Kích thước mẫu phải là 2480 x 3507 px để khớp tọa độ hiện tại (nhận được ' +
        metadata.width +
        ' x ' +
        metadata.height +
        ').',
    );
  }

  const template = fs.readFileSync(options.templatePath);
  console.log('Đang tạo ' + students.length + ' giấy mời...');
  fs.mkdirSync(outputDir, { recursive: true });

  for (let index = 0; index < students.length; index++) {
    const student = students[index];
    const outputPath = outputPathFor(outputDir, student);
    await generateLetter(
      student,
      template,
      options.fontPath,
      options.dot,
      outputPath,
    );
    console.log('✓ Đã tạo: ' + path.basename(outputPath));
  }

  console.log('Hoàn tất: ' + students.length + ' thư mời đã tạo thành công.');
  console.log('Số dòng bị bỏ qua: ' + parsed.skippedRows.length + '.');
  console.log('Kết quả: ' + outputDir);
}

main().catch((error: unknown) => {
  console.error(
    'Lỗi: ' + (error instanceof Error ? error.message : String(error)),
  );
  process.exitCode = 1;
});

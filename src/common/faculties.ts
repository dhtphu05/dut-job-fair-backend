/** Danh sách 9 khoa hiện hành; mã theo quy ước viết tắt của danh sách cũ. */
export const FACULTY_MAP: Record<string, string> = {
  CK: 'Khoa Cơ khí',
  CKGTNL: 'Khoa Cơ khí Giao thông và Năng lượng',
  CNTT: 'Khoa Công nghệ Thông tin',
  Điện: 'Khoa Điện',
  'E-AI': 'Khoa Điện tử và Trí tuệ nhân tạo',
  HMTKHSS: 'Khoa Hóa, Môi trường và Khoa học sự sống',
  'Kiến trúc': 'Khoa Kiến trúc',
  QLDACN: 'Khoa Quản lý dự án và Công nghiệp',
  XD: 'Khoa Xây dựng',
};

function facultyKey(value: string): string {
  return value.trim().replace(/^(?:Khoa\s+|K\.\s*)/i, '')
    .replace(/\s*\((?:N|123|MT|X2|X3)\)\s*$/i, '')
    .normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' ');
}

/** Giữ nguyên giá trị chưa biết, tránh gán nhầm khoa cho dữ liệu bên ngoài. */
export function normalizeFaculty(value: string): string {
  const key = facultyKey(value);
  const match = Object.entries(FACULTY_MAP).find(([code, name]) =>
    facultyKey(code) === key || facultyKey(name) === key,
  );
  return match?.[1] ?? value.trim();
}

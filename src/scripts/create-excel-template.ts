import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

export function generateStudentTemplate(outputPath?: string): string {
  const targetPath = outputPath || path.resolve(process.cwd(), 'mau_danh_sach_sinh_vien.xlsx');

  const sampleData = [
    {
      'Mã SV': '102230001',
      'Họ và tên': 'Nguyễn Văn An',
      'Lớp': '23T_DT1',
      'Khoa': 'Khoa Công nghệ Thông tin',
      'Email': '102230001@sv.dut.udn.vn',
      'Số điện thoại': '0905123456',
      'Ngành': 'Công nghệ Thông tin',
      'Đợt tốt nghiệp': 'TN2026_dot_2',
    },
    {
      'Mã SV': '102230002',
      'Họ và tên': 'Trần Thị Mai',
      'Lớp': '23DT2',
      'Khoa': 'Khoa Điện tử Viễn thông',
      'Email': '102230002@sv.dut.udn.vn',
      'Số điện thoại': '0905654321',
      'Ngành': 'Kỹ thuật Điện tử',
      'Đợt tốt nghiệp': 'TN2026_dot_2',
    },
    {
      'Mã SV': '102220115',
      'Họ và tên': 'Lê Hoàng Phúc',
      'Lớp': '22CK1',
      'Khoa': 'Khoa Cơ Khí',
      'Email': '102220115@sv.dut.udn.vn',
      'Số điện thoại': '0914111222',
      'Ngành': 'Cơ điện tử',
      'Đợt tốt nghiệp': 'TN2026_dot_2',
    },
    {
      'Mã SV': '102210088',
      'Họ và tên': 'Phạm Quỳnh Nga',
      'Lớp': '21D1',
      'Khoa': 'Khoa Điện',
      'Email': '102210088@sv.dut.udn.vn',
      'Số điện thoại': '0988777666',
      'Ngành': 'Tự động hóa',
      'Đợt tốt nghiệp': 'TN2026_dot_2',
    },
    {
      'Mã SV': '102230313',
      'Họ và tên': 'Đoàn Hoàng Thiên Phú',
      'Lớp': '23T_DT4',
      'Khoa': 'Khoa Công nghệ Thông tin',
      'Email': '102230313@sv.dut.udn.vn',
      'Số điện thoại': '0385544281',
      'Ngành': 'Kỹ thuật Phần mềm',
      'Đợt tốt nghiệp': 'TN2026_dot_2',
    },
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 15 }, // Mã SV
    { wch: 25 }, // Họ và tên
    { wch: 15 }, // Lớp
    { wch: 30 }, // Khoa
    { wch: 30 }, // Email
    { wch: 16 }, // Số điện thoại
    { wch: 25 }, // Ngành
    { wch: 20 }, // Đợt tốt nghiệp
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'DanhSachSinhVien');

  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  XLSX.writeFile(workbook, targetPath);
  console.log(`✅ Đã tạo file Excel mẫu thành công: ${targetPath}`);
  return targetPath;
}

if (require.main === module) {
  const filePath = process.argv[2];
  generateStudentTemplate(filePath);
}

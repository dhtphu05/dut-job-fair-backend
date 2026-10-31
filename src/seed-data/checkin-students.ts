export type SeedWorkshopCheckinTimes = {
  /**
   * Thời gian check-in Tọa đàm kỹ năng nghề nghiệp (WORKSHOP-01 / REWARD-CAREER-TALK) theo giờ Việt Nam (UTC+7).
   * Hỗ trợ các định dạng:
   * - '2026-10-30T13:17:33+07:00'
   * - '2026-10-30 13:17:33'
   * - '30/10/2026 13:17:33' hoặc '13h17p33s 30/10/2026'
   */
  careerTalk?: string;
  /**
   * Thời gian check-in Lễ khai mạc (WORKSHOP-02 / REWARD-OPENING) theo giờ Việt Nam (UTC+7).
   * Hỗ trợ các định dạng:
   * - '2026-10-31T07:22:01+07:00'
   * - '2026-10-31 07:22:01'
   * - '31/10/2026 07:22:01' hoặc '07h22p01s 31/10/2026'
   */
  openingCeremony?: string;
};

export type SeedCheckinStudent = {
  /** Mã số sinh viên (MSSV) - duy nhất cho mỗi sinh viên */
  studentCode: string;
  /** Họ và tên đầy đủ của sinh viên */
  fullName: string;
  /** Lớp sinh hoạt (ví dụ: 22T_DT2, 23DT1, 22CK2) */
  className: string;
  /** Khoa (có thể ghi tên đầy đủ "Khoa ..." hoặc mã viết tắt như CNTT, CK, E-AI...) */
  department: string;
  /** Ngành học (tuỳ chọn, để null nếu muốn giống dữ liệu quét QR trực tiếp) */
  major?: string | null;
  /** Email sinh viên (tuỳ chọn) */
  email?: string | null;
  /** Số điện thoại liên hệ (tuỳ chọn) */
  phone?: string | null;
  /** Năm học (tuỳ chọn - nếu bỏ trống hệ thống tự suy ra từ MSSV giống ScannerService) */
  year?: number | null;
  /** Mã đợt tốt nghiệp dot_tot_nghiep (tuỳ chọn - nếu bỏ trống sẽ tự đồng bộ theo dữ liệu có sẵn) */
  graduationBatch?: string | null;
  /**
   * Thời gian check-in Workshop riêng cho từng sinh viên (giờ Việt Nam UTC+7).
   * Bạn có thể sửa trực tiếp thời gian tại từng sinh viên bên dưới.
   * Nếu bỏ trống, script sẽ dùng mốc mặc định trong SEED_CHECKIN_TIME_CONFIG.workshops.
   */
  workshopCheckinTimes?: SeedWorkshopCheckinTimes;
};

/**
 * Cấu hình thời gian check-in (theo giờ Việt Nam UTC+7).
 * Bạn có thể chỉnh sửa trực tiếp các mốc thời gian tại đây nếu cần.
 */
export const SEED_CHECKIN_TIME_CONFIG = {
  /**
   * Ngày check-in tại các booth doanh nghiệp (định dạng YYYY-MM-DD theo giờ Việt Nam UTC+7).
   * Đặt là 'auto' để tự động đồng bộ theo ngày check-in booth doanh nghiệp đang có sẵn trong DB
   * (nếu DB chưa có lượt check-in booth nào thì mặc định dùng fallbackBoothDate).
   */
  boothCheckinDate: 'auto' as 'auto' | string,
  fallbackBoothDate: '2026-10-31',

  /**
   * Khoảng cách tối thiểu (tính bằng phút) giữa 2 lần check-in booth doanh nghiệp liên tiếp của cùng 1 sinh viên.
   */
  minBoothGapMinutes: 5,

  /**
   * Khung giờ check-in booth doanh nghiệp trong ngày (giờ Việt Nam UTC+7):
   * Chỉ từ 09:00 đến 11:30, rải rác đến từng phút và giây, cách nhau ít nhất 5 phút.
   */
  boothWindow: {
    start: '09:00:00',
    end: '11:30:00',
  },

  /**
   * Thời gian check-in mặc định cho các Workshop (giờ Việt Nam UTC+7) khi sinh viên không cấu hình riêng:
   * - Tọa đàm kỹ năng nghề nghiệp: 13h17p33s ngày 30/10/2026
   * - Lễ khai mạc: 07h22p01s ngày 31/10/2026
   */
  workshops: {
    careerTalk: '2026-10-30T13:17:33+07:00',
    openingCeremony: '2026-10-31T07:22:01+07:00',
  },
};

/**
 * Danh sách 3 sinh viên sẽ được chèn thêm và check-in đủ tất cả các booth doanh nghiệp & workshop.
 * Bạn có thể sửa thông tin cá nhân và sửa thủ công `workshopCheckinTimes` của từng sinh viên ở bên dưới,
 * sau đó chạy lại lệnh:
 *   npm run seed:student-checkins
 */
export const SEED_CHECKIN_STUDENTS: SeedCheckinStudent[] = [
  {
    studentCode: '106250258',
    fullName: 'Nguyễn Đức Tài',
    className: '25DT3',
    department: 'Khoa Điện tử và Trí tuệ nhân tạo',
    email: 'ndtai26@gmail.com',
    phone: '0813280260',
    workshopCheckinTimes: {
      careerTalk: '2026-10-30T13:11:23+07:00',
      openingCeremony: '2026-10-31T07:20:01+07:00',
    },
  },
  {
    studentCode: '105240337',
    fullName: 'Đoàn Hoàng Thiên Phúc',
    className: '24TDH2',
    department: 'Khoa Điện',
    email: '105240337@sv.dut.udn.vn',
    phone: '0333186257',
    workshopCheckinTimes: {
      careerTalk: '2026-10-30T13:11:22+07:00',
      openingCeremony: '2026-10-31T07:27:01+07:00',
    },
  },
  {
    studentCode: '109240005',
    fullName: 'Mỹ Anh',
    className: '24BIM_AI',
    department: 'Khoa Xây dựng',
    email: 'anh90390@gmail.com',
    phone: '0912794428',
    workshopCheckinTimes: {
      careerTalk: '2026-10-30T13:11:33+07:00',
      openingCeremony: '2026-10-31T07:30:01+07:00',
    },
  },
];

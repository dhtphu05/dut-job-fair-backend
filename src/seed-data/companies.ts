export type SeedCompany = {
  name: string;
  email: string;
  publicId: string;
  logoUrl: string;
};

export type SeedWorkshop = {
  name: string;
  email: string;
  publicId: string;
  logoUrl: string;
  boothName: string;
  location: string;
  capacity: number;
  qrCode: string;
};

export const DEMO_EVENT_DATE = '2026-10-30 - 2026-10-31';
export const DEMO_EVENT_START = new Date('2026-10-30T08:00:00+07:00');
export const DEMO_EVENT_END = new Date('2026-10-31T17:00:00+07:00');

export const SEED_COMPANIES: SeedCompany[] = [
  { name: 'Công ty TNHH Yajima Engineering Việt Nam', email: 'yajima@jobfair.com', publicId: '1', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/1.jpg' },
  { name: 'Công ty TNHH Hàng không Mặt Trời Phú Quốc', email: 'matroiphuquoc@jobfair.com', publicId: '2', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/2.jpg' },
  { name: 'CÔNG TY TNHH CÔNG NGHỆ MARVELL VIỆT NAM', email: 'marvell@jobfair.com', publicId: '3', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/3.jpg' },
  { name: 'G.A.Group Co.,Ltd.', email: 'gagroup@jobfair.com', publicId: '4', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/4.jpg' },
  { name: 'CÔNG TY TNHH KARCHER VIỆT NAM TECHNOLOGY', email: 'karcher@jobfair.com', publicId: '5', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/5.jpg' },
  { name: 'CÔNG TY CỔ PHẦN THÀNH QUÂN', email: 'thanhquan@jobfair.com', publicId: '6', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/6.jpg' },
  { name: 'CÔNG TY CP ĐẦU TƯ VÀ PHÁT TRIỂN NĂNG LƯỢNG VIỆT LÀO', email: 'vietlao@jobfair.com', publicId: '7', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/7.jpg' },
  { name: 'CÔNG TY CỔ PHẦN HUB ĐÀ NẴNG - NHẬT BẢN', email: 'hub@jobfair.com', publicId: '8', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/8.jpg' },
  { name: 'Công ty TNHH Tập đoàn Xây Dựng DACINCO', email: 'dacinco@jobfair.com', publicId: '9', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/9.jpg' },
  { name: 'CÔNG TY CỔ PHẦN BỘT - GIẤY VNT 19', email: 'vnt19@jobfair.com', publicId: '10', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/10.jpg' },
  { name: 'Công ty Cổ phần DRAEXLMAIER Automotive Việt Nam', email: 'draexlmaier@jobfair.com', publicId: '11', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/11.jpg' },
  { name: 'CÔNG TY TNHH JOBFULL PARTNER', email: 'jobfull@jobfair.com', publicId: '12', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/12.jpg' },
  { name: 'CÔNG TY CỔ PHẦN DỊCH VỤ & KỸ THUẬT CƠ ĐIỆN LẠNH R.E.E', email: 'ree@jobfair.com', publicId: '13', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/13.jpg' },
  { name: 'CÔNG TY TNHH GOLDWIND INTERNATIONAL VIỆT NAM', email: 'goldwind@jobfair.com', publicId: '14', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/14.jpg' },
  { name: 'Công ty Cổ phần Đô thị FPT Đà Nẵng', email: 'fptdothi@jobfair.com', publicId: '15', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/15.jpg' },
  { name: 'Trường Đại học Khoa học và Công nghệ Côn Sơn', email: 'conson@jobfair.com', publicId: '16', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/16.jpg' },
  { name: 'Học bổng INTENSE tại Taiwan', email: 'intense@jobfair.com', publicId: '17', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/17.jpg' },
  { name: 'Công ty Phát triển Phần mềm Xây dựng Aureole (ACSD)', email: 'aureole@jobfair.com', publicId: '18', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/18.jpg' },
  { name: 'Công ty TNHH Willtec Việt Nam', email: 'willtec@jobfair.com', publicId: '19', logoUrl: 'https://storage.googleapis.com/photobooth-itf/jobfair/DUT%20Job%20Fair%202026%20%C4%90%E1%BB%A3t%202/logo/19.jpg' },
];

export const SEED_WORKSHOPS: SeedWorkshop[] = [
  {
    name: 'Tọa đàm kỹ năng nghề nghiệp',
    email: 'knnn@jobfair.com',
    publicId: '',
    logoUrl: '',
    boothName: 'Tọa đàm kỹ năng nghề nghiệp',
    location: 'Hội trường S02.01',
    capacity: 200,
    qrCode: 'WORKSHOP-01',
  },
  {
    name: 'Lễ khai mạc Ngày hội việc làm',
    email: 'khaimac@jobfair.com',
    publicId: '',
    logoUrl: '',
    boothName: 'Lễ khai mạc ngày hội việc làm',
    location: 'Hội trường S02.01',
    capacity: 200,
    qrCode: 'WORKSHOP-02',
  },
];

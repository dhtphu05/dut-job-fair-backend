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

export const DEMO_EVENT_DATE = '2026-04-01';
export const DEMO_EVENT_START = new Date('2026-04-01T08:00:00+07:00');
export const DEMO_EVENT_END = new Date('2026-04-01T17:00:00+07:00');

export const SEED_COMPANIES: SeedCompany[] = [
  { name: 'Công ty Cổ phần Tập đoàn Trường Hải (THACO)', email: 'thaco@jobfair', publicId: 'thaco_b8ce45', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/thaco_b8ce45.png' },
  { name: 'Công ty Cổ phần Xây dựng Kiến trúc Tân Minh Nhân', email: 'tanminhnhan@jobfair', publicId: '2.Tan_Minh_Nhan_r1mhz5', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/2.Tan_Minh_Nhan_r1mhz5.png' },
  { name: 'Chương trình Học bổng INTENSE', email: 'intense@jobfair', publicId: 'intact_mgc5zo', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/intact_mgc5zo.png' },
  { name: 'Công ty TNHH Nhà máy Bia Heineken Việt Nam', email: 'heineken@jobfair', publicId: 'Logo_Heineken_VN_mx0knw', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/Logo_Heineken_VN_mx0knw.png' },
  { name: 'Công ty CP HUB Đà Nẵng - Nhật Bản', email: 'hub@jobfair', publicId: 'hub_dn_jp_472e5c', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/hub_dn_jp_472e5c.png' },
  { name: 'Công ty TNHH Fuwing Interconnect Technology', email: 'fuwing@jobfair', publicId: 'fuwing_a43d39', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/fuwing_a43d39.png' },
  { name: 'CÔNG TY TNHH VARD VŨNG TÀU', email: 'vard@jobfair', publicId: 'VARD_w6jxeb', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/VARD_w6jxeb.png' },
  { name: 'Comway Co., Ltd.', email: 'comway@jobfair', publicId: 'Comway_Logo_avdasg', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/Comway_Logo_avdasg.png' },
  { name: 'Công ty Cổ phần Xây dựng 47', email: 'c47@jobfair', publicId: 'c47_fwwss9', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/c47_fwwss9.png' },
  { name: 'Công ty CP Hands Holdings', email: 'hands@jobfair', publicId: 'Hands_Holdings_iwfwgl', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/Hands_Holdings_iwfwgl.png' },
  { name: 'Công ty CP Tập đoàn Xây dựng Hòa Bình', email: 'hoabinh@jobfair', publicId: '03.logo_Hoa_Binh_C_tivlrh', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/03.logo_Hoa_Binh_C_tivlrh.png' },
  { name: 'Công ty CP Thành Quân', email: 'thanhquan@jobfair', publicId: 'Thanh_Quan_vuyeum', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/Thanh_Quan_vuyeum.png' },
  { name: 'Công ty TNHH GBC ENGINEERS VIỆT NAM', email: 'gbc@jobfair', publicId: 'GBC_umxwzp', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/GBC_umxwzp.png' },
  { name: 'Công ty TNHH HS Hyosung Quảng Nam', email: 'hyosung@jobfair', publicId: 'hyosung_fplcea', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/hyosung_fplcea.png' },
  { name: 'Công ty TNHH LUXSHARE-ICT (NGHỆ AN)', email: 'luxshare@jobfair', publicId: 'LOGO_-_Luxshare_ICT_Nghe_An_indgem', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/LOGO_-_Luxshare_ICT_Nghe_An_indgem.png' },
  { name: 'Công ty TNHH Marvell Technology Việt Nam', email: 'marvell@jobfair', publicId: 'Marvell_quj7vf', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/Marvell_quj7vf.png' },
  { name: 'Công ty TNHH Tập đoàn Xây dựng DELTA', email: 'delta@jobfair', publicId: '', logoUrl: '' },
  { name: 'FPT Software Miền Trung', email: 'fptsoftware@jobfair', publicId: 'FPT_Software_ewuyrj', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/FPT_Software_ewuyrj.png' },
  { name: 'Hirochiku Co., Ltd.', email: 'hirochiku@jobfair', publicId: 'hirochiku_9a880f', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/hirochiku_9a880f.png' },
  { name: 'Kurodatec Co., Ltd.', email: 'kurodatec@jobfair', publicId: 'Kuroda_pneyut', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/Kuroda_pneyut.png' },
  { name: 'LIFEONE Co.,Ltd.', email: 'lifeone@jobfair', publicId: 'Lifeone_cbwmad', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/Lifeone_cbwmad.png' },
  { name: 'Persol Excel HR Partners Co., Ltd.', email: 'persol@jobfair', publicId: 'Persol_ksyqkj', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/Persol_ksyqkj.png' },
  { name: 'Software Science, Inc.', email: 'softwarescience@jobfair', publicId: 'ssi_01_5b1bba', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/ssi_01_5b1bba.png' },
  { name: 'Tổng Công ty Cổ phần Công trình Viettel', email: 'viettel@jobfair', publicId: 'Viettel_con_jbyxul', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/Viettel_con_jbyxul.png' },
  { name: 'Aishin Iron Works Co., Ltd.', email: 'aishin@jobfair', publicId: 'AISHIN_r7hox6', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/AISHIN_r7hox6.png' },
  { name: 'CBS Sanyo Co., Ltd.', email: 'cbssanyo@jobfair', publicId: 'CBS_SANYO_qhdekb', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/CBS_SANYO_qhdekb.png' },
  { name: 'Công ty Cổ phần Dịch vụ & Kỹ thuật Cơ điện lạnh R.E.E', email: 'ree@jobfair', publicId: 'REE_cnaibw', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/REE_cnaibw.png' },
  { name: 'Công ty Cổ phần VINACONEX 25', email: 'vinaconex@jobfair', publicId: 'Logo_Vinaconex_25-01_bpvoxa', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/Logo_Vinaconex_25-01_bpvoxa.png' },
  { name: 'Công ty CP Công nghệ Phần mềm STS', email: 'sts@jobfair', publicId: 'STS_hegeks', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/STS_hegeks.png' },
  { name: 'Công ty CP Draexlmaier Automotive Việt Nam', email: 'draexlmaier@jobfair', publicId: 'Draelmeir_jla0er', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/Draelmeir_jla0er.png' },
  { name: 'Công ty CP Hàng không Vietjet', email: 'vietjet@jobfair', publicId: 'vietjet_bcliz6', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/vietjet_bcliz6.png' },
  { name: ' CÔNG TY CP PHÁT TRIỂN  GIÁO DỤC VIỆT ĐỨC IPI', email: 'ipi@jobfair', publicId: '', logoUrl: '' },
  { name: 'Công ty Media Fusion', email: 'mediafusion@jobfair', publicId: 'logo-media_fusion_-_PHUONG_NGO_wjcyy2', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/logo-media_fusion_-_PHUONG_NGO_wjcyy2.png' },
  { name: 'Công ty Millennium Furniture', email: 'millennium@jobfair', publicId: 'Millenium_xg8kth', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/Millenium_xg8kth.png' },
  { name: 'Công ty TNHH Alchip Technologies (Việt Nam)', email: 'alchip@jobfair', publicId: 'ALCHIP_ofnfgg', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/ALCHIP_ofnfgg.png' },
  { name: 'Công ty TNHH HanesBrands Việt Nam Huế (HBI)', email: 'hanesbrands@jobfair', publicId: 'HANDSBRANDS_fe31s4', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/HANDSBRANDS_fe31s4.png' },
  { name: 'Công ty TNHH Mixel Việt Nam ', email: 'mixel@jobfair', publicId: 'mixel_Logo_Main_Black_Color_transpBG_-_Duyen_Pham_igcjj0', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/mixel_Logo_Main_Black_Color_transpBG_-_Duyen_Pham_igcjj0.png' },
  { name: 'Công ty TNHH Murata Manufacturing Việt Nam', email: 'murata@jobfair', publicId: 'Murata_dz1tmp', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/Murata_dz1tmp.png' },
  { name: 'Công ty TNHH Nghiên cứu và Phát triển ASTI Việt Nam', email: 'asti@jobfair', publicId: 'asti_01_eihqob', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/asti_01_eihqob.png' },
  { name: 'Công ty TNHH Tư vấn Năng lượng VATEC', email: 'vatec@jobfair', publicId: 'Logo_VATEC_-_Vo_Phuong_Thanh_Nguyen_uxnhq6', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/Logo_VATEC_-_Vo_Phuong_Thanh_Nguyen_uxnhq6.png' },
  { name: 'Công ty TNHH Đóng tàu Damen Sông Cấm', email: 'damen@jobfair', publicId: '', logoUrl: '' },
  { name: 'Công ty TNHH Pegatron Việt Nam', email: 'pegatron@jobfair', publicId: 'pegatron_mvlfmw', logoUrl: 'https://res.cloudinary.com/dy0f3mihf/image/upload/v1774939304/pegatron_mvlfmw.png' }
];

export const SEED_WORKSHOPS: SeedWorkshop[] = [
  {
    name: 'Hội thảo Kỹ năng chuyên đề “CV Ấn tượng – Phỏng vấn tự tin”',
    email: 'cv-workshop@jobfair',
    publicId: 'workshop_cv_interview',
    logoUrl: '',
    boothName: 'Hội thảo CV Ấn tượng – Phỏng vấn tự tin',
    location: 'Khu hội thảo - Phòng WS01',
    capacity: 200,
    qrCode: 'WORKSHOP-WS01',
  },
];

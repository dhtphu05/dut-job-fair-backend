import { FACULTY_MAP, normalizeFaculty } from './faculties';

describe('faculty catalog', () => {
  it('contains exactly nine unique faculties with the E-AI abbreviation', () => {
    expect(Object.keys(FACULTY_MAP)).toHaveLength(9);
    expect(new Set(Object.values(FACULTY_MAP)).size).toBe(9);
    expect(FACULTY_MAP['E-AI']).toBe('Khoa Điện tử và Trí tuệ nhân tạo');
    for (const [code, name] of Object.entries(FACULTY_MAP)) {
      expect(normalizeFaculty(code)).toBe(name);
      expect(normalizeFaculty(name)).toBe(name);
    }
  });

  it.each([
    ['K. Cơ khí Giao thông và Năng lượng (N)', 'CKGTNL'],
    ['K. Điện tử và trí tuệ nhân tạo (123)', 'E-AI'],
    ['K. Hóa, Môi trường và Khoa học sự sống (MT)', 'HMTKHSS'],
    ['K. Xây dựng (X2)', 'XD'],
    ['K. Xây dựng (X3)', 'XD'],
  ])('deduplicates %s', (input, code) => {
    expect(normalizeFaculty(input)).toBe(FACULTY_MAP[code]);
  });

  it('preserves unknown departments and blank values', () => {
    expect(normalizeFaculty('  Khoa ngoài danh sách  ')).toBe('Khoa ngoài danh sách');
    expect(normalizeFaculty('')).toBe('');
  });
});

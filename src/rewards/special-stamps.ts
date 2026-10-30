// Stable QR identifiers shared by the additive seed and reward eligibility.
export const SPECIAL_STAMPS = [
  {
    qrCode: 'REWARD-CAREER-TALK',
    name: 'Tọa đàm kỹ năng nghề nghiệp',
    email: 'toadam@jobfair',
  },
  { qrCode: 'REWARD-OPENING', name: 'Lễ khai mạc', email: 'khaimac@jobfair' },
] as const;

export type RewardCounts = { total: number; regular: number; special: number; workshopIds?: string[] };

export function requiredWorkshopCount(milestone: { requiredWorkshopIds?: string[] | null; requiresSpecialStamps?: boolean }) {
  return milestone.requiredWorkshopIds?.length ?? (milestone.requiresSpecialStamps ? 2 : 0);
}

export function rewardRequirement(
  milestone: { requiredBooths: number; requiresSpecialStamps?: boolean; requiredWorkshopIds?: string[] | null },
  counts: RewardCounts,
) {
  const requiredCount = requiredWorkshopCount(milestone);
  const special = milestone.requiredWorkshopIds && counts.workshopIds
    ? milestone.requiredWorkshopIds.filter(id => counts.workshopIds!.includes(id)).length
    : counts.special;
  const missingSpecialStamps = requiredCount > 0
    ? Math.max(0, requiredCount - special)
    : 0;
  const remainingBooths = requiredCount > 0
    ? Math.max(0, milestone.requiredBooths - requiredCount - counts.regular) +
      missingSpecialStamps
    : Math.max(0, milestone.requiredBooths - counts.total);
  return {
    eligible: remainingBooths === 0,
    remainingBooths,
    missingSpecialStamps,
  };
}

// Only constants defined above are interpolated; no request data enters this SQL.
const specialCodesSql = [
  ...SPECIAL_STAMPS.map((stamp) => `'${stamp.qrCode}'`),
  `'WORKSHOP-01'`,
  `'WORKSHOP-02'`,
].join(', ');
export const REWARD_COUNT_SQL = {
  total: 'COUNT(DISTINCT c.booth_id)::int',
  regular: `COUNT(DISTINCT c.booth_id) FILTER (WHERE b.type = 'booth' AND (b.qr_code IS NULL OR b.qr_code NOT IN (${specialCodesSql})))::int`,
  special: `COUNT(DISTINCT c.booth_id) FILTER (WHERE b.type = 'workshop' OR b.qr_code IN (${specialCodesSql}))::int`,
  workshopIds: `COALESCE(array_agg(DISTINCT b.id) FILTER (WHERE b.type = 'workshop'), ARRAY[]::uuid[])`,
};

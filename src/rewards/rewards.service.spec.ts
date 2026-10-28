import { RewardsService } from './rewards.service';
import { rewardRequirement } from './special-stamps';

describe('Special stamp reward milestones', () => {
  const milestone = {
    id: 'milestone',
    name: 'Gift',
    requiredBooths: 20,
    requiresSpecialStamps: true,
  };
  it.each([
    [18, 2, true, 0],
    [20, 0, false, 2],
    [19, 1, false, 1],
    [17, 2, false, 1],
    [0, 0, false, 20],
    [25, 2, true, 0],
  ])(
    '%i regular + %i special: eligible=%s',
    (regular, special, eligible, remainingBooths) => {
      expect(
        rewardRequirement(milestone, {
          total: regular + special,
          regular,
          special,
        }),
      ).toMatchObject({ eligible, remainingBooths });
    },
  );
  it('keeps the old total-count rule when the option is off', () => {
    expect(
      rewardRequirement(
        { requiredBooths: 20 },
        { total: 20, regular: 0, special: 0 },
      ).eligible,
    ).toBe(true);
  });
  it('allows a two-stamp-only milestone', () => {
    expect(
      rewardRequirement(
        { ...milestone, requiredBooths: 2 },
        { total: 2, regular: 0, special: 2 },
      ).eligible,
    ).toBe(true);
  });

  function setup(regular = 18, special = 2) {
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest
        .fn()
        .mockResolvedValue({ total: regular + special, regular, special }),
    };
    const manager = {
      findBy: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((_entity, value) => value),
      save: jest.fn((_entity, value) => ({ id: 'claim', ...value })),
    };
    const milestones = {
      findOne: jest.fn().mockResolvedValue({ ...milestone }),
      find: jest.fn().mockResolvedValue([{ ...milestone }]),
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    const claims = { find: jest.fn().mockResolvedValue([]) };
    const students = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'student', studentCode: '123' }),
    };
    const service = new RewardsService(
      milestones as never,
      claims as never,
      students as never,
      { manager } as never,
      {} as never,
      { manager, transaction: (fn: (m: unknown) => unknown) => fn(manager) } as never,
    );
    return { service, manager, milestones };
  }
  it('persists the option and rejects impossible create/update configurations', async () => {
    const { service, milestones } = setup();
    await expect(service.createMilestone(milestone)).resolves.toMatchObject({
      requiresSpecialStamps: true,
    });
    await expect(
      service.createMilestone({ ...milestone, requiredBooths: 1 }),
    ).rejects.toThrow();
    await expect(
      service.updateMilestone('milestone', { requiredBooths: 1 }),
    ).rejects.toThrow();
    milestones.findOne.mockResolvedValue({
      ...milestone,
      requiredBooths: 1,
      requiresSpecialStamps: false,
    });
    await expect(
      service.updateMilestone('milestone', { requiresSpecialStamps: true }),
    ).rejects.toThrow();
  });
  it('requires exactly the selected workshops, not any equal number of workshops', () => {
    const selection = { requiredBooths: 20, requiredWorkshopIds: ['a', 'b', 'c'] };
    expect(rewardRequirement(selection, { total: 20, regular: 17, special: 2, workshopIds: ['a', 'b', 'other'] }))
      .toMatchObject({ eligible: false, remainingBooths: 1 });
    expect(rewardRequirement(selection, { total: 20, regular: 17, special: 0, workshopIds: ['a', 'b', 'c'] }))
      .toMatchObject({ eligible: true, remainingBooths: 0 });
    expect(rewardRequirement({ requiredBooths: 20, requiredWorkshopIds: [] }, { total: 20, regular: 17, special: 0, workshopIds: [] }).eligible).toBe(true);
  });
  it('validates selected workshop IDs and prevents selecting more workshops than the total', async () => {
    const { service, manager } = setup();
    await expect(service.createMilestone({ name: 'Test', requiredBooths: 2, requiredWorkshopIds: ['a', 'b', 'c'] })).rejects.toThrow();
    await expect(service.createMilestone({ name: 'Test', requiredBooths: 20, requiredWorkshopIds: ['missing'] })).rejects.toThrow();
    manager.findBy.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    await expect(service.createMilestone({ name: 'Test', requiredBooths: 20, requiredWorkshopIds: ['a', 'b', 'c'] })).resolves.toMatchObject({ requiresSpecialStamps: true, requiredWorkshopIds: ['a', 'b', 'c'] });
    await expect(service.updateMilestone('milestone', { requiredWorkshopIds: [] })).resolves.toMatchObject({ requiresSpecialStamps: false, requiredWorkshopIds: [] });
  });
  it('blocks claim creation even when the raw total is 20 but one stamp is missing', async () => {
    const { service, manager } = setup(19, 1);
    await expect(
      service.createClaimRequest({
        studentCode: '123',
        milestoneId: 'milestone',
      }),
    ).rejects.toThrow();
    expect(manager.save).not.toHaveBeenCalled();
    const progress = await service.getStudentRewardProgress('123');
    expect(progress.milestones[0]).toMatchObject({
      eligible: false,
      remainingBooths: 1,
      missingSpecialStamps: 1,
    });
    expect(progress.nextMilestone?.id).toBe('milestone');
  });
  it('creates a claim for 18 regular booths and both special stamps', async () => {
    const { service, manager } = setup();
    await expect(
      service.createClaimRequest({
        studentCode: '123',
        milestoneId: 'milestone',
      }),
    ).resolves.toMatchObject({ status: 'pending' });
    expect(manager.save).toHaveBeenCalledTimes(1);
  });
});

import { uuidv4 } from '../lib/uuid';

describe('uuidv4', () => {
  it('should generate a valid UUID v4', () => {
    const uuid = uuidv4();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidRegex);
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const uuid = uuidv4();
      expect(uuids.has(uuid)).toBe(false);
      uuids.add(uuid);
    }
    expect(uuids.size).toBe(1000);
  });
});

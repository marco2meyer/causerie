import { beforeEach, describe, expect, it, vi } from 'vitest';

/** A memory store on a plain object: enough of localStorage for the registry and the
 *  per-profile blobs, which is all lib/profiles touches. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    map,
    api: {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => { map.set(k, String(v)); },
      removeItem: (k: string) => { map.delete(k); },
      key: (i: number) => [...map.keys()][i] ?? null,
      get length() { return map.size; }
    }
  };
}

const store = fakeStorage();
vi.stubGlobal('localStorage', store.api);

/** The server copy: lib/sync's deleteRemote, which the teardown must call for a synced
 *  profile and must not call for one that never synced. */
const deleted: string[] = [];
let remoteOk = true;
vi.mock('../../src/lib/sync', async orig => ({
  ...(await orig<typeof import('../../src/lib/sync')>()),
  deleteRemote: async (token: string) => { deleted.push(token); return remoteOk; }
}));

const { createProfile, forgetProfileElsewhere, listProfiles, removeProfile } = await import('../../src/lib/profiles');
const { blankMem, loadMemFor } = await import('../../src/lib/storage');

const seed = (name: string, sync?: { token: string; enabled: boolean }) => {
  const m = blankMem();
  m.profile.name = name;
  if (sync) m.sync = sync;
  return createProfile(name, m).id;
};

describe('removeProfile: one teardown, three places', () => {
  beforeEach(() => { store.map.clear(); deleted.length = 0; remoteOk = true; });

  it('tells the extension which profile is going, by its sync token', async () => {
    const forgotten: string[] = [];
    const id = seed('Marco', { token: 'cz-aaaa-bbbb-cccc', enabled: true });
    const r = await removeProfile(id, { forgetProfile: async k => { forgotten.push(k); return true; } });
    expect(forgotten).toEqual(['cz-aaaa-bbbb-cccc']);
    expect(deleted).toEqual(['cz-aaaa-bbbb-cccc']);
    expect(r).toEqual({ remote: true, extension: true });
    expect(listProfiles()).toHaveLength(0);
    expect(loadMemFor(id)).toBeNull();
  });

  it('a profile that never synced is still named to the extension — as `default`, its own key', async () => {
    const forgotten: string[] = [];
    const id = seed('Sans sync');
    await removeProfile(id, { forgetProfile: async k => { forgotten.push(k); return true; } });
    expect(forgotten).toEqual(['default']);
    expect(deleted).toEqual([]);            // nothing to delete on the server
  });

  it('a refusal or a throw from either side never keeps the profile on the device', async () => {
    remoteOk = false;
    const id = seed('Marco', { token: 'cz-dddd-eeee-ffff', enabled: true });
    const r = await removeProfile(id, { forgetProfile: async () => { throw new Error('offline'); } });
    expect(r).toEqual({ remote: false, extension: false });
    expect(listProfiles()).toHaveLength(0);
  });

  it('without an extension the teardown is just the two copies', async () => {
    const id = seed('Marco', { token: 'cz-1111-2222-3333', enabled: true });
    expect(await removeProfile(id)).toEqual({ remote: true, extension: true });
    expect(deleted).toEqual(['cz-1111-2222-3333']);
  });

  it('forgetProfileElsewhere does the remote halves and leaves the device alone', async () => {
    const id = seed('Marco', { token: 'cz-9999-8888-7777', enabled: true });
    const r = await forgetProfileElsewhere(id, { forgetProfile: async () => true });
    expect(r).toEqual({ remote: true, extension: true });
    expect(listProfiles()).toHaveLength(1);   // the "forget everything" button asks first
    expect(loadMemFor(id)).not.toBeNull();
  });
});

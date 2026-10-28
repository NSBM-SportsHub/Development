import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { clubsService } from "./clubsService.js";

const storage = new Map();

beforeEach(() => {
  storage.clear();
  globalThis.window = {
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
  };
});

describe("clubsService", () => {
  it("creates and updates clubs that remain available after reloading", () => {
    const created = clubsService.save([], {
      name: "Sample Club",
      sport: "Running",
      status: "Recruiting",
    });

    assert.equal(created.clubs.length, 1);
    assert.equal(clubsService.list()[0].name, "Sample Club");

    const updated = clubsService.save(created.clubs, {
      ...created.clubs[0],
      name: "Updated Club",
    });

    assert.equal(updated.clubs[0].name, "Updated Club");
    assert.equal(clubsService.list()[0].name, "Updated Club");
  });

  it("deletes clubs and persists the empty list", () => {
    const created = clubsService.save([], {
      name: "Sample Club",
      sport: "Running",
      status: "Recruiting",
    });

    assert.deepEqual(clubsService.delete(created.clubs, created.id), []);
    assert.deepEqual(clubsService.list(), []);
  });

  it("rejects updates and deletes for clubs that are no longer present", () => {
    assert.throws(
      () => clubsService.save([], { id: "missing", name: "Missing Club" }),
      /no longer exists/
    );
    assert.throws(() => clubsService.delete([], "missing"), /no longer exists/);
  });
});

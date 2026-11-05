import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { api } from "../../shared/api.js";
import { clubsService } from "./clubsService.js";
import { trainingService } from "../training-attendance/trainingService.js";

function reads(context) {
  context.mock.method(api, "get", async (path) => {
    if (path === "/clubs") return [{ id: 7, sport_id: 3, name: "Chess Club", status: "recruiting", member_count: 5 }];
    if (path === "/sports") return [{ id: 3, name: "Chess" }];
    if (path === "/club-coaches") return [{ club_id: 7, user_name: "Club Coach" }];
    throw Error("Unexpected read: " + path);
  });
}

describe("clubsService API contract", () => {
  it("loads canonical clubs, sports, membership totals and assigned coaches", async (context) => {
    reads(context);
    const rows = await clubsService.list();
    assert.equal(rows[0].id, "7");
    assert.equal(rows[0].sport, "Chess");
    assert.equal(rows[0].coach, "Club Coach");
    assert.equal(rows[0].members, 5);
    assert.equal(rows[0].status, "Recruiting");
  });
  it("creates and updates through PHP with canonical sport IDs and lower-case statuses", async (context) => {
    reads(context);
    const post = context.mock.method(api, "post", async () => ({ id: 7 }));
    const patch = context.mock.method(api, "patch", async () => ({ id: 7 }));
    const club = { name: "Chess Club", sport_id: "3", status: "Recruiting", description: "Weekly games" };
    assert.equal((await clubsService.save([], club)).id, "7");
    assert.deepEqual(post.mock.calls[0].arguments, ["/clubs", { name: club.name, description: club.description, sport_id: 3, status: "recruiting" }]);
    await clubsService.save([{ id: "7" }], { ...club, id: "7" });
    assert.equal(patch.mock.calls[0].arguments[0], "/clubs/7");
  });
  it("archives through the API and removes the club from the active list", async (context) => {
    const patch = context.mock.method(api, "patch", async () => null);
    assert.deepEqual(await clubsService.delete([{ id: "7" }], "7"), []);
    assert.deepEqual(patch.mock.calls[0].arguments, ["/clubs/7/archive", {}]);
  });
  it("rejects missing-record mutations and propagates database failures", async (context) => {
    await assert.rejects(clubsService.save([], { id: "missing" }), /no longer exists/);
    await assert.rejects(clubsService.delete([], "missing"), /no longer exists/);
    context.mock.method(api, "get", async () => { throw Error("Backend unavailable"); });
    await assert.rejects(clubsService.list(), /Backend unavailable/);
  });
  it("keeps a successful club write successful when subsequent reads are unavailable", async (context) => {
    context.mock.method(api, "get", async () => { throw Error("Read unavailable"); });
    const post = context.mock.method(api, "post", async (_path, body) => ({ id: 8, ...body }));
    const result = await clubsService.save([], { name: "Saved Club", sport_id: 3, sport: "Chess", status: "Active" });
    assert.equal(result.id, "8");
    assert.equal(result.clubs[0].name, "Saved Club");
    assert.equal(post.mock.calls.length, 1);
  });
  it("does not retry or misreport a successful training write when reads are unavailable", async (context) => {
    context.mock.method(api, "get", async () => { throw Error("Read unavailable"); });
    const post = context.mock.method(api, "post", async (_path, body) => ({ id: 9, ...body }));
    const result = await trainingService.save([], { title: "Saved Training", clubId: "8", club: "Saved Club", date: "2032-05-10", startTime: "15:00", endTime: "16:00", status: "scheduled", description: "Practice" });
    assert.equal(result.id, "9");
    assert.equal(result.sessions[0].club, "Saved Club");
    assert.equal(result.sessions[0].date, "2032-05-10");
    assert.equal(post.mock.calls.length, 1);
  });
});

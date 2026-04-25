import { test, expect } from "@playwright/test";

const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://backend_dev:8000";

test.describe("Admin CRUD flow", () => {
  let token: string;
  let createdKosId: string;
  let createdKosName: string;

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post("/api/auth/login", {
      data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    });
    if (loginRes.ok()) {
      const cookies = loginRes.headersArray().filter((h) => h.name === "set-cookie");
      const tokenCookie = cookies.find((c) => c.value.includes("admin_token="));
      if (tokenCookie) {
        const match = tokenCookie.value.match(/admin_token=([^;]+)/);
        if (match) {
          const cleanupToken = match[1];
          const listRes = await request.get(`${BACKEND_URL}/api/kos`, {
            headers: { Authorization: `Bearer ${cleanupToken}` },
          });
          if (listRes.ok()) {
            const list = await listRes.json();
            const e2eKos = list.filter((k: { nama: string }) =>
              k.nama.startsWith("E2E Kos"),
            );
            for (const kos of e2eKos) {
              await request.delete(`${BACKEND_URL}/api/admin/kos/${kos.id}`, {
                headers: { Authorization: `Bearer ${cleanupToken}` },
              });
            }
          }
        }
      }
    }
  });

  test("login and obtain auth token", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    });
    expect(res.ok()).toBeTruthy();
    const cookies = res.headersArray().filter((h) => h.name === "set-cookie");
    const tokenCookie = cookies.find((c) => c.value.includes("admin_token="));
    expect(tokenCookie).toBeDefined();

    const match = tokenCookie!.value.match(/admin_token=([^;]+)/);
    expect(match).not.toBeNull();
    token = match![1];
  });

  test("create kos", async ({ request }) => {
    test.skip(!token, "No auth token from login");

    const ts = Date.now();
    createdKosName = `E2E Kos ${ts}`;
    const res = await request.post(`${BACKEND_URL}/api/admin/kos`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        nama: createdKosName,
        jenis: "Campuran",
        alamat: "Jl. E2E Test",
        harga: "500000",
        lat: -7.56,
        lon: 110.82,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.nama).toBe(createdKosName);
    expect(body).toHaveProperty("id");
    createdKosId = body.id;
  });

  test("verify kos appears in list", async ({ request }) => {
    test.skip(!token, "No auth token");
    test.skip(!createdKosId, "No kos created");

    const res = await request.get(`${BACKEND_URL}/api/kos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const list = await res.json();
    const found = list.some(
      (k: { id: string }) => k.id === createdKosId,
    );
    expect(found).toBeTruthy();
  });

  test("edit kos harga", async ({ request }) => {
    test.skip(!token, "No auth token");
    test.skip(!createdKosId, "No kos created");

    const res = await request.put(`${BACKEND_URL}/api/admin/kos/${createdKosId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { harga: "600000" },
    });
    expect(res.ok()).toBeTruthy();
    const updated = await res.json();
    expect(updated.harga).toBe("600000");
  });

  test("delete kos and verify removed", async ({ request }) => {
    test.skip(!token, "No auth token");
    test.skip(!createdKosId, "No kos created");

    const delRes = await request.delete(`${BACKEND_URL}/api/admin/kos/${createdKosId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(delRes.status()).toBe(204);

    const afterList = await (
      await request.get(`${BACKEND_URL}/api/kos`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json();
    const stillExists = afterList.some(
      (k: { id: string }) => k.id === createdKosId,
    );
    expect(stillExists).toBeFalsy();
  });

  test.afterAll(async ({ request }) => {
    if (!token) return;
    const listRes = await request.get(`${BACKEND_URL}/api/kos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok()) return;
    const list = await listRes.json();
    const e2eKos = list.filter((k: { nama: string }) =>
      k.nama.startsWith("E2E Kos"),
    );
    for (const kos of e2eKos) {
      await request.delete(`${BACKEND_URL}/api/admin/kos/${kos.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });
});

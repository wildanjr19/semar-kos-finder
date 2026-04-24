import { test, expect } from "@playwright/test";

const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://backend_dev:8000";

test.describe("Admin CRUD flow", () => {
  let token: string;

  test("login and obtain auth token", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    });
    expect(res.ok()).toBeTruthy();
    const cookies = res.headersArray().filter((h) => h.name === "set-cookie");
    const tokenCookie = cookies.find((c) => c.value.includes("admin_token="));
    expect(tokenCookie).toBeDefined();

    // Extract token from response cookies for subsequent API calls
    const match = tokenCookie!.value.match(/admin_token=([^;]+)/);
    expect(match).not.toBeNull();
    token = match![1];
  });

  test("create kos", async ({ request }) => {
    test.skip(!token, "No auth token from login");

    const ts = Date.now();
    const res = await request.post(`${BACKEND_URL}/api/admin/kos`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        nama: `E2E Kos ${ts}`,
        jenis: "Campuran",
        alamat: "Jl. E2E Test",
        harga: "500000",
        lat: -7.56,
        lon: 110.82,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.nama).toBe(`E2E Kos ${ts}`);
    expect(body).toHaveProperty("id");
  });

  test("verify kos appears in list", async ({ request }) => {
    test.skip(!token, "No auth token");

    const res = await request.get(`${BACKEND_URL}/api/kos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const list = await res.json();
    const found = list.some(
      (k: { nama: string }) => k.nama.startsWith("E2E Kos"),
    );
    expect(found).toBeTruthy();
  });

  test("edit kos harga", async ({ request }) => {
    test.skip(!token, "No auth token");

    // Find the e2e kos
    const listRes = await request.get(`${BACKEND_URL}/api/kos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = await listRes.json();
    const kos = list.find((k: { nama: string }) =>
      k.nama.startsWith("E2E Kos"),
    );
    expect(kos).toBeDefined();

    const res = await request.put(`${BACKEND_URL}/api/admin/kos/${kos.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { harga: "600000" },
    });
    expect(res.ok()).toBeTruthy();
    const updated = await res.json();
    expect(updated.harga).toBe("600000");
  });

  test("delete kos and verify removed", async ({ request }) => {
    test.skip(!token, "No auth token");

    // Find the e2e kos
    const listRes = await request.get(`${BACKEND_URL}/api/kos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = await listRes.json();
    const kos = list.find((k: { nama: string }) =>
      k.nama.startsWith("E2E Kos"),
    );
    expect(kos).toBeDefined();

    const delRes = await request.delete(`${BACKEND_URL}/api/admin/kos/${kos.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(delRes.status()).toBe(204);

    // Verify removed
    const afterList = await (
      await request.get(`${BACKEND_URL}/api/kos`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json();
    const stillExists = afterList.some(
      (k: { id: string }) => k.id === kos.id,
    );
    expect(stillExists).toBeFalsy();
  });
});
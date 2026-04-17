# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: crud.spec.ts >> Admin CRUD flow >> login and obtain auth token
- Location: e2e/crud.spec.ts:10:7

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
  4   | const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";
  5   | const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://backend_dev:8000";
  6   | 
  7   | test.describe("Admin CRUD flow", () => {
  8   |   let token: string;
  9   | 
  10  |   test("login and obtain auth token", async ({ request }) => {
  11  |     const res = await request.post("/api/auth/login", {
  12  |       data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
  13  |     });
> 14  |     expect(res.ok()).toBeTruthy();
      |                      ^ Error: expect(received).toBeTruthy()
  15  |     const cookies = res.headersArray().filter((h) => h.name === "set-cookie");
  16  |     const tokenCookie = cookies.find((c) => c.value.includes("admin_token="));
  17  |     expect(tokenCookie).toBeDefined();
  18  | 
  19  |     // Extract token from response cookies for subsequent API calls
  20  |     const match = tokenCookie!.value.match(/admin_token=([^;]+)/);
  21  |     expect(match).not.toBeNull();
  22  |     token = match![1];
  23  |   });
  24  | 
  25  |   test("create kos", async ({ request }) => {
  26  |     test.skip(!token, "No auth token from login");
  27  | 
  28  |     const ts = Date.now();
  29  |     const res = await request.post(`${BACKEND_URL}/api/admin/kos`, {
  30  |       headers: { Authorization: `Bearer ${token}` },
  31  |       data: {
  32  |         nama: `E2E Kos ${ts}`,
  33  |         jenis: "Campuran",
  34  |         alamat: "Jl. E2E Test",
  35  |         harga: "500000",
  36  |         lat: -7.56,
  37  |         lon: 110.82,
  38  |       },
  39  |     });
  40  |     expect(res.status()).toBe(201);
  41  |     const body = await res.json();
  42  |     expect(body.nama).toBe(`E2E Kos ${ts}`);
  43  |     expect(body).toHaveProperty("id");
  44  |   });
  45  | 
  46  |   test("verify kos appears in list", async ({ request }) => {
  47  |     test.skip(!token, "No auth token");
  48  | 
  49  |     const res = await request.get(`${BACKEND_URL}/api/kos`, {
  50  |       headers: { Authorization: `Bearer ${token}` },
  51  |     });
  52  |     expect(res.ok()).toBeTruthy();
  53  |     const list = await res.json();
  54  |     const found = list.some(
  55  |       (k: { nama: string }) => k.nama.startsWith("E2E Kos"),
  56  |     );
  57  |     expect(found).toBeTruthy();
  58  |   });
  59  | 
  60  |   test("edit kos harga", async ({ request }) => {
  61  |     test.skip(!token, "No auth token");
  62  | 
  63  |     // Find the e2e kos
  64  |     const listRes = await request.get(`${BACKEND_URL}/api/kos`, {
  65  |       headers: { Authorization: `Bearer ${token}` },
  66  |     });
  67  |     const list = await listRes.json();
  68  |     const kos = list.find((k: { nama: string }) =>
  69  |       k.nama.startsWith("E2E Kos"),
  70  |     );
  71  |     expect(kos).toBeDefined();
  72  | 
  73  |     const res = await request.put(`${BACKEND_URL}/api/admin/kos/${kos.id}`, {
  74  |       headers: { Authorization: `Bearer ${token}` },
  75  |       data: { harga: "600000" },
  76  |     });
  77  |     expect(res.ok()).toBeTruthy();
  78  |     const updated = await res.json();
  79  |     expect(updated.harga).toBe("600000");
  80  |   });
  81  | 
  82  |   test("delete kos and verify removed", async ({ request }) => {
  83  |     test.skip(!token, "No auth token");
  84  | 
  85  |     // Find the e2e kos
  86  |     const listRes = await request.get(`${BACKEND_URL}/api/kos`, {
  87  |       headers: { Authorization: `Bearer ${token}` },
  88  |     });
  89  |     const list = await listRes.json();
  90  |     const kos = list.find((k: { nama: string }) =>
  91  |       k.nama.startsWith("E2E Kos"),
  92  |     );
  93  |     expect(kos).toBeDefined();
  94  | 
  95  |     const delRes = await request.delete(`${BACKEND_URL}/api/admin/kos/${kos.id}`, {
  96  |       headers: { Authorization: `Bearer ${token}` },
  97  |     });
  98  |     expect(delRes.status()).toBe(204);
  99  | 
  100 |     // Verify removed
  101 |     const afterList = await (
  102 |       await request.get(`${BACKEND_URL}/api/kos`, {
  103 |         headers: { Authorization: `Bearer ${token}` },
  104 |       })
  105 |     ).json();
  106 |     const stillExists = afterList.some(
  107 |       (k: { id: string }) => k.id === kos.id,
  108 |     );
  109 |     expect(stillExists).toBeFalsy();
  110 |   });
  111 | });
```
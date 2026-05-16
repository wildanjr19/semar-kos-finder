import { expect, test } from "@playwright/test";

const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

test("login and load parse page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(ADMIN_USERNAME);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/kos$/);

  await page.goto("/actions/parse");
  await expect(page.getByRole("heading", { name: "Review hasil parsing LLM" })).toBeVisible();
  await expect(page.getByText("Clean Data")).toBeVisible();
});

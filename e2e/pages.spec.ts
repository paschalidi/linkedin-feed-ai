import { test, expect } from "@playwright/test";

test.describe("Page Loads", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=LinkedIn Feed AI")).toBeVisible();
    await expect(page.locator("button:has-text('Send Magic Link')")).toBeVisible();
  });

  test("dashboard loads after dev login", async ({ page }) => {
    await page.goto("/login");
    
    // Click dev login bypass
    await page.click("text=Developer Login (skip email)");
    await page.click("text=Dev Login");
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator("text=Dashboard")).toBeVisible();
  });

  test("sources page loads", async ({ page }) => {
    await page.goto("/login");
    await page.click("text=Developer Login (skip email)");
    await page.click("text=Dev Login");
    
    await page.goto("/sources");
    await expect(page.locator("text=Sources")).toBeVisible();
    await expect(page.locator("text=Add Newsletter Source")).toBeVisible();
  });

  test("ideas page loads", async ({ page }) => {
    await page.goto("/login");
    await page.click("text=Developer Login (skip email)");
    await page.click("text=Dev Login");
    
    await page.goto("/ideas");
    await expect(page.locator("text=Ideas")).toBeVisible();
    await expect(page.locator("text=Add Today's Idea")).toBeVisible();
  });

  test("styles page loads", async ({ page }) => {
    await page.goto("/login");
    await page.click("text=Developer Login (skip email)");
    await page.click("text=Dev Login");
    
    await page.goto("/styles");
    await expect(page.locator("text=Style Profiles")).toBeVisible();
    await expect(page.locator("text=Create Style Profile")).toBeVisible();
  });

  test("posts page loads", async ({ page }) => {
    await page.goto("/login");
    await page.click("text=Developer Login (skip email)");
    await page.click("text=Dev Login");
    
    await page.goto("/posts");
    await expect(page.locator("text=Generated Posts")).toBeVisible();
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/login");
    await page.click("text=Developer Login (skip email)");
    await page.click("text=Dev Login");
    
    await page.goto("/settings");
    await expect(page.locator("text=Settings")).toBeVisible();
  });
});

test.describe("Navigation", () => {
  test("sidebar navigation works", async ({ page }) => {
    await page.goto("/login");
    await page.click("text=Developer Login (skip email)");
    await page.click("text=Dev Login");
    
    // Click through sidebar items
    await page.click("text=Sources");
    await expect(page).toHaveURL(/.*sources/);
    
    await page.click("text=Ideas");
    await expect(page).toHaveURL(/.*ideas/);
    
    await page.click("text=Styles");
    await expect(page).toHaveURL(/.*styles/);
    
    await page.click("text=Dashboard");
    await expect(page).toHaveURL(/.*dashboard/);
  });
});

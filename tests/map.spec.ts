import { expect, test } from "@playwright/test";

test("mapa real en móvil con sesión simulada", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/session", route => route.fulfill({ json: {
    user: { id: 1, name: "Prueba del mapa", email: "map@example.test" }, csrf: "test",
  } }));
  await page.setViewportSize({ width: 390, height: 844 });
  const tile = page.waitForResponse(response => response.url().startsWith("https://tile.openstreetmap.org/") && response.ok());
  await page.goto("/");
  await tile;
  await expect(page.getByRole("button", { name: "Acercar", exact: true })).toBeVisible();
  const bounds = await page.locator("canvas.maplibregl-canvas").boundingBox();
  expect(bounds?.height).toBeGreaterThan(500);
  expect(bounds?.width).toBeGreaterThan(300);
  await expect(page.getByRole("region", { name: "Mapa de lugares" }).getByRole("alert")).toHaveCount(0);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/map-mobile.png" });
  expect(errors).toEqual([]);
});

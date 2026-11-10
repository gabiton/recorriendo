import { expect, test } from "@playwright/test";

test("login, mapa, persistencia, páginas públicas y logout", async ({ page, request }) => {
  page.on("pageerror", error => console.error("Browser:", error.message));
  page.on("requestfailed", request => console.error("Request:", request.url(), request.failure()?.errorText));
  page.on("console", message => { if (message.type() === "error") console.error("Console:", message.text()); });
  const email = process.env.TEST_USER_EMAIL;
  if (!email) throw new Error("Configurar TEST_USER_EMAIL para crear y limpiar un usuario temporal.");
  const password = "PruebaMapa123!";
  const created = await request.post("/api/register", { data: { email, password, password_confirmation: password } });
  expect(created.status()).toBe(201);
  const anon = await request.get("/api/session");
  expect((await anon.json()).user).toBeNull();
  expect((await request.post("/api/login", { data: { email, password, csrf: "invalid" } })).status()).toBe(403);

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Login", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Mapa de lugares" })).toHaveCount(0);
  await page.getByRole("link", { name: "Login", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("incorrecta");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("status")).toContainText("No pudimos iniciar sesión");
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("region", { name: "Mapa de lugares" })).toBeVisible();
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Acercar", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Login", exact: true })).toHaveCount(0);
  const cookie = (await page.context().cookies()).find(item => item.name === "recorriendo_site");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  await page.reload();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  for (const path of ["/login", "/registro"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("region", { name: "Mapa de lugares" })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
  await page.waitForTimeout(1500);
  expect((await page.locator("canvas.maplibregl-canvas").boundingBox())?.height).toBeGreaterThan(500);
  await page.screenshot({ path: "test-results/map-mobile.png" });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("link", { name: "Login", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Registro", exact: true })).toBeVisible();
});

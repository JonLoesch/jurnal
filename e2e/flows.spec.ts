import { expect, test, type Browser, type Page } from "@playwright/test";
import { Client } from "pg";

const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgres://jurnal@localhost:54329/jurnal_e2e";

test.beforeAll(async () => {
  const c = new Client({ connectionString: E2E_DB });
  await c.connect();
  await c.query(
    'truncate "account","owner","jurnal","section","metric","entry","entry_value","asset","grant","invite","comment","reminder_rule","alert_firing","push_subscription","api_token" cascade',
  );
  await c.end();
});

async function signIn(page: Page, name: string) {
  await page.goto("/login");
  await page.getByPlaceholder("email").fill(`${name.toLowerCase()}@example.com`);
  await page.getByPlaceholder("name").fill(name);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Your jurnals" })).toBeVisible();
}

async function newUser(browser: Browser, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, name);
  return page;
}

test("solo journaling: metrics, entries, backfill, trends, export", async ({ browser }) => {
  const page = await newUser(browser, "Ann");
  await page.getByPlaceholder("New jurnal").fill("Fitness");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Fitness" })).toBeVisible();

  await page.getByRole("link", { name: "Manage" }).click();
  await page.getByPlaceholder("e.g. Sleep").fill("Weight");
  await page.locator('select[name="fieldType"]').selectOption("number");
  await page.getByPlaceholder("kg, lb").fill("kg");
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await expect(page.getByText("Weight").first()).toBeVisible();

  await page.getByRole("link", { name: /← Fitness/ }).click();
  await page.locator('input[name^="m_"]').first().fill("80.5");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByText("80.5 kg")).toBeVisible();

  // Backfill yesterday's entry.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await page.locator('input[name^="m_"]').first().fill("81");
  await page.locator('input[name="date"]').first().fill(yesterday);
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByText("81 kg")).toBeVisible();

  await page.getByRole("link", { name: "Trends" }).click();
  await expect(page.getByRole("img", { name: "Trend chart" })).toBeVisible();

  const res = await page.request.get(page.url().replace(/trends$/, "") + "../../api/jurnals/" + page.url().split("/j/")[1].split("/")[0] + "/export?format=csv");
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("Weight,80.5");
});

test("sharing: invite, protected metric hidden, public link, comments, absence alert option", async ({ browser }) => {
  const ann = await newUser(browser, "Anna");
  await ann.getByPlaceholder("New jurnal").fill("Life");
  await ann.getByRole("button", { name: "Create" }).click();
  await expect(ann.getByRole("heading", { name: "Life" })).toBeVisible();
  const jurnalUrl = ann.url();
  const jid = jurnalUrl.split("/j/")[1];

  await ann.goto(`/j/${jid}/settings`);
  for (const [name, protectedBox] of [["Mood", false], ["Diary", true]] as const) {
    await ann.getByPlaceholder("e.g. Sleep").fill(name);
    await ann.locator('select[name="fieldType"]').selectOption(name === "Mood" ? "stars" : "text");
    if (protectedBox) await ann.locator('form:has(input[placeholder="e.g. Sleep"]) input[name="protected"]').check();
    await ann.getByRole("button", { name: "Add", exact: true }).first().click();
    await expect(ann.getByText(name, { exact: true }).first()).toBeVisible();
  }
  await ann.goto(jurnalUrl);
  await ann.locator('select[name^="m_"]').first().selectOption("4");
  await ann.locator('input[name^="m_"]').first().fill("top secret thoughts");
  await ann.getByRole("button", { name: "Save entry" }).click();
  await expect(ann.getByText("top secret thoughts")).toBeVisible();

  // Invite Bob with comments.
  await ann.goto(`/j/${jid}/sharing`);
  await expect(ann.getByText(/protected items/)).toBeVisible();
  await ann.locator('select[name="commentPerm"]').first().selectOption("write");
  await ann.getByLabel(/May set alerts/).first().check();
  await ann.getByRole("button", { name: "Create invite link" }).click();
  const inviteText = await ann.locator("code").first().innerText();
  const invitePath = new URL(inviteText.trim()).pathname;

  const bob = await newUser(browser, "Bobby");
  await bob.goto(invitePath);
  await bob.getByRole("button", { name: "Accept" }).click();
  await expect(bob.getByRole("heading", { name: "Life" })).toBeVisible();
  await expect(bob.getByText("★★★★☆")).toBeVisible();
  await expect(bob.getByText("top secret thoughts")).toHaveCount(0);
  await expect(bob.getByText(/You see dates, not times/)).toBeVisible();

  await bob.getByPlaceholder("Add a comment").fill("Looking good!");
  await bob.getByRole("button", { name: "Post" }).click();
  await expect(bob.getByText("Looking good!")).toBeVisible();
  await bob.getByText("Tell me when this goes quiet").click();
  await bob.getByRole("button", { name: "Add alert" }).click();
  await bob.goto("/settings");
  await expect(bob.getByText(/tell me after 2 quiet days/)).toBeVisible();

  // The owner sees who set alerts on the jurnal.
  await ann.goto(`/j/${jid}/sharing`);
  await expect(ann.getByText(/Bobby: notified after 2 days/)).toBeVisible();

  // A stranger sees nothing; a public link shows only unprotected parts.
  const stranger = await newUser(browser, "Eve");
  await stranger.goto(`/j/${jid}`);
  await expect(stranger.getByText(/Not Found|could not be found|404/i).first()).toBeVisible();
  await ann.getByRole("button", { name: "Create public link" }).click();
  const publicText = await ann.locator("code").last().innerText();
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(new URL(publicText.trim()).pathname);
  await expect(anon.getByText("★★★★☆")).toBeVisible();
  await expect(anon.getByText("top secret thoughts")).toHaveCount(0);
});

test("photos: uploaded in notes, shown to the owner, hidden from strangers", async ({ browser }) => {
  const ann = await newUser(browser, "Pia");
  await ann.getByPlaceholder("New jurnal").fill("Meals");
  await ann.getByRole("button", { name: "Create" }).click();
  await expect(ann.getByRole("heading", { name: "Meals" })).toBeVisible();
  const jid = ann.url().split("/j/")[1];

  await ann.goto(`/j/${jid}/settings`);
  await ann.getByPlaceholder("e.g. Sleep").fill("Lunch");
  await ann.locator('select[name="fieldType"]').selectOption("richtext");
  await ann.getByRole("button", { name: "Add", exact: true }).first().click();
  await expect(ann.getByText("Lunch", { exact: true }).first()).toBeVisible();

  await ann.goto(`/j/${jid}`);
  await ann.locator("textarea").first().fill("Soup and bread");
  await ann.locator('input[type="file"]').first().setInputFiles("public/icon-192.png");
  await ann.getByRole("button", { name: "Save entry" }).click();
  await expect(ann.locator("p", { hasText: "Soup and bread" })).toBeVisible();
  const img = ann.locator("main img").first();
  await expect(img).toBeVisible();
  const src = await img.getAttribute("src");
  expect(src).toMatch(/^\/api\/assets\//);
  expect((await ann.request.get(src!)).status()).toBe(200);

  const eve = await newUser(browser, "Eve2");
  expect((await eve.request.get(src!)).status()).toBe(404);
  const anon = await (await browser.newContext()).newPage();
  expect((await anon.request.get(src!)).status()).toBe(404);
});

test("account deletion: needs the email typed, then everything is gone", async ({ browser }) => {
  const page = await newUser(browser, "Dave");
  await page.getByPlaceholder("New jurnal").fill("Temporary");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Temporary" })).toBeVisible();

  await page.goto("/settings");
  await page.locator('input[name="confirm"]').fill("not-my-email");
  await page.getByRole("button", { name: "Delete everything" }).click();
  await expect(page.getByText("Type your email address to confirm")).toBeVisible();

  await page.locator('input[name="confirm"]').fill("dave@example.com");
  await page.getByRole("button", { name: "Delete everything" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  // Signing in again makes a brand-new, empty account.
  await signIn(page, "Dave");
  await expect(page.getByText("No jurnals yet")).toBeVisible();
});

test("AI access: make a token in Settings, see it once, and revoke it", async ({ browser }) => {
  const page = await newUser(browser, "Erin");
  await page.goto("/settings");
  await page.getByPlaceholder("Claude Code on my laptop").fill("laptop");
  await page.getByLabel("Make and edit entries").check();
  await page.getByRole("button", { name: "Create token" }).click();
  await expect(page.getByText("Copy this now")).toBeVisible();
  // The token is the code block right after the notice; the token list above it shows only a shortened prefix.
  const token = (await page.getByText("Copy this now").locator("xpath=following-sibling::code[1]").innerText()).trim();

  const res = await page.request.post("/api/mcp", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json, text/event-stream", "content-type": "application/json" },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
  });
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("append_log_line");

  await page.reload();
  await expect(page.getByText("Copy this now")).toHaveCount(0); // gone for good
  await page.getByRole("button", { name: "Revoke" }).click();
  const after = await page.request.post("/api/mcp", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json, text/event-stream", "content-type": "application/json" },
    data: { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  });
  expect(after.status()).toBe(401);
});

test("running log: lines pile up through the day with their times, and a photo rides along", async ({ browser }) => {
  const page = await newUser(browser, "Lena");
  await page.getByPlaceholder("New jurnal").fill("Day");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Day" })).toBeVisible();
  const jid = page.url().split("/j/")[1];

  await page.goto(`/j/${jid}/settings`);
  await page.getByPlaceholder("e.g. Sleep").fill("Diet");
  await page.locator('select[name="fieldType"]').selectOption("log");
  await page.getByRole("button", { name: "Add", exact: true }).first().click();
  await expect(page.getByText("Diet", { exact: true }).first()).toBeVisible();

  await page.goto(`/j/${jid}`);
  await page.getByPlaceholder("Add a line").fill("oatmeal and raspberries");
  await page.getByRole("button", { name: "Add line" }).click();
  await expect(page.getByText("oatmeal and raspberries")).toBeVisible();

  await page.getByPlaceholder("Add a line").fill("cheddar, two ounces ish");
  await page.locator('input[type="file"]').first().setInputFiles("public/icon-192.png");
  await page.getByRole("button", { name: "Add line" }).click();
  await expect(page.getByText("cheddar, two ounces ish")).toBeVisible();
  await expect(page.getByText("oatmeal and raspberries")).toBeVisible(); // still there: one day, one entry
  await expect(page.locator("main img").first()).toBeVisible();
  await expect(page.getByText(/\d{1,2}:\d{2}\s?[AP]M/).first()).toBeVisible();

  await page.getByRole("button", { name: "remove" }).first().click();
  await expect(page.getByText("oatmeal and raspberries")).toHaveCount(0);
  await expect(page.getByText("cheddar, two ounces ish")).toBeVisible();
});

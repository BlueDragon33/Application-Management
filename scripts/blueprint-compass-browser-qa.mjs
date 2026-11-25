import assert from "node:assert/strict";

/**
 * Real Chromium + actual local APP route and components.
 * GitHub response fixtures are deliberately intercepted: no private data,
 * external Graph access, live-agent telemetry or production authority.
 */
export async function verifyBlueprintCompass(origin, { makeContext, pass, screenshot }) {
  const route = "/tools/blueprint-compass";
  const hub = "BlueDragon33/Software-Blueprint-Hub";
  const manager = "BlueDragon33/Application-Management";
  for (const width of [1440, 390]) {
    const context = await makeContext(origin, { viewport: { width, height: 900 }, isMobile: width === 390, hasTouch: width === 390 });
    const page = await context.newPage();
    const errors = [];
    let failReads = false;
    page.on("pageerror", error => { errors.push(error.message); console.error("Compass pageerror:", error.message); });
    page.on("console", message => {
      if (message.type() === "error" && /hydrat|<title>|server rendered HTML/i.test(message.text())) {
        errors.push(message.text()); console.error("Compass hydration:", message.text());
      }
    });
    try {
      await page.route("**/api/projects/repositories", request => request.fulfill({ json: { ok: true, unmanaged: [] } }));
      await page.route("**/api/tools/blueprint-compass/hub-contract", request => request.fulfill({ json: {
        ok: true, status: "HUB_GRAPH_NOT_EXPOSED", repository: hub,
        source: "github-public-rest-pinned-contract", hubHead: "a".repeat(40),
        contractBlobSha: "b".repeat(40), contractSchema: "application-management.contract/v1",
        contractVersion: 1, canReadGraph: false, canWriteWorkPackages: false,
        qaPassed: false, productionAuthorized: false, checkedAt: "2026-11-24T00:00:00Z",
      } }));
      await page.route("**/api/tools/blueprint-compass?*", async request => {
        const id = new URL(request.request().url()).searchParams.get("id");
        const repository = id === "software-blueprint-hub" ? hub : id === "application-management" ? manager : null;
        if (!repository) return request.abort();
        if (failReads) return request.abort();
        return request.fulfill({ json: {
          ok: true, repository, head: (repository === hub ? "a" : "b").repeat(40),
          checkedAt: "2026-11-24T00:00:00Z", pullRequests: [], issues: [],
          evidenceClass: "UNSIGNED_GITHUB_METADATA_ONLY", canonicalGateVerified: false,
          humanReviewVerified: false, verdict: { status: "DRAFT_REVIEW", title: "Fixture " + id,
            description: "Synthetic browser readback", nextStep: "Read source",
            qaPassed: false, productionAuthorized: false },
        } });
      });
      const response = await page.goto(origin + route);
      assert.equal(response.status(), 200);
      await page.getByRole("heading", { name: "Blueprint OS · Neural Command Center" }).waitFor();
      const detail = page.locator("#compass-project-detail");
      const graph = page.getByRole("region", { name: /Sơ đồ 5 dải/ });
      const nodes = graph.locator('button[aria-controls="compass-project-detail"]');
      const chosen = graph.locator('button[aria-pressed="true"]');
      const guide = page.getByRole("button", { name: /Hướng dẫn/ }).first();
      await detail.getByText("Fixture software-blueprint-hub", { exact: true }).waitFor();
      await page.getByText("HUB_GRAPH_NOT_EXPOSED", { exact: false }).first().waitFor();
      assert.ok(await nodes.count() > 2);
      assert.equal(await chosen.count(), 1);
      const search = page.getByRole("searchbox", { name: "Tìm dự án" });
      const nodeCount = await nodes.count();
      await search.fill("Application-Management");
      await graph.locator('button[data-search-match="true"]').waitFor();
      assert.equal(await graph.locator('button[data-search-match="true"]').count(), 1);
      assert.equal(await graph.locator('path[data-search-match="true"]').count(), 4);
      assert.equal(await nodes.count(), nodeCount);
      assert.match(await chosen.innerText(), /Software Blueprint Hub/);
      assert.equal(await page.getByRole("complementary", { name: "Chọn dự án" }).locator("button[data-selected]").count(), 1);
      await search.fill("nonexistent-qa-project");
      assert.equal(await graph.locator('button[data-search-match="true"]').count(), 0);
      assert.equal(await graph.locator('path[data-search-match="true"]').count(), 0);
      assert.equal(await chosen.count(), 1);
      await search.fill("");
      assert.equal(await graph.locator('button[data-search-match="true"]').count(), 0);
      assert.equal(await nodes.count(), nodeCount);
      pass("Blueprint Compass " + width + "px: shared project search highlights exact registry path, preserves selection and empty-result context", { githubFixture: true });
      assert.deepEqual(errors, [], "No hydration or page errors before interaction");
      await guide.click();
      await page.locator("#blueprint-tool-guide").waitFor({ state: "visible" });
      await guide.click();
      await page.locator("#blueprint-tool-guide").waitFor({ state: "hidden" });
      const target = nodes.filter({ hasText: "Quản trị Ứng dụng" });
      assert.equal(await target.count(), 1);
      await target.focus();
      await page.keyboard.press("Enter");
      await detail.getByText("Fixture application-management", { exact: true }).waitFor();
      assert.equal(await target.getAttribute("aria-pressed"), "true");
      assert.equal(await chosen.count(), 1);
      assert.equal(await page.locator("#neural-selected-readback li").count(), 4);
      assert.match(await page.locator("#neural-selected-readback").innerText(), /Application-Management/);
      const inspector = page.locator("#neural-selected-readback");
      const edge = inspector.getByRole("button", { name: "Dự án → repository", exact: true });
      await edge.click();
      assert.equal(await edge.getAttribute("aria-pressed"), "true");
      assert.equal(await graph.locator('path[data-inspected="true"]').count(), 1);
      const edgeDetail = page.locator("#neural-edge-detail");
      assert.match(await edgeDetail.innerText(), /Quản trị Ứng dụng/);
      assert.match(await edgeDetail.innerText(), /BlueDragon33\/Application-Management/);
      assert.match(await edgeDetail.innerText(), /project-registry\.ts/);
      const hubNode = nodes.filter({ hasText: "Software Blueprint Hub" });
      await hubNode.click();
      await detail.getByText("Fixture software-blueprint-hub", { exact: true }).waitFor();
      assert.equal(await graph.locator('path[data-inspected="true"]').count(), 0);
      assert.doesNotMatch(await edgeDetail.innerText(), /BlueDragon33\/Application-Management/);
      await target.click();
      await detail.getByText("Fixture application-management", { exact: true }).waitFor();
      pass("Blueprint Compass " + width + "px: semantic edge inspector shows exact registry endpoints and isolates project selection", { githubFixture: true });
      const locate = page.getByRole("button", { name: /Đến node dự án/ });
      await locate.click();
      await target.and(page.locator(":focus")).waitFor();
      const viewport = await graph.evaluate(element => {
        const node = element.querySelector('button[aria-pressed="true"]');
        return { left: element.scrollLeft, max: Math.max(0, element.scrollWidth - element.clientWidth),
          expected: Math.max(0, Math.min(element.scrollWidth - element.clientWidth,
            node.offsetLeft + node.offsetWidth / 2 - element.clientWidth / 2)),
          documentWidth: document.documentElement.scrollWidth, viewportWidth: document.documentElement.clientWidth };
      });
      assert.ok(Math.abs(viewport.left - viewport.expected) <= 2, JSON.stringify(viewport));
      assert.ok(viewport.documentWidth <= viewport.viewportWidth + 1, JSON.stringify(viewport));
      await screenshot(page, "compass-" + width + "-selected");
      const zoomIn = page.getByRole("button", { name: "Phóng to mạng", exact: true });
      const zoomOut = page.getByRole("button", { name: "Thu nhỏ mạng", exact: true });
      const reset = page.getByRole("button", { name: "Khôi phục tỷ lệ mạng", exact: true });
      for (const [control, percent] of [[zoomIn, "125%"], [zoomIn, "150%"], [reset, "100%"], [zoomOut, "75%"]]) {
        await control.click();
        assert.equal((await reset.innerText()).trim(), percent);
        await locate.click();
        await target.and(page.locator(":focus")).waitFor();
        assert.equal(await chosen.count(), 1);
        const geometry = await graph.evaluate(element => {
          const n = element.querySelector('button[aria-pressed="true"]');
          const rect = n.getBoundingClientRect(), frame = element.getBoundingClientRect();
          const x = rect.left + rect.width / 2 - frame.left - element.clientLeft + element.scrollLeft;
          const y = rect.top + rect.height / 2 - frame.top - element.clientTop + element.scrollTop;
          const clamp = (v, max) => Math.max(0, Math.min(v, Math.max(0,max)));
          return { dx: Math.abs(element.scrollLeft - clamp(x-element.clientWidth/2, element.scrollWidth-element.clientWidth)),
            dy: Math.abs(element.scrollTop - clamp(y-element.clientHeight/2, element.scrollHeight-element.clientHeight)),
            doc: document.documentElement.scrollWidth, view: document.documentElement.clientWidth };
        });
        assert.ok(geometry.dx <= 3 && geometry.dy <= 3 && geometry.doc <= geometry.view + 1, JSON.stringify(geometry));
      }
      assert.ok(await zoomOut.isDisabled());
      await reset.click();
      assert.equal((await reset.innerText()).trim(), "100%");
      pass("Blueprint Compass " + width + "px: bounded zoom and two-axis locator keep selected node and page containment", { githubFixture: true });
      pass("Blueprint Compass " + width + "px: real graph selection, four source edges, keyboard and locator, guide, bounded page", { githubFixture: true });
      const productDirection = detail.getByRole("button", { name: "Hoàn thiện sản phẩm", exact: true });
      await productDirection.click();
      assert.equal(await productDirection.getAttribute("aria-pressed"), "true");
      const handoff = detail.locator("#compass-direction-prompt");
      const prompt = await handoff.inputValue();
      assert.match(prompt, /FINISH_PRODUCT/);
      assert.match(prompt, /Observed default HEAD: b{40}/);
      assert.match(prompt, /not ACTIVE law/);
      assert.match(prompt, /no automatic publish\/merge/);
      assert.match(prompt, /xin quyền merge riêng/);
      await detail.getByRole("button", { name: "Chọn nội dung để sao chép" }).click();
      assert.ok(await handoff.evaluate(node => document.activeElement === node && node.selectionStart === 0 && node.selectionEnd === node.value.length));
      pass("Blueprint Compass " + width + "px: FINISH_PRODUCT proposed direction produces scoped read-only handoff, no release authority", { githubFixture: true });
      failReads = true;
      await detail.getByRole("button", { name: /Đọc lại GitHub/ }).click();
      await detail.getByRole("alert").waitFor();
      assert.doesNotMatch(await detail.innerText(), /Fixture application-management/);
      assert.match(await detail.innerText(), /UNVERIFIED/);
      assert.equal(await detail.locator("#compass-direction-prompt").count(), 0);
      assert.deepEqual(errors, []);
      pass("Blueprint Compass " + width + "px: failed refresh clears stale evidence and remains UNVERIFIED", { githubFixture: true });
    } catch (error) {
      await screenshot(page, "compass-" + width + "-failure").catch(() => {});
      const overlay = await page.locator("#__vinext_dev_error_overlay_root").innerText({ timeout: 1500 }).catch(() => "");
      if (overlay) console.error("Compass dev overlay:", overlay);
      if (errors.length) console.error("Compass captured errors:", JSON.stringify(errors));
      throw error;
    } finally {
      await context.close();
    }
  }
}

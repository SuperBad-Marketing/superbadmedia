# Web App Testing Skill

Source: https://github.com/anthropics/skills/tree/main/skills/webapp-testing

Use this skill when testing superbad-hq's UI, user flows, or dynamic page behaviour using Playwright.

## Decision framework

**Is the content static HTML?**
→ Read the file directly. No browser needed.

**Is the content dynamic (Next.js, React, data fetching)?**
→ Ensure the dev server is running first (`npm run dev`), then use Playwright.

## Core approach — Reconnaissance before action

Never try to interact with a page before you understand it. Always:

1. Take a screenshot to see the current state
2. Inspect the rendered DOM to find reliable selectors
3. Identify the target elements
4. Execute the interaction
5. Verify the outcome

## Critical rule for dynamic content

**Always wait for JS to finish executing before inspecting the DOM.**

```python
page.wait_for_load_state('networkidle')
```

Skipping this step causes false negatives on dynamic pages — elements exist in the DOM but haven't rendered yet.

## Writing Playwright tests

Use Python with `sync_playwright()`. Prefer descriptive, stable selectors in this order:
1. `role=` selectors (most resilient to styling changes)
2. `text=` selectors for visible content
3. `data-testid=` attributes (add these to components when needed)
4. CSS selectors as a last resort

## Selector examples

```python
# Prefer role-based
page.get_by_role("button", name="Submit").click()

# Text content
page.get_by_text("Sign in").click()

# Test ID (add data-testid to component if needed)
page.get_by_test_id("dashboard-card").is_visible()
```

## Test structure

```python
from playwright.sync_api import sync_playwright

def test_feature():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:3000/your-route")
        page.wait_for_load_state('networkidle')

        # Screenshot for reconnaissance
        page.screenshot(path="debug.png")

        # Assertions
        assert page.get_by_role("heading", name="Expected Title").is_visible()

        browser.close()
```

## When adding testability to components

If a reliable selector doesn't exist, add one to the component rather than using fragile CSS paths:

```tsx
<div data-testid="client-card">...</div>
```

Keep `data-testid` attributes stable — don't tie them to content that changes.

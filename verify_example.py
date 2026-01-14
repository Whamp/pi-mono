from playwright.sync_api import sync_playwright

def verify_example(page):
    page.on("console", lambda msg: print(f"Console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Page Error: {err}"))
    try:
        page.goto("http://localhost:5173")
        page.wait_for_selector("text=Pi Web UI Example", timeout=5000)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        page.screenshot(path="example.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_example(page)
        finally:
            browser.close()

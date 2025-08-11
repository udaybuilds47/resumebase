import { chromium, Page } from "playwright";

let _page: Page | null = null;

// 👈 Launch a completely separate browser instance for the agent
export async function launchAgentBrowser(): Promise<{ browser: any, context: any, page: Page }> {
  console.log("Launching separate browser instance for agent...");
  
  // Launch a new browser instance (not connected to Electron)
  const browser = await chromium.launch({
    headless: false, // Show the browser window
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });
  
  // Create a new context with strict constraints
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 }, // Fixed size
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    permissions: [], // No permissions
    extraHTTPHeaders: {},
    bypassCSP: false,
    ignoreHTTPSErrors: false
  });
  
  const page = await context.newPage();
  
  // Set strict viewport constraints
  await page.setViewportSize({ width: 800, height: 600 });
  
  // Disable fullscreen and other problematic features
  await page.evaluate(() => {
    // Disable fullscreen API
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen = () => Promise.reject('Fullscreen disabled');
    }
    
    // Prevent window resize
    window.addEventListener('resize', (e) => e.preventDefault());
    
    // Set strict CSS constraints
    const style = document.createElement('style');
    style.textContent = `
      html, body {
        width: 800px !important;
        height: 600px !important;
        max-width: 800px !important;
        max-height: 600px !important;
        overflow: hidden !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
      }
    `;
    document.head.appendChild(style);
  });
  
  console.log("Launched separate agent browser instance");
  return { browser, context, page };
}

// 👈 Keep the old function for reference but it won't be used
export async function getElectronPage(): Promise<Page> {
  if (_page && !_page.isClosed()) return _page;
  
  console.log("Connecting to Electron via CDP...");
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const [context] = browser.contexts();
  
  // Get all available pages
  const pages = context.pages();
  console.log(`Found ${pages.length} pages:`, pages.map(p => p.url()));
  
  // Look for the webview page specifically
  let targetPage = pages.find(page => {
    const url = page.url();
    // Look for pages that are not the main Electron window
    return url && !url.includes('localhost:3000') && !url.includes('file://');
  });
  
  if (!targetPage) {
    // If no webview page found, create a new one
    console.log("No webview page found, creating new page...");
    targetPage = await context.newPage();
  } else {
    console.log("Found webview page:", targetPage.url());
  }
  
  _page = targetPage;
  return _page;
}

// 👈 Simplified function that works with existing CDP connections
export async function getWebviewPage(): Promise<Page> {
  console.log("Getting webview page...");
  
  try {
    if (_page && !_page.isClosed()) {
      // Check if current page is the right one
      const url = _page.url();
      if (url && !url.includes('localhost:3000') && !url.includes('file://')) {
        console.log("Reusing existing webview page:", url);
        return _page;
      }
    }
    
    // Force new connection to get fresh page
    _page = null;
    return getElectronPage();
  } catch (error) {
    console.error("Error getting webview page:", error);
    throw new Error(`Failed to get webview page: ${error.message}`);
  }
}

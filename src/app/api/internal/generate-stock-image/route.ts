import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { cookies } from 'next/headers';
import puppeteer from 'puppeteer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Set Vercel/Next timeout to 60s if needed

export async function GET(req: Request) {
  let browser = null;
  try {
    const session = await getSession();
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie) {
      return new NextResponse('No session cookie', { status: 401 });
    }

    // Launch puppeteer
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors'],
      headless: true
    });
    
    const page = await browser.newPage();
    await page.setViewport({ 
      width: 1400, 
      height: 900,
      deviceScaleFactor: 3 // High resolution (3x density) for sharp text
    });

    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    // Inject cookie
    await page.setCookie({
      name: 'session',
      value: sessionCookie.value,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:'
    });

    // Navigate to current-stock
    await page.goto(`${baseUrl}/staff/dashboard/operations/current-stock`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for the pivot container to be fully rendered
    await page.waitForSelector('.pivot-scroll-container', { timeout: 10000 });

    // Inject styles to un-constrain the table so it can be screenshot fully
    await page.evaluate(() => {
      // Find the first pivot table container (Solar Panel Stock Brand + Wattage is the first one)
      const container = document.querySelector('.pivot-scroll-container')?.parentElement as HTMLElement | null;
      if (!container) return;
      
      const scrollContainer = container.querySelector('.pivot-scroll-container') as HTMLElement | null;
      if (!scrollContainer) return;
      
      // Override dimensions
      container.style.setProperty('width', 'max-content', 'important');
      container.style.setProperty('max-width', 'none', 'important');
      
      scrollContainer.style.setProperty('overflow', 'visible', 'important');
      scrollContainer.style.setProperty('max-height', 'none', 'important');
      scrollContainer.style.setProperty('height', 'auto', 'important');
      scrollContainer.style.setProperty('max-width', 'none', 'important');

      // Disable sticky headers so they don't overlap weirdly in a full page screenshot
      const stickyElements = container.querySelectorAll('th, td, thead, tr');
      stickyElements.forEach((el) => {
        const currentStyle = el.getAttribute('style');
        if (currentStyle && currentStyle.includes('sticky')) {
          (el as HTMLElement).style.setProperty('position', 'static', 'important');
        }
      });
    });

    // Actually we want the parent container of the scroll container to include the title, just like original
    const containerHandle = await page.evaluateHandle(() => {
        return document.querySelector('.pivot-scroll-container')?.parentElement;
    });

    const imageBuffer = await (containerHandle.asElement()!).screenshot({
      type: 'png' // Lossless PNG for crisp text
    });

    await browser.close();

    return new Response(imageBuffer as any, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, max-age=0'
      }
    });

  } catch (error) {
    console.error('[Generate Stock Image Error]', error);
    if (browser) await browser.close();
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

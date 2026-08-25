import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import puppeteer from 'puppeteer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel timeout

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Determine localhost base URL
    const baseUrl = process.env.STOCK_EXPORT_BASE_URL || 'http://localhost:3000';
    const targetUrl = `${baseUrl}/export/solar-panel-stock`;
    
    // We need to pass auth to puppeteer. 
    // The app uses cookies for session. Let's get the cookie from the request and pass it.
    const cookieHeader = req.headers.get('cookie') || '';

    const browser = await puppeteer.launch({
      headless: true, // or 'new'
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();

    // Set cookies so puppeteer can authenticate
    const cookies = cookieHeader.split(';').map(c => {
      const [name, ...rest] = c.trim().split('=');
      return {
        name,
        value: rest.join('='),
        domain: 'localhost',
        path: '/'
      };
    }).filter(c => c.name);
    
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
    }

    // A4 landscape dimensions (approx 11.69 x 8.27 inches)
    await page.setViewport({ width: 1122, height: 794, deviceScaleFactor: 2 });

    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '15px', right: '15px', bottom: '15px', left: '15px' }
    });

    await browser.close();

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Solar-Panel-Stock-Report.pdf"',
      }
    });

  } catch (error: any) {
    console.error('PDF generation error:', error);
    return new NextResponse(`PDF generation failed: ${error.message}`, { status: 500 });
  }
}

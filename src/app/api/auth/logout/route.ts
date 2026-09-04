import { logout } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function POST(request: Request) {
  await logout();
  
  let callbackUrl = '/staff';
  try {
    const formData = await request.formData();
    const returnUrl = formData.get('callbackUrl');
    if (returnUrl && typeof returnUrl === 'string' && returnUrl.startsWith('/')) {
      callbackUrl = returnUrl;
    }
  } catch (e) {
    // ignore
  }

  redirect(callbackUrl);
}

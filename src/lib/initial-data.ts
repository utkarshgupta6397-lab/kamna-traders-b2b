import { prisma } from './db';

/**
 * Ensures environment-specific dummy users exist.
 * - Local: Admin (8744832318/000000) and Staff (1234567890/000000)
 * - Production: Admin (8744832318/Secure PIN)
 * 
 * Idempotent: Does not override existing real users.
 */
export async function ensureInitialUsers() {
  const isProd = process.env.NODE_ENV === 'production';
  const adminMobile = '8744832318';
  const dummyStaffMobile = '1234567890';

  try {
    // 1. Setup Admin (All Environments)
    const prodPin = process.env.ADMIN_PIN;
    const pin = isProd ? prodPin : '000000';

    if (isProd && !prodPin) {
      console.warn('⚠️ [Setup] ADMIN_PIN environment variable is missing. Master Admin will not have a PIN until first login.');
    }

    await prisma.user.upsert({
      where: { mobile: adminMobile },
      update: {
        role: 'ADMIN',
        ...(isProd ? {} : { pin: '000000' }) 
      },
      create: {
        name: 'Master Admin',
        mobile: adminMobile,
        role: 'ADMIN',
        pin: pin || null,
        active: true,
      }
    });
    console.log(`✅ [Setup] Master Admin ensured: ${adminMobile}`);

    // 2. Setup Dummy Staff (Local/Dev Only)
    if (!isProd) {
      await prisma.user.upsert({
        where: { mobile: dummyStaffMobile },
        update: {
          role: 'STAFF',
          pin: '000000'
        },
        create: {
          name: 'Dummy Staff',
          mobile: dummyStaffMobile,
          role: 'STAFF',
          pin: '000000',
          active: true,
        }
      });
      console.log(`✅ [Setup] Dummy Staff ensured: ${dummyStaffMobile}`);
    }
  } catch (error) {
    console.error('❌ [Setup] Failed to ensure initial users:', error);
  }
}

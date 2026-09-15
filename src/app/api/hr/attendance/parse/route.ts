import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { parseAttendanceWorkbook, getEligibleEmployeesList } from '@/lib/services/hr/attendance-parser.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session || (session.role !== 'ADMIN' && !session.hr_attendance_processor)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Attendance Processor permission required.' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded.' }, { status: 400 });
    }

    // 1. Enforce file size limit (5 MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: 'File is too large. Please upload an Excel file up to 5 MB.',
          validationErrors: ['File is too large. Please upload an Excel file up to 5 MB.'],
        },
        { status: 400 }
      );
    }

    // 2. Enforce .xlsx extension strictly
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.xlsx') && file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file type. Only .xlsx files are supported.',
          validationErrors: ['Only .xlsx Excel files are supported.'],
        },
        { status: 400 }
      );
    }

    // Convert to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse workbook (automatically excludes inactive employees)
    const parseResult = parseAttendanceWorkbook(buffer);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: parseResult.errors.join('\n'),
          validationErrors: parseResult.errors,
          stats: parseResult.stats,
        },
        { status: 422 }
      );
    }

    if (parseResult.sheets.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No active attendance records found to process.',
          validationErrors: ['No active attendance records found in the uploaded workbook.'],
          stats: parseResult.stats,
        },
        { status: 422 }
      );
    }

    const employees = getEligibleEmployeesList(parseResult.sheets);

    return NextResponse.json({
      success: true,
      stats: parseResult.stats,
      employees,
    });
  } catch (error: any) {
    console.error('[AttendanceParseAPI] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to parse attendance file: ' + (error.message || 'Internal error'),
      },
      { status: 500 }
    );
  }
}

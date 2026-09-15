import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { parseAttendanceWorkbook } from '@/lib/services/hr/attendance-parser.service';
import { generateAttendancePDF } from '@/lib/services/hr/attendance-pdf.service';

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
    const selectedEmployeeIdsRaw = formData.get('selectedEmployeeIds');

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded.' }, { status: 400 });
    }

    // 1. Enforce 5 MB limit
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

    // Parse selectedEmployeeIds if provided
    let selectedEmployeeIds: string[] | undefined = undefined;
    if (typeof selectedEmployeeIdsRaw === 'string' && selectedEmployeeIdsRaw.trim()) {
      try {
        const parsed = JSON.parse(selectedEmployeeIdsRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          selectedEmployeeIds = parsed;
        }
      } catch (e) {
        // Not valid JSON array
      }
    }

    // Convert Web File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Workbook with selectedEmployeeIds option (automatically excludes inactive employees)
    const parseResult = parseAttendanceWorkbook(buffer, { selectedEmployeeIds });

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
          error: 'No attendance records found for the selected employees.',
          validationErrors: ['No attendance records found for the selected employees.'],
          stats: parseResult.stats,
        },
        { status: 422 }
      );
    }

    // Generate A4 Landscape PDF for selected employees
    const pdfBuffer = generateAttendancePDF(parseResult.sheets);
    const pdfBase64 = pdfBuffer.toString('base64');

    const cleanBaseName = file.name.replace(/\.xlsx$/i, '');
    const outputFileName = `${cleanBaseName}_statement.pdf`;

    return NextResponse.json({
      success: true,
      stats: parseResult.stats,
      fileName: outputFileName,
      pdfBase64,
    });
  } catch (error: any) {
    console.error('[AttendanceProcessorAPI] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process attendance file: ' + (error.message || 'Internal error'),
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getApprovedOrderStatuses, resolveWorkflowState } from '@/lib/solar-workflow-config';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = session.role === 'ADMIN';
    const isStaff = session.role === 'STAFF';
    const canViewDocQueue = isAdmin || isStaff || !!session.solar_documentation_view;

    if (!canViewDocQueue) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 1. Fetch Approved Orders
    const approvedStatuses = getApprovedOrderStatuses();
    const orders = await prisma.solarOrder.findMany({
      where: {
        status: { in: approvedStatuses }
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        orderDate: true,
        leadSource: true,
        referralName: true,
        zohoBooksCustomerId: true,
        totalOrderAmount: true,
        pendingAmount: true,
        salesman: { select: { name: true } },
        callingExecutive: { select: { name: true } },
        subVendor: { select: { name: true } },
        workflowSteps: {
          where: { workflowType: 'DOCUMENTATION' },
          select: {
            stepKey: true,
            status: true,
            updatedAt: true,
            startedAt: true,
            completedAt: true
          },
          orderBy: { stepIndex: 'asc' }
        }
      },
      orderBy: [
        { orderDate: 'asc' },
        { orderNumber: 'asc' }
      ]
    });

    // 2. Filter Eligible Orders
    const eligibleOrders = orders.filter(order => {
      const state = resolveWorkflowState(order.workflowSteps, 'DOCUMENTATION');
      return state.currentStage === 'Authority Signature Pending';
    });

    if (eligibleOrders.length === 0) {
      return NextResponse.json({ error: 'No orders are currently eligible for Authority Signature.' }, { status: 400 });
    }

    // 3. Prepare Logo (Server-side conversion SVG to PNG)
    let base64Logo = '';
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.svg');
      const svgBuffer = fs.readFileSync(logoPath);
      // Convert to PNG via sharp to ensure jsPDF can embed it server-side
      const pngBuffer = await sharp(svgBuffer).resize({ width: 300 }).png().toBuffer();
      base64Logo = pngBuffer.toString('base64');
    } catch (err) {
      console.warn('Could not load or convert logo for PDF', err);
    }

    // 4. Generate PDF
    // Using landscape because 10 columns in portrait is too squeezed, but I'll stick to portrait 
    // and rely on autotable to distribute the 120 "weights" smoothly if requested.
    // Actually, A4 landscape is much better for a 10-column spreadsheet-like PDF. 
    // I will use landscape to guarantee it looks "clean and professional" as requested.
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    
    // Calculate Metadata
    const printedByText = `Printed By: ${session.name || 'Staff'}`;
    const printedOnText = `Printed On: ${new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })}`;
    const batchSizeText = `Batch Size: ${eligibleOrders.length} Orders`;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Table Data
    const tableHeaders = [
      '#',
      'Customer Name',
      'City',
      'Order ID',
      'Order Date',
      'Lead Source',
      'Lead Remarks',
      'Salesman',
      'Total Amount',
      'Pending Payment',
      'Approval Signature'
    ];

    const tableRows = eligibleOrders.map((o, i) => {
      // Pending Payment Logic
      const isLinked = !!o.zohoBooksCustomerId;
      const actualPendingAmount = isLinked ? o.pendingAmount : o.totalOrderAmount;
      const pendingStr = `Rs. ${actualPendingAmount.toLocaleString('en-IN')}`;
      const totalAmountStr = `Rs. ${o.totalOrderAmount.toLocaleString('en-IN')}`;

      // Source / Remarks Logic
      let remarks = o.referralName || '—';
      if (o.leadSource === 'CALLING_ACTIVITY') remarks = o.callingExecutive?.name || '—';
      else if (o.leadSource === 'SUB_VENDOR') remarks = o.subVendor?.name || '—';

      const sourceStr = o.leadSource.replace(/_/g, ' ');

      // Assigned Logic
      let assigned = '—';
      if (o.salesman?.name) assigned = o.salesman.name;
      else if (o.callingExecutive?.name) assigned = o.callingExecutive.name;
      else if (o.subVendor?.name) assigned = o.subVendor.name;

      const dateStr = new Date(o.orderDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

      // No City field exists on SolarOrder, defaulting to '—'
      const cityStr = '—';

      return [
        (i + 1).toString(),
        o.customerName,
        cityStr,
        o.orderNumber,
        dateStr,
        sourceStr,
        remarks,
        assigned,
        totalAmountStr,
        pendingStr,
        '' // Blank for signature
      ];
    });

    const drawHeader = (data: any) => {
      // Draw Header for every page
      const logoH = 12;
      const logoW = logoH * (599 / 579); // Approximate logo aspect ratio
      
      if (base64Logo) {
        doc.addImage(base64Logo, 'PNG', 14, 10, logoW, logoH);
      }

      // Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(26, 39, 102); // #1A2766
      doc.text('AUTHORITY SIGNATURE APPROVAL SHEET', 14 + logoW + 4, 16);
      
      // Subtitle
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Internal Approval Required Before Proprietor Signature', 14 + logoW + 4, 21);

      // Metadata (Right side)
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 50);
      
      doc.text(printedByText, pageWidth - 14, 12, { align: 'right' });
      doc.text(printedOnText, pageWidth - 14, 17, { align: 'right' });
      doc.text(batchSizeText, pageWidth - 14, 22, { align: 'right' });

      // Divider line
      doc.setDrawColor(226, 232, 240); // text-slate-200
      doc.setLineWidth(0.3);
      doc.line(14, 26, pageWidth - 14, 26);
    };

    // Calculate Column Widths based on requested proportions (out of 120 total parts)
    // 18+8+10+9+10+14+12+10+10+19 = 120 parts. We have an extra "#" column, let's give it 4 parts. 
    // Total parts = 124.
    const totalParts = 124;
    const usableWidth = pageWidth - 28; // 14mm margins
    const getW = (parts: number) => (parts / totalParts) * usableWidth;

    autoTable(doc, {
      startY: 30,
      head: [tableHeaders],
      body: tableRows,
      theme: 'grid',
      styles: { 
        fontSize: 7.5, 
        cellPadding: 4, 
        valign: 'middle',
        lineColor: [226, 232, 240], // Thin slate border
        lineWidth: 0.1,
        font: 'helvetica'
      },
      headStyles: { 
        fillColor: [26, 39, 102], // Dark Blue
        textColor: 255,           // White Text
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] // Very light blue/gray for alternate rows
      },
      columnStyles: {
        0: { cellWidth: getW(4) },
        1: { cellWidth: getW(18) }, // Customer Name
        2: { cellWidth: getW(8) },  // City
        3: { cellWidth: getW(10) }, // Order ID
        4: { cellWidth: getW(9) },  // Date
        5: { cellWidth: getW(10) }, // Lead Source
        6: { cellWidth: getW(14) }, // Lead Remarks
        7: { cellWidth: getW(12) }, // Salesman
        8: { cellWidth: getW(10), halign: 'right' }, // Total Amount
        9: { cellWidth: getW(10), halign: 'right' }, // Pending Payment
        10: { cellWidth: getW(19) }  // Approval Signature (Extra width for hand signing)
      },
      didDrawPage: drawHeader,
      margin: { top: 30, left: 14, right: 14, bottom: 25 },
      showHead: 'everyPage'
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY || 30;
    
    // Add page break if footer won't fit
    if (finalY > (doc.internal.pageSize.getHeight() - 20)) {
      doc.addPage();
      drawHeader({});
    }

    const startY = (doc as any).lastAutoTable.finalY ? (doc as any).lastAutoTable.finalY + 10 : 40;

    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    
    const footerText = "This sheet confirms that the above files have been internally verified and approved to proceed for Proprietor Authority Signature.";
    doc.text(footerText, 14, startY);

    const pdfBuffer = doc.output('arraybuffer');

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Authority_Approval_Sheet.pdf"'
      }
    });

  } catch (error: any) {
    console.error('Error generating authority batch PDF:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate PDF' }, { status: 500 });
  }
}

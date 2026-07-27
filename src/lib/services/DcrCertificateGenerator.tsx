import { ImageResponse } from 'next/og';
import React from 'react';
import { format } from 'date-fns';

export interface GenerateCertificateParams {
  invoiceNumber: string;
  customerName: string;
  issueDate: Date;
  serials: string[];
}

export class DcrCertificateGenerator {
  /**
   * Generates a Real-time PNG for the DCR Certificate.
   * Returns an ImageResponse which can be converted to an ArrayBuffer.
   */
  static generate(params: GenerateCertificateParams): ImageResponse {
    const { invoiceNumber, customerName, issueDate, serials } = params;

    // Formatting serials for display - wrap automatically
    const maxSerialsPerColumn = 15;
    const columns = [];
    for (let i = 0; i < serials.length; i += maxSerialsPerColumn) {
      columns.push(serials.slice(i, i + maxSerialsPerColumn));
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            fontFamily: 'sans-serif',
            padding: '60px',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              borderBottom: '4px solid #1A2766',
              paddingBottom: '30px',
              marginBottom: '40px',
            }}
          >
            <h1
              style={{
                fontSize: '64px',
                fontWeight: 'bold',
                color: '#1A2766',
                margin: 0,
                letterSpacing: '-1px',
              }}
            >
              KAMNA TRADERS
            </h1>
            <h2
              style={{
                fontSize: '36px',
                color: '#4B5563',
                marginTop: '10px',
                marginBottom: 0,
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              DCR Certificate Issued
            </h2>
          </div>

          {/* Details Section */}
          <div
            style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'space-between',
              marginBottom: '40px',
              padding: '30px',
              backgroundColor: '#F3F4F6',
              borderRadius: '16px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '20px', color: '#6B7280', marginBottom: '8px' }}>
                Invoice Number
              </span>
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
                {invoiceNumber}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '20px', color: '#6B7280', marginBottom: '8px' }}>
                Customer
              </span>
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
                {customerName}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '20px', color: '#6B7280', marginBottom: '8px' }}>
                Issue Date
              </span>
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
                {format(issueDate, 'dd MMM yyyy')}
              </span>
            </div>
          </div>

          {/* Serials Section */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1 }}>
            <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1A2766', marginBottom: '20px' }}>
              Issued Serial Numbers
            </h3>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '20px',
                width: '100%',
              }}
            >
              {columns.map((col, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {col.map((serial, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '20px',
                        color: '#374151',
                        backgroundColor: '#E5E7EB',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                      }}
                    >
                      {serial}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '2px solid #E5E7EB',
              paddingTop: '30px',
              marginTop: '40px',
            }}
          >
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
              Total Serials Issued: {serials.length}
            </span>
            <span style={{ fontSize: '20px', color: '#6B7280', fontStyle: 'italic' }}>
              Thank you for choosing Kamna Traders.
            </span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 1200,
      }
    );
  }
}

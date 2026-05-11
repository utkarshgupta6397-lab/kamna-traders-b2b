/**
 * ESC/POS Command Renderer
 * Generates raw binary command streams for thermal printers.
 * Strictly adheres to standard ESC/POS protocol.
 */

const COMMANDS = {
  RESET: new Uint8Array([0x1b, 0x40]), // ESC @
  ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]), // ESC a 0
  ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]), // ESC a 1
  ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]), // ESC a 2
  BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]), // ESC E 1
  BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]), // ESC E 0
  DOUBLE_HEIGHT_ON: new Uint8Array([0x1b, 0x21, 0x10]), // ESC ! 16
  DOUBLE_WIDTH_ON: new Uint8Array([0x1b, 0x21, 0x20]), // ESC ! 32
  QUAD_SIZE_ON: new Uint8Array([0x1b, 0x21, 0x30]), // ESC ! 48
  TEXT_SIZE_NORMAL: new Uint8Array([0x1b, 0x21, 0x00]), // ESC ! 0
  ITALIC_ON: new Uint8Array([0x1b, 0x34]), // ESC 4
  ITALIC_OFF: new Uint8Array([0x1b, 0x35]), // ESC 5
  CUT_FULL: new Uint8Array([0x1d, 0x56, 0x00]), // GS V 0
  CUT_PARTIAL: new Uint8Array([0x1d, 0x56, 0x01]), // GS V 1
};

export class EscPosRenderer {
  private buffer: number[] = [];
  private encoder: TextEncoder;

  constructor() {
    this.encoder = new TextEncoder();
    this.reset();
  }

  public reset(): this {
    this.buffer.push(...Array.from(COMMANDS.RESET));
    return this;
  }

  public align(pos: 'left' | 'center' | 'right'): this {
    if (pos === 'left') this.buffer.push(...Array.from(COMMANDS.ALIGN_LEFT));
    if (pos === 'center') this.buffer.push(...Array.from(COMMANDS.ALIGN_CENTER));
    if (pos === 'right') this.buffer.push(...Array.from(COMMANDS.ALIGN_RIGHT));
    return this;
  }

  public bold(on: boolean = true): this {
    this.buffer.push(...Array.from(on ? COMMANDS.BOLD_ON : COMMANDS.BOLD_OFF));
    return this;
  }

  public italic(on: boolean = true): this {
    this.buffer.push(...Array.from(on ? COMMANDS.ITALIC_ON : COMMANDS.ITALIC_OFF));
    return this;
  }

  public size(type: 'normal' | 'double-height' | 'double-width' | 'quad'): this {
    if (type === 'normal') this.buffer.push(...Array.from(COMMANDS.TEXT_SIZE_NORMAL));
    if (type === 'double-height') this.buffer.push(...Array.from(COMMANDS.DOUBLE_HEIGHT_ON));
    if (type === 'double-width') this.buffer.push(...Array.from(COMMANDS.DOUBLE_WIDTH_ON));
    if (type === 'quad') this.buffer.push(...Array.from(COMMANDS.QUAD_SIZE_ON));
    return this;
  }

  public text(content: string): this {
    const encoded = this.encoder.encode(content);
    this.buffer.push(...Array.from(encoded));
    return this;
  }

  public line(content: string = ''): this {
    this.text(content + '\n');
    return this;
  }

  public feed(lines: number = 1): this {
    // ESC d n
    this.buffer.push(0x1b, 0x64, lines);
    return this;
  }

  public cut(): this {
    // Add a few feeds before cutting for better visibility
    this.feed(4);
    this.buffer.push(...Array.from(COMMANDS.CUT_PARTIAL));
    return this;
  }

  /**
   * Generates a QR Code using standard GS ( k commands.
   * Note: Implementation varies by printer raster capability.
   */
  public qr(data: string, size: number = 6): this {
    const content = this.encoder.encode(data);
    const n = content.length + 3;
    const pL = n % 256;
    const pH = Math.floor(n / 256);

    // 1. Store data in symbol storage area
    // GS ( k pL pH cn fn m n (dk)
    this.buffer.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
    this.buffer.push(...Array.from(content));

    // 2. Set QR code size
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size);

    // 3. Set error correction level (L=48, M=49, Q=50, H=51)
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 49);

    // 4. Print the symbol data
    this.buffer.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);

    return this;
  }

  public build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

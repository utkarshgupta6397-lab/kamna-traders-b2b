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

  private wrapText(text: string, width: number): string[] {
    const lines: string[] = [];
    let currentLine = '';
    const words = text.split(' ');

    for (const word of words) {
      if ((currentLine + word).length <= width) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
        while (currentLine.length > width) {
          lines.push(currentLine.substring(0, width));
          currentLine = currentLine.substring(width);
        }
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  public text(content: string): this {
    const encoded = this.encoder.encode(content);
    this.buffer.push(...Array.from(encoded));
    return this;
  }

  public line(content: string = ''): this {
    if (!content) {
      this.text('\n');
      return this;
    }
    const wrapped = this.wrapText(content, 46); // Safe buffer (reduced from 48)
    wrapped.forEach(l => this.text(l + '\n'));
    return this;
  }

  public feed(lines: number = 1): this {
    this.buffer.push(0x1b, 0x64, lines);
    return this;
  }

  public cut(): this {
    this.feed(4);
    this.buffer.push(...Array.from(COMMANDS.CUT_PARTIAL));
    return this;
  }

  public build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

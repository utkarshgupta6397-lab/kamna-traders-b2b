export class ProductAttributeValidationService {
  /**
   * Validates a single attribute value against its configuration.
   * Returns an error message string if invalid, or null if valid.
   */
  static validateAttributeValue(value: string | undefined | null, attrConfig: any): string | null {
    const val = value !== undefined && value !== null ? String(value).trim() : '';

    // 1. Mandatory Check
    if (attrConfig.mandatory && !val) {
      return `This field is mandatory.`;
    }

    // If it's not mandatory and empty, it's valid
    if (!val) {
      return null;
    }

    // 2. Data Type specific validation
    switch (attrConfig.dataType) {
      case 'Number': {
        const num = Number(val);
        if (isNaN(num) || !Number.isInteger(num)) {
          return `Please enter a valid whole number.`;
        }
        if (attrConfig.minValue !== null && attrConfig.minValue !== undefined && num < attrConfig.minValue) {
          return `Minimum value is ${attrConfig.minValue}${attrConfig.suffix ? ' ' + attrConfig.suffix : ''}.`;
        }
        if (attrConfig.maxValue !== null && attrConfig.maxValue !== undefined && num > attrConfig.maxValue) {
          return `Maximum value is ${attrConfig.maxValue}${attrConfig.suffix ? ' ' + attrConfig.suffix : ''}.`;
        }
        break;
      }
      
      case 'Decimal': {
        const num = Number(val);
        if (isNaN(num)) {
          return `Please enter a valid decimal number.`;
        }
        if (attrConfig.minValue !== null && attrConfig.minValue !== undefined && num < attrConfig.minValue) {
          return `Minimum value is ${attrConfig.minValue}${attrConfig.suffix ? ' ' + attrConfig.suffix : ''}.`;
        }
        if (attrConfig.maxValue !== null && attrConfig.maxValue !== undefined && num > attrConfig.maxValue) {
          return `Maximum value is ${attrConfig.maxValue}${attrConfig.suffix ? ' ' + attrConfig.suffix : ''}.`;
        }
        break;
      }

      case 'Date': {
        const d = new Date(val);
        if (isNaN(d.getTime())) {
          return `Please enter a valid date.`;
        }
        break;
      }

      case 'Boolean': {
        if (val !== 'Yes' && val !== 'No' && val !== 'true' && val !== 'false') {
          return `Please select Yes or No.`;
        }
        break;
      }

      case 'Dropdown': {
        if (Array.isArray(attrConfig.options) && attrConfig.options.length > 0) {
          if (!attrConfig.options.includes(val)) {
            return `Value must be one of the configured options.`;
          }
        }
        break;
      }

      case 'Multi Select': {
        // Multi select is usually comma separated or JSON stringified array. 
        // For simplicity we check if the selected options exist in the config options.
        let values: string[] = [];
        try {
          values = JSON.parse(val);
        } catch {
          // if not JSON, assume comma separated
          values = val.split(',').map((s: string) => s.trim());
        }
        
        if (Array.isArray(attrConfig.options) && attrConfig.options.length > 0) {
          for (const v of values) {
            if (!attrConfig.options.includes(v)) {
              return `Selected option '${v}' is invalid.`;
            }
          }
        }
        break;
      }

      case 'Text':
      case 'Long Text':
      default:
        // Text is mostly valid as long as it exists (which we checked in mandatory)
        break;
    }

    return null;
  }
}

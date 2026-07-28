const fs = require('fs');

// Patch AsyncLookupField.tsx
let lookupContent = fs.readFileSync('src/app/staff/dashboard/catalog-pricing/products/_components/AsyncLookupField.tsx', 'utf8');

lookupContent = lookupContent.replace(
  `onChange: (val: string | undefined) => void;`,
  `onChange: (val: string | undefined, opt?: Option) => void;`
);

lookupContent = lookupContent.replace(
  `onClick={(e) => { e.stopPropagation(); onChange(undefined); }}`,
  `onClick={(e) => { e.stopPropagation(); onChange(undefined, undefined); }}`
);

lookupContent = lookupContent.replace(
  `onChange(opt.id);`,
  `onChange(opt.id, opt);`
);

fs.writeFileSync('src/app/staff/dashboard/catalog-pricing/products/_components/AsyncLookupField.tsx', lookupContent);

// Patch page.tsx
let pageContent = fs.readFileSync('src/app/staff/dashboard/catalog-pricing/products/create/page.tsx', 'utf8');

const oldHsnField = `                  <AsyncLookupField
                    label="HSN Code"
                    required
                    endpoint="/api/staff/catalog/hsn-codes"
                    value={formData.hsnCodeId}
                    onChange={val => {
                      updateForm('hsnCodeId', val || '');
                      setHsnHelper(null);
                    }}
                    displayValue={opt => {
                       if (opt && opt.code && formData.hsnCodeId === opt.id && (!hsnHelper || hsnHelper.cachedCode !== opt.code)) {
                         setLoadingHsnHelper(true);
                         fetch(\`/api/staff/catalog/hsn-helper?code=\${opt.code}\`)
                           .then(r => r.json())
                           .then(d => {
                             if (d.found) setHsnHelper({ ...d.data, cachedCode: opt.code });
                             else setHsnHelper({ notFound: true, cachedCode: opt.code });
                           })
                           .finally(() => setLoadingHsnHelper(false));
                       }
                       return hsnDisplay(opt);
                    }}
                    renderOption={opt => (
                      <span className="flex flex-col">
                        <span className="font-medium font-mono text-gray-800">{opt.code}</span>
                        {opt.name && opt.name !== opt.code && (
                          <span className="text-[11px] text-gray-400 truncate">{opt.name}</span>
                        )}
                      </span>
                    )}
                    clearable
                  />`;

const newHsnField = `                  <AsyncLookupField
                    label="HSN Code"
                    required
                    endpoint="/api/staff/catalog/hsn-codes"
                    value={formData.hsnCodeId}
                    onChange={(val, opt) => {
                      updateForm('hsnCodeId', val || '');
                      setHsnHelper(null);
                      
                      if (opt && opt.code) {
                        setLoadingHsnHelper(true);
                        fetch(\`/api/staff/catalog/hsn-helper?code=\${opt.code}\`)
                          .then(r => r.json())
                          .then(d => {
                            if (d.found) setHsnHelper({ ...d.data, cachedCode: opt.code });
                            else setHsnHelper({ notFound: true, cachedCode: opt.code });
                          })
                          .catch(() => setHsnHelper({ notFound: true, cachedCode: opt.code }))
                          .finally(() => setLoadingHsnHelper(false));
                      }
                    }}
                    displayValue={hsnDisplay}
                    renderOption={opt => (
                      <span className="flex flex-col">
                        <span className="font-medium font-mono text-gray-800">{opt.code}</span>
                        {opt.name && opt.name !== opt.code && (
                          <span className="text-[11px] text-gray-400 truncate">{opt.name}</span>
                        )}
                      </span>
                    )}
                    clearable
                  />`;

pageContent = pageContent.replace(oldHsnField, newHsnField);

fs.writeFileSync('src/app/staff/dashboard/catalog-pricing/products/create/page.tsx', pageContent);
console.log('done');

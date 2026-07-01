const fs = require('fs');
const path = 'src/app/staff/dashboard/solar-orders/components/SolarOrderForm.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add currentMode state
content = content.replace(
  'const [loading, setLoading] = useState(false);',
  'const [loading, setLoading] = useState(false);\n  const [currentMode, setCurrentMode] = useState(mode);'
);

// Replace mode === 'VIEW' with currentMode === 'VIEW' everywhere EXCEPT the footer and props.
// Let's just replace the specific declarations
content = content.replace(/mode === 'VIEW'/g, 'currentMode === "VIEW"');
content = content.replace(/mode === "VIEW"/g, 'currentMode === "VIEW"');

// Fix the footer, which specifically used mode === 'EDIT'
content = content.replace(/\{mode === 'EDIT' && \(/g, '{currentMode === "EDIT" && (');
// Fix the preview button for CREATE mode
content = content.replace(/\{mode === "CREATE" && \(/g, '{currentMode === "CREATE" && (');
content = content.replace(/if \(mode === 'CREATE'\)/g, 'if (currentMode === "CREATE")');
content = content.replace(/else if \(mode === 'EDIT'\)/g, 'else if (currentMode === "EDIT")');

// Inject the Header (for Edit Order toggle) right before <form>
const header = `
      {currentMode !== 'CREATE' && (
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            {currentMode === 'EDIT' && <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-md tracking-wider">EDIT MODE</span>}
          </div>
          {currentMode === 'VIEW' && canMasterEdit && (
            <button
              onClick={() => setCurrentMode('EDIT')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Edit Order
            </button>
          )}
        </div>
      )}
`;

content = content.replace(/<form onSubmit=\{handlePreview\}/g, header + '<form onSubmit={handlePreview}');

fs.writeFileSync(path, content);

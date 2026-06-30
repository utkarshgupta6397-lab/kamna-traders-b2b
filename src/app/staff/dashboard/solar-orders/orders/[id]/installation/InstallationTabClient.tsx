'use client';

import { useState } from 'react';
import { ArrowRight, Loader2, Check, Eye, EyeOff, CheckSquare, Square, Wifi } from 'lucide-react';
import toast from 'react-hot-toast';
import WorkflowEngine, { WorkflowStep } from '../components/WorkflowEngine';

export default function InstallationTabClient({ 
  orderId, 
  steps, 
  canEdit,
  debugInfo
}: { 
  orderId: string, 
  steps: WorkflowStep[],
  canEdit: boolean,
  debugInfo?: {
    orderStatus: string;
    hasPermission: boolean;
  }
}) {
  const [inverterNumber, setInverterNumber] = useState('');
  const [wiringCompleted, setWiringCompleted] = useState(false);
  const [inverterInstalled, setInverterInstalled] = useState(false);
  
  const [wifiUsername, setWifiUsername] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isChangingWifi, setIsChangingWifi] = useState(false);

  return (
    <WorkflowEngine
      orderId={orderId}
      steps={steps}
      theme="neon-blue"
      title="Installation Progress"
      reviewSteps={[]} 
      canProgress={canEdit}
      canApprove={false}
      renderStageAction={(selectedStep, updateStep, remarks, setRemarks, loadingStep) => {
        const stepName = selectedStep.metadata?.name || selectedStep.stepKey;

        if (stepName === 'Ready to Install') {
          const isExecution = debugInfo?.orderStatus === 'EXECUTION' || debugInfo?.orderStatus === 'INSTALLATION_IN_PROGRESS';
          const hasPermission = debugInfo?.hasPermission === true;
          const hasNotStarted = selectedStep.status === 'PENDING';
          const canStart = isExecution && hasPermission && hasNotStarted;

          return (
            <div className="p-6 md:p-8 w-full bg-slate-50 flex flex-col justify-center">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Installation Ready</h3>
                <p className="text-sm text-gray-500">
                  {isExecution ? 'You can now start the installation phase.' : 'The order must be in EXECUTION state to begin.'}
                </p>
              </div>

              <button
                onClick={() => {
                  if (window.confirm('Start Installation for this order?')) {
                    updateStep('COMPLETED', 'Installation Started');
                  }
                }}
                disabled={loadingStep === selectedStep.id || !canStart}
                className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${canStart ? 'bg-[#00C2FF] text-white hover:bg-[#0091C2] hover:shadow-lg' : 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300 shadow-none'}`}
                title={!isExecution ? 'Order must be in EXECUTION' : !hasPermission ? 'Missing workflow permission' : ''}
              >
                {loadingStep === selectedStep.id ? <Loader2 size={22} className="animate-spin" /> : (canStart && <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />)}
                Start Installation
              </button>
            </div>
          );
        }

        if (stepName === 'Installation Checklist') {
          return (
            <div className="p-6 md:p-8 w-full bg-slate-50 flex flex-col justify-center">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Installation Checklist</h3>
                <p className="text-sm text-gray-500">
                  Please confirm the following tasks are complete.
                </p>
              </div>

              {canEdit && (
                <div className="mb-6 space-y-6">
                  {/* Task 1 */}
                  <div 
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${wiringCompleted ? 'border-[#00C2FF] bg-[#00C2FF]/5' : 'border-gray-200 bg-white hover:border-[#00C2FF]/30'}`}
                    onClick={() => setWiringCompleted(!wiringCompleted)}
                  >
                    {wiringCompleted ? <CheckSquare size={24} className="text-[#00C2FF]" /> : <Square size={24} className="text-gray-300" />}
                    <div>
                      <h4 className={`font-bold ${wiringCompleted ? 'text-[#00C2FF]' : 'text-gray-700'}`}>Wiring Completed</h4>
                      <p className="text-xs text-gray-500">All electrical wiring has been finished safely.</p>
                    </div>
                  </div>

                  {/* Task 2 */}
                  <div className="space-y-4">
                    <div 
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${inverterInstalled ? 'border-[#00C2FF] bg-[#00C2FF]/5' : 'border-gray-200 bg-white hover:border-[#00C2FF]/30'}`}
                      onClick={() => {
                        setInverterInstalled(!inverterInstalled);
                        if (inverterInstalled) setInverterNumber('');
                      }}
                    >
                      {inverterInstalled ? <CheckSquare size={24} className="text-[#00C2FF]" /> : <Square size={24} className="text-gray-300" />}
                      <div>
                        <h4 className={`font-bold ${inverterInstalled ? 'text-[#00C2FF]' : 'text-gray-700'}`}>Inverter Installed</h4>
                        <p className="text-xs text-gray-500">Inverter is physically mounted and connected.</p>
                      </div>
                    </div>

                    {inverterInstalled && (
                      <div className="pl-14 pr-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          Inverter Serial Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Scan or enter inverter serial number"
                          value={inverterNumber}
                          onChange={(e) => setInverterNumber(e.target.value)}
                          className="w-full border-2 border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-4 focus:ring-[#00C2FF]/10 focus:border-[#00C2FF] transition-all bg-white font-mono uppercase shadow-sm"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <textarea
                      placeholder="Optional remarks..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/20 focus:border-[#00C2FF] transition-all resize-none shadow-sm bg-white"
                      rows={2}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  if (!wiringCompleted || !inverterInstalled) {
                    toast.error('Please complete all checklist items');
                    return;
                  }
                  if (!inverterNumber.trim()) {
                    toast.error('Inverter Serial Number is mandatory');
                    return;
                  }
                  updateStep('COMPLETED', remarks, { 
                    inverterNumber: inverterNumber.trim().toUpperCase(),
                    wiringCompleted,
                    inverterInstalled
                  });
                }}
                disabled={loadingStep === selectedStep.id || !canEdit || !wiringCompleted || !inverterInstalled || !inverterNumber.trim()}
                className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${
                  (canEdit && wiringCompleted && inverterInstalled && inverterNumber.trim()) 
                  ? 'bg-[#00C2FF] text-white hover:bg-[#0091C2] hover:shadow-lg' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'
                }`}
              >
                {loadingStep === selectedStep.id ? <Loader2 size={22} className="animate-spin" /> : <Check size={22} className="group-hover:scale-110 transition-transform" />}
                Complete Installation
              </button>
            </div>
          );
        }

        if (stepName === 'System WiFi Setup Done') {
          const hasSavedCreds = !!selectedStep.metadata?.wifiUsername;
          const showForm = !hasSavedCreds || isChangingWifi;

          return (
            <div className="p-6 md:p-8 w-full bg-slate-50 flex flex-col justify-center">
              <div className="mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#00C2FF]/10 flex items-center justify-center text-[#00C2FF]">
                  <Wifi size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">System WiFi Setup</h3>
                  <p className="text-sm text-gray-500">
                    Connect the inverter to the customer's WiFi and save the credentials.
                  </p>
                </div>
              </div>

              {!showForm ? (
                <div className="mb-6 p-5 border border-gray-200 bg-white rounded-xl shadow-sm space-y-4">
                   <div>
                     <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">WiFi Username</p>
                     <p className="font-medium text-gray-900">{selectedStep.metadata?.wifiUsername as string}</p>
                   </div>
                   <div>
                     <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">WiFi Password</p>
                     <p className="font-mono text-gray-900 tracking-widest">************</p>
                   </div>
                   {canEdit && (
                     <button 
                       onClick={() => setIsChangingWifi(true)}
                       className="text-sm font-bold text-[#00C2FF] hover:text-[#0091C2]"
                     >
                       Change Credentials
                     </button>
                   )}
                </div>
              ) : (
                canEdit && (
                  <div className="mb-6 space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        WiFi Username <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="SSID / Network Name"
                        value={wifiUsername}
                        onChange={(e) => setWifiUsername(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-4 focus:ring-[#00C2FF]/10 focus:border-[#00C2FF] transition-all bg-white shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        WiFi Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Password"
                          value={wifiPassword}
                          onChange={(e) => setWifiPassword(e.target.value)}
                          className="w-full border-2 border-gray-200 rounded-xl p-3 pr-12 text-sm focus:outline-none focus:ring-4 focus:ring-[#00C2FF]/10 focus:border-[#00C2FF] transition-all bg-white shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <textarea
                        placeholder="Optional remarks..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/20 focus:border-[#00C2FF] transition-all resize-none shadow-sm bg-white mt-2"
                        rows={2}
                      />
                    </div>
                  </div>
                )
              )}

              {(canEdit && showForm) && (
                <button
                  onClick={() => {
                    if (!wifiUsername.trim() || !wifiPassword.trim()) {
                      toast.error('Both Username and Password are required');
                      return;
                    }
                    updateStep('COMPLETED', remarks, { 
                      wifiUsername: wifiUsername.trim(),
                      wifiPassword: wifiPassword.trim()
                    });
                    setIsChangingWifi(false);
                  }}
                  disabled={loadingStep === selectedStep.id || !wifiUsername.trim() || !wifiPassword.trim()}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${
                    (wifiUsername.trim() && wifiPassword.trim()) 
                    ? 'bg-[#00C2FF] text-white hover:bg-[#0091C2] hover:shadow-lg' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'
                  }`}
                >
                  {loadingStep === selectedStep.id ? <Loader2 size={22} className="animate-spin" /> : <Check size={22} className="group-hover:scale-110 transition-transform" />}
                  Save Credentials & Complete
                </button>
              )}
            </div>
          );
        }

        if (stepName === 'Installation Completed') {
          return (
            <div className="p-6 md:p-8 w-full bg-slate-50 flex flex-col justify-center items-center text-center">
               <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                 <Check size={32} strokeWidth={3} />
               </div>
               <h3 className="text-2xl font-black text-gray-900 mb-2">Installation Completed</h3>
               <p className="text-gray-500 max-w-sm mb-6">
                 All physical installation, wiring, net metering, and system configurations are fully complete.
               </p>
               
               {selectedStep.status !== 'COMPLETED' ? (
                 <button
                   onClick={() => updateStep('COMPLETED', 'Final Installation Sign-off')}
                   disabled={loadingStep === selectedStep.id || !canEdit}
                   className={`w-full max-w-sm flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${canEdit ? 'bg-[#00C2FF] text-white hover:bg-[#0091C2] hover:shadow-lg' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'}`}
                 >
                   {loadingStep === selectedStep.id ? <Loader2 size={22} className="animate-spin" /> : (canEdit && <Check size={22} className="group-hover:scale-110 transition-transform" />)}
                   Sign Off Installation
                 </button>
               ) : (
                 <div className="w-full max-w-sm bg-white border border-gray-200 rounded-xl p-5 text-left shadow-sm">
                    <p className="text-sm font-medium text-gray-500 mb-1">Completed By</p>
                    <p className="font-bold text-gray-900 mb-4">{selectedStep.completedBy?.name || 'System User'}</p>
                    
                    <p className="text-sm font-medium text-gray-500 mb-1">Completed On</p>
                    <p className="font-bold text-gray-900">{selectedStep.completedAt ? new Date(selectedStep.completedAt).toLocaleString() : 'N/A'}</p>
                 </div>
               )}
            </div>
          );
        }

        // Generic stage handling (Physical Installation Completed, Net Metering Done, System Start Done)
        if (selectedStep.status === 'PENDING' || selectedStep.status === 'IN_PROGRESS') {
          return (
            <div className="p-6 md:p-8 w-full bg-slate-50 flex flex-col justify-center">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{stepName}</h3>
                <p className="text-sm text-gray-500">
                  Please confirm that this task is complete.
                </p>
              </div>

              {canEdit && (
                 <div className="mb-4">
                   <textarea
                     placeholder="Optional remarks before completing..."
                     value={remarks}
                     onChange={(e) => setRemarks(e.target.value)}
                     className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2FF]/20 focus:border-[#00C2FF] transition-all resize-none shadow-sm bg-white"
                     rows={2}
                   />
                 </div>
              )}

              <button
                onClick={() => updateStep('COMPLETED', remarks)}
                disabled={loadingStep === selectedStep.id || !canEdit}
                className={`w-full flex items-center justify-center gap-2 px-6 py-4 font-bold text-base rounded-xl transition-all shadow-md group ${canEdit ? 'bg-[#00C2FF] text-white hover:bg-[#0091C2] hover:shadow-lg' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'}`}
              >
                {loadingStep === selectedStep.id ? <Loader2 size={22} className="animate-spin" /> : (canEdit && <Check size={22} className="group-hover:scale-110 transition-transform" />)}
                Complete {stepName}
              </button>
            </div>
          );
        }

        return null;
      }}
    />
  );
}

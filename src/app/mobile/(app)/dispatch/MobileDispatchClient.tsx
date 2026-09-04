'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  RefreshCw,
  Camera,
  Truck,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Upload,
  Calendar,
  User,
  MapPin,
  Package,
  Layers,
  FileText,
  Clock,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { playTruckHornSound } from '@/lib/hooks/useAudioNotification';

interface EligibleOrder {
  id: string;
  zohoSalesorderId: string;
  salesorderNumber: string;
  customerName: string;
  total: number;
  currencyCode: string;
  orderDate: string;
  deliveryAddress: string;
  customerGst: string;
  salesPerson: string;
  itemCount: number;
  pendingQuantity: number;
  receivedAt: string;
}

interface TodayUpload {
  id: string;
  salesOrderId: string;
  salesOrderNumber: string;
  customerName: string;
  total: number;
  currencyCode: string;
  imageUrl: string;
  imageSizeBytes: number;
  imageMimeType: string;
  uploadedAt: string;
  uploadedByUserName: string;
}

function formatINR(val: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
}

function formatUploadTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

export default function MobileDispatchClient() {
  const [activeTab, setActiveTab] = useState<'upload' | 'today'>('upload');
  const [eligibleOrders, setEligibleOrders] = useState<EligibleOrder[]>([]);
  const [todayUploads, setTodayUploads] = useState<TodayUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Camera & Modal State
  const [selectedOrder, setSelectedOrder] = useState<EligibleOrder | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── 1. Data Fetching ───────────────────────────────────────────────────────

  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const [eligibleRes, todayRes] = await Promise.all([
        fetch('/api/mobile/dispatch/eligible-orders'),
        fetch('/api/mobile/dispatch/today'),
      ]);

      const [eligibleJson, todayJson] = await Promise.all([
        eligibleRes.json(),
        todayRes.json(),
      ]);

      if (eligibleRes.ok && eligibleJson.success) {
        setEligibleOrders(eligibleJson.data || []);
      }
      if (todayRes.ok && todayJson.success) {
        setTodayUploads(todayJson.data || []);
      }

      if (isManualRefresh) {
        toast.success('Dispatch orders updated');
      }
    } catch (err) {
      console.error('[Dispatch Fetch Error]', err);
      if (isManualRefresh) {
        toast.error('Failed to refresh dispatch orders');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── 2. Camera Controls ────────────────────────────────────────────────────

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCameraStream = useCallback(async () => {
    stopCameraStream();
    setCameraError(null);
    setCapturedBlob(null);
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
      setCapturedPreviewUrl(null);
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Live camera is not supported on this browser or connection.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error('[Camera Access Error]', err);
      let msg = 'Live camera access is required to capture truck photos.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission was denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera hardware found on this device.';
      }
      setCameraError(msg);
      setCameraActive(false);
    }
  }, [capturedPreviewUrl, stopCameraStream]);

  // Open modal
  const handleOpenCapture = (order: EligibleOrder) => {
    setSelectedOrder(order);
    startCameraStream();
  };

  // Close modal
  const handleCloseCapture = () => {
    stopCameraStream();
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
      setCapturedPreviewUrl(null);
    }
    setCapturedBlob(null);
    setCameraActive(false);
    setCameraError(null);
    setSelectedOrder(null);
    setSubmitting(false);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
      if (capturedPreviewUrl) {
        URL.revokeObjectURL(capturedPreviewUrl);
      }
    };
  }, [stopCameraStream, capturedPreviewUrl]);

  // ── 3. Image Capture & Compression ────────────────────────────────────────

  const captureFrame = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    let width = video.videoWidth || 1280;
    let height = video.videoHeight || 720;

    // Constrain longest edge to 1280px
    const MAX_EDGE = 1280;
    if (width > height) {
      if (width > MAX_EDGE) {
        height = Math.round((height * MAX_EDGE) / width);
        width = MAX_EDGE;
      }
    } else {
      if (height > MAX_EDGE) {
        width = Math.round((width * MAX_EDGE) / height);
        height = MAX_EDGE;
      }
    }

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    // Stop live stream once frame is captured
    stopCameraStream();
    setCameraActive(false);

    // Compress to JPEG blob
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error('Failed to process camera image');
          return;
        }

        setCapturedBlob(blob);
        const previewUrl = URL.createObjectURL(blob);
        setCapturedPreviewUrl(previewUrl);
      },
      'image/jpeg',
      0.8
    );
  };

  const handleRetake = () => {
    startCameraStream();
  };

  // ── 4. Submit Upload ──────────────────────────────────────────────────────

  const handleSubmitPhoto = async () => {
    if (!selectedOrder || !capturedBlob) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', capturedBlob, `truck_${selectedOrder.id}.jpg`);

      const res = await fetch(`/api/mobile/dispatch/${selectedOrder.id}/truck-image`, {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (res.status === 409) {
        toast.error('Truck image has already been uploaded for this Sales Order.');
        handleCloseCapture();
        fetchData();
        return;
      }

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to upload truck photo');
      }

      // Play soft truck horn on confirmed successful upload
      playTruckHornSound();

      toast.success('Truck photo submitted successfully!');
      handleCloseCapture();
      setActiveTab('today');
      fetchData();
    } catch (err: any) {
      console.error('[Upload Submit Error]', err);
      toast.error(err.message || 'Submission failed. Please try again.');
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col font-sans bg-[#F8F9FB] min-h-0">
      {/* Hidden canvas for snapshot compression */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between px-3 min-h-[56px] py-1">
          <Link
            href="/mobile"
            className="flex items-center gap-1 px-2 py-2 text-white active:opacity-60 transition-opacity"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[17px]">Dispatch</span>
          </Link>

          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white/90 disabled:opacity-50"
            title="Refresh Orders"
          >
            <RefreshCw size={19} className={refreshing ? 'animate-spin text-white' : ''} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-4 border-t border-white/10 bg-[#162154]">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-3 px-3 text-[13px] font-bold tracking-wide transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'text-white border-white'
                : 'text-white/60 border-transparent hover:text-white/80'
            }`}
          >
            <span>Upload Truck Number</span>
            {eligibleOrders.length > 0 && (
              <span className="text-[10px] bg-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded-full font-semibold">
                {eligibleOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('today')}
            className={`py-3 px-3 text-[13px] font-bold tracking-wide transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'today'
                ? 'text-white border-white'
                : 'text-white/60 border-transparent hover:text-white/80'
            }`}
          >
            <span>Today&apos;s Uploaded</span>
            {todayUploads.length > 0 && (
              <span className="text-[10px] bg-emerald-500/30 text-emerald-200 px-1.5 py-0.5 rounded-full font-semibold">
                {todayUploads.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 py-5 max-w-[430px] mx-auto w-full pb-20">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={36} className="animate-spin text-[#1A2766] mb-3" />
            <span className="text-sm font-semibold text-slate-600">Loading dispatch orders...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Section 1: Eligible Orders (Upload Tab) */}
            {activeTab === 'upload' && (
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-black text-slate-500 tracking-wider uppercase">
                      Active Orders (&gt; ₹50,000)
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {eligibleOrders.length}
                    </span>
                  </div>
                </div>

              {eligibleOrders.length === 0 ? (
                <div className="bg-white rounded-[20px] p-6 text-center border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="font-bold text-slate-800 text-[15px]">All Caught Up</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-[240px] mx-auto">
                    No active sales orders over ₹50,000 are currently awaiting truck number capture.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {eligibleOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white rounded-[20px] p-4 border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col gap-3"
                    >
                      {/* Top Header: SO + Value */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div>
                          <div className="font-extrabold text-[#1A2766] text-[16px] tracking-tight">
                            {order.salesorderNumber}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                            <Calendar size={12} />
                            <span>{order.orderDate}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-slate-900 text-[17px] tracking-tight">
                            {formatINR(order.total)}
                          </div>
                          <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 mt-0.5">
                            Active
                          </span>
                        </div>
                      </div>

                      {/* Customer Details */}
                      <div>
                        <div className="font-bold text-slate-800 text-[14px] leading-snug">
                          {order.customerName}
                        </div>
                        {order.customerGst && order.customerGst !== 'N/A' && (
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            GST: {order.customerGst}
                          </div>
                        )}
                      </div>

                      {/* Meta Grid */}
                      <div className="grid grid-cols-2 gap-2 text-[12px] bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                        <div className="flex items-start gap-1.5 text-slate-600">
                          <User size={14} className="text-slate-400 shrink-0 mt-0.5" />
                          <div className="truncate">
                            <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Salesperson</span>
                            <span className="font-semibold text-slate-700">{order.salesPerson}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-1.5 text-slate-600">
                          <Layers size={14} className="text-slate-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Items / Pending</span>
                            <span className="font-semibold text-slate-700">
                              {order.itemCount} items • {order.pendingQuantity} qty
                            </span>
                          </div>
                        </div>

                        {order.deliveryAddress && order.deliveryAddress !== 'N/A' && (
                          <div className="col-span-2 flex items-start gap-1.5 text-slate-600 pt-1 border-t border-slate-200/50">
                            <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                            <div className="text-[11px] text-slate-600 leading-tight line-clamp-2">
                              {order.deliveryAddress}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Button: Live Camera Only */}
                      <button
                        onClick={() => handleOpenCapture(order)}
                        className="w-full bg-[#1A2766] hover:bg-[#152053] active:scale-[0.98] text-white font-bold text-[14px] py-3 rounded-[14px] shadow-[0_4px_12px_rgba(26,39,102,0.15)] flex items-center justify-center gap-2 transition-all mt-1"
                      >
                        <Camera size={17} strokeWidth={2.5} />
                        <span>Capture Truck Number</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Section 2: Today's Uploaded (Today Tab) */}
            {activeTab === 'today' && (
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-black text-slate-500 tracking-wider uppercase">
                      Today&apos;s Uploaded (IST)
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {todayUploads.length}
                    </span>
                  </div>
                </div>

                {todayUploads.length === 0 ? (
                  <div className="bg-white rounded-[20px] p-6 text-center border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <Truck size={22} />
                    </div>
                    <h4 className="font-bold text-slate-800 text-[15px]">No Uploads Today</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-[240px] mx-auto">
                      No truck photos have been captured yet today (Asia/Kolkata timezone).
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayUploads.map((up) => (
                      <div
                        key={up.id}
                        className="bg-white rounded-[18px] p-3 border border-slate-200/70 shadow-sm flex items-center gap-3.5"
                      >
                        {/* Photo Thumbnail */}
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
                          <img
                            src={up.imageUrl}
                            alt={`Truck for ${up.salesOrderNumber}`}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <div className="font-extrabold text-[#1A2766] text-[14px] truncate">
                              {up.salesOrderNumber}
                            </div>
                            <div className="text-[11px] font-bold text-slate-800 shrink-0">
                              {formatINR(up.total)}
                            </div>
                          </div>

                          <div className="text-[12px] text-slate-700 font-medium truncate mt-0.5">
                            {up.customerName}
                          </div>

                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-1">
                            <span className="flex items-center gap-0.5">
                              <Clock size={11} />
                              {formatUploadTime(up.uploadedAt)}
                            </span>
                            <span>•</span>
                            <span className="truncate">by {up.uploadedByUserName}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Camera Capture Modal / Viewfinder ───────────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 h-[100dvh] w-full z-50 bg-black font-sans select-none overflow-hidden">
          {/* Camera Viewfinder / Preview Area (Full-screen background behind status bar & home bar) */}
          <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
            {cameraError ? (
              <div className="p-6 text-center max-w-[320px] text-white relative z-20">
                <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert size={32} />
                </div>
                <h4 className="font-bold text-lg mb-2">Camera Required</h4>
                <p className="text-sm text-white/70 leading-relaxed mb-6">
                  {cameraError}
                </p>
                <button
                  onClick={startCameraStream}
                  className="px-5 py-2.5 bg-white text-black font-bold rounded-xl text-sm"
                >
                  Try Again
                </button>
              </div>
            ) : capturedPreviewUrl ? (
              /* Static Preview Mode */
              <div className="w-full h-full flex items-center justify-center p-4">
                <img
                  src={capturedPreviewUrl}
                  alt="Truck preview"
                  className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl"
                />
              </div>
            ) : (
              /* Live Camera Viewfinder */
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Camera Overlay (Top controls, framing guide, bottom capture bar) */}
          <div className="absolute inset-0 z-10 flex flex-col justify-between pointer-events-none">
            {/* Top Bar / Controls (Positioned safely below status bar / Dynamic Island / notch) */}
            <div className="w-full pt-[max(16px,calc(env(safe-area-inset-top)+8px))] pb-4 px-4 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between text-white pointer-events-auto">
              <div className="min-w-0 pr-3">
                <div className="font-bold text-[16px] tracking-tight truncate drop-shadow-sm">
                  {selectedOrder.salesorderNumber}
                </div>
                <div className="text-xs text-white/80 truncate max-w-[260px] drop-shadow-sm">
                  {selectedOrder.customerName}
                </div>
              </div>
              <button
                onClick={handleCloseCapture}
                disabled={submitting}
                className="p-2.5 rounded-full bg-black/40 hover:bg-black/60 active:bg-white/30 text-white backdrop-blur-md transition-all shrink-0 border border-white/10"
                aria-label="Close Camera"
              >
                <X size={20} />
              </button>
            </div>

            {/* Target Framing Guide / Review Badge */}
            <div className="flex-1 flex items-center justify-center p-6 pointer-events-none">
              {capturedPreviewUrl ? (
                <div className="bg-black/60 px-4 py-1.5 rounded-full text-white text-xs font-semibold backdrop-blur-md border border-white/10 self-start mt-2">
                  Review Photo
                </div>
              ) : cameraActive && !cameraError ? (
                <div className="w-full max-w-[360px] aspect-[16/10] border-2 border-dashed border-white/75 rounded-2xl flex flex-col justify-between p-3.5 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]">
                  <div className="text-center text-white text-xs font-semibold bg-black/50 px-3 py-1 rounded-full self-center backdrop-blur-sm border border-white/15">
                    Center the truck number plate
                  </div>
                  <div className="flex justify-between items-end text-[11px] font-medium text-white/80">
                    <span className="bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm">Live View</span>
                    <span className="bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm">Rear Camera</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Bottom Action Bar (Positioned safely above home gesture indicator) */}
            <div className="w-full pt-4 pb-[max(20px,calc(env(safe-area-inset-bottom)+12px))] px-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-center text-white pointer-events-auto">
              {capturedPreviewUrl ? (
                /* Retake and Submit Controls */
                <div className="flex items-center justify-between w-full max-w-[360px] gap-4">
                  <button
                    onClick={handleRetake}
                    disabled={submitting}
                    className="flex-1 py-3.5 px-4 rounded-2xl bg-white/20 text-white font-bold text-sm flex items-center justify-center gap-2 active:bg-white/30 transition-all disabled:opacity-50 backdrop-blur-md border border-white/10"
                  >
                    <RotateCcw size={16} />
                    <span>Retake</span>
                  </button>

                  <button
                    onClick={handleSubmitPhoto}
                    disabled={submitting}
                    className="flex-1 py-3.5 px-4 rounded-2xl bg-[#2563eb] text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-blue-500/30"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        <span>Submit Photo</span>
                      </>
                    )}
                  </button>
                </div>
              ) : cameraActive && !cameraError ? (
                /* Shutter Button (Live Camera Only) */
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={captureFrame}
                    className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1 active:scale-95 transition-transform shadow-lg"
                    aria-label="Take Photo"
                  >
                    <div className="w-full h-full bg-white rounded-full active:bg-white/80 transition-colors" />
                  </button>
                  <span className="text-[11px] text-white/80 font-medium drop-shadow-sm">
                    Tap to Capture
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

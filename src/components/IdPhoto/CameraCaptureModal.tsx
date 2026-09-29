import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoCaptured: (file: File) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onPhotoCaptured,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedDataUrl(null);
      setErrorMsg(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setErrorMsg(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 960 },
          facingMode: 'user',
        },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setErrorMsg(
        err.name === 'NotAllowedError'
          ? '请允许浏览器访问摄像头权限后重试'
          : '未能启动摄像头，请检查设备是否连接或被其他程序占用'
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const triggerSnap = () => {
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          takeSnapshot();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Mirror image for natural selfie feel
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedDataUrl(dataUrl);
  };

  const handleConfirm = () => {
    if (!capturedDataUrl) return;
    // Convert dataUrl to File
    const arr = capturedDataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const file = new File([u8arr], `camera_portrait_${Date.now()}.jpg`, { type: mime });
    onPhotoCaptured(file);
    onClose();
  };

  const handleRetake = () => {
    setCapturedDataUrl(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-200 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">拍摄证件照人像</h3>
              <p className="text-[11px] text-stone-500">
                请端坐正视摄像头，头部对准虚线框，光线均匀无反光
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video / Snapshot Viewport */}
        <div className="relative aspect-3/4 bg-stone-900 overflow-hidden flex items-center justify-center">
          {errorMsg ? (
            <div className="p-6 text-center text-red-300 max-w-xs space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-red-400" />
              <p className="text-xs">{errorMsg}</p>
              <button
                type="button"
                onClick={startCamera}
                className="mt-3 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs rounded-lg border border-stone-700"
              >
                重新连接
              </button>
            </div>
          ) : capturedDataUrl ? (
            <img
              src={capturedDataUrl}
              alt="Snapshot"
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {/* Standard Head & Shoulder Alignment Guideline Overlay */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                {/* Head Oval Guideline */}
                <div className="w-44 h-60 border-2 border-dashed border-white/70 rounded-[50%] shadow-[0_0_12px_rgba(0,0,0,0.4)] flex flex-col items-center justify-between p-3">
                  <span className="text-[10px] text-white/90 bg-black/40 px-2 py-0.5 rounded-full font-mono mt-1">
                    头顶线
                  </span>
                  <div className="w-full border-t border-white/40 my-auto" title="眼鼻水平中心线" />
                  <span className="text-[10px] text-white/90 bg-black/40 px-2 py-0.5 rounded-full font-mono mb-1">
                    下巴线
                  </span>
                </div>

                {/* Shoulder reference curve */}
                <div className="w-68 h-20 border-t-2 border-dashed border-white/50 rounded-t-[50%] -mt-4" />
              </div>

              {/* Countdown overlay */}
              {countdown !== null && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-7xl font-black text-white animate-ping">
                    {countdown}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-4 bg-white border-t border-stone-100 flex items-center justify-between">
          <p className="text-[11px] text-stone-500">
            {capturedDataUrl ? '确认满意即可开始自动 AI 抠图' : '建议纯色墙面为背景效果更佳'}
          </p>

          <div className="flex items-center gap-2">
            {capturedDataUrl ? (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-3.5 py-2 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>重拍</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>使用照片并抠图</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={triggerSnap}
                disabled={!!errorMsg || countdown !== null}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>3秒倒计时拍摄</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

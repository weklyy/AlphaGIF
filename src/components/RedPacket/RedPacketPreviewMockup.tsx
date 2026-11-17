/**
 * WeChat Red Packet Interactive Real-time Mockup Simulation
 * Designed with Apple's clean, minimalist, high-end aesthetic (Natural Titanium, Frosted Glass, Refined Lighting)
 *
 * Provides accurate WeChat client rendering for:
 * 1. 待拆红包封面 (Authentic floating WeChat red envelope card with 957x1278 cover, 1053x1746 pendant overlay & interactive "開" button)
 * 2. 聊天消息气泡 (Realistic WeChat dialogue with 480x384 bubble pendant attached cleanly without clipping)
 * 3. 红包详情与封面故事 (Opened envelope banner + 750x1250 full immersive story card)
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Smartphone,
  MessageSquare,
  BookOpen,
  ShieldAlert,
  ChevronLeft,
  AlertTriangle,
} from 'lucide-react';
import { MaterialResult } from '../../utils/redPacketProcessor';

interface RedPacketPreviewMockupProps {
  coverResult: MaterialResult | null;
  coverVideoUrl: string | null;
  pendantResult: MaterialResult | null;
  bubbleResult: MaterialResult | null;
  storyResult: MaterialResult | null;
  senderName?: string;
  senderAvatar?: string;
  blessingText?: string;
  activeTab?: 'cover' | 'pendant' | 'bubble' | 'story' | 'presets';
  showSafeAreaGuide?: boolean;
  onToggleSafeAreaGuide?: () => void;
}

export const RedPacketPreviewMockup: React.FC<RedPacketPreviewMockupProps> = ({
  coverResult,
  coverVideoUrl,
  pendantResult,
  bubbleResult,
  storyResult,
  senderName = '微信红包创作者',
  senderAvatar = '🧧',
  blessingText = '恭喜发财，大吉大利',
  activeTab,
  showSafeAreaGuide: showSafeAreaGuideProp,
  onToggleSafeAreaGuide,
}) => {
  const [activeScreen, setActiveScreen] = useState<'envelope' | 'chat' | 'story'>('envelope');
  const [showSafeAreaGuide, setShowSafeAreaGuide] = useState<boolean>(showSafeAreaGuideProp ?? false);
  const [isOpenCoinRotating, setIsOpenCoinRotating] = useState(false);

  // Sync external safe-area guide prop when provided
  useEffect(() => {
    if (showSafeAreaGuideProp !== undefined) {
      setShowSafeAreaGuide(showSafeAreaGuideProp);
    }
  }, [showSafeAreaGuideProp]);

  // Automatically sync preview screen to active editing tab
  useEffect(() => {
    if (activeTab === 'bubble') {
      setActiveScreen('chat');
    } else if (activeTab === 'story') {
      setActiveScreen('story');
    } else if (activeTab === 'cover' || activeTab === 'pendant') {
      setActiveScreen('envelope');
    }
  }, [activeTab]);

  const handleToggleGuide = () => {
    if (onToggleSafeAreaGuide) {
      onToggleSafeAreaGuide();
    } else {
      setShowSafeAreaGuide((v) => !v);
    }
  };

  const handleOpenClick = () => {
    setIsOpenCoinRotating(true);
    setTimeout(() => {
      setIsOpenCoinRotating(false);
      setActiveScreen('story');
    }, 700);
  };

  return (
    <div className="bg-[#fbfbfd]/95 backdrop-blur-2xl rounded-3xl p-5 sm:p-6 border border-neutral-200/80 shadow-[0_12px_40px_rgba(0,0,0,0.05)] flex flex-col items-center select-none">
      {/* Top Segmented Controls: Apple Minimalist Aesthetic */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 mb-5 pb-4 border-b border-neutral-200/70">
        <div className="flex items-center p-1 bg-neutral-200/60 rounded-2xl border border-neutral-300/60 text-xs w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveScreen('envelope')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeScreen === 'envelope'
                ? 'bg-white text-neutral-900 shadow-sm font-bold'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-red-500" />
            <span>封面待拆效果</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen('chat')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeScreen === 'chat'
                ? 'bg-white text-neutral-900 shadow-sm font-bold'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>聊天气泡挂件</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen('story')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeScreen === 'story'
                ? 'bg-white text-neutral-900 shadow-sm font-bold'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>拆开与封面故事</span>
          </button>
        </div>

        {/* Safe Area Guideline Toggle */}
        <button
          type="button"
          onClick={handleToggleGuide}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border cursor-pointer ${
            showSafeAreaGuide
              ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-xs'
              : 'bg-white text-neutral-600 border-neutral-200/90 hover:bg-neutral-50'
          }`}
          title="微信官方不可遮挡区与安全设计基准线"
        >
          <ShieldAlert className={`w-3.5 h-3.5 ${showSafeAreaGuide ? 'text-amber-600' : 'text-neutral-400'}`} />
          <span>{showSafeAreaGuide ? '隐藏参考线' : '显示安全区'}</span>
        </button>
      </div>

      {/* Apple Natural Titanium / Silver Phone Chassis - Inner Screen strictly 375px standard mobile width */}
      <div className="relative w-full max-w-[391px] h-[660px] p-[2px] rounded-[50px] bg-gradient-to-b from-[#e5e5ea] via-[#d1d1d6] to-[#e5e5ea] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.12)] border border-[#d1d1d6] flex items-center justify-center">
        {/* Inner Clean Light Bezel */}
        <div className="w-full h-full p-[6px] rounded-[47px] bg-[#f5f5f7] border border-white flex flex-col items-center">
          {/* True Mobile Display Screen (Standard 375pt Mobile Viewport Benchmark) */}
          <div className="relative flex-1 w-full max-w-[375px] rounded-[41px] overflow-hidden bg-[#EDEDED] flex flex-col shadow-inner">
            {/* Minimalist Apple Status Bar */}
            <div className="relative w-full px-6 pt-2 pb-1.5 flex items-center justify-between text-[11px] font-mono text-neutral-800 z-40 bg-white/40 backdrop-blur-md">
              <span className="font-semibold tracking-tight">09:41</span>
              {/* Apple Dynamic Island Capsule */}
              <div className="w-22 h-4.5 bg-neutral-900 rounded-full flex items-center justify-end px-2">
                <div className="w-2 h-2 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-blue-500/80" />
                </div>
              </div>
              <div className="flex items-center gap-1 font-sans text-[10px] text-neutral-600">
                <span className="font-semibold">5G</span>
                <span className="font-semibold">100%</span>
              </div>
            </div>

            {/* ======================================================== */}
            {/* SCREEN 1: 待拆红包封面 (Realistic WeChat Floating Card)  */}
            {/* ======================================================== */}
            {activeScreen === 'envelope' && (
              <div className="relative flex-1 w-full overflow-hidden flex flex-col items-center justify-center bg-gradient-to-b from-[#e8e8ed] via-[#f2f2f7] to-[#e5e5ea] p-2 sm:p-4">
                {/* WeChat Chat Background Simulation Behind the Envelope Card */}
                <div className="absolute inset-0 z-0 bg-[#ededed] opacity-60 pointer-events-none" />

                {/* Ambient Soft Red Glow behind Red Envelope */}
                <div className="absolute w-56 h-80 rounded-full bg-red-400/20 blur-3xl pointer-events-none" />

                {/* Full 1053 x 1746 Frame: Envelope Card sits strictly at (96, 342, 861, 1308), Pendant overlays 1:1 */}
                <div className="relative z-10 w-[265px] sm:w-[285px] aspect-[1053/1746] flex items-center justify-center">
                  {/* 1. Authentic Floating WeChat Red Envelope Card (861 x 1308 at X:96, Y:342, crisp ~10px radius matching 36px/1053) */}
                  <div
                    className="absolute rounded-[10px] overflow-hidden shadow-[0_18px_40px_-8px_rgba(185,28,28,0.36)] border border-red-300/40 bg-gradient-to-b from-[#d93632] via-[#c92a2a] to-[#a81d1d] flex flex-col justify-between"
                    style={{
                      top: '19.59%', // 342 / 1746
                      height: '74.91%', // 1308 / 1746
                      left: '9.12%', // 96 / 1053
                      width: '81.77%', // 861 / 1053
                    }}
                  >
                    {/* Underlying Cover Image / Video (957 x 1278 = 3:4 width-fitted & top-aligned, matching cover.weixin.qq.com) */}
                    <div className="absolute inset-x-0 top-0 bottom-0 z-0 overflow-hidden bg-[#b91c1c]">
                      <div className="relative w-full aspect-[957/1278] overflow-hidden">
                        {coverVideoUrl ? (
                          <video
                            src={coverVideoUrl}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-full object-cover object-top"
                          />
                        ) : coverResult ? (
                          <img
                            src={coverResult.url}
                            alt="微信红包封面图"
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white/70 text-xs">
                            <Sparkles className="w-9 h-9 mb-2 opacity-50 text-amber-200" />
                            <span className="font-medium">957 × 1278 微信标准封面图</span>
                            <span className="text-[10px] text-white/50 mt-1">上传后将在此处呈现真实效果</span>
                          </div>
                        )}

                        {/* Gradient shading for top header legibility & smooth bottom blend into flap */}
                        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/35 via-black/10 to-transparent pointer-events-none" />
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#a81d1d]/80 to-transparent pointer-events-none" />
                      </div>
                    </div>

                    {/* Top Header & Sender Information */}
                    <div className="relative z-20 w-full pt-3.5 px-3 flex flex-col items-center text-center">
                      <div className="w-8 h-8 rounded-xl bg-white text-sm flex items-center justify-center shadow-md border-2 border-amber-200/90 mb-1">
                        {senderAvatar}
                      </div>
                      <h3 className="text-[11px] font-bold text-white drop-shadow-md">
                        {senderName}
                      </h3>
                      <p className="text-[8.5px] text-amber-200/90 font-medium drop-shadow-sm">
                        发来一个定制微信红包
                      </p>
                      <p className="text-[11px] font-bold text-white mt-0.5 drop-shadow-md tracking-wide px-2 line-clamp-2">
                        “{blessingText}”
                      </p>
                    </div>

                    {/* Authentic WeChat Envelope Curved Bottom Flap */}
                    <div className="absolute inset-x-0 bottom-0 h-[24%] pointer-events-none z-10">
                      <svg
                        viewBox="0 0 285 95"
                        preserveAspectRatio="none"
                        className="w-full h-full text-[#cf3630] drop-shadow-[0_-3px_8px_rgba(0,0,0,0.22)]"
                      >
                        <path
                          d="M 0,12 Q 142.5,68 285,12 L 285,95 L 0,95 Z"
                          fill="currentColor"
                        />
                        <path
                          d="M 0,12 Q 142.5,68 285,12"
                          fill="none"
                          stroke="#f5c97a"
                          strokeOpacity="0.45"
                          strokeWidth="1.5"
                        />
                      </svg>
                    </div>

                    {/* Golden "開" Coin Button (Centered on curved flap seam) */}
                    <div className="relative z-25 pb-5 flex flex-col items-center">
                      <button
                        type="button"
                        onClick={handleOpenClick}
                        className={`w-14 h-14 rounded-full bg-gradient-to-b from-[#ffe57f] via-[#f59e0b] to-[#b45309] text-[#78350f] font-black text-xl shadow-[0_6px_16px_rgba(0,0,0,0.32)] flex items-center justify-center border-2 border-[#fffbeb] active:scale-95 transition-all cursor-pointer ${
                          isOpenCoinRotating ? 'animate-spin scale-110' : 'hover:scale-105'
                        }`}
                        title="点击拆开红包"
                      >
                        <span>開</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Transparent Cover Pendant (1053 x 1746) Overlay — 100% faithful (no artificial CSS shadow) */}
                  {pendantResult && (
                    <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
                      <img
                        src={pendantResult.url}
                        alt="封面挂件 (1053×1746)"
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    </div>
                  )}

                  {/* 3. Safe Area Guideline Overlay (WeChat Official Exact Coordinates) */}
                  {showSafeAreaGuide && (
                    <div className="absolute inset-0 pointer-events-none z-35 text-[8px] font-bold">
                      {/* Top editable zone: 0 ~ 342px (19.59%) */}
                      <div
                        className="absolute inset-x-0 top-0 border border-dashed border-emerald-500 bg-emerald-500/12 flex items-start justify-center pt-1 text-emerald-950 font-bold"
                        style={{ height: '19.59%' }}
                      >
                        <span className="bg-white/95 px-1.5 py-0.5 rounded shadow-xs border border-emerald-300 font-mono">
                          ✅ 顶部可编辑区 (0~342px)
                        </span>
                      </div>

                      {/* Left editable wing: X 0~96, Y 342~1650 */}
                      <div
                        className="absolute border-r border-dashed border-emerald-500/80 bg-emerald-500/10"
                        style={{
                          top: '19.59%',
                          height: '74.91%',
                          left: '0%',
                          width: '9.12%',
                        }}
                      />

                      {/* Right editable wing: X 957~1053, Y 342~1650 */}
                      <div
                        className="absolute border-l border-dashed border-emerald-500/80 bg-emerald-500/10"
                        style={{
                          top: '19.59%',
                          height: '74.91%',
                          right: '0%',
                          width: '9.12%',
                        }}
                      />

                      {/* Middle envelope forbidden area: X 96~957 (81.77%), Y 342~1650 (74.91%) */}
                      <div
                        className="absolute border border-dashed border-red-400/90 bg-red-500/8 rounded-[10px] flex items-center justify-center text-red-900 font-bold"
                        style={{
                          top: '19.59%',
                          height: '74.91%',
                          left: '9.12%',
                          width: '81.77%',
                        }}
                      >
                        <span className="bg-white/95 px-2 py-0.5 rounded shadow-xs border border-red-300 text-center">
                          🚫 不可编辑主体区 (861×1308)
                        </span>
                      </div>

                      {/* Bottom editable spine zone: 1650 ~ 1746px (5.50%) */}
                      <div
                        className="absolute inset-x-0 bottom-0 border border-dashed border-emerald-500 bg-emerald-500/12 flex items-center justify-center text-emerald-950 font-bold"
                        style={{ height: '5.50%' }}
                      >
                        <span className="bg-white/95 px-1.5 py-0.2 rounded shadow-xs border border-emerald-300 font-mono text-[7px]">
                          ✅ 底部脊端区 (1650~1746px)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Cover Pendant Compliance Pill (if diagnostics alert) */}
                {pendantResult?.diagnostics && (pendantResult.diagnostics.cardIntruded ||
                  pendantResult.diagnostics.clippedEdges.top ||
                  pendantResult.diagnostics.clippedEdges.bottom ||
                  pendantResult.diagnostics.clippedEdges.left ||
                  pendantResult.diagnostics.clippedEdges.right) && (
                  <div className="relative z-20 mt-2 max-w-[330px] px-2.5 py-1.5 rounded-xl bg-amber-50/95 border border-amber-300 text-[10px] text-amber-950 flex items-center gap-1.5 shadow-2xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="leading-tight font-medium">
                      {pendantResult.diagnostics.cardIntruded
                        ? '挂件部分进入中间主体区，导出 PNG 已自动精准镂空过审；'
                        : ''}
                      {(pendantResult.diagnostics.clippedEdges.top ||
                        pendantResult.diagnostics.clippedEdges.bottom ||
                        pendantResult.diagnostics.clippedEdges.left ||
                        pendantResult.diagnostics.clippedEdges.right)
                        ? '部分图案超出 1053×1746 边界将被裁切，请适当缩小或微调位置。'
                        : ''}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* SCREEN 2: 真机 1:1 视觉预览视窗 (375pt 基准 · K=0.6 锚点映射) */}
            {/* ======================================================== */}
            {activeScreen === 'chat' && (
              <div className="flex-1 w-full overflow-hidden bg-[#EDEDED] flex flex-col text-neutral-800">
                {/* WeChat Chat Navigation Bar */}
                <div className="bg-[#EDEDED] px-3.5 py-2.5 border-b border-neutral-300/80 flex items-center justify-between text-xs font-semibold text-neutral-800 shrink-0">
                  <div className="flex items-center gap-1">
                    <ChevronLeft className="w-4 h-4" />
                    <span>微信 (375pt 真机 1:1)</span>
                  </div>
                  <span className="font-bold">好友会话</span>
                  <span className="tracking-widest">···</span>
                </div>

                {/* Chat Scrollable Content Area: Strictly 375px WeChat Chat Environment */}
                <div className="flex-1 px-3 py-4 space-y-3 overflow-y-auto flex flex-col justify-between">
                  <div className="text-center">
                    <span className="text-[10px] bg-neutral-300/90 text-neutral-700 px-2.5 py-0.5 rounded-md font-mono font-semibold">
                      真机 1:1 视觉映射 (K = 230/384 ≈ 0.6)
                    </span>
                  </div>

                  {/* Authentic WeChat Message Row with Exact 230px × 129.6px Card Entity */}
                  <div className="my-auto py-12 flex items-start justify-end gap-[14px] w-full pr-1.5">
                    {/* 红包卡片实体容器：严格锁定 width: 230px, height: 129.6px (216px * 0.6) */}
                    <div
                      className="relative shrink-0"
                      style={{
                        width: '230px',
                        height: '129.6px',
                      }}
                    >
                      {/* 微信红包卡片本体 (230px × 129.6px): 真实使用用户封面图底纹 + 暖金渐变遮罩 */}
                      <div className="w-full h-full bg-[#fa9d3b] text-white rounded-[9px] rounded-tr-[2px] overflow-hidden shadow-xs border border-[#e58a27]/80 cursor-pointer active:opacity-90 z-10 flex flex-col justify-between relative">
                        {coverResult && (
                          <>
                            <img
                              src={coverResult.url}
                              alt="红包气泡封面底图"
                              className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
                            />
                            <div
                              className="absolute inset-0 pointer-events-none"
                              style={{
                                background:
                                  'linear-gradient(90deg, rgba(229, 134, 42, 0.88) 0%, rgba(229, 134, 42, 0.65) 55%, rgba(229, 134, 42, 0.28) 100%)',
                              }}
                            />
                          </>
                        )}

                        <div className="relative z-10 p-3 flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg bg-[#e0483e] flex items-center justify-center text-base shrink-0 shadow-xs border border-amber-200/40">
                            🧧
                          </div>
                          <div className="overflow-hidden flex-1">
                            <div className="text-[13px] font-bold leading-tight truncate drop-shadow-xs">
                              {blessingText}
                            </div>
                            <div className="text-[10px] text-amber-50/90 mt-1 font-medium truncate">
                              领取红包
                            </div>
                          </div>
                        </div>

                        <div className="relative z-10 bg-white/95 text-neutral-500 text-[9px] px-3 py-1 flex items-center justify-between border-t border-black/5">
                          <span>微信红包</span>
                          <span className="text-[8px] text-amber-600 font-bold">专享气泡挂件</span>
                        </div>

                        {/* 文字及交互禁入区参考层 (x:68, y:120, w:272, h:100 -> 相对于卡片(48,96)乘0.6: left:12px, top:14.4px, w:163.2px, h:60px) */}
                        {showSafeAreaGuide && (
                          <div
                            className="absolute border border-dashed border-red-600 bg-red-600/20 rounded pointer-events-none flex items-center justify-center z-20"
                            style={{
                              left: '12px',
                              top: '14.4px',
                              width: '163.2px',
                              height: '60px',
                            }}
                          >
                            <span className="text-[7px] font-bold text-white bg-red-600/90 px-1 py-0.2 rounded">
                              🚫 文字禁入区 (272×100px)
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 气泡挂件图层叠加逻辑：整个 480×384 挂件图层以等比系数 0.6 绝对定位覆盖 (无人工 CSS drop-shadow) */}
                      {bubbleResult && (
                        <div
                          style={{
                            position: 'absolute',
                            width: '288px', // 480 * 0.6
                            height: '230.4px', // 384 * 0.6
                            left: '-28.8px', // -48 * 0.6 (卡片左边距精确对齐)
                            top: '-57.6px', // -96 * 0.6 (卡片顶边距精确对齐)
                            pointerEvents: 'none',
                            zIndex: 20,
                          }}
                        >
                          <img
                            src={bubbleResult.url}
                            alt="气泡挂件真机 1:1 叠加"
                            className="w-full h-full object-contain"
                          />

                          {/* 0.6x 参考区标线 */}
                          {showSafeAreaGuide && (
                            <div className="absolute inset-0 pointer-events-none z-30">
                              {/* 顶部挂件区 (0~96px -> 0~57.6px) */}
                              <div
                                className="absolute inset-x-0 top-0 border border-dashed border-emerald-600 bg-emerald-500/12 flex items-start justify-center pt-0.5"
                                style={{ height: '57.6px' }}
                              >
                                <span className="text-[7px] font-bold text-emerald-900 bg-white/90 px-1 rounded shadow-2xs font-mono">
                                  顶部挂件区 480×96 (57.6pt)
                                </span>
                              </div>
                              {/* 左右侧翼可编辑区 (0~48px & 432~480px -> 28.8pt) */}
                              <div
                                className="absolute border-r border-dashed border-emerald-600/70 bg-emerald-500/10"
                                style={{ left: 0, top: '57.6px', width: '28.8px', height: '129.6px' }}
                              />
                              <div
                                className="absolute border-l border-dashed border-emerald-600/70 bg-emerald-500/10"
                                style={{ right: 0, top: '57.6px', width: '28.8px', height: '129.6px' }}
                              />
                              {/* 底部装饰区 (312~384px -> top: 187.2px, height: 43.2px) */}
                              <div
                                className="absolute inset-x-0 bottom-0 border border-dashed border-emerald-600 bg-emerald-500/12 flex items-end justify-center pb-0.5"
                                style={{ height: '43.2px' }}
                              >
                                <span className="text-[7px] font-bold text-emerald-900 bg-white/90 px-1 rounded shadow-2xs font-mono">
                                  底部装饰区 480×72 (43.2pt)
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 发送者微信头像 (40px × 40px) */}
                    <div className="relative z-10 w-10 h-10 rounded-[6px] bg-red-600 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-xs">
                      {senderAvatar}
                    </div>
                  </div>

                  {/* 真机尺寸映射与视觉饱满度实时诊断卡 */}
                  <div className="p-3 bg-white/95 rounded-2xl border border-neutral-200/90 text-[11px] text-neutral-600 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-neutral-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>真机 1:1 绝对锚点渲染规格</span>
                      </div>
                      {bubbleResult && (
                        <span className="font-mono text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200 font-bold">
                          480×384 PNG · {Math.round(bubbleResult.size / 1024)}KB
                        </span>
                      )}
                    </div>
                    {bubbleResult && (() => {
                      const topW = bubbleResult.topOpaqueWidth || bubbleResult.opaqueWidth || 0;
                      const mobileW = Math.round(topW * 0.6);
                      const ratioPct = Math.round((topW / 384) * 100);
                      const isNarrow = topW > 0 && topW < 160;
                      const diag = bubbleResult.diagnostics;
                      const hasClip = diag && (diag.clippedEdges.top || diag.clippedEdges.bottom || diag.clippedEdges.left || diag.clippedEdges.right);
                      return (
                        <div className="space-y-1.5">
                          <div className={`p-2 rounded-xl border text-[10px] font-mono flex items-center justify-between ${
                            isNarrow
                              ? 'bg-amber-50 border-amber-300 text-amber-900'
                              : 'bg-neutral-50 border-neutral-200 text-neutral-700'
                          }`}>
                            <span>
                              挂件实宽: <strong>{topW}px</strong> (真机 <strong>{mobileW}pt</strong>)
                            </span>
                            <span className={`px-1.5 py-0.2 rounded font-bold ${
                              isNarrow ? 'bg-amber-200/80 text-amber-950' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              占卡片宽 {ratioPct}% {isNarrow ? '⚠️偏小' : '✓饱满'}
                            </span>
                          </div>

                          {(diag?.cardIntruded || hasClip) && (
                            <div className="p-2 rounded-xl border border-amber-300 bg-amber-50/90 text-[10px] text-amber-950 flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <span className="leading-snug">
                                {diag?.cardIntruded ? '挂件部分像素进入气泡卡片区，导出时已自动透明镂空；' : ''}
                                {hasClip ? '部分图案超出 480×384 边界将被裁切，请适当缩放或微调。' : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <p className="text-[10px] leading-relaxed text-neutral-500">
                      卡片实体 <strong>230×129.6pt</strong>，挂件图层按 <strong>0.6 倍</strong>（288×230.4pt，左偏移 -28.8pt，顶偏移 -57.6pt）精准锚定覆盖。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SCREEN 3: 拆开后详情与封面故事 (Opened & Story Card)      */}
            {/* ======================================================== */}
            {activeScreen === 'story' && (
              <div className="flex-1 w-full overflow-hidden bg-[#f5f5f7] flex flex-col text-neutral-800 overflow-y-auto">
                {/* Opened Result Arched Header (Using coverResult backdrop just like WeChat Detail Screen) */}
                <div className="bg-[#cf3333] text-white p-5 rounded-b-[32px] text-center shadow-md relative shrink-0 overflow-hidden">
                  {coverResult && (
                    <>
                      <img
                        src={coverResult.url}
                        alt="红包详情页顶部封面"
                        className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none"
                      />
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            'linear-gradient(180deg, rgba(168, 25, 25, 0.58) 0%, rgba(168, 25, 25, 0.72) 55%, rgba(140, 18, 18, 0.85) 100%)',
                        }}
                      />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveScreen('envelope')}
                    className="relative z-10 float-left text-xs text-white/95 hover:text-white flex items-center gap-0.5 cursor-pointer bg-black/25 px-2 py-0.5 rounded-lg backdrop-blur-xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>返回</span>
                  </button>
                  <div className="relative z-10 clear-both pt-1">
                    <div className="w-11 h-11 rounded-2xl bg-white text-xl mx-auto flex items-center justify-center shadow-md mb-2 text-neutral-900">
                      {senderAvatar}
                    </div>
                    <h4 className="text-xs font-bold text-white drop-shadow-xs">{senderName} 的红包</h4>
                    <p className="text-[11px] text-white/90 mt-0.5 drop-shadow-xs">{blessingText}</p>
                    <div className="mt-2 text-3xl font-black text-[#fff59d] tracking-tight drop-shadow-sm">
                      ¥ 88.88
                    </div>
                    <span className="text-[10px] text-white/80 block mt-1">已存入零钱，可直接消费</span>
                  </div>
                </div>

                {/* 750 x 1250 Cover Story Card Section */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-800">
                    <span>封面故事沉浸展示 (750×1250)</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      下拉沉浸式浏览
                    </span>
                  </div>

                  {storyResult ? (
                    <div className="rounded-2xl overflow-hidden shadow-md border border-neutral-200/80 bg-white">
                      <img
                        src={storyResult.url}
                        alt="红包封面故事"
                        className="w-full object-cover rounded-2xl"
                      />
                    </div>
                  ) : (
                    <div className="p-8 bg-white rounded-2xl border border-neutral-200 text-center text-neutral-400 text-xs">
                      待生成 750×1250 封面故事
                    </div>
                  )}

                  {/* Video Channel / Creator Link Card in Apple Minimalist Style */}
                  <div className="p-3.5 bg-white rounded-2xl border border-neutral-200/80 flex items-center justify-between text-xs text-neutral-700 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-xs font-bold border border-red-200">
                        ▶
                      </div>
                      <div>
                        <div className="font-bold text-neutral-900">关注作者视频号</div>
                        <div className="text-[10px] text-neutral-400">了解更多创作故事与品牌动态</div>
                      </div>
                    </div>
                    <span className="text-[#07c160] font-bold text-xs shrink-0">去看看 ›</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3.5 text-center text-[11px] text-neutral-400 font-medium">
        ✨ 100% 真实还原微信红包开放平台 & 客户端三屏所见即所得效果
      </div>
    </div>
  );
};

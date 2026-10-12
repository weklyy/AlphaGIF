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
  Check,
  ExternalLink,
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
  activeTab?: 'cover' | 'pendant' | 'bubble' | 'story';
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
}) => {
  const [activeScreen, setActiveScreen] = useState<'envelope' | 'chat' | 'story'>('envelope');
  const [showSafeAreaGuide, setShowSafeAreaGuide] = useState(false);
  const [isOpenCoinRotating, setIsOpenCoinRotating] = useState(false);

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
          onClick={() => setShowSafeAreaGuide((v) => !v)}
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

      {/* Apple Natural Titanium / Silver Phone Chassis */}
      <div className="relative w-[320px] sm:w-[340px] h-[640px] p-[2.5px] rounded-[50px] bg-gradient-to-b from-[#e5e5ea] via-[#d1d1d6] to-[#e5e5ea] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.12)] border border-[#d1d1d6]">
        {/* Inner Clean Light Bezel (Apple Minimalist White/Silver rim, NO dark pitch-black!) */}
        <div className="w-full h-full p-[6px] rounded-[47px] bg-[#f5f5f7] border border-white flex flex-col">
          {/* True Mobile Display Screen */}
          <div className="relative flex-1 w-full rounded-[41px] overflow-hidden bg-[#f5f5f7] flex flex-col shadow-inner">
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

                {/* Full 1053 x 1746 Frame: Envelope Card sits inside, Pendant sits gracefully above and on spine (WeChat Figure 5 Standard) */}
                <div className="relative z-10 w-[270px] sm:w-[285px] aspect-[1053/1746] h-[450px] sm:h-[475px] flex items-center justify-center">
                  
                  {/* 1. Authentic Floating WeChat Red Envelope Card (Figure 5: 861 x 1308 non-editable body starting at Y: 342px) */}
                  <div
                    className="absolute rounded-[24px] overflow-hidden shadow-[0_20px_45px_-8px_rgba(185,28,28,0.38)] border border-red-300/40 bg-gradient-to-b from-[#e53935] via-[#d32f2f] to-[#b71c1c] flex flex-col justify-between"
                    style={{
                      top: '19.59%', // exactly 342px in 1746px (Figure 5)
                      height: '74.91%', // exactly 1308px in 1746px (Figure 5)
                      left: '9.12%', // exactly 96px in 1053px (Figure 5)
                      width: '81.77%', // exactly 861px in 1053px (Figure 5)
                    }}
                  >
                    {/* Underlying Cover Image / Video (957 x 1278) */}
                    <div className="absolute inset-0 z-0 overflow-hidden">
                      {coverVideoUrl ? (
                        <video
                          src={coverVideoUrl}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : coverResult ? (
                        <img
                          src={coverResult.url}
                          alt="微信红包封面图"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white/70 text-xs">
                          <Sparkles className="w-9 h-9 mb-2 opacity-50 text-amber-200" />
                          <span className="font-medium">957 × 1278 微信标准封面图</span>
                          <span className="text-[10px] text-white/50 mt-1">上传后将在此处呈现真实效果</span>
                        </div>
                      )}

                      {/* Gradient shading for header and bottom flap legibility */}
                      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 via-black/15 to-transparent pointer-events-none" />
                      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/45 via-black/15 to-transparent pointer-events-none" />
                    </div>

                    {/* Top Header & Sender Information */}
                    <div className="relative z-20 w-full pt-3 px-3 flex flex-col items-center text-center">
                      <div className="w-9 h-9 rounded-2xl bg-white text-base flex items-center justify-center shadow-md border-2 border-amber-200/90 mb-1">
                        {senderAvatar}
                      </div>
                      <h3 className="text-xs font-bold text-white drop-shadow-md">
                        {senderName}
                      </h3>
                      <p className="text-[9px] text-amber-200/90 font-medium drop-shadow-sm">
                        发来一个定制微信红包
                      </p>
                      <p className="text-xs font-bold text-white mt-1 drop-shadow-md tracking-wide px-2 line-clamp-2">
                        “{blessingText}”
                      </p>
                    </div>

                    {/* Authentic WeChat Envelope Curved Flap Line */}
                    <div className="absolute inset-x-0 bottom-12 h-20 pointer-events-none z-10">
                      <svg
                        viewBox="0 0 285 90"
                        preserveAspectRatio="none"
                        className="w-full h-full text-[#b32727]/95 drop-shadow-[0_-3px_8px_rgba(0,0,0,0.25)]"
                      >
                        <path
                          d="M 0,0 Q 142.5,80 285,0 L 285,90 L 0,90 Z"
                          fill="currentColor"
                        />
                      </svg>
                    </div>

                    {/* Golden "開" Coin Button (Sitting gracefully on the flap joint) */}
                    <div className="relative z-25 pb-4 flex flex-col items-center">
                      <button
                        type="button"
                        onClick={handleOpenClick}
                        className={`w-15 h-15 rounded-full bg-gradient-to-b from-[#ffe57f] via-[#f59e0b] to-[#b45309] text-[#78350f] font-black text-xl shadow-[0_8px_20px_rgba(0,0,0,0.35)] flex items-center justify-center border-3 border-[#fffbeb] active:scale-95 transition-all cursor-pointer ${
                          isOpenCoinRotating ? 'animate-spin scale-110' : 'hover:scale-105'
                        }`}
                        title="点击拆开红包"
                      >
                        <span>開</span>
                      </button>
                      <span className="text-[8px] text-amber-100 mt-1 font-medium drop-shadow-sm bg-black/25 px-2 py-0.5 rounded-full backdrop-blur-xs">
                        点击「開」查看拆开详情
                      </span>
                    </div>
                  </div>

                  {/* 2. Transparent Cover Pendant (1053 x 1746) Overlay */}
                  {/* Top mascot sits directly along the envelope top edge (Y = 342px), matching Figure 2 and Figure 5 */}
                  {pendantResult && (
                    <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center animate-in fade-in">
                      <img
                        src={pendantResult.url}
                        alt="封面挂件 (图5标准)"
                        className="w-full h-full object-contain pointer-events-none drop-shadow-lg"
                      />
                    </div>
                  )}

                  {/* 3. Safe Area Guideline Overlay (WeChat Figure 5 Exact Coordinates) */}
                  {showSafeAreaGuide && (
                    <div className="absolute inset-0 pointer-events-none z-35 text-[8px] font-bold">
                      {/* Top editable zone: 342px height (0 ~ 19.59%) */}
                      <div
                        className="absolute inset-x-0 top-0 border-2 border-dashed border-emerald-400 bg-emerald-500/15 rounded-t-xl flex items-center justify-center text-emerald-950 font-bold"
                        style={{ height: '19.59%' }}
                      >
                        <span className="bg-white/95 px-2 py-0.5 rounded shadow-xs border border-emerald-300">
                          ✅ 图5：上侧可编辑区 (高342px · 探头挂靠处)
                        </span>
                      </div>

                      {/* Middle envelope forbidden area: 1308px height, 861px width (19.59% ~ 94.50%) */}
                      <div
                        className="absolute border border-dashed border-red-400/80 bg-red-500/10 rounded-xl flex items-center justify-center text-red-900 font-bold"
                        style={{
                          top: '19.59%',
                          height: '74.91%',
                          left: '9.12%',
                          width: '81.77%',
                        }}
                      >
                        <span className="bg-white/95 px-2 py-0.5 rounded shadow-xs border border-red-300">
                          🚫 图5：不可编辑区域 (1308×861 · 禁止挂件进入)
                        </span>
                      </div>

                      {/* Bottom editable spine zone: 96px height (94.50% ~ 100%) */}
                      <div
                        className="absolute inset-x-0 bottom-0 border-2 border-dashed border-emerald-400 bg-emerald-500/15 rounded-b-xl flex items-center justify-center text-emerald-950 font-bold"
                        style={{ height: '5.50%' }}
                      >
                        <span className="bg-white/95 px-2 py-0.5 rounded shadow-xs border border-emerald-300">
                          ✅ 图5：下侧可编辑区 (高96px · 脊端垂饰)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SCREEN 2: 微信红包消息气泡 (Realistic WeChat Red Packet Card - No Extra Dialogue!) */}
            {/* ======================================================== */}
            {activeScreen === 'chat' && (
              <div className="flex-1 w-full overflow-hidden bg-[#ededed] flex flex-col text-neutral-800">
                {/* WeChat Chat Navigation Bar */}
                <div className="bg-[#ededed] px-3.5 py-2.5 border-b border-neutral-300/80 flex items-center justify-between text-xs font-semibold text-neutral-800 shrink-0">
                  <div className="flex items-center gap-1">
                    <ChevronLeft className="w-4 h-4" />
                    <span>微信</span>
                  </div>
                  <span className="font-bold">好友会话</span>
                  <span className="tracking-widest">···</span>
                </div>

                {/* Chat Scrollable Content Area: Focused Purely on WeChat Red Packet Card */}
                <div className="flex-1 p-4 space-y-4 overflow-y-auto flex flex-col justify-center">
                  <div className="text-center mb-2">
                    <span className="text-[10px] bg-neutral-300/80 text-neutral-600 px-2 py-0.5 rounded-md">
                      微信红包消息展示
                    </span>
                  </div>

                  {/* Authentic WeChat Red Packet Bubble Card with Attached Pendant */}
                  <div className="flex items-start justify-end gap-2.5 w-full pr-1">
                    <div className="relative flex flex-col items-end">
                      {/* 480x384 Bubble Pendant attached cleanly to the red packet card (paws rest right on top rim) */}
                      {bubbleResult && (
                        <div className="absolute -top-[93px] right-2 w-[160px] aspect-[480/384] z-20 pointer-events-none drop-shadow-md">
                          <img
                            src={bubbleResult.url}
                            alt="气泡挂件 (趴在对话框气泡上)"
                            className="w-full h-full object-contain"
                          />

                          {/* Guide Crosshair if Safe Area is active */}
                          {showSafeAreaGuide && (
                            <div className="absolute inset-0 border border-dashed border-emerald-500 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                              <span className="text-[7px] font-bold text-emerald-800 bg-white/90 px-1 rounded shadow-2xs">
                                挂点 ({bubbleResult.anchorX ?? 240}, {bubbleResult.anchorY ?? 200})
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Authentic WeChat Red Packet Bubble Card (1:1 WeChat Client) */}
                      <div className="relative bg-[#fa9d3b] text-white rounded-2xl rounded-tr-xs overflow-hidden shadow-sm border border-[#e58a27] w-[225px] cursor-pointer active:opacity-90">
                        <div className="p-3.5 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#c23636] flex items-center justify-center text-xl shrink-0 shadow-xs border border-white/20">
                            🧧
                          </div>
                          <div className="overflow-hidden">
                            <div className="text-xs font-bold leading-tight truncate">
                              {blessingText}
                            </div>
                            <div className="text-[10px] text-amber-100/90 mt-0.5 font-medium">
                              领取专享定制红包封面
                            </div>
                          </div>
                        </div>

                        <div className="bg-white/95 text-neutral-500 text-[10px] px-3.5 py-1.5 flex items-center justify-between border-t border-amber-500/20">
                          <span>微信红包</span>
                          <span className="text-[9px] text-amber-600 font-bold">专享封面</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-xs mt-1">
                      {senderAvatar}
                    </div>
                  </div>

                  {/* Specification Callout in Apple Style */}
                  <div className="p-3 bg-white/90 rounded-2xl border border-neutral-200/90 text-[11px] text-neutral-600 space-y-1 shadow-2xs mt-4">
                    <div className="font-bold text-neutral-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>气泡挂件 (480×384) 微信官方标准</span>
                    </div>
                    <p className="text-[10px] leading-relaxed text-neutral-500">
                      微信官方规范：<strong>透明 PNG 格式</strong>，体积<strong>严格 ≤ 300KB</strong>。系统自动装配在红包卡片右上角，所见即所得，形象完整不截断。
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
                {/* Opened Result Arched Header */}
                <div className="bg-[#cf3333] text-white p-5 rounded-b-[32px] text-center shadow-md relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveScreen('envelope')}
                    className="absolute top-3 left-3 text-xs text-white/90 hover:text-white flex items-center gap-0.5 cursor-pointer bg-white/15 px-2 py-0.5 rounded-lg backdrop-blur-xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>返回</span>
                  </button>
                  <div className="w-11 h-11 rounded-2xl bg-white text-xl mx-auto flex items-center justify-center shadow-md mb-2 text-neutral-900">
                    {senderAvatar}
                  </div>
                  <h4 className="text-xs font-bold text-white/95">{senderName} 的红包</h4>
                  <p className="text-[11px] text-white/80 mt-0.5">{blessingText}</p>
                  <div className="mt-2 text-3xl font-black text-[#fff59d] tracking-tight">
                    ¥ 88.88
                  </div>
                  <span className="text-[10px] text-white/70 block mt-1">已存入零钱，可直接消费</span>
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
        ✨ Apple 极简美学设计 • 100% 真实还原微信红包客户端三屏视觉效果
      </div>
    </div>
  );
};

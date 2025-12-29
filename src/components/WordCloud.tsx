'use client';

import React, { useEffect, useRef, useState } from 'react';

interface Word {
  text: string;
  value: number;
}

interface WordCloudProps {
  words: Word[];
  width?: number;
  height?: number;
}

// 颜色数组
const colors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8B500', '#00CED1', '#FF69B4', '#32CD32', '#FF7F50',
  '#9370DB', '#20B2AA', '#FF6347', '#4169E1', '#FFD700'
];

export default function WordCloud({ words, width = 600, height = 400 }: WordCloudProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [placedWords, setPlacedWords] = useState<{
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
    rotate: number;
  }[]>([]);

  useEffect(() => {
    if (!words || words.length === 0) return;

    const maxValue = Math.max(...words.map(w => w.value));
    const minValue = Math.min(...words.map(w => w.value));
    
    const placed: typeof placedWords = [];
    const positions: { x: number; y: number; width: number; height: number }[] = [];

    // 按词频排序
    const sortedWords = [...words].sort((a, b) => b.value - a.value).slice(0, 80);

    for (let i = 0; i < sortedWords.length; i++) {
      const word = sortedWords[i];
      
      // 计算字体大小 (16-48px)
      const normalizedValue = maxValue === minValue ? 0.5 : (word.value - minValue) / (maxValue - minValue);
      const fontSize = Math.round(16 + normalizedValue * 32);
      
      // 估算词语宽度
      const estimatedWidth = word.text.length * fontSize * 0.8;
      const estimatedHeight = fontSize * 1.2;
      
      // 尝试找到合适的位置
      let placed_success = false;
      let attempts = 0;
      const maxAttempts = 100;
      
      while (!placed_success && attempts < maxAttempts) {
        // 螺旋布局 - 中心优先
        const angle = attempts * 0.5;
        const radius = attempts * 3;
        const centerX = width / 2;
        const centerY = height / 2;
        
        let x = centerX + radius * Math.cos(angle) - estimatedWidth / 2;
        let y = centerY + radius * Math.sin(angle) - estimatedHeight / 2;
        
        // 边界检查
        x = Math.max(10, Math.min(width - estimatedWidth - 10, x));
        y = Math.max(10, Math.min(height - estimatedHeight - 10, y));
        
        // 碰撞检测
        const hasCollision = positions.some(pos => {
          return !(x + estimatedWidth < pos.x || 
                   x > pos.x + pos.width || 
                   y + estimatedHeight < pos.y || 
                   y > pos.y + pos.height);
        });
        
        if (!hasCollision) {
          positions.push({ x, y, width: estimatedWidth, height: estimatedHeight });
          placed.push({
            text: word.text,
            x,
            y,
            fontSize,
            color: colors[i % colors.length],
            rotate: Math.random() > 0.7 ? (Math.random() > 0.5 ? 90 : -90) : 0
          });
          placed_success = true;
        }
        
        attempts++;
      }
    }
    
    setPlacedWords(placed);
  }, [words, width, height]);

  if (!words || words.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-100 rounded-xl"
        style={{ width, height }}
      >
        <p className="text-gray-400">暂无词云数据</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden"
      style={{ width, height }}
    >
      {placedWords.map((word, index) => (
        <span
          key={index}
          className="absolute cursor-default transition-all duration-300 hover:scale-110 font-bold"
          style={{
            left: word.x,
            top: word.y,
            fontSize: word.fontSize,
            color: word.color,
            transform: word.rotate !== 0 ? `rotate(${word.rotate}deg)` : undefined,
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap'
          }}
          title={`${word.text}`}
        >
          {word.text}
        </span>
      ))}
    </div>
  );
}

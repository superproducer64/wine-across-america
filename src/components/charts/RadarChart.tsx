import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, {
  Polygon,
  Line,
  Circle,
  Text as SvgText,
  G,
} from 'react-native-svg';
import { Colors, Fonts } from '@/theme';

interface RadarChartProps {
  scores: {
    sweetness: number | null; // null on pre-migration-006 entries; plotted as 0
    acidity: number;
    tannin: number;
    body: number;
    alcohol: number;
    intensity: number;
    finish_length: number;
  };
  size?: number;
  maxValue?: number;
  color?: string;
}

const DIMENSIONS = [
  { key: 'sweetness', label: 'Sweet' },
  { key: 'acidity', label: 'Acidity' },
  { key: 'tannin', label: 'Tannin' },
  { key: 'body', label: 'Body' },
  { key: 'alcohol', label: 'Alcohol' },
  { key: 'intensity', label: 'Intensity' },
  { key: 'finish_length', label: 'Finish' },
] as const;

type DimKey = (typeof DIMENSIONS)[number]['key'];

interface TooltipData {
  x: number;
  y: number;
  label: string;
  value: number;
}

function polarToCartesian(angle: number, radius: number, cx: number, cy: number) {
  const rad = (angle - 90) * (Math.PI / 180);
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const TOOLTIP_W = 68;
const TOOLTIP_H = 36;
const TOOLTIP_MARGIN = 6;
const FADE_IN_MS = 180;
const FADE_OUT_MS = 120;
const RING_FADE_OUT_MS = 120;
const RING_RADIUS = 9;

export function RadarChart({ scores, size = 220, maxValue = 10, color = Colors.gold }: RadarChartProps) {
  const [selected, setSelected] = useState<DimKey | null>(null);

  const labelPad = 22;
  const totalSize = size + labelPad * 2;
  const cx = totalSize / 2;
  const cy = totalSize / 2;
  const radius = size * 0.36;
  const labelRadius = size * 0.47;
  const n = DIMENSIONS.length;
  const levels = [0.25, 0.5, 0.75, 1.0];

  const gridPolygons = levels.map((level) => {
    const pts = DIMENSIONS.map((_, i) => {
      const angle = (i * 360) / n;
      const { x, y } = polarToCartesian(angle, radius * level, cx, cy);
      return `${x},${y}`;
    });
    return pts.join(' ');
  });

  const scorePoints = DIMENSIONS.map((dim, i) => {
    const angle = (i * 360) / n;
    const val = scores[dim.key] ?? 0;
    const r = (val / maxValue) * radius;
    const { x, y } = polarToCartesian(angle, r, cx, cy);
    return `${x},${y}`;
  });

  const handleSpokePress = (key: DimKey) => {
    setSelected((prev) => (prev === key ? null : key));
  };

  function computeTooltip(sel: DimKey | null): TooltipData | null {
    if (sel === null) return null;
    const idx = DIMENSIONS.findIndex((d) => d.key === sel);
    if (idx < 0) return null;
    const angle = (idx * 360) / n;
    const val = scores[sel] ?? 0;
    const r = (val / maxValue) * radius;
    const { x: dx, y: dy } = polarToCartesian(angle, r, cx, cy);
    const raw = { x: dx - TOOLTIP_W / 2, y: dy - TOOLTIP_H - TOOLTIP_MARGIN };
    return {
      x: clamp(raw.x, 2, totalSize - TOOLTIP_W - 2),
      y: clamp(raw.y, 2, totalSize - TOOLTIP_H - 2),
      label: DIMENSIONS[idx].label,
      value: val,
    };
  }

  // ── Tooltip animation ──────────────────────────────────────────────────────
  const targetTooltipRef = useRef<TooltipData | null>(null);
  const [renderedTooltip, setRenderedTooltip] = useState<TooltipData | null>(null);
  const renderedTooltipRef = useRef<TooltipData | null>(null);

  const animProgress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  function stopCurrent() {
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
  }

  function fadeIn(data: TooltipData) {
    renderedTooltipRef.current = data;
    setRenderedTooltip(data);
    animProgress.setValue(0);
    const anim = Animated.timing(animProgress, {
      toValue: 1,
      duration: FADE_IN_MS,
      useNativeDriver: true,
    });
    animationRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) animationRef.current = null;
    });
  }

  function fadeOut(onDone: () => void) {
    const anim = Animated.timing(animProgress, {
      toValue: 0,
      duration: FADE_OUT_MS,
      useNativeDriver: true,
    });
    animationRef.current = anim;
    anim.start(({ finished }) => {
      animationRef.current = null;
      if (finished) onDone();
    });
  }

  // ── Ring animation ─────────────────────────────────────────────────────────
  const ringAnim = useRef(new Animated.Value(0)).current;
  const ringAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const [renderedRingKey, setRenderedRingKey] = useState<DimKey | null>(null);
  const renderedRingKeyRef = useRef<DimKey | null>(null);
  const targetRingKeyRef = useRef<DimKey | null>(null);

  function stopRing() {
    if (ringAnimRef.current) {
      ringAnimRef.current.stop();
      ringAnimRef.current = null;
    }
  }

  function ringSpringIn(key: DimKey) {
    renderedRingKeyRef.current = key;
    setRenderedRingKey(key);
    ringAnim.setValue(0);
    const anim = Animated.spring(ringAnim, {
      toValue: 1,
      tension: 200,
      friction: 12,
      useNativeDriver: false,
    });
    ringAnimRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) ringAnimRef.current = null;
    });
  }

  function ringFadeOut(onDone: () => void) {
    const anim = Animated.timing(ringAnim, {
      toValue: 0,
      duration: RING_FADE_OUT_MS,
      useNativeDriver: false,
    });
    ringAnimRef.current = anim;
    anim.start(({ finished }) => {
      ringAnimRef.current = null;
      if (finished) onDone();
    });
  }

  // ── Combined selection effect ───────────────────────────────────────────────
  useEffect(() => {
    // Tooltip
    const nextTooltip = computeTooltip(selected);
    targetTooltipRef.current = nextTooltip;
    const currentlyShowing = renderedTooltipRef.current;

    if (!currentlyShowing && nextTooltip) {
      fadeIn(nextTooltip);
    } else if (currentlyShowing && !nextTooltip) {
      stopCurrent();
      fadeOut(() => {
        renderedTooltipRef.current = null;
        setRenderedTooltip(null);
      });
    } else if (currentlyShowing && nextTooltip) {
      stopCurrent();
      fadeOut(() => {
        const latestTarget = targetTooltipRef.current;
        if (latestTarget) {
          fadeIn(latestTarget);
        } else {
          renderedTooltipRef.current = null;
          setRenderedTooltip(null);
        }
      });
    }

    // Ring
    const nextKey = selected;
    targetRingKeyRef.current = nextKey;
    const currentRing = renderedRingKeyRef.current;

    if (!currentRing && nextKey) {
      ringSpringIn(nextKey);
    } else if (currentRing && !nextKey) {
      stopRing();
      ringFadeOut(() => {
        renderedRingKeyRef.current = null;
        setRenderedRingKey(null);
      });
    } else if (currentRing && nextKey) {
      stopRing();
      ringFadeOut(() => {
        const latest = targetRingKeyRef.current;
        if (latest) {
          ringSpringIn(latest);
        } else {
          renderedRingKeyRef.current = null;
          setRenderedRingKey(null);
        }
      });
    }
  }, [selected]);

  const tooltipAnimStyle = {
    opacity: animProgress,
    transform: [
      {
        scale: animProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.82, 1],
        }),
      },
    ],
  };

  const ringR = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, RING_RADIUS],
  });

  return (
    <View style={{ width: totalSize, height: totalSize, alignSelf: 'center' }}>
      <Svg width={totalSize} height={totalSize}>
        {/* Grid rings */}
        {gridPolygons.map((pts, i) => (
          <Polygon
            key={i}
            points={pts}
            fill="none"
            stroke={Colors.border}
            strokeWidth={0.5}
          />
        ))}

        {/* Axis lines */}
        {DIMENSIONS.map((dim, i) => {
          const angle = (i * 360) / n;
          const { x, y } = polarToCartesian(angle, radius, cx, cy);
          const isActive = selected === dim.key;
          return (
            <Line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke={isActive ? Colors.gold : Colors.border}
              strokeWidth={isActive ? 1.2 : 0.5}
            />
          );
        })}

        {/* Score polygon fill */}
        <Polygon
          points={scorePoints.join(' ')}
          fill={color + '28'}
          stroke={color}
          strokeWidth={1.5}
        />

        {/* Score dots + invisible tap targets */}
        {DIMENSIONS.map((dim, i) => {
          const angle = (i * 360) / n;
          const val = scores[dim.key] ?? 0;
          const r = (val / maxValue) * radius;
          const { x, y } = polarToCartesian(angle, r, cx, cy);
          const isActive = selected === dim.key;
          return (
            <G key={i} onPress={() => handleSpokePress(dim.key)}>
              {/* Invisible large hit target */}
              <Circle cx={x} cy={y} r={16} fill="transparent" />
              {/* Animated highlight ring — spring in, fade out */}
              {renderedRingKey === dim.key && (
                <AnimatedCircle
                  cx={x}
                  cy={y}
                  r={ringR}
                  fill={Colors.gold + '30'}
                  stroke={Colors.gold}
                  strokeWidth={1}
                  opacity={ringAnim}
                />
              )}
              {/* Score dot */}
              <Circle
                cx={x}
                cy={y}
                r={isActive ? 5 : 3.5}
                fill={color}
                stroke={Colors.surface}
                strokeWidth={1.5}
              />
            </G>
          );
        })}

        {/* Labels */}
        {DIMENSIONS.map((dim, i) => {
          const angle = (i * 360) / n;
          const { x, y } = polarToCartesian(angle, labelRadius, cx, cy);
          const textAnchor =
            x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle';
          const isActive = selected === dim.key;
          return (
            <SvgText
              key={i}
              x={x}
              y={y + 4}
              textAnchor={textAnchor}
              fontSize={isActive ? 10.5 : 9.5}
              fill={isActive ? Colors.gold : Colors.inkMuted}
              fontFamily={isActive ? Fonts.dmSansMedium : Fonts.dmSansMedium}
              fontWeight={isActive ? 'bold' : 'normal'}
            >
              {dim.label}
            </SvgText>
          );
        })}
      </Svg>

      {/* Animated tooltip overlay (outside SVG so RN Animated can drive it) */}
      {renderedTooltip && (
        <Animated.View
          style={[
            styles.tooltip,
            {
              left: renderedTooltip.x,
              top: renderedTooltip.y,
              width: TOOLTIP_W,
              height: TOOLTIP_H,
            },
            tooltipAnimStyle,
          ]}
          pointerEvents="none"
        >
          <Text style={styles.tooltipLabel}>{renderedTooltip.label}</Text>
          <Text style={styles.tooltipValue}>
            {renderedTooltip.value.toFixed(1)}
            <Text style={styles.tooltipMax}> / {maxValue}</Text>
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    backgroundColor: Colors.ink,
    borderRadius: 7,
    opacity: 0.88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  tooltipLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    opacity: 0.8,
    fontFamily: Fonts.dmSans,
    lineHeight: 13,
  },
  tooltipValue: {
    color: Colors.goldLight,
    fontSize: 13,
    fontFamily: Fonts.dmSansMedium,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  tooltipMax: {
    color: Colors.goldLight,
    fontSize: 10,
    fontWeight: 'normal',
  },
});

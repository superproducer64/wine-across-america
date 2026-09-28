import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Pressable,
  LayoutChangeEvent,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '@/theme';

export interface SliderZone {
  label: string;
  min: number;
  max: number;
  color: string;
}

interface ScoreSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  lowLabel?: string;
  highLabel?: string;
  tip?: string;
  /** Called once when the user releases the thumb (not on every move). */
  onChange: (value: number) => void;
  /** Lets a parent disable its ScrollView while the thumb is being dragged. */
  onDragStateChange?: (dragging: boolean) => void;
  accentColor?: string;
  disabled?: boolean;
  zones?: SliderZone[];
  onInfo?: () => void;
}

const ZoneBar = memo(function ZoneBar({
  zones,
  activeLabel,
}: {
  zones: SliderZone[];
  activeLabel: string | undefined;
}) {
  return (
    <View style={styles.zoneRow}>
      {zones.map((zone) => {
        const isActive = activeLabel === zone.label;
        const size = zone.max - zone.min + 1;
        return (
          <View key={zone.label} style={{ flex: size, alignItems: 'center' }}>
            <View
              style={[
                styles.zoneBand,
                { backgroundColor: zone.color, opacity: isActive ? 1 : 0.28 },
              ]}
            />
            <Text
              style={[
                styles.zoneLabel,
                {
                  color: isActive ? zone.color : Colors.inkFaint,
                  fontFamily: isActive ? Fonts.dmSansMedium : Fonts.dmSans,
                },
              ]}
              numberOfLines={1}
            >
              {zone.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

export function ScoreSlider({
  label,
  value,
  min = 1,
  max = 10,
  step = 1,
  lowLabel,
  highLabel,
  tip,
  onChange,
  onDragStateChange,
  accentColor = Colors.gold,
  disabled = false,
  zones,
  onInfo,
}: ScoreSliderProps) {
  // Local value while dragging; null means "show the committed prop value".
  // Committing only on release keeps the parent (and its radar chart) from
  // re-rendering on every move event.
  const [dragValue, setDragValue] = useState<number | null>(null);
  const displayValue = dragValue ?? value;

  // The PanResponder is created once, so everything it reads lives in a ref.
  const live = useRef({ min, max, step, disabled, onChange, onDragStateChange, value });
  live.current = { min, max, step, disabled, onChange, onDragStateChange, value };

  const trackWidth = useRef(0);
  const gesture = useRef({ startX: 0, last: value });

  useEffect(() => {
    if (dragValue === null) gesture.current.last = value;
  }, [value, dragValue]);

  const panResponder = useMemo(() => {
    const toValue = (x: number) => {
      const { min: lo, max: hi, step: st } = live.current;
      const w = trackWidth.current;
      if (w === 0) return live.current.value;
      const ratio = Math.max(0, Math.min(1, x / w));
      const stepped = Math.round((lo + ratio * (hi - lo)) / st) * st;
      return Math.max(lo, Math.min(hi, stepped));
    };
    const update = (x: number) => {
      const next = toValue(x);
      if (next !== gesture.current.last) {
        gesture.current.last = next;
        setDragValue(next);
      }
    };
    const finish = () => {
      const final = gesture.current.last;
      live.current.onDragStateChange?.(false);
      if (final !== live.current.value) live.current.onChange(final);
      setDragValue(null);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => !live.current.disabled,
      onMoveShouldSetPanResponder: () => !live.current.disabled,
      // Don't let the parent ScrollView take the gesture mid-drag.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        live.current.onDragStateChange?.(true);
        // Track children are pointerEvents="none", so locationX is always
        // relative to the hit area here. Movement is then tracked with
        // gestureState.dx, which (unlike locationX) doesn't jump when the
        // finger passes over the thumb or leaves the track.
        gesture.current.startX = evt.nativeEvent.locationX;
        gesture.current.last = live.current.value;
        update(gesture.current.startX);
      },
      onPanResponderMove: (_evt, g) => update(gesture.current.startX + g.dx),
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    });
  }, []);

  const handleTrackLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  const fillRatio = (displayValue - min) / (max - min);
  const activeZone = zones?.find((z) => displayValue >= z.min && displayValue <= z.max);
  const fillColor = disabled ? Colors.inkFaint : (activeZone?.color ?? accentColor);

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
          {onInfo && (
            <Pressable onPress={onInfo} hitSlop={10} style={styles.infoBtn}>
              <Text style={styles.infoBtnText}>ⓘ</Text>
            </Pressable>
          )}
        </View>
        <View style={[styles.valueBadge, { backgroundColor: fillColor + '22', borderColor: fillColor + '66' }]}>
          <Text style={[styles.valueText, { color: fillColor }]}>{displayValue}</Text>
        </View>
      </View>

      {tip ? <Text style={styles.tip}>{tip}</Text> : null}

      {zones && zones.length > 0 && <ZoneBar zones={zones} activeLabel={activeZone?.label} />}

      {/* Tall hit area around a thin visual track; track uses the full width */}
      <View style={styles.hitArea} onLayout={handleTrackLayout} {...panResponder.panHandlers}>
        <View pointerEvents="none" style={[styles.track, disabled && styles.trackDisabled]}>
          <View style={[styles.fill, { width: `${fillRatio * 100}%`, backgroundColor: fillColor }]} />
          {!disabled && (
            <View
              style={[
                styles.thumb,
                { left: `${fillRatio * 100}%`, backgroundColor: fillColor, borderColor: Colors.surface },
              ]}
            />
          )}
        </View>
      </View>

      {lowLabel || highLabel ? (
        <View style={styles.anchorRow}>
          <Text style={styles.anchor}>{lowLabel ?? ''}</Text>
          <Text style={[styles.anchor, styles.anchorRight]}>{highLabel ?? ''}</Text>
        </View>
      ) : null}
    </View>
  );
}

const THUMB = 22;

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },
  containerDisabled: {
    opacity: 0.55,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  label: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 14,
    color: Colors.ink,
  },
  labelDisabled: {
    color: Colors.inkMuted,
  },
  infoBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBtnText: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkFaint,
  },
  valueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  valueText: {
    fontFamily: Fonts.playfair,
    fontSize: 15,
    fontWeight: '600',
  },
  tip: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.inkMuted,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  zoneRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 2,
  },
  zoneBand: {
    height: 5,
    borderRadius: Radius.full,
    width: '100%',
    marginBottom: 3,
  },
  zoneLabel: {
    fontSize: 9,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  hitArea: {
    height: 36,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
    justifyContent: 'center',
  },
  trackDisabled: {
    borderStyle: 'dashed',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: Radius.full,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    top: -9,
    marginLeft: -THUMB / 2,
  },
  anchorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: 2,
  },
  anchor: {
    fontFamily: Fonts.dmSans,
    fontSize: 11,
    color: Colors.inkMuted,
    flexShrink: 1,
    maxWidth: '48%',
  },
  anchorRight: {
    textAlign: 'right',
  },
});

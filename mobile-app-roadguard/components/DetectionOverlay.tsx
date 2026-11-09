import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppUI';
import { useColors } from '@/hooks/useColors';
import type { PotholeBox, Severity } from '@/types';

function sizeColor(size: 'Small' | 'Medium' | 'Large', colors: ReturnType<typeof useColors>) {
  switch (size) {
    case 'Large':
      return '#EF4444'; // Red
    case 'Medium':
      return '#F97316'; // Orange
    case 'Small':
    default:
      return '#22C55E'; // Green
  }
}

export function DetectionOverlay({
  potholes = [],
}: {
  potholes?: any[];
}) {
  const colors = useColors();

  if (!potholes || potholes.length === 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {potholes.map((pothole, index) => {
        let top = 0;
        let left = 0;
        let width = 0;
        let height = 0;

        // Support Gemini box_2d: [ymin, xmin, ymax, xmax] (0..1000 scale)
        if (pothole.box_2d && Array.isArray(pothole.box_2d)) {
          const [ymin, xmin, ymax, xmax] = pothole.box_2d;
          top = (ymin / 1000) * 100;
          left = (xmin / 1000) * 100;
          width = ((xmax - xmin) / 1000) * 100;
          height = ((ymax - ymin) / 1000) * 100;
        } else if (pothole.bbox && Array.isArray(pothole.bbox)) {
          // Legacy normalized 0..1 bbox: [x, y, w, h]
          const [x, y, w, h] = pothole.bbox;
          left = x * 100;
          top = y * 100;
          width = w * 100;
          height = h * 100;
        }

        const size: 'Small' | 'Medium' | 'Large' = pothole.size || 'Medium';
        const color = sizeColor(size, colors);

        return (
          <View
            key={`pothole-${pothole.id ?? index}`}
            style={[
              styles.box,
              {
                left: `${Math.max(0, Math.min(100, left))}%`,
                top: `${Math.max(0, Math.min(100, top))}%`,
                width: `${Math.max(4, Math.min(100 - left, width))}%`,
                height: `${Math.max(4, Math.min(100 - top, height))}%`,
                borderColor: color,
              },
            ]}
          >
            <View style={[styles.label, { backgroundColor: color }]}>
              <AppText size={9} weight="bold" style={styles.labelText}>
                #{pothole.id ?? index + 1} · {size}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function DetectionPreview({
  uri,
  potholes,
}: {
  uri: string;
  potholes?: any[];
}) {
  return (
    <View style={styles.imageFrame}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <DetectionOverlay potholes={potholes} />
    </View>
  );
}

const styles = StyleSheet.create({
  imageFrame: {
    width: '100%',
    height: 280,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#151515',
    position: 'relative',
  },
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(232, 93, 4, 0.12)',
  },
  label: {
    position: 'absolute',
    top: -20,
    left: -2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
  },
  labelText: {
    color: '#FFFFFF',
  },
});

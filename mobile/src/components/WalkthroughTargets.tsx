import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Keyboard, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

export type WalkthroughTargetKey = 'feed' | 'discover' | 'post' | 'activity' | 'profile';

export interface WalkthroughRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WalkthroughTargetsValue {
  rects: Partial<Record<WalkthroughTargetKey, WalkthroughRect>>;
  registerTarget: (key: WalkthroughTargetKey, measure: () => void) => () => void;
  updateTarget: (key: WalkthroughTargetKey, rect: WalkthroughRect) => void;
  measureTargets: () => void;
}

const WalkthroughTargetsContext = createContext<WalkthroughTargetsValue | null>(null);

export function WalkthroughTargetsProvider({ children }: { children: ReactNode }) {
  const measurers = useRef(new Map<WalkthroughTargetKey, () => void>());
  const [rects, setRects] = useState<Partial<Record<WalkthroughTargetKey, WalkthroughRect>>>({});
  const dimensions = useWindowDimensions();

  const measureTargets = useCallback(() => {
    requestAnimationFrame(() => {
      measurers.current.forEach((measure) => measure());
    });
  }, []);

  const registerTarget = useCallback(
    (key: WalkthroughTargetKey, measure: () => void) => {
      measurers.current.set(key, measure);
      measureTargets();
      return () => {
        measurers.current.delete(key);
      };
    },
    [measureTargets],
  );

  const updateTarget = useCallback((key: WalkthroughTargetKey, rect: WalkthroughRect) => {
    setRects((current) => {
      const existing = current[key];
      if (
        existing &&
        existing.x === rect.x &&
        existing.y === rect.y &&
        existing.width === rect.width &&
        existing.height === rect.height
      ) {
        return current;
      }
      return { ...current, [key]: rect };
    });
  }, []);

  useEffect(() => {
    measureTargets();
  }, [dimensions.width, dimensions.height, measureTargets]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', measureTargets);
    const hide = Keyboard.addListener('keyboardDidHide', measureTargets);
    return () => {
      show.remove();
      hide.remove();
    };
  }, [measureTargets]);

  const value = useMemo(
    () => ({ rects, registerTarget, updateTarget, measureTargets }),
    [rects, registerTarget, updateTarget, measureTargets],
  );

  return (
    <WalkthroughTargetsContext.Provider value={value}>
      {children}
    </WalkthroughTargetsContext.Provider>
  );
}

export function useWalkthroughTargets() {
  const value = useContext(WalkthroughTargetsContext);
  if (!value) {
    throw new Error('useWalkthroughTargets must be used inside WalkthroughTargetsProvider');
  }
  return value;
}

export function WalkthroughTarget({
  target,
  children,
}: {
  target: WalkthroughTargetKey;
  children: ReactNode;
}) {
  const ref = useRef<View>(null);
  const { registerTarget, updateTarget } = useWalkthroughTargets();

  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) updateTarget(target, { x, y, width, height });
    });
  }, [target, updateTarget]);

  useEffect(() => registerTarget(target, measure), [measure, registerTarget, target]);

  const onLayout = (_event: LayoutChangeEvent) => {
    measure();
  };

  return (
    <View ref={ref} collapsable={false} onLayout={onLayout}>
      {children}
    </View>
  );
}

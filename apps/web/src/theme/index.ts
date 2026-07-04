import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { radius } from './radius';
import { shadows } from './shadows';
import { borders } from './borders';
import { opacity } from './opacity';
import { zIndex } from './zIndex';
import { breakpoints } from './breakpoints';
import { animations } from './animations';
import { gradients } from './gradients';

export const theme = {
    colors,
    typography,
    spacing,
    radius,
    shadows,
    borders,
    opacity,
    zIndex,
    breakpoints,
    animations,
    gradients,
} as const;

export {
    colors,
    typography,
    spacing,
    radius,
    shadows,
    borders,
    opacity,
    zIndex,
    breakpoints,
    animations,
    gradients,
};
export type ThemeType = typeof theme;

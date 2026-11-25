import { render } from '@testing-library/react-native';
import { type ReactElement } from 'react';

import { ThemeProvider } from '@/theme';

/** Renders a part or a screen inside the app's theme, as it is in the app. */
export function renderInApp(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

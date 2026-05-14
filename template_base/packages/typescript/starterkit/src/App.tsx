

import { useSelector } from 'src/store/Store';
import { ThemeSettings } from './theme/Theme';
import RTL from './layouts/full/shared/customizer/RTL';
import { AppState } from './store/Store';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { RouterProvider } from 'react-router';
import router from './routes/Router';

function App() {

  const theme = ThemeSettings();
  const customizer = useSelector((state: AppState) => state.customizer);
  return (
    <ThemeProvider theme={theme}>
      <RTL direction={customizer.activeDir}>
        <CssBaseline />
        <RouterProvider router={router} />
      </RTL>
    </ThemeProvider>
  );
}

export default App

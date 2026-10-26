import React, { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/golos-text';
import App from './App';
import './styles.css';
registerSW({
  immediate: true,
  onRegisterError(error) {
    console.warn('Автономный режим пока недоступен', error);
  },
});
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="loading-screen">
        <h1>Гардероб не открылся</h1>
        <p>
          Разрешите хранение данных сайта в браузере и перезагрузите страницу. Ваши данные не
          удаляются.
        </p>
        <button className="btn primary" onClick={() => location.reload()}>
          Попробовать снова
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

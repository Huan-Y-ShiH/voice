import React from 'react';
import './App.css';
import VoiceRecorder from './VoiceRecorder.js';
import AutoListener from './components/AutoListener.js';
import Login from './components/Login.js';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { closeWebSocket } from './utils/websocket.js';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').then((registration) => {
    console.log('Service Worker registered:', registration);
  }).catch((error) => {
    console.error('Service Worker registration failed:', error);
  });
}

function PrivateRoute({ children }) {
  const username = localStorage.getItem('username');
  const location = useLocation();
  
  if (!username) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return children;
}

// 修改后的登出函数
const handleLogout = () => {
  console.log('[系统] 用户登出流程开始');
  
  // 关闭WebSocket连接
  closeWebSocket(true);
  
  // 清除存储
  localStorage.removeItem('username');
  localStorage.removeItem('clientId');
  
  console.log('[系统] 已清除本地存储，准备跳转登录页');
  window.location.href = '/login';
};

function App() {
  return (
    <Router>
      <div className="App">
        <div className="app-container">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <div>
                    <div className="header-bar">
                      <h1 className="app-title">语音助手</h1>
                      <button 
                        className="logout-button"
                        onClick={handleLogout}
                        title="退出登录"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>
                        </svg>
                      </button>
                    </div>
                    <div className="main-content">
                      <VoiceRecorder />
                    </div>
                  </div>
                </PrivateRoute>
              }
            />
            <Route path="/auto-listener" element={
              <PrivateRoute>
                <AutoListener />
              </PrivateRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;

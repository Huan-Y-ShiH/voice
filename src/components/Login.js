import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onLoginSuccess } from '../utils/websocket.js';
import './Login.css';

function Login() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
      navigate('/');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('开始注册请求...');
      const response = await fetch('https://www.srtp.site:8080/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim() }),
      });
      
      console.log('收到服务器响应:', response.status);
      
      const data = await response.json();
      console.log('响应数据:', data);
      
      if (!response.ok) {
        throw new Error(data.detail || '注册失败');
      }

      console.log('注册成功，保存用户名...');
      localStorage.setItem('username', username.trim());
      onLoginSuccess();  // 调用websocket
      navigate('/');

    } catch (error) {
      console.error('注册失败:', error);
      if (error.message.includes('Failed to fetch')) {
        setError('无法连接到服务器，请检查服务器是否运行');
      } else if (error.message.includes('数据库错误')) {
        setError('服务器数据库错误，请稍后重试');
      } else {
        setError(error.message || '注册失败，请稍后重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <div className="login-logo">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
          </svg>
        </div>
        <h1 className="login-title">语音助手</h1>
      </div>
      
      <form onSubmit={handleSubmit} className="login-form">
        {error && <div className="error-message">{error}</div>}
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="请输入用户名"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? '正在登录...' : '登录'}
        </button>
      </form>
    </div>
  );
}

export default Login; 
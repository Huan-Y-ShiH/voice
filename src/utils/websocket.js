import { v4 as uuidv4 } from 'uuid';  // 确保已安装 uuid
import { textToSpeech as voiceRecorderTextToSpeech } from '../VoiceRecorder';

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const clientId = localStorage.getItem('clientId') || uuidv4();

// 实现必要的功能函数
const textToSpeech = (text) => {
  console.log('文字转语音:', text);
  voiceRecorderTextToSpeech(text);
};

const updateUI = (payload) => {
  console.log('更新UI:', payload);
  // TODO: 实现实际的UI更新逻辑
};

const showSystemNotification = (content) => {
  console.log('系统通知:', content);
  // TODO: 实现实际的通知逻辑
};

const handleWebSocketMessage = (message) => {
  switch(message.type) {
    case 'voice_instruction':
      textToSpeech(message.content);
      break;
    case 'ui_update':
      updateUI(message.payload);
      break;
    case 'system':
      showSystemNotification(message.content);
      break;
    default:
      console.log('未知消息类型:', message);
  }
};

export const connectWebSocket = () => {
  const username = localStorage.getItem('username');
  if (!username) {
    console.log('用户未登录，不建立WebSocket连接');
    return;
  }

  console.log('开始建立WebSocket连接...');
  console.log('用户名:', username);
  console.log('客户端ID:', clientId);

  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log('WebSocket已连接');
    return;
  }

  socket = new WebSocket(`wss://www.srtp.site:37961/ws/${clientId}`);

  socket.onopen = () => {
    console.log('WebSocket连接已建立');
    localStorage.setItem('clientId', clientId);
    reconnectAttempts = 0;
    
    const registerMessage = {
      type: 'register',
      username: username
    };
    console.log('发送注册消息:', registerMessage);
    socket.send(JSON.stringify(registerMessage));
  };

  socket.onmessage = (event) => {
    console.log('收到WebSocket消息:', event.data);
    const message = JSON.parse(event.data);
    handleWebSocketMessage(message);
  };

  socket.onclose = () => {
    console.log('WebSocket连接已断开');
    if (localStorage.getItem('username') && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      console.log(`尝试重新连接... (${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
      reconnectAttempts++;
      setTimeout(connectWebSocket, 5000);
    } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('达到最大重连次数，请刷新页面重试');
      localStorage.removeItem('username');  // 清除登录状态
      window.location.reload();  // 刷新页面
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket错误:', error);
  };
};

export const closeWebSocket = (permanent = false) => {
  if (socket) {
    console.log(`[WebSocket] 正在关闭连接${permanent ? '（永久关闭）' : ''}`);
    socket.close();
    socket = null;
    if (permanent) {
      localStorage.removeItem('clientId');
    }
  }
};

// 在页面加载时添加日志
console.log('websocket.js 已加载');
if (localStorage.getItem('username')) {
  console.log('检测到用户已登录，准备建立WebSocket连接');
  connectWebSocket();
} else {
  console.log('未检测到登录用户');
}
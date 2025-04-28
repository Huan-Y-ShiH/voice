import { v4 as uuidv4 } from 'uuid';

// 全局变量
let socket = null;
let reconnectAttempts = 0;
let isManualClose = false;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL_BASE = 2000; // 2秒基础重连间隔
const HEARTBEAT_INTERVAL = 25000; // 25秒心跳间隔
let heartbeatTimer = null;
let clientId = localStorage.getItem('clientId') || uuidv4();

// 心跳检测
const setupHeartbeat = () => {
  clearHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
        console.log('[WebSocket] 发送心跳包');
      } catch (error) {
        console.error('[WebSocket] 心跳发送失败:', error);
        reconnect();
      }
    }
  }, HEARTBEAT_INTERVAL);
};

const clearHeartbeat = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

// 重新连接逻辑
const reconnect = () => {
  if (isManualClose || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log(`[WebSocket] 停止重连，手动关闭或达到最大重试次数`);
    return;
  }

  const delay = RECONNECT_INTERVAL_BASE * Math.pow(2, reconnectAttempts);
  reconnectAttempts++;

  console.log(`[WebSocket] 将在 ${delay / 1000} 秒后尝试第 ${reconnectAttempts} 次重连...`);

  setTimeout(() => {
    if (!isManualClose) {
      connectWebSocket();
    }
  }, delay);
};

// 处理收到的消息
const handleWebSocketMessage = (message) => {
  console.log('[WebSocket] 收到消息:', message);
  
  try {
    const parsedMsg = typeof message === 'string' ? JSON.parse(message) : message;
    
    switch(parsedMsg.type) {
      case 'voice_instruction':
        textToSpeech(parsedMsg.content);
        break;
      case 'ui_update':
        updateUI(parsedMsg.payload);
        break;
      case 'system':
        showSystemNotification(parsedMsg.content);
        break;
      case 'heartbeat':
        console.log('[WebSocket] 收到心跳响应');
        break;
      default:
        console.log('[WebSocket] 未知消息类型:', parsedMsg);
    }
  } catch (error) {
    console.error('[WebSocket] 消息处理错误:', error);
  }
};

// 文字转语音函数 (需要从 VoiceRecorder.js 导入)
const textToSpeech = async (text) => {
  try {
    console.log('[WebSocket] 文字转语音:', text);
    const response = await fetch('https://www.srtp.site:8080/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
    };
    
    await audio.play();
  } catch (error) {
    console.error('[WebSocket] 文字转语音错误:', error);
  }
};

// UI更新函数
const updateUI = (payload) => {
  console.log('[WebSocket] 更新UI:', payload);
  // 实际UI更新逻辑需要根据项目需求实现
};

// 系统通知函数
const showSystemNotification = (content) => {
  console.log('[WebSocket] 系统通知:', content);
  if (Notification.permission === 'granted') {
    new Notification('语音助手通知', { body: content });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification('语音助手通知', { body: content });
      }
    });
  }
};

// 连接WebSocket
export const connectWebSocket = () => {
  const username = localStorage.getItem('username');
  if (!username) {
    console.log('[WebSocket] 用户未登录，不建立连接');
    return;
  }

  // 如果已有连接且处于OPEN或CONNECTING状态，先关闭
  if (socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.readyState)) {
    console.log('[WebSocket] 关闭现有连接');
    socket.close();
  }

  // 重置手动关闭标志
  isManualClose = false;
  reconnectAttempts = 0;

  // 确保clientId存在
  if (!clientId) {
    clientId = uuidv4();
    localStorage.setItem('clientId', clientId);
  }

  console.log(`[WebSocket] 正在连接到 wss://www.srtp.site:8080/ws/${clientId}`);
  
  try {
    socket = new WebSocket(`wss://www.srtp.site:8080/ws/${clientId}`);

    socket.onopen = () => {
      console.log('[WebSocket] 连接已建立');
      reconnectAttempts = 0;
      setupHeartbeat();

      // 发送注册消息
      const registerMessage = {
        type: 'register',
        username: username,
        clientId: clientId,
        timestamp: Date.now()
      };
      socket.send(JSON.stringify(registerMessage));
      console.log('[WebSocket] 发送注册消息:', registerMessage);
    };

    socket.onmessage = (event) => {
      try {
        handleWebSocketMessage(event.data);
      } catch (error) {
        console.error('[WebSocket] 消息处理错误:', error);
      }
    };

    socket.onclose = (event) => {
      console.log(`[WebSocket] 连接关闭，代码: ${event.code}, 原因: ${event.reason}`);
      clearHeartbeat();
      
      if (!isManualClose) {
        reconnect();
      }
    };

    socket.onerror = (error) => {
      console.error('[WebSocket] 连接错误:', error);
      clearHeartbeat();
      
      if (!isManualClose) {
        reconnect();
      }
    };

  } catch (error) {
    console.error('[WebSocket] 连接初始化错误:', error);
    reconnect();
  }
};

// 关闭WebSocket
export const closeWebSocket = (permanent = false) => {
  console.log(`[WebSocket] 正在关闭连接${permanent ? '（永久关闭）' : ''}`);
  
  isManualClose = true;
  clearHeartbeat();
  
  if (socket) {
    socket.close();
    socket = null;
  }
  
  if (permanent) {
    localStorage.removeItem('clientId');
    clientId = null;
  }
};

// 发送消息
export const sendWebSocketMessage = (message) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      const msg = typeof message === 'string' ? message : JSON.stringify(message);
      socket.send(msg);
      return true;
    } catch (error) {
      console.error('[WebSocket] 消息发送失败:', error);
      return false;
    }
  } else {
    console.warn('[WebSocket] 连接未就绪，无法发送消息');
    return false;
  }
};


// 导出 onLoginSuccess 函数
export const onLoginSuccess = () => {
  localStorage.setItem('clientId', clientId);
  connectWebSocket();
};


// 初始化
const initializeWebSocket = () => {
  console.log('[WebSocket] 初始化WebSocket模块');
  
  // 如果用户已登录，自动连接
  if (localStorage.getItem('username')) {
    console.log('[WebSocket] 检测到已登录用户，准备连接');
    connectWebSocket();
  }
  
  // 监听登录事件
  window.addEventListener('userLoggedIn', () => {
    console.log('[WebSocket] 收到用户登录事件，建立连接');
    connectWebSocket();
  });
  
  // 监听注销事件
  window.addEventListener('userLoggedOut', () => {
    console.log('[WebSocket] 收到用户注销事件，关闭连接');
    closeWebSocket(true);
  });
};

// 页面加载时初始化
window.addEventListener('DOMContentLoaded', initializeWebSocket);

// 导出API
export default {
  connect: connectWebSocket,
  close: closeWebSocket,
  send: sendWebSocketMessage,
  getStatus: () => socket ? socket.readyState : WebSocket.CLOSED,
  onLoginSuccess 
};
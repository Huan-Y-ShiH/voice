import React, { useState, useRef, useEffect } from 'react';
import './VoiceRecorder.css';
import { Link } from 'react-router-dom';

export const textToSpeech = async (text) => {
  try {
    const response = await fetch('https://www.srtp.site:8080/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const blob = await response.blob();
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    
    audio.onended = () => URL.revokeObjectURL(audioUrl);
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(err => console.log("播放中断:", err));
    }
  } catch (error) {
    console.error("文字转语音错误:", error);
    alert("语音转换失败，请重试");
  }
};

const VoiceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [transcriptionHistory, setTranscriptionHistory] = useState([]);
  const [browserSupport, setBrowserSupport] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioRef = useRef(null); // 新增：管理音频对象

  // 增强版浏览器兼容性检查
  useEffect(() => {
    const checkCompatibility = async () => {
      try {
        const isSupported = (
          navigator.mediaDevices && 
          window.MediaRecorder &&
          typeof MediaRecorder === 'function' &&
          typeof MediaRecorder.isTypeSupported === 'function'
        );
        
        // 实际测试MediaRecorder功能
        if (isSupported) {
          const testStream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
          if (testStream) {
            try {
              const testRecorder = new MediaRecorder(testStream);
              if (typeof testRecorder.start !== 'function') {
                throw new Error('MediaRecorder API not functional');
              }
              testRecorder.start();
              testRecorder.stop();
              testStream.getTracks().forEach(track => track.stop());
            } catch (e) {
              console.error('MediaRecorder test failed:', e);
              throw e;
            }
          }
        }
        
        setBrowserSupport(isSupported);
        
        if (!isSupported) {
          alert('您的浏览器不支持录音功能，请使用最新版Chrome/Edge/Safari浏览器');
        }
      } catch (error) {
        console.error('兼容性检查出错:', error);
        setBrowserSupport(false);
      }
    };
    
    checkCompatibility();
    
    // 清理函数
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      cleanupStream();
    };
  }, []);

  // 改进的录音启动函数
  const startRecording = async () => {
    if (!browserSupport || isLoading) return;

    try {
      setTranscription('');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      }).catch(err => {
        console.error("麦克风权限错误:", err);
        alert("请允许麦克风权限");
        return null;
      });

      if (!stream) return;
      
      // 清理之前的录音器
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      cleanupStream();

      streamRef.current = stream;

      // 增强的MIME类型检测
      const getSupportedMimeType = () => {
        const types = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4;codecs=mp4a',
          'audio/mp4',
          'audio/ogg;codecs=opus',
          'audio/wav',
          'audio/x-wav',
          ''
        ];
        return types.find(type => !type || MediaRecorder.isTypeSupported(type));
      };

      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};

      // 创建录音器实例
      try {
        mediaRecorderRef.current = new MediaRecorder(stream, options);
        
        // 检查是否真的创建成功
        if (typeof mediaRecorderRef.current.start !== 'function') {
          throw new Error('MediaRecorder创建失败，start方法不存在');
        }
      } catch (e) {
        console.error('MediaRecorder初始化失败:', e);
        throw new Error('无法初始化录音器');
      }

      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { 
            type: mediaRecorderRef.current.mimeType || 'audio/wav'
          });
          await uploadAudio(blob);
        } catch (error) {
          console.error('录音处理出错:', error);
        } finally {
          cleanupStream();
        }
      };

      mediaRecorderRef.current.onerror = (e) => {
        console.error('录音器错误:', e.error);
        alert(`录音出错: ${e.error.message}`);
        cleanupStream();
      };

      // 启动录音（移除timeslice参数确保兼容性）
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("录音启动失败:", error);
      alert(`录音失败: ${error.message}`);
      setIsRecording(false);
      cleanupStream();
    }
  };

  // 停止录音
  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } catch (error) {
      console.error('停止录音出错:', error);
    } finally {
      setIsRecording(false);
    }
  };

  // 清理媒体流
  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    chunksRef.current = [];
  };

  // 统一录音按钮处理
  const handleRecordButton = (e) => {
    e.preventDefault();
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // 添加转录结果到历史记录
  const addToHistory = (text, type = 'user') => {
    const newEntry = {
      id: Date.now(),
      text,
      type,
      timestamp: new Date().toLocaleTimeString(),
    };
    setTranscriptionHistory(prev => [...prev, newEntry]);
  };

  // 处理文本输入变化
  const handleInputChange = (e) => {
    setInputText(e.target.value);
  };
  
  // 处理文本提交
  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    addToHistory(text, 'assistant');
    await textToSpeech(text);
    setInputText('');
  };

  // 与FastAPI接口通信
  const sendToFastAPI = async (text) => {
    try {
      const response = await fetch('https://www.srtp.site:8080/api/transcribe', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer sk-abcdef',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result && result.response) {
        await textToSpeech(result.response);
      }
    } catch (error) {
      console.error("Error communicating with FastAPI:", error);
    }
  };

  // 上传音频文件并请求转录
  const uploadAudio = async (audioBlob) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append("model", "FunAudioLLM/SenseVoiceSmall");
    formData.append("file", audioBlob, "recording.wav");

    try {
      const response = await fetch('https://api.siliconflow.cn/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer sk-fbvnyezvojrfaypxcnrqsmwyxpmvfkpnlelhmprqzdzeawci'
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result && result.text) {
        setTranscription(result.text);
        await sendToFastAPI(result.text);
      } else {
        throw new Error('No transcription in response');
      }
    } catch (error) {
      console.error("Error uploading audio:", error);
      setTranscription('转录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="voice-recorder">
      <form onSubmit={handleTextSubmit} className="text-input-form">
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder="输入文本转换为语音..."
        />
        <button 
          type="submit" 
          disabled={!inputText.trim()}
          className="send-button"
        >
          发送
        </button>
      </form>

      <div className="controls">
        <button 
          onClick={handleRecordButton}
          onTouchEnd={handleRecordButton}
          className={isRecording ? 'recording' : ''}
          disabled={isLoading || !browserSupport}
        >
          {isRecording ? '停止录音' : '开始录音'}
        </button>
        
        <Link to="/auto-listener" className="mode-switch-button">
          监听模式
        </Link>
      </div>

      {isLoading && (
        <div className="loading">
          正在转录中...
        </div>
      )}

      <div className="chat-history">
        {transcriptionHistory.map((entry) => (
          <div key={entry.id} className={`chat-message ${entry.type}`}>
            <div className="message-content">
              <p>{entry.text}</p>
              <span className="timestamp">{entry.timestamp}</span>
            </div>
            {entry.type === 'assistant' && (
              <div className="message-actions">
                <button 
                  className={`replay-button ${isPlaying ? 'playing' : ''}`}
                  onClick={() => textToSpeech(entry.text)}
                  title="重新播放"
                  disabled={isPlaying}
                >
                  {isPlaying ? '🔊' : '🔈'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {transcription && (
        <div className="transcription">
          <div className="transcription-content">
            <div className="transcription-text">
              <p>{transcription}</p>
            </div>
            <button 
              className="confirm-button"
              onClick={() => {
                addToHistory(transcription, 'user');
                setTranscription('');
              }}
            >
              确认
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
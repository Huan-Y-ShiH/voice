import React, { useState, useRef, useEffect } from 'react';
import './AutoListener.css';
import { Link } from 'react-router-dom';

const AutoListener = () => {
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transcriptionHistory, setTranscriptionHistory] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [browserSupport, setBrowserSupport] = useState(true);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const uploadQueue = useRef([]);
  const isUploading = useRef(false);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // 浏览器兼容性检查
  useEffect(() => {
    const checkCompatibility = async () => {
      try {
        const isSupported = (
          navigator.mediaDevices && 
          (window.MediaRecorder || window.webkitMediaRecorder) &&
          typeof (window.MediaRecorder || window.webkitMediaRecorder) === 'function'
        );
        
        if (isSupported) {
          const testStream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
          if (testStream) {
            try {
              const Recorder = window.MediaRecorder || window.webkitMediaRecorder;
              const testRecorder = new Recorder(testStream);
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
          alert('您的浏览器不支持监听功能，请使用最新版Chrome/Edge/Safari浏览器');
        }
      } catch (error) {
        console.error('兼容性检查出错:', error);
        setBrowserSupport(false);
      }
    };
    
    checkCompatibility();
    
    return () => {
      stopListening();
    };
  }, []);

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

  // 发送转录结果到FastAPI
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
        addToHistory(result.response, 'assistant');
      }
    } catch (error) {
      console.error("Error communicating with FastAPI:", error);
    }
  };

  // 上传音频并请求转录（带队列管理）
  const uploadAudio = async (audioBlob) => {
    uploadQueue.current.push(audioBlob);
    if (isUploading.current) return;

    setIsLoading(true);
    isUploading.current = true;

    while (uploadQueue.current.length > 0) {
      const blob = uploadQueue.current.shift();
      try {
        const formData = new FormData();
        formData.append("model", "FunAudioLLM/SenseVoiceSmall");
        formData.append("file", blob, "recording.wav");

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
          addToHistory(result.text, 'user');
          await sendToFastAPI(result.text);
        }
      } catch (error) {
        console.error("Error uploading audio:", error);
      }
    }

    isUploading.current = false;
    setIsLoading(false);
  };

  // 开始监听
  const startListening = async () => {
    if (!browserSupport) return;

    try {
      if (isMobile) {
        alert("请点击允许麦克风权限");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: isMobile ? 16000 : 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      }).catch(err => {
        console.error("获取麦克风权限失败:", err);
        alert("请允许麦克风权限以使用监听功能");
        throw err;
      });

      // 清理之前的资源
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      streamRef.current = stream;

      // 兼容的MIME类型检测
      const getSupportedMimeType = () => {
        const types = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/wav',
          'audio/x-wav',
          ''
        ];
        return types.find(type => !type || MediaRecorder.isTypeSupported(type));
      };

      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};

      // 创建录音器实例
      const Recorder = window.MediaRecorder || window.webkitMediaRecorder;
      mediaRecorderRef.current = new Recorder(stream, options);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorderRef.current.mimeType || 'audio/wav' });
        chunksRef.current = [];
        
        // 立即开始新录音
        if (isListening) {
          startNewRecording();
        }
        
        // 异步上传
        uploadAudio(audioBlob).catch(error => {
          console.error("Upload failed:", error);
        });
      };

      mediaRecorderRef.current.onerror = (e) => {
        console.error('录音器错误:', e.error);
        alert(`录音出错: ${e.error?.message || '未知错误'}`);
        stopListening();
      };

      // 开始音频分析
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 256;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setAudioLevel(average);
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };

      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);

      // 开始第一次录音
      startNewRecording();
      setIsListening(true);
    } catch (error) {
      console.error("开始监听失败:", error);
      setIsListening(false);
    }
  };

  // 开始新的4秒录音片段
  const startNewRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'recording') {
      mediaRecorderRef.current.start();
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 4000); // 4秒录音片段
    }
  };

  // 停止监听
  const stopListening = () => {
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsListening(false);
    setAudioLevel(0);
  };

  // 切换监听状态
  const toggleListening = (e) => {
    e.preventDefault();
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="auto-listener">
      {!browserSupport && (
        <div className="browser-warning">
          <p>⚠️ 您的浏览器不支持监听功能</p>
          <p>请使用最新版Chrome/Edge/Safari浏览器</p>
        </div>
      )}

      <div className="header">
        <Link to="/" className="back-button">
          返回主页
        </Link>
      </div>
      
      <div className="voice-ball" style={{
        transform: `scale(${1 + audioLevel/255})`,
        opacity: 0.6 + audioLevel/255 * 0.4
      }}>
        <div className="inner-circle"></div>
      </div>

      <div className="status-text">
        {isListening ? '正在聆听...' : '已停止监听'}
      </div>

      <button 
        className={`listen-toggle ${isListening ? 'listening' : ''}`}
        onClick={toggleListening}
        disabled={isLoading || !browserSupport}
        style={{
          minWidth: '44px',
          minHeight: '44px',
          touchAction: 'manipulation'
        }}
      >
        {isListening ? '停止监听' : '开始监听'}
      </button>

      <div className="chat-history-container">
        <div className="chat-history">
          {transcriptionHistory.map((entry) => (
            <div key={entry.id} className={`chat-message ${entry.type}`}>
              <div className="message-content">
                <p>{entry.text}</p>
                <span className="timestamp">{entry.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="loading">
          正在处理中...
        </div>
      )}
    </div>
  );
};

export default AutoListener;
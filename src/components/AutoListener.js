import React, { useState, useRef, useEffect } from 'react';
import './AutoListener.css';
import { Link } from 'react-router-dom';

const AutoListener = () => {
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [_transcription, setTranscription] = useState('');
  const [_isLoading, setIsLoading] = useState(false);
  const [transcriptionHistory, setTranscriptionHistory] = useState([]);
  const [_isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

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
    console.log("Sending to FastAPI:", text);
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
      console.log("FastAPI response:", result);
      if (result && result.response) {
        await textToSpeech(result.response);
        addToHistory(result.response, 'assistant');
      }
    } catch (error) {
      console.error("Error communicating with FastAPI:", error);
    }
  };

  // 文字转语音
  const textToSpeech = async (text) => {
    try {
      setIsPlaying(true);
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
        setIsPlaying(false);
      };
      
      await audio.play();
    } catch (error) {
      console.error("文字转语音错误:", error);
      setIsPlaying(false);
    }
  };

  // 上传音频并请求转录
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
        addToHistory(result.text, 'user');
        await sendToFastAPI(result.text);
      }
    } catch (error) {
      console.error("Error uploading audio:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 更新音量显示
  const updateAudioLevel = (analyser) => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
      setAudioLevel(average);
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
  };

  // 开始监听
  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
        uploadAudio(audioBlob);
        chunksRef.current = [];
        if (isListening) {
          startNewRecording();
        }
      };

      updateAudioLevel(analyser);
      startNewRecording();
      setIsListening(true);
    } catch (error) {
      console.error("Error starting listening:", error);
      alert("无法访问麦克风，请确保已授予麦克风权限。");
    }
  };

  // 开始新的录音片段
  const startNewRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'recording') {
      mediaRecorderRef.current.start();
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 2000); // 每2秒录制一段
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

  // 组件挂载时自动开始监听，卸载时清理资源
  useEffect(() => {
    startListening();
    
    return () => {
      // 在组件卸载时安全地停止录音
      if (mediaRecorderRef.current) {
        // 检查状态是否为 'recording'
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        // 停止所有音轨
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="auto-listener">
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
        onClick={isListening ? stopListening : startListening}
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
    </div>
  );
};

export default AutoListener;
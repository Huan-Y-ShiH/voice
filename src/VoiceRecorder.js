import React, { useState, useRef } from 'react';
import './VoiceRecorder.css';

import { Link } from 'react-router-dom';


const VoiceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [_audioUrl, setAudioUrl] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [transcriptionHistory, setTranscriptionHistory] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const _audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

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
    // 添加到历史记录（作为对话者的消息）
    addToHistory(text, 'assistant');
    // 转换为语音并播放
    await textToSpeech(text);
    // 清空输入框
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

        // 使用FastAPI的响应进行文字转语音
        await textToSpeech(result.response);

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
        body: JSON.stringify({
          text: text
        })
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
      alert("语音转换失败，请重试");
      setIsPlaying(false);
    }
  };

  // 开始录音
  const startRecording = async () => {
    try {
      setTranscription('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(audioUrl);
        uploadAudio(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("无法访问麦克风，请确保已授予麦克风权限。");
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
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

        // 将转录结果发送到FastAPI
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
          disabled={isPlaying}
        />
        <button 
          type="submit" 
          disabled={!inputText.trim() || isPlaying}
          className="send-button"
        >
          发送
        </button>
      </form>

      <div className="controls">
        <button 
          onClick={isRecording ? stopRecording : startRecording}
          className={isRecording ? 'recording' : ''}
          disabled={isLoading || isPlaying}
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

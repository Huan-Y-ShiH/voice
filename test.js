import fetch from 'node-fetch';

const API_URL = 'http://localhost:51234/api/tts';
const TEST_TEXT = '这是一个测试文件，时长大概是3秒左右';

async function testTTS() {
  try {
    console.log(`Sending TTS request for: "${TEST_TEXT}"`);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: TEST_TEXT,
        playOnTerminal: true  
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
  } catch (error) {
    console.error("TTS Error:", error);
  }
}

// Run the test
testTTS();
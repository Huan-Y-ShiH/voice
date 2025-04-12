import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// 代理 TTS 请求
app.post('/proxy/tts', async (req, res) => {
  try {
    const response = await fetch('https://api.302.ai/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer sk-2LbK3gzLG3FmhkJzvILf8QDrruCSOCxVCr61YDf7NjI2NKdp',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "tts-1",
        input: req.body.text,
        voice: "onyx"
      })
    });

    if (!response.ok) {
      return res.status(response.status).send(`HTTP error! status: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("代理请求错误:", error);
    res.status(500).send("代理请求失败");
  }
});

const PORT = process.env.PORT ||  51234;
app.listen(PORT, () => {
  console.log(`代理服务器运行在 http://localhost:${PORT}`);
}); 
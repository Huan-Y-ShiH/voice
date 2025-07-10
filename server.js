import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';  
import { spawn } from 'child_process';
import fs from 'fs';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const bridgePath = join(__dirname, 'SDK', 'x64', 'audio_bridge.exe');
const tempDir = join(__dirname, 'temp');
const preDir = join(__dirname, 'pre');

const app = express();
let audioBridgeProcess = null;
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

// 启动音频桥接程序
function startAudioBridge() {
    // 确保pre和temp目录存在
    [tempDir, preDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });

    if (!fs.existsSync(bridgePath)) {
        console.error(`Audio bridge executable not found at: ${bridgePath}`);
        return;
    }
    
    console.log(`Starting audio bridge from: ${bridgePath}`);
    audioBridgeProcess = spawn(bridgePath, [], {
        cwd: dirname(bridgePath),
        stdio: ['ignore', 'pipe', 'pipe']
    });

    audioBridgeProcess.stdout.on('data', (data) => {
        console.log(`[Audio Bridge] ${data.toString().trim()}`);
    });

    audioBridgeProcess.stderr.on('data', (data) => {
        console.error(`[Audio Bridge Error] ${data.toString().trim()}`);
    });

    audioBridgeProcess.on('close', (code) => {
        console.log(`Audio bridge process exited with code ${code}`);
    });
}

// 停止音频桥接程序
function stopAudioBridge() {
    if (audioBridgeProcess) {
        audioBridgeProcess.kill();
    }
}

// 音频修复处理
async function fixAudio(inputBuffer) {
    const rawPath = join(preDir, `raw_${Date.now()}.mp3`);
    const fixedPath = join(tempDir, `fixed_${Date.now()}.mp3`);

    try {
        // 1. 将ArrayBuffer转为Buffer并写入pre目录
        const buffer = Buffer.from(inputBuffer);
        await writeFile(rawPath, buffer);

        // 2. 使用ffmpeg处理音频
        const ffmpegArgs = [
            '-i', rawPath,
            '-c:a', 'libmp3lame',
            '-b:a', '128k',
            '-ar', '44100', 
            '-ac', '1',
            '-y',
            fixedPath
        ];

        await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', ffmpegArgs);
            ffmpeg.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with code ${code}`)));
            ffmpeg.on('error', reject);
        });

        // 3. 读取处理后的音频文件
        return fs.readFileSync(fixedPath);

    } catch (error) {
        console.error('音频修复处理失败:', error);
        throw error;
    } finally {
        // 清理临时文件
        try { await unlink(rawPath); } catch (e) {}
        try { await unlink(fixedPath); } catch (e) {}
    }
}

app.use(cors());
app.use(express.json());

// TTS语音合成接口
app.post('/api/tts', async (req, res) => {
    try {
        const { text, playOnTerminal = false } = req.body;
        
        // 调用TTS服务
        const response = await fetch('https://api.302.ai/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer sk-2LbK3gzLG3FmhkJzvILf8QDrruCSOCxVCr61YDf7NjI2NKdp',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "tts-1",
                input: text,
                language: "zh-CN",
                voice: "onyx"
            })
        });

        if (!response.ok) {
            return res.status(response.status).send(`HTTP error! status: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // 返回音频数据
        res.set('Content-Type', 'audio/mpeg');
        res.send(buffer);
        
        // 如果需要音柱播放
        if (playOnTerminal) {
            try {
                const fixedAudio = await fixAudio(arrayBuffer);
                const outputPath = join(tempDir, `tts_${Date.now()}.mp3`);
                await writeFile(outputPath, fixedAudio);
                console.log('音频文件已保存:', outputPath);
                
            } catch (error) {
                console.error('音频播放失败:', error);
            }
        }
        
    } catch (error) {
        console.error("TTS处理失败:", error);
        res.status(500).send("TTS处理失败");
    }
});

// 启动服务器
const PORT = process.env.PORT || 51234;
app.listen(PORT, () => {
    console.log(`语音合成服务已启动: http://localhost:${PORT}`);
    startAudioBridge();
});

process.on('SIGINT', () => {
    stopAudioBridge();
    process.exit();
});

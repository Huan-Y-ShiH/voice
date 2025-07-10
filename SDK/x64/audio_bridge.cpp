#include <iostream>
#include <Windows.h>
#include <string>
#include <fstream>
#include <thread>
#include <queue>
#include <mutex>
#include <condition_variable>
#include <atomic>
#include <chrono>
#include <algorithm>
#include <vector>
#include <sstream>

using namespace std;

// 常量定义
#define LOOP_ONCE 0
#define LOOP_WEEKLY 1
#define CONFIG_FILE "audio_bridge_config.ini"

// 配置结构体
struct Config {
    vector<unsigned long> terminalIds = {13};       // 默认值
    string serverIp = "192.168.10.2";               // 默认值
} config;

// 音柱SDK函数定义
typedef bool(*initTcpNetworkManager)(int, int, char*);
typedef int(*addTimerTask)(char*, char*, unsigned int, unsigned int);
typedef void(*startTimerTask)(unsigned long);
typedef int(*stopTaskSDK)(unsigned long);
typedef void(*DelTaskSDK)(unsigned long);
typedef int(*GetTerminalInformationSDK)(unsigned long, int);

// 全局变量
HMODULE hDLL = NULL;
atomic<bool> running(true);
bool sdkInitialized = false;

// 分割字符串函数
vector<string> split(const string &s, char delimiter) {
    vector<string> tokens;
    string token;
    istringstream tokenStream(s);
    while (getline(tokenStream, token, delimiter)) {
        if (!token.empty()) {
            tokens.push_back(token);
        }
    }
    return tokens;
}

// 读取配置文件
bool readConfig() {
    ifstream file(CONFIG_FILE);
    if (!file.is_open()) {
        cerr << "Config file not found, using defaults" << endl;
        return false;
    }

    string line;
    while (getline(file, line)) {
        // 移除空格和制表符
        line.erase(remove_if(line.begin(), line.end(), ::isspace), line.end());
        
        if (line.empty() || line[0] == '#') continue;

        size_t delim = line.find('=');
        if (delim == string::npos) continue;

        string key = line.substr(0, delim);
        string value = line.substr(delim + 1);

        if (key == "TERMINAL_IDS") {
            vector<string> ids = split(value, ',');
            config.terminalIds.clear();
            for (const auto& id : ids) {
                try {
                    config.terminalIds.push_back(stoul(id));
                } catch (...) {
                    cerr << "Invalid TERMINAL_ID in config: " << id << endl;
                }
            }
        } else if (key == "SERVER_IP") {
            config.serverIp = value;
        }
    }
    file.close();
    
    if (config.terminalIds.empty()) {
        cerr << "No valid terminal IDs, using default" << endl;
        config.terminalIds = {13};
    }
    
    return true;
}

// 检查音柱连接状态
bool isTerminalConnected(unsigned long terminalId) {
    if (!hDLL) return false;
    
    GetTerminalInformationSDK getTerminalInfo = (GetTerminalInformationSDK)GetProcAddress(hDLL, "_SDK_Install_GetTerminalInformation");
    if (!getTerminalInfo) {
        cerr << "Failed to get device information function" << endl;
        return false;
    }

    int status = getTerminalInfo(terminalId, 0);
    cout << "Device " << terminalId << " status: " 
         << (status == 1 ? "Connected" : "Disconnected") << endl;
    
    return status == 1;
}

// 播放音频到指定音柱
void playAudioToTerminal(const string& filePath, unsigned long terminalId) {
    if (!sdkInitialized) {
        cerr << "SDK not initialized" << endl;
        return;
    }
    
    if (!isTerminalConnected(terminalId)) {
        cout << "Device " << terminalId << " not connected" << endl;
        return;
    }

    // 获取SDK函数
    addTimerTask addTask = (addTimerTask)GetProcAddress(hDLL, "_SDK_Install_AddTask");
    startTimerTask startTask = (startTimerTask)GetProcAddress(hDLL, "_SDK_Install_StartTask");
    stopTaskSDK stopTask = (stopTaskSDK)GetProcAddress(hDLL, "_SDK_Install_StopTask");
    DelTaskSDK delTask = (DelTaskSDK)GetProcAddress(hDLL, "_SDK_Install_DelTask");

    if (!addTask || !startTask || !stopTask || !delTask) {
        cerr << "Failed to get SDK functions" << endl;
        return;
    }

    // 构造播放参数 - 使用绝对路径
    char absolutePath[MAX_PATH];
    GetFullPathNameA(filePath.c_str(), MAX_PATH, absolutePath, NULL);
    string pathStr = string(absolutePath) + "|";
    string terminalStr = to_string(terminalId) + "|";

    cout << "Adding playback task to device " << terminalId << " for: " << pathStr << endl;
    int taskId = addTask(
        const_cast<char*>(pathStr.c_str()), 
        const_cast<char*>(terminalStr.c_str()), 
        LOOP_ONCE,
        0
    );
    
    if (taskId > 0 && taskId <= 65535) {
        cout << "Task added successfully to device " << terminalId << ", ID: " << taskId << endl;
        
        this_thread::sleep_for(chrono::milliseconds(500));
        startTask(taskId);
        
        // 根据文件大小计算播放时间
        ifstream file(filePath, ios::binary | ios::ate);
        int duration = max(5, min(180, (int)(file.tellg() / (64 * 128)))); // 估算时长
        file.close();
        
        this_thread::sleep_for(chrono::seconds(duration));
        stopTask(taskId);
        delTask(taskId);
        cout << "Playback completed on device " << terminalId << endl;
    } else {
        cerr << "Failed to add playback task to device " << terminalId << ", returned ID: " << taskId << endl;
        
        if (taskId == -1) cerr << "Error: Invalid parameters" << endl;
        else if (taskId == -2) cerr << "Error: Invalid device ID" << endl;
        else if (taskId == -3) cerr << "Error: Memory allocation failed" << endl;
    }
}

// 播放音频到所有音柱
void playAudio(const string& filePath) {
    vector<thread> threads;
    
    for (auto terminalId : config.terminalIds) {
        threads.emplace_back([filePath, terminalId]() {
            playAudioToTerminal(filePath, terminalId);
        });
    }
    
    for (auto& t : threads) {
        if (t.joinable()) t.join();
    }
}

// 监控临时文件夹
void audioWorker() {
    string tempDir = "../../temp/";
    WIN32_FIND_DATAA findData;
    HANDLE hFind;
    
    // 获取绝对路径
    char absTempDir[MAX_PATH];
    GetFullPathNameA(tempDir.c_str(), MAX_PATH, absTempDir, NULL);
    cout << "Monitoring directory: " << absTempDir << endl;

    while (running) {
        string searchPath = string(absTempDir) + "\\*.mp3";
        hFind = FindFirstFileA(searchPath.c_str(), &findData);
        if (hFind != INVALID_HANDLE_VALUE) {
            do {
                if (!(findData.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)) {
                    string filePath = string(absTempDir) + "\\" + findData.cFileName;
                    cout << "Found new audio file: " << filePath << endl;
                    
                    // 确保文件完全写入
                    long lastSize = -1;
                    do {
                        lastSize = ifstream(filePath, ios::binary | ios::ate).tellg();
                        this_thread::sleep_for(chrono::milliseconds(100));
                    } while (lastSize != ifstream(filePath, ios::binary | ios::ate).tellg());
                    
                    playAudio(filePath);
                    DeleteFileA(filePath.c_str());
                }
            } while (FindNextFileA(hFind, &findData) && running);
            FindClose(hFind);
        }
        this_thread::sleep_for(chrono::seconds(1));
    }
}

// 初始化SDK
bool initSDK() {
    hDLL = LoadLibraryA("Inline_SDK_ALL_API_X64.dll");
    if (!hDLL) {
        cerr << "Failed to load SDK DLL" << endl;
        return false;
    }

    initTcpNetworkManager tcpNetwork = (initTcpNetworkManager)GetProcAddress(hDLL, "_SDK_Install_InitNetworkManager");
    if (!tcpNetwork) {
        cerr << "Failed to get network initialization function" << endl;
        return false;
    }

    bool bResult = false;
    for (int mode : {1, 0}) { // 0=同网段, 1=跨网段
        bResult = tcpNetwork(12680, mode, const_cast<char*>(config.serverIp.c_str()));
        cout << "Trying network mode " << mode << " with server " << config.serverIp 
             << ": " << (bResult ? "Success" : "Failed") << endl;
        if (bResult) break;
    }
    
    if (!bResult) {
        cerr << "Both network modes failed" << endl;
        return false;
    }
    
    sdkInitialized = true;
    return true;
}

// 主函数
int main() {
    // 读取配置
    readConfig();
    
    cout << "=== Audio Bridge Service Started ===" << endl;
    cout << "Config: TerminalIDs=[";
    for (size_t i = 0; i < config.terminalIds.size(); ++i) {
        if (i != 0) cout << ", ";
        cout << config.terminalIds[i];
    }
    cout << "], ServerIP=" << config.serverIp << endl;

    // 设置控制台处理程序
    SetConsoleCtrlHandler([](DWORD dwCtrlType) -> BOOL {
        if (dwCtrlType == CTRL_C_EVENT) {
            cout << "\nShutting down..." << endl;
            running = false;
            return TRUE;
        }
        return FALSE;
    }, TRUE);

    // 初始化SDK
    cout << "Initializing SDK..." << endl;
    if (!initSDK()) {
        cerr << "SDK initialization failed" << endl;
        return 1;
    }
    cout << "SDK initialized successfully" << endl;

    // 启动工作线程
    thread worker(audioWorker);

    // 主循环
    while (running) {
        this_thread::sleep_for(chrono::seconds(1));
    }

    // 清理
    worker.join();
    FreeLibrary(hDLL);
    cout << "Service stopped" << endl;
    return 0;
}
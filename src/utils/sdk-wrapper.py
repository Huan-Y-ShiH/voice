from ctypes import cdll, c_int, c_bool, c_char_p
import os

class AudioPoleSDK:
    def __init__(self):
        self.is_initialized = False
        self.active_tasks = {}
        
        # 加载 DLL
        dll_path = os.path.join(os.path.dirname(__file__), '../../SDK/C++SDK_X64/Inline_SDK_ALL_API_X64.dll')
        self.sdk_lib = cdll.LoadLibrary(dll_path)
        
        # 设置函数原型
        self.sdk_lib._SDK_Install_InitNetworkManager.argtypes = [c_int, c_int, c_char_p]
        self.sdk_lib._SDK_Install_InitNetworkManager.restype = c_bool
        
        self.sdk_lib._SDK_Install_AddTask.argtypes = [c_char_p, c_char_p, c_int, c_char_p, c_char_p, c_int]
        self.sdk_lib._SDK_Install_AddTask.restype = c_int
        
        self.sdk_lib._SDK_Install_StartTask.argtypes = [c_int]
        self.sdk_lib._SDK_Install_StartTask.restype = c_bool
        
        self.sdk_lib._SDK_Install_StopTask.argtypes = [c_int]
        self.sdk_lib._SDK_Install_StopTask.restype = c_bool
        
        self.sdk_lib._SDK_Install_GetTerminalInformation.argtypes = [c_int, c_int]
        self.sdk_lib._SDK_Install_GetTerminalInformation.restype = c_int
        
        self.sdk_lib._SDK_Install_DelTask.argtypes = [c_int]
        self.sdk_lib._SDK_Install_DelTask.restype = c_bool

    def initialize(self):
        try:
            self.is_initialized = self.sdk_lib._SDK_Install_InitNetworkManager(
                12681,  # 端口
                0,      # 模式(0=默认)
                b'49.232.143.161'  # IP
            )
            
            if not self.is_initialized:
                raise Exception('SDK初始化失败')
                
            print('SDK初始化成功')
            return True
        except Exception as e:
            print('SDK初始化错误:', e)
            self.is_initialized = False
            return False

    def play_audio(self, file_path, device_id=1):
        if not self.is_initialized:
            print('SDK未初始化')
            return False

        try:
            task_id = self.sdk_lib._SDK_Install_AddTask(
                f"{file_path}|".encode('utf-8'),
                f"{device_id}|".encode('utf-8'),
                0,    # 模式(0=顺序)
                None,  # 开始时间
                None,  # 结束时间
                0      # 循环次数
            )

            if task_id <= 0:
                raise Exception(f"添加任务失败: {task_id}")

            self.active_tasks[task_id] = file_path
            success = self.sdk_lib._SDK_Install_StartTask(task_id)
            
            if not success:
                del self.active_tasks[task_id]
                raise Exception('启动任务失败')

            return task_id
        except Exception as e:
            print('播放错误:', e)
            return False

    def stop_playback(self, task_id):
        if task_id in self.active_tasks:
            self.sdk_lib._SDK_Install_StopTask(task_id)
            self.sdk_lib._SDK_Install_DelTask(task_id)
            del self.active_tasks[task_id]

    def check_device_status(self, device_id=1):
        if not self.is_initialized:
            return 'uninitialized'
        
        status = self.sdk_lib._SDK_Install_GetTerminalInformation(device_id, 0)
        return 'connected' if status == 1 else 'disconnected'

# 单例模式
audio_pole_sdk = AudioPoleSDK()
//dllTest.cpp : 此文件包含 "main" 函数。程序执行将在此处开始并结束。


#include <iostream>
#include <Windows.h>
using namespace std;

#define TCP_SERVER_PORT 12680
#define LOOP_ONCE 0             //一次性播放完当前任务后停止 
#define LOOP_WEEKLY 1           //循环播放列表曲目
#define TASK_LINK 10            //添加消防报警任务

#define  TERMINAL 22
enum { CONNECT = 0, VOLUME, TASKTYPE };

typedef bool(*initInstallSDK)(void);
typedef bool(*initTcpNetworkManager)(int, int,char *); //用于初始化SDK服务器TCP网络
typedef int(*addTimerTask)(char *, char *, unsigned int,unsigned int);
typedef int(*stopTaskSDK)(unsigned long);
typedef bool(*addSpeakTerminalSDK)(unsigned long);
typedef int(*addSpeakTask)(unsigned long);
typedef bool(*StopSpeaktSDK)();
typedef int(*addAcquisitionTask)(unsigned long, unsigned long);
typedef int(*addLinkTask)(char *, char *, unsigned int, int port);
typedef int(*addTaskFile)(unsigned long, char *);
typedef int(*addTaskTerminal)(unsigned long, unsigned int);
typedef int(*addTTSSDK)(char *, char *, int, int, int);
typedef void(*startTimerTask)(unsigned long);
typedef bool(*startServerIntercom)(unsigned long);
typedef bool(*stopServerIntercom)(unsigned long);
typedef bool(*addUserSDK)(char *, char *, char *);
typedef int(*GetTerminalInformationSDK)(unsigned long, int type);
typedef void(*CscanSDK)(char *IP, char *);
typedef void(*ScanTerminalInfoSDK)(void);
typedef int(*getMP3DurationSDK)(char *);
typedef bool(*updateTaskSDK)(unsigned long);
typedef void(*DelTaskSDK)(unsigned long);
typedef bool(*getIntercomStateSDK)(unsigned long &, int &);
typedef void(*setTerminalIPSDK)(unsigned long, char *);
typedef bool(*StartTerminalIntercomSDK)(unsigned long, unsigned long);
typedef bool(*StopTerminalIntercomSDK)(unsigned long, unsigned long);
typedef void(*StartTerminalGroupSDK)(unsigned long, char *);
typedef void(*StopTerminalGroupSDK)(unsigned long);
typedef void(*ShutDownSDK)(void);
typedef void(*SetVolumeSDK)(unsigned long, unsigned long);
typedef void(*BindNetworkSDK)(char *);
typedef void(*addGroup)(char *);
typedef void(*RenameGroup)(char *,char *);
typedef void(*DelGroup)(char *);
typedef void(*AddGroupTerminalSDK)(char *, unsigned long);
typedef void(*DelTerminal)(unsigned long);
typedef void(*NextPlayMusicTask)(unsigned long);
typedef bool(*PauseTask)(unsigned long);
typedef bool(*StartSpeakSDK)(unsigned long);
typedef void(*DelUserSDK)(char*);

int main()
{
	unsigned long dwID;
	int a = 0; //用于键盘输出，让整个程序不退出

	HMODULE hDLL = LoadLibraryA("Inline_SDK_ALL_API_X64.dll"); //加载动态库
	if (hDLL != NULL)
	{
			printf("开始初始化SDK\r\n");
			initTcpNetworkManager tcpNetwork = initTcpNetworkManager(GetProcAddress(hDLL, "_SDK_Install_InitNetworkManager")); //加载提供的API函数
			if (tcpNetwork != NULL)
			{
				printf("Init tcpNetwork\r\n");
				bool bResult = tcpNetwork(12680, 1, "192.168.10.2");  //初始化服务器TCP网络
				if (bResult)
					printf("网络初始化成功！\r\n");
				else
					printf("网络初始化失败！\r\n");
			}
			else
				printf("initTcpNetworkManager error \r\n");

// 			////////////////////////////调节音量代码////////////////////////////////////////////
// 			SetVolumeSDK setVolume = SetVolumeSDK(GetProcAddress(hDLL, "_SDK_Install_SetVolume"));
// 			setVolume(TERMINAL,2);
// 			Sleep(100);
// // 			////////////////////////////获取设备信息代码////////////////////////////////////////////
// 			GetTerminalInformationSDK getterminalinfor = GetTerminalInformationSDK(GetProcAddress(hDLL, "_SDK_Install_GetTerminalInformation"));
//  			int dwConnect = getterminalinfor(TERMINAL, 0);
// 			int dwVolume = getterminalinfor(TERMINAL, 1);
// 			int dwTaskType = getterminalinfor(TERMINAL, 2);
//  			printf("设备%d号的链接状态为:%d\r\n",TERMINAL,dwConnect);
// 			printf("设备%d号的音量大小为:%d\r\n", TERMINAL, dwVolume);
// 			printf("设备%d号的任务类型为:%d\r\n", TERMINAL, dwTaskType);
// 			Sleep(100);
// // 			////////////////////////////添加播放音乐代码////////////////////////////////////////////
    			addTimerTask addTask = addTimerTask(GetProcAddress(hDLL, "_SDK_Install_AddTask"));
   			startTimerTask starttask = startTimerTask(GetProcAddress(hDLL, "_SDK_Install_StartTask"));
   			int dwID = addTask("C:/Users/86198/Desktop/SDK_V1.08/123.mp3|", "13|", LOOP_WEEKLY, 0); //添加一个音乐任务
  			Sleep(500);
 			if (dwID!=NULL&&dwID<=65535)
 			{
 				printf("开始执行播放任务\r\n");
 				starttask(dwID);
 			}
 			Sleep(30000);
// 			PauseTask pausetask = PauseTask(GetProcAddress(hDLL, "_SDK_Install_PauseTask"));
// 			printf("暂停任务中\r\n");
// 			pausetask(dwID);
// 			Sleep(2000);
// 
// 			printf("继续执行任务\r\n");
// 			starttask(dwID);
// 			Sleep(10000);
// 
// 			stopTaskSDK stoptask = stopTaskSDK(GetProcAddress(hDLL, "_SDK_Install_StopTask"));
// 			printf("停止任务\r\n");
// 			stoptask(dwID);
// 
// 			DelTaskSDK deltask = DelTaskSDK(GetProcAddress(hDLL, "_SDK_Install_DelTask"));
// 			deltask(dwID);
// 			printf("删除任务\r\n");
			/////////////////////////////////指定任务中添加设备代码/////////////////////////////
//  			addTaskTerminal addterminal = addTaskTerminal(GetProcAddress(hDLL, "_SDK_Install_AddTerminalID"));
//  			addterminal(dwID, 55);
// 			Sleep(50);

			// 			NextPlayMusicTask nextPlayTask = NextPlayMusicTask(GetProcAddress(hDLL, "_SDK_Install_nextPlayMusicTask"));
			// 			nextPlayTask(dwID);
			///////////////////////////////////////实时寻呼////////////////////////////////
// 			addSpeakTerminalSDK speakterminal = addSpeakTerminalSDK(GetProcAddress(hDLL,"_SDK_Install_AddSpeakTerminal"));
// 			bool addterminal = speakterminal(22);
// 			if (addterminal)
// 			{
// 				StartSpeakSDK startspeak = StartSpeakSDK(GetProcAddress(hDLL, "_SDK_Install_StartSpeak"));
// 				startspeak(8000);
// 			}
// 			Sleep(20000);
// 			StopSpeaktSDK stopspeak = StopSpeaktSDK(GetProcAddress(hDLL, "_SDK_Install_StopSpeakt"));
// 			stopspeak();

		    ///////////////////////////////////////语音合成//////////////////////////////////////
			//addTTSSDK addtts = addTTSSDK(GetProcAddress(hDLL, "_SDK_Install_addTTS"));
			//int dwtts = addtts("美国数码科技媒体Apple Insider网站近日报道称，\
			//	来自美国德克萨斯州的男子罗伯特·富兰克林近日将苹果公司告上法庭，原因是在2019年，\
			//	他的iPhone 6手机出现电池爆炸事故。", "22|", 1, 50, 2);
			//if (dwtts != NULL && dwtts <= 65535)
			//{
			//	printf("添加语音合成任务成功，下面开始执行任务\r\n");
			//	starttask(dwtts);
			//}
				//////////////////////////////////////////添加用户////////////////////////////////////////
		// 		addUserSDK adduser = addUserSDK(GetProcAddress(hDLL, "_SDK_Install_addUser"));
		// 		bool b_addUser = adduser("123", "123", "22|");
		// 		if (!b_addUser)
		// 		{
		// 			DelUserSDK delUser = DelUserSDK(GetProcAddress(hDLL, "_SDK_Install_delUser"));
		// 			delUser("123");
		// 		}
				/////////////////////////////////////////添加群组/////////////////////////////////////////
		// 		DelGroup delgroup = DelGroup(GetProcAddress(hDLL, "_SDK_Install_delGroup"));
		// 		delgroup("123");
		// 		addGroup addgroup = addGroup(GetProcAddress(hDLL, "_SDK_Install_addGroup"));
		// 		addgroup("123");
		// 		RenameGroup renamegroup = RenameGroup(GetProcAddress(hDLL, "_SDK_Install_renameGroup"));
		// 		renamegroup("123", "456");

				/////////////////////////////////////////向群组中添加终端设备////////////////////////////
		// 		AddGroupTerminalSDK addgroupterminal = AddGroupTerminalSDK(GetProcAddress(hDLL, "_SDK_Install_addTerminal"));
		// 		addgroupterminal("123", 22);
				/////////////////////////////////////////删除终端设备////////////////////////////
		// 		DelTerminal delterminal = DelTerminal(GetProcAddress(hDLL, "_SDK_Install_delTerminal"));
		// 		delterminal(22);
				////////////////////////////////////////添加子组////////////////////////////////////////

	}
	else
		printf("HANDEL ERROR\r\n");

	scanf("%d", &a);//让SDK不退出
}

